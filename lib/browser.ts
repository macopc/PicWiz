import { AppError } from "./domain";
import {
  assertImageDimensions,
  declaredDimensions,
  IMAGE_LIMITS,
  isRasterDataUrl,
  rasterType,
} from "./image-format";

const TIMEOUT_MS = 15_000;

export type ImageAdapter = {
  createImage(): HTMLImageElement;
  createCanvas(): HTMLCanvasElement;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  timeoutMs?: number;
};

function imageAdapter(): ImageAdapter {
  return {
    createImage: () => new Image(),
    createCanvas: () => document.createElement("canvas"),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  };
}

function bounded<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  code: string,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new AppError(code, message)),
      timeoutMs,
    );
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function decode(src: string, adapter: ImageAdapter): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    let image: HTMLImageElement;
    try {
      image = adapter.createImage();
    } catch {
      reject(
        new AppError("image_decode", "This browser could not open the image."),
      );
      return;
    }
    const cleanup = () => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
    };
    const timer = setTimeout(() => {
      cleanup();
      image.removeAttribute?.("src");
      reject(
        new AppError(
          "image_timeout",
          "Image decoding took too long. Try a smaller image.",
        ),
      );
    }, adapter.timeoutMs ?? TIMEOUT_MS);
    image.onload = () => {
      cleanup();
      try {
        assertImageDimensions(image.naturalWidth, image.naturalHeight);
        resolve(image);
      } catch (error) {
        image.removeAttribute?.("src");
        reject(error);
      }
    };
    image.onerror = () => {
      cleanup();
      image.removeAttribute?.("src");
      reject(
        new AppError(
          "image_decode",
          "The image is damaged or cannot be decoded by this browser.",
        ),
      );
    };
    image.decoding = "async";
    try {
      image.src = src;
    } catch {
      cleanup();
      image.removeAttribute?.("src");
      reject(
        new AppError("image_decode", "This browser could not open the image."),
      );
    }
  });
}

export function loadImage(
  dataUrl: string,
  adapter: ImageAdapter = imageAdapter(),
): Promise<HTMLImageElement> {
  if (!isRasterDataUrl(dataUrl))
    return Promise.reject(
      new AppError(
        "image_type",
        "Only locally saved PNG, JPEG, or WebP image data can be opened.",
      ),
    );
  return decode(dataUrl, adapter);
}

