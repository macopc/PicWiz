import { expect, test, type Page } from "@playwright/test";
import {
  OUTPUT_SIZES,
  annotationState,
  canvasSnapshot,
  expectCanvasChanged,
  expectCenterColor,
  expectSourcePixel,
  expectStyle,
  exportPng,
  openBatch,
  openEditor,
  pngPixels,
  readStore,
  selectBackground,
  setSlider,
  showInspector,
  solidFile,
  sourceFromStore,
  uploadSolid,
} from "./helpers";

const BLUE = { r: 30, g: 110, b: 190 };
const MINT = { r: 20, g: 184, b: 166 };
const INK = [119, 86, 220, 255];

async function pastePng(
  page: Page,
  file: Awaited<ReturnType<typeof solidFile>>,
) {
  return page.evaluate(
    ({ name, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (character) =>
        character.charCodeAt(0),
      );
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name, { type: "image/png" }));
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer,
      });
      // Firefox removes files from constructed (untrusted) ClipboardEvents.
      // Inject only this event-payload boundary, retaining real File bytes and
      // the actual importer/renderer. This is not OS clipboard capability proof.
      if (!event.clipboardData?.files.length)
        Object.defineProperty(event, "clipboardData", { value: transfer });
      // Preserve the real focused target: a modal button must reach the global
      // handler without accidentally taking its INPUT/TEXTAREA early return.
      (document.activeElement ?? document.body).dispatchEvent(event);
      return event.defaultPrevented;
    },
    { name: file.name, base64: file.buffer.toString("base64") },
  );
}

function inkPixels(png: Awaited<ReturnType<typeof pngPixels>>) {
  let count = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (
        png
          .pixel(x, y)
          .every((channel, index) => Math.abs(channel - INK[index]) <= 5)
      )
        count++;
    }
  }
  return count;
}

test("@critical releasing an old annotation drag after PNG paste cannot mark the replacement source", async ({
  page,
}) => {
  await openEditor(page);
  const originalSource = await uploadSolid(
    page,
    "drag-original.png",
    800,
    400,
    BLUE,
  );
  await selectBackground(page, { name: "Paper", kind: "solid" });
  await page.getByRole("button", { name: "No frame", exact: true }).click();
  await setSlider(page, "Padding", 80);
  await setSlider(page, "Corner radius", 0);
  await setSlider(page, "Shadow", 0);
  await expectStyle(page, {
    frame: "none",
    padding: 80,
    radius: 0,
    shadow: 0,
    size: "landscape",
    scale: 1,
  });
  await page
    .getByRole("button", { name: "Add rectangle", exact: true })
    .click();
  await showInspector(page, "Annotate");
  await page
    .getByLabel("Annotation color", { exact: true })
    .selectOption("#7756dc");
  await page.getByLabel("Annotation stroke", { exact: true }).selectOption("8");
  await expect
    .poll(() => annotationState(page))
    .toMatchObject([{ type: "rectangle", color: "#7756dc", stroke: 8 }]);
  const originalAnnotations = await annotationState(page);
  const beforeDrag = await canvasSnapshot(page);
  const replacement = await solidFile("drag-replacement.png", MINT, 800, 400);
  const mark = page.getByRole("button", {
    name: "Move rectangle annotation 1",
    exact: true,
  });
  await mark.scrollIntoViewIfNeeded();
  await mark.focus();
  const box = await mark.locator("rect.annotation-hit").boundingBox();
  expect(box).not.toBeNull();
  const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  try {
    await page.mouse.move(start.x + box!.width / 3, start.y + box!.height / 3, {
      steps: 4,
    });
    await expectCanvasChanged(page, beforeDrag);
    expect(
      await annotationState(page),
      "the held drag is preview-only",
    ).toEqual(originalAnnotations);

    expect(await pastePng(page, replacement)).toBe(true);
    const source = await sourceFromStore(page, replacement.name);
    expect(source.dataUrl).not.toBe(originalSource.dataUrl);
    await expectCenterColor(page, MINT);
    await expect.poll(() => annotationState(page)).toEqual([]);
    // The replacement must finish while the original pointer is still down.
  } finally {
    await page.mouse.up();
  }

  await canvasSnapshot(page);
  await expect(mark).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Undo annotation", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Redo annotation", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => annotationState(page)).toEqual([]);
  const replacementSource = await sourceFromStore(page, replacement.name);

  const png = await pngPixels(await exportPng(page));
  expect({ width: png.width, height: png.height }).toEqual(
    OUTPUT_SIZES.landscape,
  );
  expectSourcePixel(png.pixel(png.width / 2, png.height / 2), MINT);
  expect(
    inkPixels(png),
    "the replacement PNG must contain no old rectangle ink",
  ).toBe(0);
  expect((await readStore(page))!.composition).toMatchObject({
    source: replacementSource,
    annotations: [],
  });

  await page.reload();
  expect(await sourceFromStore(page, replacement.name)).toEqual(
    replacementSource,
  );
  await expectCenterColor(page, MINT);
  await expect.poll(() => annotationState(page)).toEqual([]);
});

