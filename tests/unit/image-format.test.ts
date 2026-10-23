import { describe, expect, it } from "vitest";
import {
  declaredDimensions,
  isRasterDataUrl,
  rasterType,
  validDimensions,
} from "../../lib/image-format";

function webp(chunk: string, data: number[]) {
  const bytes = new Uint8Array(20 + data.length + (data.length % 2));
  bytes.set([82, 73, 70, 70], 0);
  bytes.set([87, 69, 66, 80], 8);
  bytes.set(
    [...chunk].map((char) => char.charCodeAt(0)),
    12,
  );
  const view = new DataView(bytes.buffer);
  view.setUint32(4, bytes.length - 8, true);
  view.setUint32(16, data.length, true);
  bytes.set(data, 20);
  return bytes;
}

describe("bounded raster headers", () => {
  it("reads JPEG dimensions past application metadata and recognizes progressive frames", () => {
    const bytes = new Uint8Array([
      255, 216, 255, 224, 0, 4, 0, 0, 255, 194, 0, 11, 8, 1, 44, 2, 88, 1, 1,
      17, 0,
    ]);
    expect(rasterType(bytes)).toBe("image/jpeg");
    expect(declaredDimensions(bytes, "image/jpeg")).toEqual({
      width: 600,
      height: 300,
    });
    expect(declaredDimensions(bytes.slice(0, 12), "image/jpeg")).toBeNull();
  });

  it("recognizes lossy, lossless, and extended WebP dimensions", () => {
    const lossy = webp("VP8 ", [0, 0, 0, 0x9d, 1, 0x2a, 128, 2, 224, 1]);
    expect(rasterType(lossy)).toBe("image/webp");
    expect(declaredDimensions(lossy, "image/webp")).toEqual({
      width: 640,
      height: 480,
    });
    const bits = (479 << 14) | 639;
    const lossless = webp("VP8L", [
      0x2f,
      bits & 255,
      (bits >>> 8) & 255,
      (bits >>> 16) & 255,
      (bits >>> 24) & 255,
    ]);
    expect(declaredDimensions(lossless, "image/webp")).toEqual({
      width: 640,
      height: 480,
    });
    const extended = webp("VP8X", [0, 0, 0, 0, 127, 2, 0, 223, 1, 0]);
    expect(declaredDimensions(extended, "image/webp")).toEqual({
      width: 640,
      height: 480,
    });
    expect(declaredDimensions(extended.slice(0, -1), "image/webp")).toBeNull();
  });

  it("checks edge and pixel limits independently and includes exact boundaries", () => {
    expect(validDimensions(8000, 5000)).toBe(true);
    expect(validDimensions(8000, 5001)).toBe(false);
    expect(validDimensions(16_384, 1)).toBe(true);
    expect(validDimensions(16_385, 1)).toBe(false);
    expect(validDimensions(1.5, 2)).toBe(false);
    expect(validDimensions(0, 1)).toBe(false);
  });

  it("rejects stored data with swapped MIME, invalid base64, or oversized declared dimensions", () => {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    bytes.set([73, 72, 68, 82], 12);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 4096);
    view.setUint32(20, 2048);
    const encode = () => Buffer.from(bytes).toString("base64");
    expect(isRasterDataUrl(`data:image/png;base64,${encode()}`)).toBe(true);
    expect(isRasterDataUrl(`data:image/jpeg;base64,${encode()}`)).toBe(false);
    expect(isRasterDataUrl("data:image/png;base64,%%%%")).toBe(false);
    view.setUint32(16, 50_000);
    expect(isRasterDataUrl(`data:image/png;base64,${encode()}`)).toBe(false);
    expect(rasterType(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