export async function importImage(
  file: File,
  adapter: ImageAdapter = imageAdapter(),
): Promise<{
  dataUrl: string;
  name: string;
  width: number;
  height: number;
  image: HTMLImageElement;
}> {
  if (!file || !Number.isFinite(file.size) || file.size <= 0)
    throw new AppError(
      "image_empty",
      "Choose a nonempty PNG, JPEG, or WebP image.",
    );
  if (file.size > IMAGE_LIMITS.bytes)
    throw new AppError("image_size", "Choose an image smaller than 25 MB.");
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(
      await bounded(
        file.arrayBuffer(),
        adapter.timeoutMs ?? TIMEOUT_MS,
        "image_timeout",
        "Reading the image took too long. Try again.",
      ),
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "image_read",
      "This file could not be read. Choose it again.",
    );
  }
  if (bytes.byteLength !== file.size)
    throw new AppError(
      "image_read",
      "The image file is incomplete. Choose it again.",
    );
  const type = rasterType(bytes);
  if (!type || (file.type && file.type.toLowerCase() !== type))
    throw new AppError(
      "image_type",
      "Choose a PNG, JPEG, or WebP image with a matching file type.",
    );
  const declared = declaredDimensions(bytes, type);
  if (!declared)
    throw new AppError(
      "image_decode",
      "This image has an invalid or incomplete header.",
    );
  assertImageDimensions(declared.width, declared.height);

  let url: string;
  try {
    url = adapter.createObjectURL(new Blob([bytes as BlobPart], { type }));
  } catch {
    throw new AppError(
      "image_decode",
      "This browser could not open the local image.",
    );
  }
  let original: HTMLImageElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    original = await decode(url, adapter);
    const factor = Math.min(
      1,
      IMAGE_LIMITS.normalizedEdge /
        Math.max(original.naturalWidth, original.naturalHeight),
    );
    let width = Math.max(1, Math.round(original.naturalWidth * factor));
    let height = Math.max(1, Math.round(original.naturalHeight * factor));
    canvas = adapter.createCanvas();
    let dataUrl = "";
    // Redraw from the decoded original on each resize to avoid cumulative resampling.
    for (let attempt = 0; attempt < 16; attempt++) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context)
        throw new AppError(
          "canvas_unavailable",
          "This browser could not create an image canvas.",
        );
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(original, 0, 0, width, height);
      dataUrl = canvas.toDataURL("image/png");
      if (dataUrl.length > IMAGE_LIMITS.dataUrlLength) {
        for (const quality of [0.9, 0.8, 0.7, 0.6]) {
          dataUrl = canvas.toDataURL("image/webp", quality);
          if (dataUrl.length <= IMAGE_LIMITS.dataUrlLength) break;
        }
      }
      const fitsStorage = dataUrl.length <= IMAGE_LIMITS.dataUrlLength;
      if (isRasterDataUrl(dataUrl)) {
        // Original decode and normalization surface are no longer needed.
        original.removeAttribute?.("src");
        const image = await loadImage(dataUrl, adapter);
        if (image.naturalWidth !== width || image.naturalHeight !== height) {
          image.removeAttribute?.("src");
          throw new AppError(
            "image_decode",
            "The normalized image has unexpected dimensions.",
          );
        }
        const name =
          (file.name.split(/[\\/]/).pop() ?? "screenshot")
            .replace(/[\u0000-\u001f\u007f]/g, "")
            .trim()
            .slice(0, 120) || "screenshot";
        return { dataUrl, name, width, height, image };
      }
      if (fitsStorage)
        throw new AppError(
          "image_encode",
          "This browser could not save the image as a supported raster.",
        );
      width = Math.max(1, Math.floor(width * 0.8));
      height = Math.max(1, Math.floor(height * 0.8));
    }
    throw new AppError(
      "image_size",
      "This image could not fit in browser storage. Try a smaller image.",
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "image_encode",
      "This browser could not prepare the image. Try a different image.",
    );
  } finally {
    adapter.revokeObjectURL(url);
    original?.removeAttribute?.("src");
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

let pngEncoderBusy = false;
const pngEncoderListeners = new Set<(busy: boolean) => void>();
export function isPngEncoderBusy(): boolean {
  return pngEncoderBusy;
}
export function subscribePngEncoder(
  listener: (busy: boolean) => void,
): () => void {
  pngEncoderListeners.add(listener);
  return () => {
    pngEncoderListeners.delete(listener);
  };
}
function setEncoderBusy(busy: boolean): void {
  if (pngEncoderBusy === busy) return;
  pngEncoderBusy = busy;
  for (const listener of pngEncoderListeners) {
    try {
      listener(busy);
    } catch {
      /* A UI subscriber cannot interfere with native settlement. */
    }
  }
}

export function canvasToPng(
  canvas: HTMLCanvasElement,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Blob> {
  if (options.signal?.aborted)
    return Promise.reject(
      new AppError("cancelled", "PNG export was cancelled."),
    );
  if (pngEncoderBusy)
    return Promise.reject(
      new AppError(
        "png_busy",
        "Waiting for the browser to finish encoding. If it never responds, reload this page.",
      ),
    );
  return new Promise((resolve, reject) => {
    let settled = false,
      nativeSettled = false;
    const finish = (error?: AppError, blob?: Blob) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(blob!);
    };
    const abort = () =>
      finish(
        new AppError(
          "cancelled",
          "PNG export was cancelled. Waiting for the browser to finish encoding.",
        ),
      );
    const timer = setTimeout(
      () =>
        finish(
          new AppError(
            "png_timeout",
            "PNG encoding took too long. Waiting for the browser to finish; reload if it never responds.",
          ),
        ),
      options.timeoutMs ?? TIMEOUT_MS,
    );
    options.signal?.addEventListener("abort", abort, { once: true });
    setEncoderBusy(true);
    try {
      canvas.toBlob((blob) => {
        // Timeout/abort only settle the application promise. Only this native callback unlocks.
        if (nativeSettled) return;
        nativeSettled = true;
        setEncoderBusy(false);
        if (settled) return; // Discard every late result.
        if (blob && blob.size > 0 && blob.type === "image/png")
          finish(undefined, blob);
        else
          finish(
            new AppError(
              "png_encode",
              "This browser could not encode a PNG. Try exporting again.",
            ),
          );
      }, "image/png");
    } catch {
      if (!nativeSettled) {
        nativeSettled = true;
        setEncoderBusy(false);
      }
      finish(
        new AppError(
          "png_encode",
          "This browser could not encode this canvas as a PNG.",
        ),
      );
    }
  });
}

export type ClipboardAdapter = {
  write(items: ClipboardItem[]): Promise<void>;
  createItem?(data: Record<string, Promise<Blob>>): ClipboardItem;
  supports?(type: string): boolean;
  timeoutMs?: number;
};

export function copyPng(
  png: Promise<Blob>,
  clipboard?: ClipboardAdapter,
): Promise<void> {
  // Attach a rejection handler even when capability detection fails before the PNG is ready.
  const encoding = Promise.resolve(png);
  void encoding.catch(() => {});
  try {
    if (!clipboard) {
      if (
        !globalThis.isSecureContext ||
        typeof navigator === "undefined" ||
        !navigator.clipboard?.write
      )
        throw new AppError(
          "clipboard_unavailable",
          "PNG copy needs a secure browser with clipboard support. Download the PNG instead.",
        );
      clipboard = navigator.clipboard;
    }
    const createItem =
      clipboard.createItem ??
      (typeof ClipboardItem !== "undefined"
        ? (data: Record<string, Promise<Blob>>) => new ClipboardItem(data)
        : undefined);
    const supports =
      clipboard.supports ??
      (typeof ClipboardItem !== "undefined" && ClipboardItem.supports
        ? (type: string) => ClipboardItem.supports(type)
        : undefined);
    if (!createItem || (supports && !supports("image/png")))
      throw new AppError(
        "clipboard_unavailable",
        "This browser cannot copy PNG images. Download the PNG instead.",
      );
    const ready = bounded(
      encoding,
      clipboard.timeoutMs ?? TIMEOUT_MS,
      "png_timeout",
      "PNG encoding took too long. Wait for the browser to finish; reload if it never responds.",
    ).then((blob) => {
      if (!blob || blob.type !== "image/png" || blob.size === 0)
        throw new AppError(
          "png_encode",
          "The clipboard needs a valid PNG image.",
        );
      return blob;
    });
    void ready.catch(() => {});
    // Do not await encoding: the write must begin in the original user gesture.
    const writing = clipboard.write([createItem({ "image/png": ready })]);
    return bounded(
      Promise.all([writing, ready]).then(() => {}),
      clipboard.timeoutMs ?? TIMEOUT_MS,
      "clipboard_timeout",
      "Clipboard access timed out. Download the PNG instead.",
    ).catch((error) => {
      if (error instanceof AppError) throw error;
      const denied =
        error &&
        typeof error === "object" &&
        "name" in error &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      throw new AppError(
        denied ? "clipboard_denied" : "clipboard_failed",
        denied
          ? "Clipboard permission was denied. Download the PNG instead."
          : "The PNG could not be copied. Download it instead.",
      );
    });
  } catch (error) {
    if (error instanceof AppError) return Promise.reject(error);
    const denied =
      error &&
      typeof error === "object" &&
      "name" in error &&
      (error.name === "NotAllowedError" || error.name === "SecurityError");
    return Promise.reject(
      new AppError(
        denied ? "clipboard_denied" : "clipboard_failed",
        "Clipboard access failed. Download the PNG instead.",
      ),
    );
  }
}

export type DownloadAdapter = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): HTMLAnchorElement;
  appendAnchor(anchor: HTMLAnchorElement): void;
};

