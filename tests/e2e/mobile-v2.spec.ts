import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";
import sharp from "sharp";
import {
  annotationState,
  downloadBytes,
  expectNoHorizontalOverflow,
  expectStyle,
  openEditor,
  readStore,
  showInspector,
  uploadSolid,
} from "./helpers";

test.describe("390 × 844 browser viewport (not physical phone evidence)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("keyboard-accessible annotations, format selection and batch download fit the mobile workspace", async ({ page }) => {
    await openEditor(page);
    await uploadSolid(page, "mobile.png", 640, 360);
    await expectNoHorizontalOverflow(page);
    const add = page.getByRole("button", { name: "Add text", exact: true });
    await add.focus();
    await add.press("Enter");
    await showInspector(page, "Annotate");
    const text = page.getByLabel("Annotation text", { exact: true });
    await text.focus();
    await text.press("ControlOrMeta+A");
    await page.keyboard.insertText("Ready for launch");
    await text.press("Tab");
    await expect.poll(async () => (await annotationState(page))[0]?.text).toBe("Ready for launch");
    const move = page.getByRole("button", { name: "Move text annotation 1", exact: true });
    const before = (await annotationState(page))[0];
    await move.focus();
    await move.press("ArrowRight");
    await expect.poll(async () => (await annotationState(page))[0]?.x).toBeCloseTo(before.x + 0.01, 5);
    await move.press("Delete");
    await expect.poll(() => annotationState(page)).toEqual([]);
    const undo = page.getByRole("button", { name: "Undo annotation", exact: true });
    await undo.focus();
    await undo.press("Enter");
    await expect.poll(() => annotationState(page)).toHaveLength(1);

    const size = page.getByLabel("Output size", { exact: true });
    await size.focus();
    await size.selectOption("story");
    await page.getByLabel("Export scale", { exact: true }).selectOption("1");
    await expectStyle(page, { size: "story", scale: 1 });
    await expectNoHorizontalOverflow(page);
    const opener = page.getByRole("button", { name: "Batch export", exact: true });
    await opener.focus();
    await opener.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Batch export", exact: true });
    await expect(dialog).toBeVisible();
    await expectNoHorizontalOverflow(page);
    for (const checkbox of await dialog.getByRole("checkbox", { name: /^Batch size: / }).all()) {
      if (await checkbox.isChecked()) { await checkbox.focus(); await checkbox.press("Space"); }
    }
    for (const label of ["Story", "LinkedIn"]) {
      const checkbox = dialog.getByRole("checkbox", { name: `Batch size: ${label}`, exact: true });
      await checkbox.focus();
      await checkbox.press("Space");
      await expect(checkbox).toBeChecked();
    }
    const prepare = dialog.getByRole("button", { name: "Prepare ZIP", exact: true });
    await prepare.scrollIntoViewIfNeeded();
    const bounds = await prepare.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    await prepare.focus();
    await prepare.press("Enter");
    const downloadButton = dialog.getByRole("button", { name: "Download ZIP", exact: true });
    await expect(downloadButton).toBeEnabled();
    const pending = page.waitForEvent("download");
    await downloadButton.focus();
    await downloadButton.press("Enter");
    const archive = unzipSync(new Uint8Array(await downloadBytes(await pending)));
    const names = Object.keys(archive).filter(name => name.endsWith(".png"));
    expect(names).toHaveLength(2);
    const dimensions = await Promise.all(names.map(name => sharp(archive[name]).metadata()));
    expect(dimensions.map(({ width, height }) => [width, height])).toEqual(expect.arrayContaining([[1080, 1920], [1200, 627]]));
    await expectNoHorizontalOverflow(page);
    const close = dialog.getByRole("button", { name: "Close batch export", exact: true });
    await close.focus();
    await close.press("Enter");
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    expect((await readStore(page))!.composition.annotations[0].text).toBe("Ready for launch");
  });
});
