import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { OUTPUT_SIZES, expectStyle, exportPng, openEditor, readStore, uploadSolid } from "./helpers";

test("all six sizes at both scales export twelve real PNGs with exact independent dimensions", async ({ page }) => {
  test.setTimeout(60_000);
  await openEditor(page);
  await uploadSolid(page, "all-formats.png", 800, 450);
  for (const [size, expected] of Object.entries(OUTPUT_SIZES)) {
    for (const scale of [1, 2] as const) {
      await page.getByLabel("Output size", { exact: true }).selectOption(size);
      await page.getByLabel("Export scale", { exact: true }).selectOption(String(scale));
      await expectStyle(page, { size: size as keyof typeof OUTPUT_SIZES, scale });
      const metadata = await sharp(await exportPng(page)).metadata();
      expect(metadata).toMatchObject({ format: "png", width: expected.width * scale, height: expected.height * scale });
    }
  }
  await expect.poll(async () => (await readStore(page))!.jobs.filter(job => job.kind === "download" && job.status === "succeeded")).toHaveLength(12);
});

test("missing native ClipboardItem offers a working PNG download without inventing browser capability", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "ClipboardItem", { configurable: true, value: undefined }));
  await openEditor(page);
  const source = await uploadSolid(page, "clipboard-unavailable.png", 640, 360);
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(page.getByTestId("notification")).toContainText(/download.*instead|download.*png/i);
  await expect.poll(async () => (await readStore(page))!.jobs.at(-1)).toMatchObject({ kind: "clipboard", status: "failed" });
  expect((await readStore(page))!.composition.source).toEqual(source);
  expect(await sharp(await exportPng(page)).metadata()).toMatchObject({ format: "png", width: 1600, height: 900 });
});
