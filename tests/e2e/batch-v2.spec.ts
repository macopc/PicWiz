import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import {
  OUTPUT_SIZES,
  annotationPercent,
  annotationState,
  downloadBytes,
  expectStyle,
  openBatch,
  openEditor,
  pngPixels,
  readStore,
  selectBackground,
  setSlider,
  showInspector,
  solidFile,
  uploadSolid,
} from "./helpers";

const BLUE = { r: 30, g: 110, b: 190 };

async function downloadZip(page: Page, button = "Download ZIP") {
  const pending = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: button, exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^picwiz.*\.zip$/);
  return unzipSync(new Uint8Array(await downloadBytes(download)));
}

type Manifest = {
  app: string;
  version: number;
  createdAt: string;
  scale: number;
  entries: { path: string; width: number; height: number; status: string; error: string | null; sourceIndex: number; attemptId: string }[];
  attempts: { id: string }[];
};

function readManifest(archive: Record<string, Uint8Array>): Manifest {
  expect(archive["picwiz-manifest.json"]).toBeDefined();
  const raw = strFromU8(archive["picwiz-manifest.json"]);
  expect(raw).not.toMatch(/data:image|base64|dataUrl|annotations/i);
  const manifest: Manifest = JSON.parse(raw);
  expect(manifest).toMatchObject({ app: "picwiz", version: 2 });
  expect(manifest.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  expect(Array.isArray(manifest.entries)).toBe(true);
  expect(Array.isArray(manifest.attempts)).toBe(true);
  return manifest;
}

test("@critical 3 sources × 2 formats produce one explicit ZIP with six correctly sized PNGs and source-only annotations", async ({ page }) => {
  const submissions: string[] = [];
  const downloads: string[] = [];
  page.on("request", request => {
    if (!["GET", "HEAD"].includes(request.method())) submissions.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  page.on("download", download => downloads.push(download.suggestedFilename()));
  await openEditor(page);
  await uploadSolid(page, "shared shot.png", 800, 400, BLUE);
  await selectBackground(page, { name: "Paper", kind: "solid" });
  await page.getByRole("button", { name: "No frame", exact: true }).click();
  await setSlider(page, "Padding", 80);
  await setSlider(page, "Corner radius", 0);
  await setSlider(page, "Shadow", 0);
  await page.getByLabel("Export scale", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Add rectangle", exact: true }).click();
  await showInspector(page, "Annotate");
  for (const field of ["X", "Y", "Width", "Height"] as const) await annotationPercent(page, field, 25);
  await page.getByLabel("Annotation color", { exact: true }).selectOption("#20a589");
  await page.getByLabel("Annotation stroke", { exact: true }).selectOption("8");
  await expect.poll(async () => (await annotationState(page))[0]).toMatchObject({ x: 0.25, y: 0.25, width: 0.25, height: 0.25 });
  await expectStyle(page, { padding: 80, radius: 0, shadow: 0, frame: "none", scale: 1 });
  const dialog = await openBatch(page, ["landscape", "square"]);
  await dialog.getByLabel("Batch screenshots", { exact: true }).setInputFiles([
    await solidFile("shared shot.png", BLUE, 800, 400),
    await solidFile("shared shot.png", BLUE, 800, 400),
  ]);
  await expect(dialog).toContainText(/3\s*(?:images|screenshots|sources).*2\s*(?:sizes|formats).*6\s*PNG/i);
  await expect(dialog).toContainText(/refresh|reload|this tab/i);
  await dialog.getByRole("button", { name: "Prepare ZIP", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Download ZIP", exact: true })).toBeEnabled();
  expect(downloads, "preparation must never trigger automatic browser downloads").toEqual([]);
  const archive = await downloadZip(page);
  const pngNames = Object.keys(archive).filter(name => name.endsWith(".png"));
  expect(pngNames).toHaveLength(6);
  expect(new Set(pngNames).size).toBe(6);
  expect(Object.keys(archive)).toHaveLength(7);
  for (const index of ["01", "02", "03"]) {
    for (const [size, expected] of [["landscape", OUTPUT_SIZES.landscape], ["square", OUTPUT_SIZES.square]] as const) {
      const name = `${index}-shared-shot/${size}-${expected.width}x${expected.height}.png`;
      expect(pngNames).toContain(name);
      const png = await pngPixels(Buffer.from(archive[name]));
      expect([png.width, png.height]).toEqual([expected.width, expected.height]);
      expect(png.pixel(0, 0)).toEqual([242, 240, 247, 255]);
      const imageWidth = expected.width - 160;
      const imageTop = (expected.height - imageWidth / 2) / 2;
      const pixel = png.pixel(Math.round(80 + imageWidth * 0.375), Math.round(imageTop + imageWidth / 2 * 0.25));
      const wanted = index === "01" ? [32, 165, 137, 255] : [BLUE.r, BLUE.g, BLUE.b, 255];
      pixel.forEach((channel, channelIndex) => expect(Math.abs(channel - wanted[channelIndex])).toBeLessThanOrEqual(4));
    }
  }
  const manifest = readManifest(archive);
  expect(manifest.scale).toBe(1);
  const records = manifest.entries;
  expect(records).toHaveLength(6);
  expect(records.map(record => record.path).sort()).toEqual(pngNames.sort());
  expect(records.every(record => record.status === "succeeded")).toBe(true);
  for (const dimensions of Object.values({ landscape: OUTPUT_SIZES.landscape, square: OUTPUT_SIZES.square })) {
    expect(records.filter(record => record.width === dimensions.width && record.height === dimensions.height)).toHaveLength(3);
  }
  await expect.poll(async () => (await readStore(page))!.jobs.at(-1)).toMatchObject({ kind: "batch", status: "succeeded", total: 6, completed: 6, failed: 0, formats: ["landscape", "square"], scale: 1 });
  expect(downloads).toHaveLength(1);
  expect(submissions, "images, annotations, presets and batch files stay in the browser").toEqual([]);
});

test("bad image is a partial result with usable PNGs and no same-input retry", async ({ page }) => {
  await openEditor(page);
  await uploadSolid(page, "good.png", 640, 360, BLUE);
  const dialog = await openBatch(page, ["landscape"]);
  await dialog.getByLabel("Batch screenshots", { exact: true }).setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not a PNG") });
  await dialog.getByRole("button", { name: "Prepare ZIP", exact: true }).click();
  await expect.poll(async () => (await readStore(page))!.jobs.at(-1)).toMatchObject({ kind: "batch", status: "failed", total: 2, completed: 1, failed: 1 });
  await expect(dialog).toContainText(/partial|1.*(?:failed|need attention)/i);
  await expect(dialog).toContainText(/broken\.png/);
  await expect(dialog.getByRole("button", { name: "Retry failed", exact: true })).not.toBeVisible();
  const archive = await downloadZip(page);
  expect(Object.keys(archive).filter(name => name.endsWith(".png"))).toHaveLength(1);
  const records = readManifest(archive).entries;
  expect(records.filter(record => record.status === "failed")).toHaveLength(1);
  await dialog.getByRole("button", { name: "Close batch export", exact: true }).click();
  await page.getByRole("button", { name: "Batch export", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toContainText("broken.png");
});

test("transient PNG failure retries only failed pairs and preserves successful blobs and the first job", async ({ page }) => {
  await openEditor(page);
  await uploadSolid(page, "retry.png", 640, 360, BLUE);
  const dialog = await openBatch(page, ["landscape", "square"]);
  await page.evaluate(() => {
    const state = window as typeof window & { __pngCalls: number };
    state.__pngCalls = 0;
    const native = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      if (type === "image/png") {
        state.__pngCalls++;
        if (state.__pngCalls === 2) { queueMicrotask(() => callback(null)); return; }
      }
      native.call(this, callback, type, quality);
    };
  });
  await dialog.getByRole("button", { name: "Prepare ZIP", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Retry failed", exact: true })).toBeEnabled();
  await expect.poll(async () => (await readStore(page))!.jobs.at(-1)).toMatchObject({ status: "failed", total: 2, completed: 1, failed: 1 });
  const originalJob = (await readStore(page))!.jobs.at(-1)!;
  await dialog.getByRole("button", { name: "Retry failed", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Download ZIP", exact: true })).toBeEnabled();
  const archive = await downloadZip(page);
  expect(Object.keys(archive).filter(name => name.endsWith(".png"))).toHaveLength(2);
  const manifest = readManifest(archive);
  expect(manifest.entries).toHaveLength(2);
  expect(new Set(manifest.entries.map(entry => entry.attemptId)).size).toBe(2);
  expect(manifest.attempts).toHaveLength(2);
  expect(await page.evaluate(() => (window as typeof window & { __pngCalls: number }).__pngCalls)).toBe(3);
  const jobs = (await readStore(page))!.jobs;
  expect(jobs.find(job => job.id === originalJob.id)).toEqual(originalJob);
  expect(jobs.at(-1)).toMatchObject({ kind: "batch", status: "succeeded", total: 1, completed: 1, failed: 0, formats: ["square"] });
  expect(jobs.at(-1)!.id).not.toBe(originalJob.id);
});

test("cancel responds during a native encode, retains completed results and starts no later PNGs", async ({ page }) => {
  await openEditor(page);
  await uploadSolid(page, "cancel.png", 640, 360, BLUE);
  const dialog = await openBatch(page, ["landscape", "square", "portrait"]);
  const downloads: string[] = [];
  page.on("download", download => downloads.push(download.suggestedFilename()));
  await page.evaluate(() => {
    const state = window as typeof window & { __pngCalls: number; __releasePng?: () => void };
    state.__pngCalls = 0;
    const native = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      if (type === "image/png") {
        state.__pngCalls++;
        if (state.__pngCalls === 2) {
          state.__releasePng = () => native.call(this, callback, type, quality);
          return;
        }
      }
      native.call(this, callback, type, quality);
    };
  });
  await dialog.getByRole("button", { name: "Prepare ZIP", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __pngCalls: number }).__pngCalls)).toBe(2);
  await dialog.getByRole("button", { name: "Cancel export", exact: true }).click();
  await expect(dialog).toContainText(/stopping|cancelled|canceled|waiting.*browser/i);
  expect(downloads).toEqual([]);
  await page.evaluate(() => (window as typeof window & { __releasePng: () => void }).__releasePng());
  await expect.poll(async () => (await readStore(page))!.jobs.at(-1)).toMatchObject({ status: "cancelled", total: 3, completed: 1 });
  await expect(dialog.getByRole("button", { name: "Download completed results", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Download completed results", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Download ZIP", exact: true })).toBeEnabled();
  expect(downloads, "packaging completed results still requires explicit Download ZIP").toEqual([]);
  const archive = await downloadZip(page);
  expect(Object.keys(archive).filter(name => name.endsWith(".png"))).toHaveLength(1);
  expect(await page.evaluate(() => (window as typeof window & { __pngCalls: number }).__pngCalls)).toBe(2);
  expect(downloads).toHaveLength(1);
});
