import { readFile } from "node:fs/promises";
import { expect, type Download, type Page } from "@playwright/test";
import sharp from "sharp";
import { SIZES, type Style } from "../../lib/domain";
import { createStore } from "../../lib/storage";

export const STORE_KEY = "picwiz:store";
export const LEGACY_STORE_KEY = "shinyshot:store";
export const SOURCE_COLOR = { r: 235, g: 58, b: 82 };

// Independent acceptance values, rather than dimensions() from the implementation.
export const OUTPUT_SIZES = {
  landscape: { width: 1600, height: 900 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  linkedin: { width: 1200, height: 627 },
  pinterest: { width: 1000, height: 1500 },
} as const;

export type StoredAnnotation = {
  id: string;
  type: "arrow" | "rectangle" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  stroke: 2 | 4 | 8;
  text: string;
  fontSize: number;
  flipX: boolean;
  flipY: boolean;
};

export type Source = {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
};

export type StoredState = {
  version: number;
  composition: {
    style: Style;
    source: Source | null;
    status: string;
    annotations: StoredAnnotation[];
  };
  presets: {
    id: string;
    name: string;
    style: Style;
    createdAt: string;
    updatedAt: string;
  }[];
  jobs: {
    id: string;
    kind: "download" | "clipboard" | "batch";
    status: string;
    width: number;
    height: number;
    formats: string[];
    scale: 1 | 2;
    total: number;
    completed: number;
    failed: number;
    error: string | null;
  }[];
};

export async function openEditor(page: Page) {
  await page.addInitScript(
    ({ key, empty }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(empty));
    },
    { key: STORE_KEY, empty: createStore() },
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Use example", exact: true }),
  ).toBeEnabled();
}

export async function selectBackground(
  page: Page,
  background: { name: string; kind: "solid" | "gradient" },
) {
  await page
    .getByRole("button", {
      name: background.kind === "solid" ? "Solid color" : "Gradient",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: `Background: ${background.name}`,
      exact: true,
    })
    .click();
}

export async function readStore(page: Page): Promise<StoredState | null> {
  return page.evaluate((key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, STORE_KEY);
}

export async function expectStyle(page: Page, style: Partial<Style>) {
  await expect
    .poll(async () => (await readStore(page))?.composition.style)
    .toMatchObject(style);
}

export async function sourceFromStore(
  page: Page,
  name?: string,
): Promise<Source> {
  await expect
    .poll(async () => (await readStore(page))?.composition.source?.name)
    .toEqual(name ?? expect.any(String));
  return (await readStore(page))!.composition.source!;
}

export async function uploadSolid(
  page: Page,
  name: string,
  width: number,
  height: number,
  color = SOURCE_COLOR,
) {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
  await page.getByLabel("Upload screenshot", { exact: true }).setInputFiles({
    name,
    mimeType: "image/png",
    buffer,
  });
  const source = await sourceFromStore(page, name);
  await expectCenterColor(page, color);
  return source;
}

export async function expectCenterColor(
  page: Page,
  color: typeof SOURCE_COLOR,
) {
  await expect
    .poll(async () =>
      page
        .getByTestId("composition-canvas")
        .evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          const context = canvas.getContext("2d")!;
          return [
            ...context.getImageData(
              Math.floor(canvas.width / 2),
              Math.floor(canvas.height / 2),
              1,
              1,
            ).data,
          ];
        })
        .then((pixel) =>
          Math.max(
            Math.abs(pixel[0] - color.r),
            Math.abs(pixel[1] - color.g),
            Math.abs(pixel[2] - color.b),
            Math.abs(pixel[3] - 255),
          ),
        ),
    )
    .toBeLessThanOrEqual(3);
}

export function expectSourcePixel(pixel: number[], color = SOURCE_COLOR) {
  // Import normalizes images to WebP; a small RGB tolerance accounts for its lossy encoding.
  for (const [channel, expected] of [color.r, color.g, color.b].entries()) {
    expect(Math.abs(pixel[channel] - expected)).toBeLessThanOrEqual(3);
  }
  expect(pixel[3]).toBe(255);
}

export async function setSlider(page: Page, label: string, value: number) {
  const slider = page.getByRole("slider", { name: label, exact: true });
  await slider.evaluate((element, nextValue) => {
    // Use the native setter so React observes the same input/change events as a drag.
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, String(nextValue));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await expect(slider).toHaveValue(String(value));
}

export async function canvasSnapshot(page: Page) {
  return page.getByTestId("composition-canvas").evaluate(async (element) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const canvas = element as HTMLCanvasElement;
    const pixels = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (const value of pixels) hash = Math.imul(hash ^ value, 16777619);
    return { width: canvas.width, height: canvas.height, hash: hash >>> 0 };
  });
}

