import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { BACKGROUNDS, SIZES } from "../../lib/domain";
import {
  canvasSnapshot,
  clipboardPng,
  expectCanvasChanged,
  expectCenterColor,
  expectNoHorizontalOverflow,
  expectSourcePixel,
  expectStyle,
  installClipboard,
  openEditor,
  pngPixels,
  readStore,
  selectBackground,
  setSlider,
  showInspector,
  sourceFromStore,
  supportsClipboardPng,
  uploadSolid,
} from "./helpers";

const solidBackground = BACKGROUNDS.find(
  (background) => background.kind === "solid",
)!;
const alternateBackground = BACKGROUNDS.find(
  (background) => background.id !== solidBackground.id,
)!;

test("@critical PNG download is exactly 1600 × 900 with the selected background and exact 80px padding", async ({
  page,
}) => {
  await openEditor(page);
  const source = await uploadSolid(page, "padding-fixture.png", 1440, 740);
  await selectBackground(page, solidBackground);
  await page.getByRole("button", { name: "No frame", exact: true }).click();
  await setSlider(page, "Padding", 80);
  await setSlider(page, "Corner radius", 0);
  await setSlider(page, "Shadow", 0);
  await page
    .getByLabel("Output size", { exact: true })
    .selectOption("landscape");
  await page.getByLabel("Export scale", { exact: true }).selectOption("1");
  await expectStyle(page, {
    background: solidBackground.id,
    padding: 80,
    radius: 0,
    shadow: 0,
    frame: "none",
    size: "landscape",
    scale: 1,
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/i);
  const path = await download.path();
  expect(path).not.toBeNull();
  const png = await pngPixels(await readFile(path!));
  expect({ width: png.width, height: png.height }).toEqual({
    width: 1600,
    height: 900,
  });
  const background = [
    ...solidBackground.colors[0]
      .slice(1)
      .match(/.{2}/g)!
      .map((hex) => parseInt(hex, 16)),
    255,
  ];
  expect(png.pixel(0, 0)).toEqual(background);
  expect(png.pixel(1599, 899)).toEqual(background);
  expectSourcePixel(png.pixel(800, 450));
  for (const [outside, inside] of [
    [
      [79, 450],
      [80, 450],
    ],
    [
      [1520, 450],
      [1519, 450],
    ],
    [
      [800, 79],
      [800, 80],
    ],
    [
      [800, 820],
      [800, 819],
    ],
  ]) {
    expect(png.pixel(outside[0], outside[1])).toEqual(background);
    expectSourcePixel(png.pixel(inside[0], inside[1]));
  }
  await expect
    .poll(async () => (await readStore(page))?.jobs)
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "download",
          status: "succeeded",
          width: 1600,
          height: 900,
        }),
      ]),
    );
  expect((await readStore(page))!.composition.source).toEqual(source);
});

test("@critical frame, appearance, shadow, size and scale reach preview and native ClipboardItem PNG or download fallback", async ({
  page,
}) => {
  await installClipboard(page);
  await openEditor(page);
  await page.getByRole("button", { name: "Use example", exact: true }).click();
  await sourceFromStore(page);
  await expect(page.getByTestId("composition-canvas")).toBeVisible();

  let before = await canvasSnapshot(page);
  await page
    .getByRole("button", { name: "Browser frame", exact: true })
    .click();
  await expectStyle(page, { frame: "browser" });
  await expectCanvasChanged(page, before);
  for (const [label, appearance] of [
    ["Dark frame", "dark"],
    ["Light frame", "light"],
  ] as const) {
    before = await canvasSnapshot(page);
    await page.getByRole("button", { name: label, exact: true }).click();
    await expectStyle(page, { appearance });
    await expectCanvasChanged(page, before);
  }
  before = await canvasSnapshot(page);
  await page.getByRole("button", { name: "Device frame", exact: true }).click();
  await expectStyle(page, { frame: "device" });
  await expectCanvasChanged(page, before);

  await setSlider(page, "Shadow", 0);
  await expectStyle(page, { shadow: 0 });
  before = await canvasSnapshot(page);
  await setSlider(page, "Shadow", 75);
  await expectStyle(page, { shadow: 75 });
  await expectCanvasChanged(page, before);
  before = await canvasSnapshot(page);
  await setSlider(page, "Padding", 140);
  await expectStyle(page, { padding: 140 });
  await expectCanvasChanged(page, before);
  before = await canvasSnapshot(page);
  await setSlider(page, "Corner radius", 32);
  await expectStyle(page, { radius: 32 });
  await expectCanvasChanged(page, before);

  for (const size of ["square", "portrait", "landscape", "portrait"] as const) {
    await page.getByLabel("Output size", { exact: true }).selectOption(size);
    await expectStyle(page, { size });
    await expect
      .poll(() =>
        page.getByTestId("composition-canvas").evaluate((canvas) => {
          const image = canvas as HTMLCanvasElement;
          return image.width / image.height;
        }),
      )
      .toBeCloseTo(SIZES[size].width / SIZES[size].height, 2);
  }
  await page.getByLabel("Export scale", { exact: true }).selectOption("2");
  await expectStyle(page, { size: "portrait", scale: 2 });
  const clipboardSupported = await supportsClipboardPng(page);
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  let encoded: Buffer;
  if (clipboardSupported) {
    encoded = await clipboardPng(page);
  } else {
    await expect(page.getByTestId("notification")).toContainText(/download.*instead|download.*png/i);
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PNG", exact: true }).click();
    const path = await (await pending).path();
    encoded = await readFile(path!);
  }
  const png = await pngPixels(encoded);
  expect({ width: png.width, height: png.height }).toEqual({
    width: 2160,
    height: 2700,
  });
  expect(png.pixel(0, 0)[3]).toBe(255);
  expect(
    png.pixel(Math.floor(png.width / 2), Math.floor(png.height / 2)),
  ).not.toEqual(png.pixel(0, 0));
  await expect
    .poll(async () => (await readStore(page))?.jobs)
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: clipboardSupported ? "clipboard" : "download",
          status: "succeeded",
          width: 2160,
          height: 2700,
        }),
      ]),
    );
  await expect(page.getByTestId("notification")).toContainText(
    clipboardSupported ? /copied/i : /downloaded/i,
  );
});

