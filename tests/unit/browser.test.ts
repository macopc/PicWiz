import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canvasToPng,
  copyPng,
  downloadPng,
  importImage,
  loadImage,
  type ClipboardAdapter,
  type DownloadAdapter,
  type ImageAdapter,
} from "../../lib/browser";
import { IMAGE_LIMITS } from "../../lib/image-format";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0b8AAAAASUVORK5CYII=";
const PNG = new Blob([new Uint8Array([137, 80, 78, 71])], {
  type: "image/png",
});

function pngFile(width = 1200, height = 800, type = "image/png") {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], "Screenshot.png", { type });
}

function fakeImages(
  width = 1200,
  height = 800,
  mode: "success" | "error" | "hang" = "success",
) {
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage })),
    toDataURL: vi.fn((_type: string, _quality?: number) => PIXEL),
  };
  const images: {
    naturalWidth: number;
    naturalHeight: number;
    onload: (() => void) | null;
    onerror: (() => void) | null;
    removeAttribute: ReturnType<typeof vi.fn>;
  }[] = [];
  const adapter: ImageAdapter = {
    createImage: vi.fn(() => {
      const image = {
        naturalWidth: images.length === 0 ? width : canvas.width,
        naturalHeight: images.length === 0 ? height : canvas.height,
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        removeAttribute: vi.fn(),
        set src(_value: string) {
          if (mode !== "hang")
            queueMicrotask(() =>
              mode === "error" ? image.onerror?.() : image.onload?.(),
            );
        },
      };
      images.push(image);
      return image as unknown as HTMLImageElement;
    }),
    createCanvas: vi.fn(() => canvas as unknown as HTMLCanvasElement),
    createObjectURL: vi.fn(() => "blob:local-image"),
    revokeObjectURL: vi.fn(),
    timeoutMs: 20,
  };
  return { adapter, canvas, images, drawImage };
}