export async function expectCanvasChanged(
  page: Page,
  before: Awaited<ReturnType<typeof canvasSnapshot>>,
) {
  await expect.poll(() => canvasSnapshot(page)).not.toEqual(before);
}

export async function pngPixels(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();
  expect(metadata.format).toBe("png");
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    pixel(x: number, y: number) {
      const offset = (y * info.width + x) * info.channels;
      return [...data.subarray(offset, offset + 4)];
    },
  };
}

export async function installClipboard(page: Page) {
  await page.addInitScript(() => {
    const state = window as typeof window & {
      __clipboardItems: ClipboardItem[];
      __clipboardWriteCount: number;
    };
    state.__clipboardItems = [];
    state.__clipboardWriteCount = 0;
    // Stub only the OS boundary. Never polyfill ClipboardItem or its PNG support.
    if (
      typeof ClipboardItem !== "function" ||
      !navigator.clipboard?.write ||
      (typeof ClipboardItem.supports === "function" &&
        !ClipboardItem.supports("image/png"))
    ) return;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        async write(items: ClipboardItem[]) {
          for (const item of items) {
            if (!(item instanceof ClipboardItem))
              throw new TypeError("Expected a real ClipboardItem");
            const blob = await item.getType("image/png");
            if (blob.type !== "image/png" || blob.size === 0)
              throw new TypeError("Expected PNG data");
            await blob.arrayBuffer();
          }
          state.__clipboardItems = [...items];
          state.__clipboardWriteCount += 1;
        },
        async read() {
          return state.__clipboardItems;
        },
      },
    });
  });
}

export async function supportsClipboardPng(page: Page) {
  return page.evaluate(() =>
    typeof ClipboardItem === "function" &&
    !!navigator.clipboard?.write &&
    (typeof ClipboardItem.supports !== "function" ||
      ClipboardItem.supports("image/png")),
  );
}

export async function downloadBytes(download: Download) {
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!);
}

export async function exportPng(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^picwiz-\d+x\d+\.png$/);
  return downloadBytes(download);
}

export async function solidFile(
  name: string,
  color = SOURCE_COLOR,
  width = 640,
  height = 360,
) {
  return {
    name,
    mimeType: "image/png",
    buffer: await sharp({
      create: { width, height, channels: 3, background: color },
    }).png().toBuffer(),
  };
}

export async function openPresets(page: Page) {
  const opener = page.getByRole("button", { name: "My presets", exact: true });
  if (!(await page.getByRole("dialog").isVisible())) await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

export async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

export async function showInspector(page: Page, name: "Style" | "Frame" | "Annotate") {
  // Desktop may show all inspector sections; mobile exposes semantic tabs or buttons.
  const tab = page.getByRole("tab", { name, exact: true });
  if (await tab.isVisible()) await tab.click();
  else {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.isVisible()) await button.click();
  }
}

export async function annotationState(page: Page) {
  return (await readStore(page))!.composition.annotations;
}

export async function annotationPercent(page: Page, field: "X" | "Y" | "Width" | "Height", value: number) {
  const input = page.getByLabel(`Annotation ${field}`, { exact: true });
  await input.fill(String(value));
  await input.press("Tab");
}

export async function openBatch(page: Page, formats: (keyof typeof OUTPUT_SIZES)[]) {
  await page.getByRole("button", { name: "Batch export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Batch export", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Include current screenshot", exact: true }).check();
  for (const checkbox of await dialog.getByRole("checkbox", { name: /^Batch size: / }).all()) await checkbox.uncheck();
  for (const format of formats) {
    await dialog.getByRole("checkbox", { name: `Batch size: ${SIZES[format].label}`, exact: true }).check();
  }
  return dialog;
}

export async function clipboardPng(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __clipboardWriteCount: number;
            }
          ).__clipboardWriteCount,
      ),
    )
    .toBe(1);
  const result = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const item = items[0];
    const blob = await item.getType("image/png");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return {
      realItem: item instanceof ClipboardItem,
      types: item.types,
      type: blob.type,
      dataUrl,
    };
  });
  expect(result.realItem).toBe(true);
  expect(result.types).toContain("image/png");
  expect(result.type).toBe("image/png");
  return Buffer.from(result.dataUrl.split(",")[1], "base64");
}

export async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => window.innerWidth)).toBe(390);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
          ) - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
}
