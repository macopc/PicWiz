import { expect, test, type Page } from "@playwright/test";
import {
  OUTPUT_SIZES,
  annotationPercent,
  annotationState,
  canvasSnapshot,
  expectStyle,
  exportPng,
  openEditor,
  pngPixels,
  readStore,
  selectBackground,
  setSlider,
  showInspector,
  uploadSolid,
} from "./helpers";

const INK = [119, 86, 220, 255];
const BLUE = { r: 30, g: 110, b: 190 };

async function position(page: Page, x: number, y: number, width: number, height: number) {
  await annotationPercent(page, "Width", 20);
  await annotationPercent(page, "Height", 20);
  await annotationPercent(page, "X", x);
  await annotationPercent(page, "Y", y);
  await annotationPercent(page, "Width", width);
  await annotationPercent(page, "Height", height);
}

async function plainComposition(page: Page) {
  await selectBackground(page, { name: "Paper", kind: "solid" });
  await page.getByRole("button", { name: "No frame", exact: true }).click();
  await setSlider(page, "Padding", 80);
  await setSlider(page, "Corner radius", 0);
  await setSlider(page, "Shadow", 0);
  await expectStyle(page, { frame: "none", padding: 80, radius: 0, shadow: 0 });
}

// Fixture is 2:1, unframed, 80px padding. Independent fit geometry for PNG assertions.
function imageRect(width: number, height: number, scale: number) {
  const padding = 80 * scale;
  const fittedWidth = Math.min(width - padding * 2, (height - padding * 2) * 2);
  const fittedHeight = fittedWidth / 2;
  return { x: (width - fittedWidth) / 2, y: (height - fittedHeight) / 2, width: fittedWidth, height: fittedHeight };
}

