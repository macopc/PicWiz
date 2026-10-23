import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEFAULT_STYLE } from "../../lib/domain";
import {
  expectStyle,
  openEditor,
  readStore,
  setSlider,
  sourceFromStore,
  uploadSolid,
} from "./helpers";
const recovery = JSON.parse(
  readFileSync(
    new URL("../fixtures/recovery-state.json", import.meta.url),
    "utf8",
  ),
);

test("clipboard permission failure leaves the screenshot intact and download recovers", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: () =>
          Promise.reject(
            new DOMException("Permission denied", "NotAllowedError"),
          ),
      },
    }),
  );
  await openEditor(page);
  const source = await uploadSolid(page, "clipboard-recovery.png", 1440, 740);
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(page.getByTestId("notification")).toContainText(
    /permission.*denied.*download/i,
  );
  await expect
    .poll(async () => (await readStore(page))?.jobs.at(-1)?.status)
    .toBe("failed");
  expect((await readStore(page))?.composition.source).toEqual(source);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("shinyshot-1600x900.png");
  await expect
    .poll(async () => (await readStore(page))?.jobs.at(-1)?.status)
    .toBe("succeeded");
});

test("corrupt browser data is preserved until a scoped confirmed clear, then saving works", async ({
  page,
}) => {
  const corrupt = "{broken local data";
  await page.addInitScript((value) => {
    if (localStorage.getItem("shinyshot:store") === null)
      localStorage.setItem("shinyshot:store", value);
  }, corrupt);
  await page.goto("/");
  await expect(page.getByText(/saved browser data is invalid/i)).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("shinyshot:store")),
  ).toBe(corrupt);
  await page
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("every saved preset");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem("shinyshot:store")),
  ).toBe(corrupt);
  await page
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear local data", exact: true })
    .click();
  await expect
    .poll(async () => (await readStore(page))?.composition.status)
    .toBe("empty");
  await expect(
    page.getByRole("button", { name: "Use example", exact: true }),
  ).toBeEnabled();
  await uploadSolid(page, "after-clear.png", 1000, 600);
  await page.reload();
  await sourceFromStore(page, "after-clear.png");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
});

test("interrupted export seed recovers atomically and reset style keeps image and presets", async ({
  page,
}) => {
  await page.addInitScript((value) => {
    if (localStorage.getItem("shinyshot:store") === null)
      localStorage.setItem("shinyshot:store", JSON.stringify(value));
  }, recovery);
  await page.goto("/");
  await expect(page.getByTestId("notification")).toContainText(
    /previous export was interrupted/i,
  );
  await expect
    .poll(async () => (await readStore(page))?.jobs[0]?.status)
    .toBe("failed");
  const source = await uploadSolid(page, "keep-me.png", 1000, 600);
  await setSlider(page, "Padding", 150);
  await expectStyle(page, { padding: 150 });
  await page
    .getByRole("button", { name: "Reset style to defaults", exact: true })
    .click();
  await expectStyle(page, DEFAULT_STYLE);
  expect((await readStore(page))?.composition.source).toEqual(source);
  expect((await readStore(page))?.presets).toHaveLength(1);
  await page.reload();
  await sourceFromStore(page, "keep-me.png");
  await expect(page.getByTestId("notification")).toHaveCount(0);
});

test("paste imports a screenshot without a network submission", async ({
  page,
}) => {
  await openEditor(page);
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 450;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#336699";
    context.fillRect(0, 0, 800, 450);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "pasted.png", { type: "image/png" }));
    document.body.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }),
    );
  });
  await sourceFromStore(page, "pasted.png");
  await expect(
    page.getByRole("button", { name: "Export PNG", exact: true }),
  ).toBeEnabled();
});
