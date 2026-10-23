import { expect, test } from "@playwright/test";
import {
  annotationState,
  closeDialog,
  downloadBytes,
  expectStyle,
  openEditor,
  openPresets,
  readStore,
  setSlider,
  uploadSolid,
} from "./helpers";

const STARTERS = [
  { name: "Studio", background: "violet", padding: 96, radius: 12, shadow: 36, frame: "none", appearance: "light" },
  { name: "Paper", background: "paper", padding: 80, radius: 16, shadow: 20, frame: "browser", appearance: "light" },
  { name: "Midnight", background: "midnight", padding: 96, radius: 18, shadow: 55, frame: "browser", appearance: "dark" },
  { name: "Mint", background: "mint", padding: 112, radius: 24, shadow: 28, frame: "none", appearance: "light" },
  { name: "Sunset", background: "sunset", padding: 88, radius: 16, shadow: 45, frame: "device", appearance: "light" },
  { name: "Ocean", background: "ocean", padding: 104, radius: 14, shadow: 40, frame: "browser", appearance: "light" },
] as const;

test("@critical all six starter looks preserve screenshot, annotations, output size and scale", async ({ page }) => {
  await openEditor(page);
  const source = await uploadSolid(page, "starter-content.png", 800, 450);
  await page.getByLabel("Output size", { exact: true }).selectOption("story");
  await page.getByLabel("Export scale", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "Add arrow", exact: true }).click();
  await expect.poll(() => annotationState(page)).toHaveLength(1);
  const annotations = await annotationState(page);

  await openPresets(page);
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Apply / })).toHaveCount(6);
  for (const { name, ...look } of STARTERS) {
    await openPresets(page);
    await expect(page.getByRole("button", { name: `Rename ${name}`, exact: true })).toHaveCount(0);
    await page.getByRole("dialog").getByRole("button", { name: `Apply ${name}`, exact: true }).click();
    await expectStyle(page, { ...look, size: "story", scale: 2 });
    expect((await readStore(page))!.composition.source).toEqual(source);
    expect(await annotationState(page)).toEqual(annotations);
  }
  await page.reload();
  await expectStyle(page, { background: "ocean", size: "story", scale: 2 });
  expect(await annotationState(page)).toEqual(annotations);
});

test("@critical user looks save, explicitly update, rename, export, delete and import idempotently", async ({ page }) => {
  await openEditor(page);
  const source = await uploadSolid(page, "private-source.png", 640, 360);
  await page.getByLabel("Output size", { exact: true }).selectOption("pinterest");
  await page.getByLabel("Export scale", { exact: true }).selectOption("2");
  await setSlider(page, "Padding", 110);
  await page.getByRole("button", { name: "Save preset", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Preset name", { exact: true }).fill("Release look");
  await page.getByRole("dialog").getByRole("button", { name: "Save preset", exact: true }).click();
  await expect.poll(async () => (await readStore(page))?.presets).toHaveLength(1);
  const original = (await readStore(page))!.presets[0];

  await setSlider(page, "Padding", 134);
  await openPresets(page);
  await page.getByRole("button", { name: "Update Release look", exact: true }).click();
  // Merely opening confirmation must not overwrite the saved look.
  expect((await readStore(page))!.presets[0].style.padding).toBe(110);
  await page.getByRole("dialog").getByRole("button", { name: "Update preset", exact: true }).click();
  await expect.poll(async () => (await readStore(page))!.presets[0].style.padding).toBe(134);
  expect((await readStore(page))!.presets[0]).toMatchObject({ id: original.id, createdAt: original.createdAt });
  if (await page.getByRole("dialog").isVisible()) await closeDialog(page);

  await openPresets(page);
  await page.getByRole("button", { name: "Rename Release look", exact: true }).click();
  await page.getByLabel("Preset name", { exact: true }).fill("Launch look");
  await page.getByRole("button", { name: "Rename preset", exact: true }).click();
  await expect.poll(async () => (await readStore(page))!.presets[0].name).toBe("Launch look");
  if (await page.getByRole("dialog").isVisible()) await closeDialog(page);

  await openPresets(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export presets", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^picwiz.*\.json$/);
  const buffer = await downloadBytes(download);
  const document = JSON.parse(buffer.toString("utf8"));
  expect(Object.keys(document).sort()).toEqual(["app", "presets", "type", "version"]);
  expect(document).toMatchObject({ app: "picwiz", type: "style-presets", version: 1, presets: [{ name: "Launch look", style: { padding: 134 } }] });
  expect(Object.keys(document.presets[0]).sort()).toEqual(["name", "style"]);
  expect(Object.keys(document.presets[0].style).sort()).toEqual(["appearance", "background", "frame", "padding", "radius", "shadow"]);
  expect(buffer.toString("utf8")).not.toMatch(/data:image|private-source|annotations|token/i);
  await page.getByRole("button", { name: "Delete Launch look", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete preset", exact: true }).click();
  await expect.poll(async () => (await readStore(page))?.presets).toEqual([]);
  if (await page.getByRole("dialog").isVisible()) await closeDialog(page);

  await openPresets(page);
  const file = { name: "picwiz-presets.json", mimeType: "application/json", buffer };
  await page.getByLabel("Import preset file", { exact: true }).setInputFiles(file);
  await expect.poll(async () => (await readStore(page))?.presets).toHaveLength(1);
  await expect(page.getByTestId("notification")).toContainText(/1.*added|1.*imported|imported.*1/i);
  const imported = (await readStore(page))!.presets;
  await page.getByLabel("Import preset file", { exact: true }).setInputFiles(file);
  await expect(page.getByTestId("notification")).toContainText(/0.*added|0.*imported|1.*skipped/i);
  expect((await readStore(page))!.presets).toEqual(imported);
  if (await page.getByRole("dialog").isVisible()) await closeDialog(page);

  await page.getByLabel("Output size", { exact: true }).selectOption("linkedin");
  await page.getByLabel("Export scale", { exact: true }).selectOption("1");
  await setSlider(page, "Padding", 24);
  await openPresets(page);
  await page.getByRole("button", { name: "Apply Launch look", exact: true }).click();
  await expectStyle(page, { padding: 134, size: "linkedin", scale: 1 });
  expect((await readStore(page))!.composition.source).toEqual(source);
});

test("preset JSON rejects a mixed valid/invalid file without a partial save", async ({ page }) => {
  await openEditor(page);
  await openPresets(page);
  const style = { background: "paper", padding: 80, radius: 16, shadow: 20, frame: "browser", appearance: "light" };
  await page.getByLabel("Import preset file", { exact: true }).setInputFiles({
    name: "invalid-presets.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ app: "picwiz", type: "style-presets", version: 1, presets: [
      { name: "Valid look", style }, { name: "Invalid look", style: { ...style, size: "story" } },
    ] })),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(/invalid|unsupported|could not|not.*valid|unknown/i);
  expect((await readStore(page))!.presets).toEqual([]);
});
