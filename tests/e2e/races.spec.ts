import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { createStore } from "../../lib/storage";
import {
  STORE_KEY,
  canvasSnapshot,
  expectCenterColor,
  expectSourcePixel,
  pngPixels,
  readStore,
  uploadSolid,
} from "./helpers";

const COLOR_A = { r: 235, g: 58, b: 82 };
const COLOR_B = { r: 20, g: 184, b: 166 };

type RaceWindow = typeof window & {
  __waitForImports: () => Promise<void>;
  __heldRestores: number;
  __releaseRestore: () => Promise<number>;
};

// Release held decodes before the image adapter's 15-second timeout can mask a race.
test.setTimeout(15_000);

async function solidPng(color: typeof COLOR_A) {
  return sharp({
    create: { width: 640, height: 360, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

async function trackImportCompletion(page: Page) {
  await page.addInitScript(() => {
    let pending = 0;
    let activity = 0;
    const track = <T>(promise: Promise<T>) => {
      pending += 1;
      activity += 1;
      return promise.finally(() => {
        pending -= 1;
        activity += 1;
      });
    };

    const fetch = window.fetch.bind(window);
    window.fetch = (...args) => track(fetch(...args));
    const blob = Response.prototype.blob;
    Response.prototype.blob = function () {
      return track(blob.call(this));
    };
    const arrayBuffer = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      return track(arrayBuffer.call(this));
    };

    const src = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "src",
    )!;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...src,
      set(this: HTMLImageElement, value: string) {
        pending += 1;
        activity += 1;
        const finish = () => {
          this.removeEventListener("load", finish);
          this.removeEventListener("error", finish);
          pending -= 1;
          activity += 1;
        };
        this.addEventListener("load", finish);
        this.addEventListener("error", finish);
        try {
          src.set!.call(this, value);
        } catch (error) {
          finish();
          throw error;
        }
      },
    });

    (window as RaceWindow).__waitForImports = async () => {
      const deadline = performance.now() + 5_000;
      let previousActivity = -1;
      while (performance.now() < deadline) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        if (pending === 0 && activity === previousActivity) return;
        previousActivity = activity;
      }
      throw new Error(
        `Import work did not settle (${pending} pending operations)`,
      );
    };
  });
}

async function holdSavedRestore(page: Page) {
  const dataUrl = `data:image/png;base64,${(await solidPng(COLOR_A)).toString("base64")}`;
  const saved = createStore();
  saved.composition.status = "ready";
  saved.composition.source = {
    dataUrl,
    name: "saved-A.png",
    width: 640,
    height: 360,
  };

  await page.addInitScript(
    ({ key, saved, dataUrl }) => {
      localStorage.setItem(key, JSON.stringify(saved));
      const state = window as RaceWindow;
      state.__heldRestores = 0;
      const src = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        "src",
      )!;
      const held: HTMLImageElement[] = [];
      let released = false;
      Object.defineProperty(HTMLImageElement.prototype, "src", {
        ...src,
        set(this: HTMLImageElement, value: string) {
          if (value === dataUrl && !released) {
            held.push(this);
            state.__heldRestores += 1;
          } else src.set!.call(this, value);
        },
      });
      state.__releaseRestore = async () => {
        if (!held.length)
          throw new Error("Saved A must be waiting before it is released");
        released = true;
        const images = held.splice(0);
        await Promise.all(
          images.map(
            (image) =>
              new Promise<void>((resolve, reject) => {
                image.addEventListener(
                  "load",
                  () => {
                    if (image.naturalWidth > 0 && image.naturalHeight > 0)
                      resolve();
                    else
                      reject(
                        new Error("Saved A loaded without image dimensions"),
                      );
                  },
                  { once: true },
                );
                image.addEventListener(
                  "error",
                  () => reject(new Error("Saved A failed to decode")),
                  { once: true },
                );
                src.set!.call(image, dataUrl);
              }),
          ),
        );
        // Native load events resolve the application's decoder; let its continuation render.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return images.length;
      };
    },
    { key: STORE_KEY, saved, dataUrl },
  );
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => (window as RaceWindow).__heldRestores))
    .toBeGreaterThan(0);
  expect((await readStore(page))?.composition.source).toEqual(
    saved.composition.source,
  );
  await expect(
    page.getByRole("button", { name: "Export PNG", exact: true }),
  ).toBeDisabled();
}

test("a delayed first-visit example cannot replace a newer uploaded screenshot", async ({
  page,
}) => {
  const example = await solidPng(COLOR_A);
  let releaseExample!: () => void;
  const released = new Promise<void>((resolve) => {
    releaseExample = resolve;
  });
  let intercepted!: () => void;
  const requested = new Promise<void>((resolve) => {
    intercepted = resolve;
  });
  await trackImportCompletion(page);
  await page.route("**/example.png", async (route) => {
    intercepted();
    await released;
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: example,
    });
  });

  try {
    // Leave this isolated context's storage absent so initialization fetches the example.
    await page.goto("/");
    await requested;
    expect(await readStore(page)).toBeNull();
    const sourceB = await uploadSolid(
      page,
      "uploaded-B.png",
      640,
      360,
      COLOR_B,
    );
    const previewB = await canvasSnapshot(page);

    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/example.png",
    );
    releaseExample();
    const response = await responsePromise;
    expect(await response.finished()).toBeNull();
    await page.evaluate(() => (window as RaceWindow).__waitForImports());

    expect((await readStore(page))?.composition.source).toEqual(sourceB);
    await expectCenterColor(page, COLOR_B);
    expect(await canvasSnapshot(page)).toEqual(previewB);
    await expect(
      page.getByRole("button", { name: "Export PNG", exact: true }),
    ).toBeEnabled();
  } finally {
    releaseExample();
  }
});

test("a delayed saved restore cannot overwrite the image used to export a newer upload", async ({
  page,
}) => {
  await holdSavedRestore(page);
  const sourceB = await uploadSolid(page, "uploaded-B.png", 640, 360, COLOR_B);

  expect(
    await page.evaluate(() => (window as RaceWindow).__releaseRestore()),
  ).toBeGreaterThan(0);
  expect((await readStore(page))?.composition.source).toEqual(sourceB);
  await expectCenterColor(page, COLOR_B);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const png = await pngPixels(await readFile(path!));
  expect({ width: png.width, height: png.height }).toEqual({
    width: 1600,
    height: 900,
  });
  expectSourcePixel(
    png.pixel(Math.floor(png.width / 2), Math.floor(png.height / 2)),
    COLOR_B,
  );
  expect((await readStore(page))?.composition.source).toEqual(sourceB);
});

test("clearing local data prevents a delayed saved restore from reviving the canvas", async ({
  page,
}) => {
  await holdSavedRestore(page);
  await page
    .getByRole("button", { name: "Help and privacy", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Clear your local workspace?",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect
    .poll(async () => (await readStore(page))?.composition.source)
    .toBeNull();
  const clearedPreview = await canvasSnapshot(page);

  expect(
    await page.evaluate(() => (window as RaceWindow).__releaseRestore()),
  ).toBeGreaterThan(0);

  expect(await readStore(page)).toMatchObject({
    composition: { source: null, status: "empty" },
    presets: [],
    jobs: [],
  });
  await expect(
    page.getByRole("button", { name: "Export PNG", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", {
      name: "Good things start with a screenshot.",
      exact: true,
    }),
  ).toBeVisible();
  expect(await canvasSnapshot(page)).toEqual(clearedPreview);
});
