import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  LEGACY_STORE_KEY,
  STORE_KEY,
  downloadBytes,
  expectStyle,
  exportPng,
  pngPixels,
  readStore,
  solidFile,
  sourceFromStore,
  uploadSolid,
} from "./helpers";

const legacyFixture = JSON.parse(readFileSync(new URL("../fixtures/recovery-state.json", import.meta.url), "utf8"));

test("@critical V1 legacy key migrates to schema 2 without removing source, preset IDs, jobs or the original backup", async ({ page }) => {
  const file = await solidFile("legacy.png");
  const legacy = structuredClone(legacyFixture);
  legacy.composition.status = "ready";
  legacy.composition.source = { name: file.name, dataUrl: `data:image/png;base64,${file.buffer.toString("base64")}`, width: 640, height: 360 };
  legacy.composition.style = { ...legacy.composition.style, size: "square", padding: 100, radius: 20, scale: 2 };
  const raw = JSON.stringify(legacy);
  await page.addInitScript(({ key, raw }) => {
    if (sessionStorage.getItem("legacy-seeded")) return;
    localStorage.setItem(key, raw);
    sessionStorage.setItem("legacy-seeded", "1");
  }, { key: LEGACY_STORE_KEY, raw });
  await page.goto("/");
  await sourceFromStore(page, "legacy.png");
  await expect.poll(async () => (await readStore(page))?.version).toBe(2);
  await expectStyle(page, { size: "square", scale: 2, padding: 68, radius: 14 });
  const migrated = (await readStore(page))!;
  expect(migrated.composition.source).toEqual(legacy.composition.source);
  expect(migrated.composition.annotations).toEqual([]);
  expect(migrated.presets[0]).toMatchObject({ id: "seed-product-updates", name: "Product updates", createdAt: legacy.presets[0].createdAt, style: { size: "square", padding: 68, radius: 12 } });
  expect(migrated.jobs[0]).toMatchObject({ id: "seed-interrupted-export", kind: "clipboard", status: "failed", error: "interrupted", total: 1, completed: 0, failed: 1, formats: ["landscape"], scale: 1 });
  expect(await page.evaluate(key => localStorage.getItem(key), LEGACY_STORE_KEY)).toBe(raw);
  await page.getByLabel("Output size", { exact: true }).selectOption("story");
  await expectStyle(page, { size: "story" });
  await page.reload();
  await sourceFromStore(page, "legacy.png");
  await expectStyle(page, { size: "story", scale: 2 });
  expect(await page.evaluate(key => localStorage.getItem(key), LEGACY_STORE_KEY)).toBe(raw);
});

test("authoritative corrupt V2 data blocks fallback, raw backup preserves both keys, session export works and confirmed clear removes both", async ({ page }) => {
  const corrupt = "{corrupt-picwiz-v2";
  const legacy = JSON.stringify(legacyFixture);
  await page.addInitScript(({ key, legacyKey, corrupt, legacy }) => {
    if (sessionStorage.getItem("recovery-seeded")) return;
    localStorage.setItem(key, corrupt);
    localStorage.setItem(legacyKey, legacy);
    localStorage.setItem("unrelated-workspace", "keep me");
    sessionStorage.setItem("recovery-seeded", "1");
  }, { key: STORE_KEY, legacyKey: LEGACY_STORE_KEY, corrupt, legacy });
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: /invalid|corrupt|saved browser data/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Backup local data", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Session-only editing", exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), STORE_KEY)).toBe(corrupt);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Backup local data", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^picwiz.*\.json$/);
  const backup = JSON.parse((await downloadBytes(download)).toString("utf8"));
  expect(backup).toMatchObject({ app: "picwiz", type: "local-data-backup", keys: { [STORE_KEY]: corrupt, [LEGACY_STORE_KEY]: legacy } });
  await page.getByRole("button", { name: "Session-only editing", exact: true }).click();
  // A blocked repository must still allow local import, annotation and PNG export.
  await page.getByLabel("Upload screenshot", { exact: true }).setInputFiles(await solidFile("session-only.png"));
  await expect(page.getByRole("button", { name: "Export PNG", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Add text", exact: true }).click();
  const png = await pngPixels(await exportPng(page));
  expect([png.width, png.height]).toEqual([1600, 900]);
  expect(await page.evaluate(key => localStorage.getItem(key), STORE_KEY)).toBe(corrupt);
  await expect(page.getByText("Saved on this device", { exact: true })).not.toBeVisible();

  // Session-only may retain the recovery bar, or expose reset from Help.
  const clear = page.getByRole("button", { name: "Clear local data", exact: true });
  if (!(await clear.isVisible())) await page.getByRole("button", { name: "Help and privacy", exact: true }).click();
  await clear.click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), STORE_KEY)).toBe(corrupt);
  if (!(await clear.isVisible())) await page.getByRole("button", { name: "Help and privacy", exact: true }).click();
  await clear.click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear local data", exact: true }).click();
  await expect.poll(async () => (await readStore(page))?.composition.source ?? null).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), LEGACY_STORE_KEY)).toBeNull();
  const cleared = await readStore(page);
  if (cleared) expect(cleared).toMatchObject({ version: 2, composition: { status: "empty", source: null, annotations: [] }, presets: [], jobs: [] });
  expect(await page.evaluate(() => localStorage.getItem("unrelated-workspace"))).toBe("keep me");
  await uploadSolid(page, "after-clear-v2.png", 640, 360);
  await page.reload();
  await sourceFromStore(page, "after-clear-v2.png");
  expect(await page.evaluate(key => localStorage.getItem(key), LEGACY_STORE_KEY)).toBeNull();
});
