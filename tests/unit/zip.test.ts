import { crc32 } from "node:zlib";
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createZip } from "../../lib/zip";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Independent reader checks CRC and offsets explicitly; fflate alone does not.
function inspect(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  expect(view.getUint16(end + 4, true)).toBe(0);
  expect(view.getUint16(end + 6, true)).toBe(0);
  expect(view.getUint16(end + 20, true)).toBe(0);
  const count = view.getUint16(end + 10, true);
  expect(view.getUint16(end + 8, true)).toBe(count);
  let central = view.getUint32(end + 16, true);
  expect(central + view.getUint32(end + 12, true)).toBe(end);
  let expectedOffset = 0;
  const entries = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(central, true)).toBe(0x02014b50);
    expect(view.getUint16(central + 8, true)).toBe(0x0800);
    expect(view.getUint16(central + 10, true)).toBe(0);
    const nameLength = view.getUint16(central + 28, true);
    expect(view.getUint16(central + 30, true)).toBe(0);
    expect(view.getUint16(central + 32, true)).toBe(0);
    const local = view.getUint32(central + 42, true);
    expect(local).toBe(expectedOffset);
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    expect(view.getUint16(local + 6, true)).toBe(0x0800);
    expect(view.getUint16(local + 8, true)).toBe(0);
    expect(view.getUint16(local + 10, true)).toBe(0);
    expect(view.getUint16(local + 12, true)).toBe(0x0021);
    expect(view.getUint16(local + 26, true)).toBe(nameLength);
    expect(view.getUint16(local + 28, true)).toBe(0);
    const name = decoder.decode(bytes.subarray(central + 46, central + 46 + nameLength));
    expect(decoder.decode(bytes.subarray(local + 30, local + 30 + nameLength))).toBe(name);
    const size = view.getUint32(central + 24, true);
    expect(view.getUint32(central + 20, true)).toBe(size);
    expect(view.getUint32(local + 18, true)).toBe(size);
    expect(view.getUint32(local + 22, true)).toBe(size);
    const start = local + 30 + nameLength;
    const data = bytes.subarray(start, start + size);
    const checksum = crc32(data);
    if (checksum !== view.getUint32(central + 16, true) || checksum !== view.getUint32(local + 14, true))
      throw new Error("CRC mismatch");
    entries.push({ name, data, checksum, start, local, central });
    expectedOffset = start + size;
    central += 46 + nameLength;
  }
  expect(central).toBe(end);
  expect(expectedOffset).toBe(view.getUint32(end + 16, true));
  return entries;
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("stored ZIP32", () => {
  it("matches known CRC32 vectors, independent headers/offsets, and fflate contents", async () => {
    const inputs = [
      { name: "empty.txt", blob: new Blob([]) },
      { name: "vectors/123456789.txt", blob: new Blob(["123456789"]) },
      { name: "图像/é.png", blob: new Blob([Uint8Array.of(137, 80, 78, 71, 0, 255)]) },
      { name: "picwiz-manifest.json", blob: new Blob(['{"app":"picwiz"}']) },
    ];
    const zip = await createZip(inputs);
    expect(zip.type).toBe("application/zip");
    const bytes = new Uint8Array(await zip.arrayBuffer());
    const entries = inspect(bytes);
    expect(entries[0].checksum).toBe(0);
    expect(entries[1].checksum).toBe(0xcbf43926);
    const extracted = unzipSync(bytes);
    for (const input of inputs)
      expect(extracted[input.name]).toEqual(new Uint8Array(await input.blob.arrayBuffer()));
    expect(entries.map((entry) => entry.name)).toEqual(inputs.map((input) => input.name));
    expect(new Uint8Array(await (await createZip(inputs)).arrayBuffer())).toEqual(bytes);
  });

  it("detects mutated payload and CRC fields independently of decompression", async () => {
    const bytes = new Uint8Array(await (await createZip([{ name: "a", blob: new Blob(["123456789"]) }])).arrayBuffer());
    const [entry] = inspect(bytes);
    const payload = bytes.slice();
    payload[entry.start] ^= 1;
    expect(() => inspect(payload)).toThrow("CRC mismatch");
    const localCrc = bytes.slice();
    localCrc[entry.local + 14] ^= 1;
    expect(() => inspect(localCrc)).toThrow("CRC mismatch");
    const centralCrc = bytes.slice();
    centralCrc[entry.central + 16] ^= 1;
    expect(() => inspect(centralCrc)).toThrow("CRC mismatch");
  });

  it("accepts exact archive limits and rejects one byte over before reading data", async () => {
    const entry = { name: "a", blob: new Blob(["x"]) };
    const read = vi.spyOn(entry.blob, "slice");
    const bytes = 22 + 30 + 1 + 1 + 46 + 1;
    expect((await createZip([entry], { maxBytes: bytes })).size).toBe(bytes);
    read.mockClear();
    await expect(createZip([entry], { maxBytes: bytes - 1 })).rejects.toMatchObject({ code: "zip_limit" });
    expect(read).not.toHaveBeenCalled();
    const cap = 65 * 1024 * 1024;
    const overhead = 22 + 30 + 1 + 46 + 1;
    const large = new Blob([new Uint8Array(cap - overhead)]);
    expect((await createZip([{ name: "a", blob: large }])).size).toBe(cap);
    const tooLarge = new Blob([large, "x"]);
    const untouched = vi.spyOn(tooLarge, "slice");
    await expect(createZip([{ name: "a", blob: tooLarge }], { maxBytes: cap + 1 })).rejects.toMatchObject({ code: "zip_limit" });
    expect(untouched).not.toHaveBeenCalled();
  });

  it("never reads a whole large entry or archive and limits slices to 1 MiB", async () => {
    const blob = new Blob([new Uint8Array(2 * 1024 * 1024 + 17)]);
    const whole = vi.spyOn(blob, "arrayBuffer");
    const slice = vi.spyOn(blob, "slice");
    const zip = await createZip([{ name: "large.png", blob }]);
    expect(whole).not.toHaveBeenCalled();
    expect(slice.mock.calls).toEqual([[0, 1048576], [1048576, 2097152], [2097152, blob.size]]);
    expect(unzipSync(new Uint8Array(await zip.arrayBuffer()))["large.png"].length).toBe(blob.size);
  });

  it("checks cancellation before work, after reads, and after timer yields", async () => {
    const early = new AbortController(); early.abort();
    const blob = new Blob(["x"]);
    const slice = vi.spyOn(blob, "slice");
    await expect(createZip([{ name: "x", blob }], { signal: early.signal })).rejects.toMatchObject({ code: "cancelled" });
    expect(slice).not.toHaveBeenCalled();
    const controller = new AbortController();
    vi.spyOn(blob, "slice").mockImplementation(() => ({ arrayBuffer: async () => { controller.abort(); return encoder.encode("x").buffer; } }) as Blob);
    await expect(createZip([{ name: "x", blob }], { signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
    vi.restoreAllMocks();
    vi.useFakeTimers();
    const afterYield = new AbortController();
    const pending = createZip([{ name: "x", blob: new Blob(["x"]) }], { signal: afterYield.signal });
    const rejected = expect(pending).rejects.toMatchObject({ code: "cancelled" });
    // The native read runs outside fake timers; wait until its timer yield is armed.
    for (let i = 0; i < 20 && !vi.getTimerCount(); i++) await Promise.resolve();
    afterYield.abort();
    await vi.runAllTimersAsync();
    await rejected;
  });

  it("rejects malformed paths, duplicates, entries, and limits", async () => {
    for (const name of ["", "../x", "/root", "x//y", "x/./y", "x/../y", "x\\y", "C:/x", "x\u0000", "x/", "\ud800"])
      await expect(createZip([{ name, blob: new Blob(["x"]) }])).rejects.toMatchObject({ code: "zip_path" });
    await expect(createZip([{ name: "a", blob: new Blob([]) }, { name: "a", blob: new Blob([]) }])).rejects.toMatchObject({ code: "zip_path" });
    await expect(createZip([{ name: "x".repeat(65536), blob: new Blob([]) }])).rejects.toMatchObject({ code: "zip_path" });
    await expect(createZip([])).rejects.toMatchObject({ code: "zip_entries" });
    await expect(createZip([{ name: "a", blob: {} as Blob }])).rejects.toMatchObject({ code: "zip_entries" });
    for (const maxBytes of [-1, 1.5, Infinity, NaN])
      await expect(createZip([{ name: "x", blob: new Blob([]) }], { maxBytes })).rejects.toMatchObject({ code: "zip_limit" });
  });

  it("normalizes read rejection and refuses incomplete slices", async () => {
    const blob = new Blob(["abc"]);
    vi.spyOn(blob, "slice").mockImplementation(() => ({ arrayBuffer: () => Promise.reject(new Error("disk failed")) }) as Blob);
    await expect(createZip([{ name: "x", blob }])).rejects.toMatchObject({ code: "zip_failed" });
    vi.spyOn(blob, "slice").mockImplementation(() => new Blob(["a"]));
    await expect(createZip([{ name: "x", blob }])).rejects.toMatchObject({ code: "zip_failed" });
  });
});