test("@critical PNG paste inside Batch preserves the editor and its history; closing Batch restores normal paste", async ({
  page,
}) => {
  await openEditor(page);
  await uploadSolid(page, "batch-paste-original.png", 800, 400, BLUE);
  await page
    .getByRole("button", { name: "Add rectangle", exact: true })
    .click();
  await expect.poll(() => annotationState(page)).toHaveLength(1);
  const rectangle = await annotationState(page);
  await page.getByRole("button", { name: "Add arrow", exact: true }).click();
  await expect.poll(() => annotationState(page)).toHaveLength(2);
  const bothMarks = await annotationState(page);
  const undo = page.getByRole("button", {
    name: "Undo annotation",
    exact: true,
  });
  const redo = page.getByRole("button", {
    name: "Redo annotation",
    exact: true,
  });
  await undo.click();
  await expect.poll(() => annotationState(page)).toEqual(rectangle);
  await expect(undo).toBeEnabled();
  await expect(redo).toBeEnabled();
  const before = (await readStore(page))!.composition;
  const beforePaste = await canvasSnapshot(page);
  const replacement = await solidFile(
    "batch-paste-replacement.png",
    MINT,
    800,
    400,
  );
  const dialog = await openBatch(page, ["landscape"]);
  const close = dialog.getByRole("button", {
    name: "Close batch export",
    exact: true,
  });
  await close.focus();
  await expect(close).toBeFocused();

  // Import acceptance prevents default synchronously. Checking that signal
  // avoids an unchanged-storage assertion passing before an unwanted decode.
  expect(
    await pastePng(page, replacement),
    "Batch must not accept an editor image paste",
  ).toBe(false);
  expect(await canvasSnapshot(page)).toEqual(beforePaste);
  expect((await readStore(page))!.composition).toEqual(before);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    `${before.source!.name} · keeps its 1 annotation`,
  );

  await close.click();
  await expect(dialog).not.toBeVisible();
  await expect(undo).toBeEnabled();
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect.poll(() => annotationState(page)).toEqual(bothMarks);
  await undo.click();
  await expect.poll(() => annotationState(page)).toEqual(rectangle);
  await undo.click();
  await expect.poll(() => annotationState(page)).toEqual([]);
  await redo.click();
  await expect.poll(() => annotationState(page)).toEqual(rectangle);

  // The exact same valid PNG is accepted after closing the modal.
  const batchOpener = page.getByRole("button", {
    name: "Batch export",
    exact: true,
  });
  await batchOpener.focus();
  await expect(batchOpener).toBeFocused();
  expect(await pastePng(page, replacement)).toBe(true);
  const replacementSource = await sourceFromStore(page, replacement.name);
  expect(replacementSource.dataUrl).not.toBe(before.source!.dataUrl);
  await expectCenterColor(page, MINT);
  await expect.poll(() => annotationState(page)).toEqual([]);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await batchOpener.press("ControlOrMeta+z");
  await batchOpener.press("ControlOrMeta+Shift+z");
  expect((await readStore(page))!.composition).toMatchObject({
    source: replacementSource,
    annotations: [],
  });
  await expect(
    page.getByRole("button", { name: /^Move (rectangle|arrow) annotation / }),
  ).toHaveCount(0);
});

test("@critical undo invalidates a held annotation drag and releasing preserves redo", async ({
  page,
}) => {
  await openEditor(page);
  await uploadSolid(page, "undo-drag.png", 800, 400, BLUE);
  await page
    .getByRole("button", { name: "Add rectangle", exact: true })
    .click();
  await expect.poll(() => annotationState(page)).toHaveLength(1);
  const original = await annotationState(page);
  const target = page.getByRole("button", {
    name: "Move rectangle annotation 1",
    exact: true,
  });
  await target.focus();
  const box = await target.locator("rect.annotation-hit").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(
      box!.x + box!.width * 0.8,
      box!.y + box!.height * 0.8,
      { steps: 3 },
    );
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => annotationState(page)).toEqual([]);
    await expect(
      page.getByRole("button", { name: "Redo annotation", exact: true }),
    ).toBeEnabled();
  } finally {
    await page.mouse.up();
  }
  await expect.poll(() => annotationState(page)).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Redo annotation", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Redo annotation", exact: true })
    .click();
  await expect.poll(() => annotationState(page)).toEqual(original);
});
