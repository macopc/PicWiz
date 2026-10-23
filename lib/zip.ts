import { AppError } from "./domain";

export type ZipEntry = { name: string; blob: Blob };
export type ZipOptions = { signal?: AbortSignal; maxBytes?: number };

const MAX_BYTES = 65 * 1024 * 1024;
const SLICE_BYTES = 1024 * 1024;
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++)
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new AppError("cancelled", "ZIP preparation was cancelled.");
}

async function checksum(blob: Blob, signal?: AbortSignal): Promise<number> {
  let crc = 0xffffffff;
  for (let offset = 0; offset < blob.size; offset += SLICE_BYTES) {
    checkAbort(signal);
    const length = Math.min(SLICE_BYTES, blob.size - offset);
    const buffer = await blob.slice(offset, offset + length).arrayBuffer();
    checkAbort(signal);
    if (buffer.byteLength !== length)
      throw new AppError("zip_failed", "A ZIP entry could not be read fully.");
    for (const byte of new Uint8Array(buffer))
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
    // Timer yields let clicks and AbortSignal delivery run between bounded reads.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    checkAbort(signal);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pathBytes(name: string): Uint8Array<ArrayBuffer> {
  if (
    typeof name !== "string" ||
    !name ||
    /[\u0000-\u001f\u007f\\:]/.test(name) ||
    name.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new AppError("zip_path", "ZIP entries need safe relative file paths.");
  const bytes = new TextEncoder().encode(name);
  if (bytes.length > 0xffff || new TextDecoder().decode(bytes) !== name)
    throw new AppError("zip_path", "A ZIP entry name is too long.");
  return bytes;
}

/** Stored ZIP32; layout reference: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT */
export async function createZip(
  entries: ZipEntry[],
  options: ZipOptions = {},
): Promise<Blob> {
  checkAbort(options.signal);
  if (!Array.isArray(entries) || entries.length === 0 || entries.length >= 0xffff)
    throw new AppError("zip_entries", "Choose valid files to package.");
  const requested = options.maxBytes ?? MAX_BYTES;
  if (!Number.isSafeInteger(requested) || requested < 0)
    throw new AppError("zip_limit", "The ZIP byte limit is invalid.");
  const maxBytes = Math.min(requested, MAX_BYTES);
  const names = new Set<string>();
  let total = 22;
  const prepared = entries.map((entry) => {
    if (!entry || !(entry.blob instanceof Blob))
      throw new AppError("zip_entries", "A ZIP entry is invalid.");
    const name = pathBytes(entry.name);
    if (names.has(entry.name))
      throw new AppError("zip_path", "ZIP entry names must be unique.");
    names.add(entry.name);
    total += 30 + name.length + entry.blob.size + 46 + name.length;
    if (!Number.isSafeInteger(total) || total > maxBytes)
      throw new AppError("zip_limit", "The ZIP exceeds the archive byte limit.");
    return { name, blob: entry.blob };
  });

  const localParts: BlobPart[] = [];
  const directoryParts: BlobPart[] = [];
  let localOffset = 0;
  let directorySize = 0;
  try {
    for (const { name, blob } of prepared) {
      checkAbort(options.signal);
      const crc = await checksum(blob, options.signal);
      checkAbort(options.signal);
      const local = new Uint8Array(30 + name.length);
      const header = new DataView(local.buffer);
      header.setUint32(0, 0x04034b50, true);
      header.setUint16(4, 20, true);
      header.setUint16(6, 0x0800, true);
      header.setUint16(12, 0x0021, true); // 1980-01-01, deterministic DOS date.
      header.setUint32(14, crc, true);
      header.setUint32(18, blob.size, true);
      header.setUint32(22, blob.size, true);
      header.setUint16(26, name.length, true);
      local.set(name, 30);
      localParts.push(local, blob);

      const central = new Uint8Array(46 + name.length);
      const record = new DataView(central.buffer);
      record.setUint32(0, 0x02014b50, true);
      record.setUint16(4, 20, true);
      record.setUint16(6, 20, true);
      record.setUint16(8, 0x0800, true);
      record.setUint16(14, 0x0021, true);
      record.setUint32(16, crc, true);
      record.setUint32(20, blob.size, true);
      record.setUint32(24, blob.size, true);
      record.setUint16(28, name.length, true);
      record.setUint32(42, localOffset, true);
      central.set(name, 46);
      directoryParts.push(central);
      localOffset += local.length + blob.size;
      directorySize += central.length;
    }
    checkAbort(options.signal);
    const end = new Uint8Array(22);
    const record = new DataView(end.buffer);
    record.setUint32(0, 0x06054b50, true);
    record.setUint16(8, prepared.length, true);
    record.setUint16(10, prepared.length, true);
    record.setUint32(12, directorySize, true);
    record.setUint32(16, localOffset, true);
    // PNG blobs are reused as parts; no whole-archive ArrayBuffer is created.
    const archive = new Blob([...localParts, ...directoryParts, end], {
      type: "application/zip",
    });
    if (archive.size !== total || archive.size > maxBytes)
      throw new AppError("zip_limit", "The ZIP exceeds the archive byte limit.");
    checkAbort(options.signal);
    return archive;
  } catch (error) {
    checkAbort(options.signal);
    if (error instanceof AppError) throw error;
    throw new AppError("zip_failed", "The ZIP could not be prepared. Try again.");
  }
}