export function downloadPng(
  blob: Blob,
  name: string,
  adapter?: DownloadAdapter,
): void {
  if (blob.type !== "image/png" || blob.size === 0)
    throw new AppError("png_encode", "Choose a valid PNG to download.");
  downloadFile(blob, name, adapter);
}

export function downloadFile(
  blob: Blob,
  name: string,
  adapter?: DownloadAdapter,
): void {
  const extension = (
    {
      "image/png": "png",
      "application/json": "json",
      "application/zip": "zip",
    } as Record<string, string>
  )[blob.type];
  if (!extension || !blob.size)
    throw new AppError(
      "download_type",
      "Choose a nonempty PNG, JSON, or ZIP file to download.",
    );
  const environment = adapter ?? {
    createObjectURL: (value: Blob) => URL.createObjectURL(value),
    revokeObjectURL: (url: string) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement("a"),
    appendAnchor: (anchor: HTMLAnchorElement) =>
      document.body.appendChild(anchor),
  };
  let url: string | undefined, anchor: HTMLAnchorElement | undefined;
  try {
    url = environment.createObjectURL(blob);
    anchor = environment.createAnchor();
    const filename =
      name
        .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "-")
        .replace(/\.(png|json|zip)$/i, "")
        .trim()
        .replace(/^\.+/, "")
        .slice(0, 116) || "picwiz";
    anchor.download = `${filename}.${extension}`;
    anchor.href = url;
    anchor.style.display = "none";
    environment.appendAnchor(anchor);
    anchor.click();
  } catch {
    throw new AppError(
      "download_failed",
      "The browser could not start the download. Try exporting again.",
    );
  } finally {
    anchor?.remove();
    if (url) {
      const createdUrl = url;
      setTimeout(() => environment.revokeObjectURL(createdUrl), 1000);
    }
  }
}