test("presets apply to the next screenshot, persist on reload, and can be renamed and deleted", async ({
  page,
}) => {
  const name = "Product launch";
  const renamed = "Release notes";
  await openEditor(page);
  await page.getByRole("button", { name: "Use example", exact: true }).click();
  await sourceFromStore(page);
  await selectBackground(page, alternateBackground);
  await setSlider(page, "Padding", 120);
  await setSlider(page, "Corner radius", 24);
  await setSlider(page, "Shadow", 60);
  await page
    .getByRole("button", { name: "Browser frame", exact: true })
    .click();
  await page.getByRole("button", { name: "Dark frame", exact: true }).click();
  await page.getByLabel("Output size", { exact: true }).selectOption("square");
  await page.getByLabel("Export scale", { exact: true }).selectOption("2");
  await expectStyle(page, {
    background: alternateBackground.id,
    padding: 120,
    radius: 24,
    shadow: 60,
    frame: "browser",
    appearance: "dark",
    size: "square",
    scale: 2,
  });
  const savedStyle = (await readStore(page))!.composition.style;
  await page.getByRole("button", { name: "Save preset", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Preset name", { exact: true })
    .fill(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save preset", exact: true })
    .click();
  await expect
    .poll(async () => (await readStore(page))?.presets)
    .toEqual([expect.objectContaining({ name, style: savedStyle })]);
  expect((await readStore(page))!.presets[0]).not.toHaveProperty("source");
  expect(JSON.stringify((await readStore(page))!.presets[0])).not.toContain(
    "data:image/",
  );

  const nextColor = { r: 20, g: 184, b: 166 };
  const nextSource = await uploadSolid(
    page,
    "next-screenshot.png",
    900,
    900,
    nextColor,
  );
  await selectBackground(page, solidBackground);
  await setSlider(page, "Padding", 40);
  await setSlider(page, "Corner radius", 0);
  await setSlider(page, "Shadow", 0);
  await page.getByRole("button", { name: "No frame", exact: true }).click();
  await page.getByRole("button", { name: "Light frame", exact: true }).click();
  await page
    .getByLabel("Output size", { exact: true })
    .selectOption("portrait");
  await page.getByLabel("Export scale", { exact: true }).selectOption("1");
  await expectStyle(page, {
    background: solidBackground.id,
    frame: "none",
    size: "portrait",
    scale: 1,
  });
  await page.getByRole("button", { name: "My presets", exact: true }).click();
  await page
    .getByRole("button", { name: `Apply ${name}`, exact: true })
    .click();
  const appliedStyle = { ...savedStyle, size: "portrait" as const, scale: 1 as const };
  await expectStyle(page, appliedStyle);
  expect((await readStore(page))!.composition.source).toEqual(nextSource);

  await page.reload();
  expect(await sourceFromStore(page, "next-screenshot.png")).toEqual(
    nextSource,
  );
  await expectStyle(page, appliedStyle);
  await expectCenterColor(page, nextColor);
  await page.getByRole("button", { name: "My presets", exact: true }).click();
  await page
    .getByRole("button", { name: `Rename ${name}`, exact: true })
    .click();
  await page.getByLabel("Preset name", { exact: true }).fill(renamed);
  await page
    .getByRole("button", { name: "Rename preset", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await readStore(page))?.presets.map((preset) => preset.name),
    )
    .toEqual([renamed]);

  const deleteButton = page.getByRole("button", {
    name: `Delete ${renamed}`,
    exact: true,
  });
  if (!(await deleteButton.isVisible()))
    await page.getByRole("button", { name: "My presets", exact: true }).click();
  await deleteButton.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete preset", exact: true })
    .click();
  await expect.poll(async () => (await readStore(page))?.presets).toEqual([]);
  expect((await readStore(page))!.composition.source).toEqual(nextSource);
  await expectStyle(page, appliedStyle);
  await page.reload();
  expect(await sourceFromStore(page, "next-screenshot.png")).toEqual(
    nextSource,
  );
  await expectStyle(page, appliedStyle);
  await page.getByRole("button", { name: "My presets", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Apply ${renamed}`, exact: true }),
  ).toHaveCount(0);
});

test.describe("Mobile editor", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test("empty, composed, and dialog states fit a 390 × 844 viewport", async ({
    page,
  }) => {
    await openEditor(page);
    await expect(
      page.getByRole("button", { name: "Use example", exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page
      .getByRole("button", { name: "Use example", exact: true })
      .click();
    await sourceFromStore(page);
    await expect(page.getByTestId("composition-canvas")).toBeVisible();
    await page
      .getByLabel("Output size", { exact: true })
      .selectOption("portrait");
    await showInspector(page, "Frame");
    await page
      .getByRole("button", { name: "Device frame", exact: true })
      .click();
    await expectStyle(page, { size: "portrait", frame: "device" });
    await expectNoHorizontalOverflow(page);
    await page
      .getByRole("button", { name: "Save preset", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByLabel("Preset name", { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
