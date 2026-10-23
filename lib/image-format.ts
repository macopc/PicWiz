import { AppError } from "./domain";

export const IMAGE_LIMITS = {
  bytes: 25 * 1024 * 1024,
  pixels: 40_000_000,
  edge: 16_384,
  normalizedEdge: 4096,
  dataUrlLength: 2_500_000,
} as const;

export type RasterType = "image/png" | "image/jpeg" | "image/webp";

export function rasterType(bytes: Uint8Array): RasterType | null {
  if (
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

export function validDimensions(
  width: number,
  height: number,
  edge: number = IMAGE_LIMITS.edge,
): boolean {
  return (
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= edge &&
    height <= edge &&
    width * height <= IMAGE_LIMITS.pixels
  );
}

// Check declared dimensions before asking the browser to allocate a decoded image.
export function declaredDimensions(
  bytes: Uint8Array,
  type: RasterType,
): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === "image/png" && bytes.length >= 24) {
    if (String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (type === "image/jpeg") {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 255) return null;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (
        marker === 0x01 ||
        marker === 0xd8 ||
        (marker >= 0xd0 && marker <= 0xd7)
      )
        continue;
      if (offset + 2 > bytes.length) return null;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) return null;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        length >= 8
      ) {
        return {
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
        };
      }
      offset += length;
    }
  }
  if (type === "image/webp") {
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const chunk = String.fromCharCode(...bytes.slice(offset, offset + 4));
      const length = view.getUint32(offset + 4, true);
      const data = offset + 8;
      if (data + length > bytes.length) return null;
      const uint24 = (at: number) =>
        bytes[at] + (bytes[at + 1] << 8) + (bytes[at + 2] << 16);
      if (chunk === "VP8X" && length >= 10)
        return { width: uint24(data + 4) + 1, height: uint24(data + 7) + 1 };
      if (
        chunk === "VP8 " &&
        length >= 10 &&
        bytes[data + 3] === 0x9d &&
        bytes[data + 4] === 0x01 &&
        bytes[data + 5] === 0x2a
      ) {
        return {
          width: view.getUint16(data + 6, true) & 0x3fff,
          height: view.getUint16(data + 8, true) & 0x3fff,
        };
      }
      if (chunk === "VP8L" && length >= 5 && bytes[data] === 0x2f) {
        const bits = view.getUint32(data + 1, true);
        return {
          width: (bits & 0x3fff) + 1,
          height: ((bits >>> 14) & 0x3fff) + 1,
        };
      }
      offset = data + length + (length % 2);
    }
  }
  return null;
}

export function isRasterDataUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > IMAGE_LIMITS.dataUrlLength)
    return false;
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match || match[2].length % 4 !== 0) return false;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++)
      bytes[index] = binary.charCodeAt(index);
    const type = rasterType(bytes);
    if (type !== match[1]) return false;
    const size = declaredDimensions(bytes, type);
    return (
      size !== null &&
      validDimensions(size.width, size.height, IMAGE_LIMITS.normalizedEdge)
    );
  } catch {
    return false;
  }
}

export function assertImageDimensions(width: number, height: number): void {
  if (!validDimensions(width, height)) {
    throw new AppError(
      "image_dimensions",
      "Choose an image with at most 40 megapixels and 16,384 pixels per edge.",
    );
  }
}