function fakeClipboard(write?: ClipboardAdapter["write"]): ClipboardAdapter & {
  write: ReturnType<typeof vi.fn>;
  createItem: ReturnType<typeof vi.fn>;
} {
  return {
    createItem: vi.fn((data) => ({ data }) as unknown as ClipboardItem),
    write: vi.fn(
      write ??
        (async (items) => {
          await (items[0] as unknown as { data: Record<string, Promise<Blob>> })
            .data["image/png"];
        }),
    ),
    supports: (type) => type === "image/png",
    timeoutMs: 20,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("local image import", () => {
  it("checks signatures and MIME before creating object URLs or decoding", async () => {
    const { adapter } = fakeImages();
    await expect(
      importImage(
        new File(["<svg onload=alert(1)/>"], "image.png", {
          type: "image/png",
        }),
        adapter,
      ),
    ).rejects.toMatchObject({ code: "image_type" });
    await expect(
      importImage(pngFile(100, 100, "image/jpeg"), adapter),
    ).rejects.toMatchObject({ code: "image_type" });
    await expect(
      importImage(new File([], "empty.png", { type: "image/png" }), adapter),
    ).rejects.toMatchObject({ code: "image_empty" });
    expect(adapter.createObjectURL).not.toHaveBeenCalled();
    expect(adapter.createImage).not.toHaveBeenCalled();
  });

  it("rejects byte, megapixel, and edge limits before decoding", async () => {
    const { adapter } = fakeImages();
    const oversized = {
      size: IMAGE_LIMITS.bytes + 1,
      arrayBuffer: vi.fn(),
    } as unknown as File;
    await expect(importImage(oversized, adapter)).rejects.toMatchObject({
      code: "image_size",
    });
    expect(oversized.arrayBuffer).not.toHaveBeenCalled();
    await expect(
      importImage(pngFile(10_000, 5000), adapter),
    ).rejects.toMatchObject({ code: "image_dimensions" });
    await expect(
      importImage(pngFile(16_385, 1), adapter),
    ).rejects.toMatchObject({ code: "image_dimensions" });
    expect(adapter.createImage).not.toHaveBeenCalled();
  });

  it("normalizes a 4K-plus image locally and releases its original object URL", async () => {
    const { adapter, canvas, images, drawImage } = fakeImages(8000, 4000);
    const result = await importImage(pngFile(8000, 4000), adapter);
    expect(result).toMatchObject({
      width: 4096,
      height: 2048,
      name: "Screenshot.png",
      dataUrl: PIXEL,
    });
    expect(result.image).toBe(images[1]);
    expect(drawImage).toHaveBeenCalledWith(images[0], 0, 0, 4096, 2048);
    expect(canvas.toDataURL).toHaveBeenCalledExactlyOnceWith("image/png");
    expect(adapter.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:local-image",
    );
    expect(images[0].removeAttribute).toHaveBeenCalledWith("src");
  });

  it("resizes high-entropy sources when quality reduction cannot meet the stored data limit", async () => {
    const { adapter, canvas, drawImage } = fakeImages(4096, 2048);
    const tooLarge = `data:image/webp;base64,${"A".repeat(IMAGE_LIMITS.dataUrlLength)}`;
    canvas.toDataURL.mockImplementation(() =>
      canvas.width === 4096 ? tooLarge : PIXEL,
    );
    const result = await importImage(pngFile(4096, 2048), adapter);
    expect(result.width).toBe(3276);
    expect(result.height).toBe(1638);
    expect(result.dataUrl.length).toBeLessThanOrEqual(
      IMAGE_LIMITS.dataUrlLength,
    );
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(canvas.toDataURL.mock.calls[0][0]).toBe("image/png");
    expect(
      canvas.toDataURL.mock.calls.some(([type]) => type === "image/webp"),
    ).toBe(true);
    expect(canvas.toDataURL.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("keeps the original resolution when WebP compression alone fits local storage", async () => {
    const { adapter, canvas } = fakeImages(4096, 2048);
    const oversized = `data:image/png;base64,${"A".repeat(IMAGE_LIMITS.dataUrlLength)}`;
    canvas.toDataURL.mockImplementation((type) =>
      type === "image/png" ? oversized : PIXEL,
    );
    const result = await importImage(pngFile(4096, 2048), adapter);
    expect(result).toMatchObject({ width: 4096, height: 2048, dataUrl: PIXEL });
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/webp", 0.9);
  });

  it("cleans up after decoder failure and normalizes encoding errors", async () => {
    const failing = fakeImages(1200, 800, "error");
    await expect(importImage(pngFile(), failing.adapter)).rejects.toMatchObject(
      { code: "image_decode" },
    );
    expect(failing.adapter.revokeObjectURL).toHaveBeenCalledOnce();
    const encoding = fakeImages();
    encoding.canvas.toDataURL.mockImplementation(() => {
      throw new Error("canvas broke");
    });
    await expect(
      importImage(pngFile(), encoding.adapter),
    ).rejects.toMatchObject({ code: "image_encode" });
    expect(encoding.adapter.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("bounds decoding time and rejects remote URLs when restoring local state", async () => {
    vi.useFakeTimers();
    const { adapter, images } = fakeImages(1200, 800, "hang");
    const importing = importImage(pngFile(), adapter);
    const rejected = expect(importing).rejects.toMatchObject({
      code: "image_timeout",
    });
    await vi.advanceTimersByTimeAsync(21);
    await rejected;
    expect(images[0].removeAttribute).toHaveBeenCalledWith("src");
    expect(adapter.revokeObjectURL).toHaveBeenCalledOnce();
    await expect(
      loadImage("https://example.com/image.png", adapter),
    ).rejects.toMatchObject({ code: "image_type" });
    await expect(
      loadImage("data:image/svg+xml;base64,PHN2Zy8+", adapter),
    ).rejects.toMatchObject({ code: "image_type" });
  });

  it("does not trust dimensions returned by a decoder after valid header checks", async () => {
    const { adapter } = fakeImages(20_000, 20_000);
    await expect(importImage(pngFile(), adapter)).rejects.toMatchObject({
      code: "image_dimensions",
    });
    expect(adapter.createCanvas).not.toHaveBeenCalled();
    expect(adapter.revokeObjectURL).toHaveBeenCalledOnce();
  });
});

describe("PNG encoding and clipboard", () => {
  it("uses PNG encoding and rejects null/invalid output or security errors", async () => {
    const canvas = {
      toBlob: vi.fn((callback: BlobCallback) => callback(PNG)),
    } as unknown as HTMLCanvasElement;
    await expect(canvasToPng(canvas)).resolves.toBe(PNG);
    expect(canvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/png",
    );
    const nullCanvas = {
      toBlob: (callback: BlobCallback) => callback(null),
    } as HTMLCanvasElement;
    await expect(canvasToPng(nullCanvas)).rejects.toMatchObject({
      code: "png_encode",
    });
    const tainted = {
      toBlob: () => {
        throw new Error("tainted");
      },
    } as unknown as HTMLCanvasElement;
    await expect(canvasToPng(tainted)).rejects.toMatchObject({
      code: "png_encode",
    });
  });

  it("times out when a browser never invokes toBlob", async () => {
    vi.useFakeTimers();
    const promise = canvasToPng(
      { toBlob: () => {} } as unknown as HTMLCanvasElement,
      { timeoutMs: 20 },
    );
    const rejected = expect(promise).rejects.toMatchObject({
      code: "png_timeout",
    });
    await vi.advanceTimersByTimeAsync(21);
    await rejected;
  });

  it("starts clipboard.write synchronously while PNG encoding is still pending", async () => {
    let resolvePng!: (blob: Blob) => void;
    const png = new Promise<Blob>((resolve) => {
      resolvePng = resolve;
    });
    const clipboard = fakeClipboard();
    const copying = copyPng(png, clipboard);
    expect(clipboard.write).toHaveBeenCalledTimes(1);
    expect(clipboard.createItem).toHaveBeenCalledWith({
      "image/png": expect.any(Promise),
    });
    let completed = false;
    void copying.then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    resolvePng(PNG);
    await expect(copying).resolves.toBeUndefined();
    expect(clipboard.write).toHaveBeenCalledTimes(1);
  });

  it("feature-detects image support and normalizes denied, thrown, and encoding failures", async () => {
    const unavailable = fakeClipboard();
    unavailable.supports = () => false;
    await expect(
      copyPng(Promise.resolve(PNG), unavailable),
    ).rejects.toMatchObject({ code: "clipboard_unavailable" });
    expect(unavailable.write).not.toHaveBeenCalled();
    const denied = Object.assign(new Error("permission"), {
      name: "NotAllowedError",
    });
    await expect(
      copyPng(
        Promise.resolve(PNG),
        fakeClipboard(async () => {
          throw denied;
        }),
      ),
    ).rejects.toMatchObject({ code: "clipboard_denied" });
    await expect(
      copyPng(
        Promise.resolve(PNG),
        fakeClipboard(() => {
          throw denied;
        }),
      ),
    ).rejects.toMatchObject({ code: "clipboard_denied" });
    await expect(
      copyPng(Promise.reject(new Error("encoding broke")), fakeClipboard()),
    ).rejects.toMatchObject({ code: "clipboard_failed" });
    await expect(
      copyPng(
        Promise.resolve(new Blob(["text"], { type: "text/plain" })),
        fakeClipboard(),
      ),
    ).rejects.toMatchObject({ code: "png_encode" });
  });

  it("times out without retrying a clipboard side effect", async () => {
    vi.useFakeTimers();
    const clipboard = fakeClipboard(() => new Promise<void>(() => {}));
    const copying = copyPng(Promise.resolve(PNG), clipboard);
    const rejected = expect(copying).rejects.toMatchObject({
      code: "clipboard_timeout",
    });
    await vi.advanceTimersByTimeAsync(21);
    await rejected;
    expect(clipboard.write).toHaveBeenCalledTimes(1);
  });

  it("uses the native ClipboardItem promise path when no adapter is supplied", async () => {
    const write = vi.fn(async () => {});
    const constructor = vi.fn();
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { clipboard: { write } });
    vi.stubGlobal(
      "ClipboardItem",
      class {
        static supports = () => true;
        constructor(data: Record<string, Promise<Blob>>) {
          constructor(data);
        }
      },
    );
    const promise = copyPng(Promise.resolve(PNG));
    expect(write).toHaveBeenCalledOnce();
    expect(constructor).toHaveBeenCalledWith({
      "image/png": expect.any(Promise),
    });
    await promise;
  });
});

describe("local PNG downloads", () => {
  it("downloads once under a bounded filename and releases the object URL after dispatch", () => {
    vi.useFakeTimers();
    const anchor = {
      style: {},
      download: "",
      href: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const adapter: DownloadAdapter = {
      createObjectURL: vi.fn(() => "blob:download"),
      revokeObjectURL: vi.fn(),
      createAnchor: () => anchor as unknown as HTMLAnchorElement,
      appendAnchor: vi.fn(),
    };
    downloadPng(PNG, "My screenshot.PNG", adapter);
    expect(anchor).toMatchObject({
      download: "My screenshot.png",
      href: "blob:download",
    });
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(adapter.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(adapter.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:download",
    );
  });
});