function inkBounds(png: Awaited<ReturnType<typeof pngPixels>>, region?: { x: number; y: number; width: number; height: number }) {
  const area = region ?? { x: 0, y: 0, width: png.width, height: png.height };
  let left = Infinity, top = Infinity, right = -1, bottom = -1, count = 0;
  for (let y = Math.max(0, Math.floor(area.y)); y < Math.min(png.height, area.y + area.height); y++) {
    for (let x = Math.max(0, Math.floor(area.x)); x < Math.min(png.width, area.x + area.width); x++) {
      const pixel = png.pixel(x, y);
      if (pixel.every((channel, index) => Math.abs(channel - INK[index]) <= 5)) {
        count++;
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
  }
  return { left, top, right, bottom, count };
}

test("@critical three annotation types support selection, keyboard movement, editing, deletion, undo/redo and refresh", async ({ page }) => {
  await openEditor(page);
  await uploadSolid(page, "annotation-edit.png", 800, 400, BLUE);
  for (const type of ["arrow", "rectangle", "text"]) {
    await page.getByRole("button", { name: `Add ${type}`, exact: true }).click();
  }
  await expect.poll(async () => (await annotationState(page)).map(item => item.type)).toEqual(["arrow", "rectangle", "text"]);
  await showInspector(page, "Annotate");
  const literal = "<b>Ship it</b>\nSecond line\nThird line";
  const text = page.getByLabel("Annotation text", { exact: true });
  await text.fill(literal);
  await text.press("Tab");
  await page.getByLabel("Annotation color", { exact: true }).selectOption("#7756dc");
  await page.getByLabel("Annotation font size", { exact: true }).selectOption("0.045");
  await position(page, 15, 55, 65, 30);
  await expect.poll(async () => (await annotationState(page))[2]).toMatchObject({ text: literal, color: "#7756dc", fontSize: 0.045, x: 0.15, y: 0.55, width: 0.65, height: 0.3 });

  // Delete inside a text field remains native text editing, never a layer deletion.
  await text.focus();
  await text.press("End");
  await text.press("Delete");
  await expect.poll(() => annotationState(page)).toHaveLength(3);
  await page.getByRole("button", { name: /^Select annotation 1:/ }).click();
  await page.getByLabel("Annotation stroke", { exact: true }).selectOption("8");
  await page.getByRole("button", { name: "Flip arrow horizontally", exact: true }).click();
  await page.getByRole("button", { name: "Flip arrow vertically", exact: true }).click();
  await expect.poll(async () => (await annotationState(page))[0]).toMatchObject({ stroke: 8, flipX: true, flipY: true });
  const beforeMove = (await annotationState(page))[0];
  const layer = page.getByRole("button", { name: "Move arrow annotation 1", exact: true });
  await layer.focus();
  await layer.press("ArrowRight");
  await layer.press("Shift+ArrowDown");
  await expect.poll(async () => (await annotationState(page))[0].x).toBeCloseTo(beforeMove.x + 0.01, 5);
  await expect.poll(async () => (await annotationState(page))[0].y).toBeCloseTo(beforeMove.y + 0.05, 5);
  const moved = await annotationState(page);
  await layer.press("ControlOrMeta+z");
  await expect.poll(async () => (await annotationState(page))[0].y).toBeCloseTo(beforeMove.y, 5);
  await layer.press("ControlOrMeta+Shift+z");
  await expect.poll(() => annotationState(page)).toEqual(moved);
  await layer.press("Delete");
  await expect.poll(() => annotationState(page)).toHaveLength(2);
  await expect(page.locator(":focus")).toHaveAccessibleName(/Select annotation|Add |Move /);
  await page.getByRole("button", { name: "Undo annotation", exact: true }).click();
  await expect.poll(() => annotationState(page)).toEqual(moved);
  await expect(page.locator(":focus")).toHaveAccessibleName(/Move arrow annotation 1|Select annotation 1/);
  await page.getByRole("button", { name: "Redo annotation", exact: true }).click();
  await expect.poll(() => annotationState(page)).toHaveLength(2);
  await page.getByRole("button", { name: "Undo annotation", exact: true }).click();
  await page.getByRole("button", { name: /^Select annotation 2:/ }).click();
  await page.getByRole("button", { name: "Delete annotation", exact: true }).click();
  await expect.poll(async () => (await annotationState(page)).map(item => item.type)).toEqual(["arrow", "text"]);
  const saved = await annotationState(page);
  await page.reload();
  await expect.poll(() => annotationState(page)).toEqual(saved);
  await expect(page.getByRole("button", { name: "Undo annotation", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: /^Select annotation 2:/ }).click();
  await expect(page.getByLabel("Annotation text", { exact: true })).toHaveValue(literal);
});

test("@critical real PNG contains arrow, rectangle and literal text ink clipped to the screenshot", async ({ page }) => {
  await openEditor(page);
  await uploadSolid(page, "annotation-pixels.png", 800, 400, BLUE);
  await plainComposition(page);
  for (const [index, type] of ["arrow", "rectangle", "text"].entries()) {
    await page.getByRole("button", { name: `Add ${type}`, exact: true }).click();
    await showInspector(page, "Annotate");
    await page.getByLabel("Annotation color", { exact: true }).selectOption("#7756dc");
    if (type === "text") {
      await page.getByLabel("Annotation text", { exact: true }).fill("Launch notes\nReady to share");
      await page.getByLabel("Annotation font size", { exact: true }).selectOption("0.045");
      await position(page, 10, 60, 65, 25);
    } else {
      await page.getByLabel("Annotation stroke", { exact: true }).selectOption("8");
      await position(page, index === 0 ? 10 : 55, 10, 25, 25);
    }
  }
  const png = await pngPixels(await exportPng(page));
  const rect = imageRect(1600, 900, 1);
  for (const [x, y, width, height] of [[0.08, 0.08, 0.3, 0.3], [0.53, 0.08, 0.3, 0.3], [0.08, 0.58, 0.7, 0.3]]) {
    const region = { x: rect.x + rect.width * x, y: rect.y + rect.height * y, width: rect.width * width, height: rect.height * height };
    expect(inkBounds(png, region).count).toBeGreaterThan(30);
  }
  // Neither the blue source nor the solid Paper background contains annotation ink.
  expect(inkBounds(png, { x: rect.x, y: 0, width: rect.width, height: rect.y - 5 }).count).toBe(0);
});

test("rectangle PNG anchoring remains in source coordinates across size and scale", async ({ page }) => {
  await openEditor(page);
  await uploadSolid(page, "anchored.png", 800, 400, BLUE);
  await plainComposition(page);
  await page.getByRole("button", { name: "Add rectangle", exact: true }).click();
  await showInspector(page, "Annotate");
  await position(page, 25, 25, 25, 25);
  await page.getByLabel("Annotation color", { exact: true }).selectOption("#7756dc");
  await page.getByLabel("Annotation stroke", { exact: true }).selectOption("8");
  await expect.poll(async () => (await annotationState(page))[0]).toMatchObject({ x: 0.25, y: 0.25, width: 0.25, height: 0.25 });
  const saved = await annotationState(page);
  for (const [size, scale] of [["landscape", 1], ["story", 1], ["linkedin", 2]] as const) {
    await page.getByLabel("Output size", { exact: true }).selectOption(size);
    await page.getByLabel("Export scale", { exact: true }).selectOption(String(scale));
    await expectStyle(page, { size, scale });
    const expected = OUTPUT_SIZES[size];
    const png = await pngPixels(await exportPng(page));
    expect([png.width, png.height]).toEqual([expected.width * scale, expected.height * scale]);
    const rect = imageRect(png.width, png.height, scale);
    const bounds = inkBounds(png, rect);
    expect(bounds.count).toBeGreaterThan(100);
    const halfStroke = 4 * rect.width / 1600;
    const tolerance = 2;
    for (const [actual, wanted] of [
      [bounds.left, rect.x + rect.width * 0.25 - halfStroke],
      [bounds.right, rect.x + rect.width * 0.5 + halfStroke],
      [bounds.top, rect.y + rect.height * 0.25 - halfStroke],
      [bounds.bottom, rect.y + rect.height * 0.5 + halfStroke],
    ]) expect(Math.abs(actual - wanted)).toBeLessThanOrEqual(tolerance);
    expect(await annotationState(page)).toEqual(saved);
  }
  await page.reload();
  await expect.poll(() => annotationState(page)).toEqual(saved);
});

test("successful replacement resets annotation history; a bad replacement preserves it", async ({ page }) => {
  await openEditor(page);
  const source = await uploadSolid(page, "keep.png", 800, 400, BLUE);
  await page.getByRole("button", { name: "Add rectangle", exact: true }).click();
  await expect.poll(() => annotationState(page)).toHaveLength(1);
  const annotations = await annotationState(page);
  await page.getByLabel("Upload screenshot", { exact: true }).setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not a PNG") });
  await expect(page.getByTestId("notification")).toContainText(/image|decode|invalid/i);
  expect((await readStore(page))!.composition.source).toEqual(source);
  expect(await annotationState(page)).toEqual(annotations);
  await uploadSolid(page, "new.png", 800, 400, BLUE);
  await expect.poll(() => annotationState(page)).toEqual([]);
  await expect(page.getByRole("button", { name: "Undo annotation", exact: true })).toBeDisabled();
});

test.describe("annotation pointer coordinates at DPR 2", () => {
  test.use({ deviceScaleFactor: 2 });

  test("CSS-scaled drag commits one history step and pointercancel restores the preview without saving", async ({ page }) => {
    await openEditor(page);
    await uploadSolid(page, "pointer.png", 800, 400, BLUE);
    await plainComposition(page);
    await page.getByRole("button", { name: "Add rectangle", exact: true }).click();
    await showInspector(page, "Annotate");
    await position(page, 25, 25, 25, 25);
    await expect.poll(async () => (await annotationState(page))[0]).toMatchObject({ x: 0.25, y: 0.25, width: 0.25, height: 0.25 });
    const original = await annotationState(page);
    const overlay = page.getByTestId("annotation-layer");
    await overlay.scrollIntoViewIfNeeded();
    const box = (await overlay.boundingBox())!;
    expect(box.width).toBeLessThan(1600);
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
    const rect = imageRect(1600, 900, 1);
    const start = {
      x: box.x + (rect.x + rect.width * 0.375) / 1600 * box.width,
      y: box.y + (rect.y + rect.height * 0.375) / 900 * box.height,
    };
    const end = { x: start.x + rect.width * 0.1 / 1600 * box.width, y: start.y + rect.height * 0.1 / 900 * box.height };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 4 });
    expect(await annotationState(page), "pointermove preview must not write local storage").toEqual(original);
    await page.mouse.up();
    await expect.poll(async () => (await annotationState(page))[0].x).toBeCloseTo(0.35, 2);
    await expect.poll(async () => (await annotationState(page))[0].y).toBeCloseTo(0.35, 2);
    await page.getByRole("button", { name: "Undo annotation", exact: true }).click();
    await expect.poll(() => annotationState(page)).toEqual(original);
    await expect(page.getByRole("button", { name: "Redo annotation", exact: true })).toBeEnabled();
    const beforeCancel = await canvasSnapshot(page);
    await overlay.evaluate(element => element.addEventListener("pointerdown", event => {
      element.setAttribute("data-test-pointer-id", String((event as PointerEvent).pointerId));
    }, { once: true }));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 2 });
    const pointerId = Number(await overlay.getAttribute("data-test-pointer-id"));
    expect(pointerId).toBeGreaterThan(0);
    await overlay.dispatchEvent("pointercancel", { bubbles: true, pointerId });
    await page.mouse.up();
    await expect.poll(() => canvasSnapshot(page)).toEqual(beforeCancel);
    expect(await annotationState(page)).toEqual(original);
    await expect(page.getByRole("button", { name: "Redo annotation", exact: true })).toBeEnabled();
  });
});
