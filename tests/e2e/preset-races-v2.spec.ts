import { expect, test, type Page } from "@playwright/test";
import { createStore } from "../../lib/storage";
import {
  LEGACY_STORE_KEY,
  STORE_KEY,
  closeDialog,
  openEditor,
  openPresets,
  readStore,
  uploadSolid,
} from "./helpers";

type PresetRaceWindow = typeof window & {
  __heldPresetReads: number;
  __releasePresetText: () => Promise<number>;
  __presetImportSuccesses: string[];
};

function presetFile(name: string) {
  return {
    name: "pending-presets.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      app: "picwiz",
      type: "style-presets",
      version: 1,
      presets: [{
        name,
        style: {
          background: "paper",
          padding: 80,
          radius: 16,
          shadow: 20,
          frame: "browser",
          appearance: "light",
        },
      }],
    })),
  };
}

async function holdPresetText(page: Page, fileName: string) {
  await page.evaluate((name) => {
    const state = window as PresetRaceWindow;
    state.__heldPresetReads = 0;
    state.__presetImportSuccesses = [];
    const nativeText = File.prototype.text;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let reading: Promise<string> | undefined;

    // Hold one native file read, leaving parsing, validation and commits real.
    File.prototype.text = function () {
      if (this.name !== name || state.__heldPresetReads)
        return nativeText.call(this);
      state.__heldPresetReads += 1;
      reading = nativeText.call(this).then(async (text) => {
        await gate;
        return text;
      });
      return reading;
    };
    state.__releasePresetText = async () => {
      if (!reading) throw new Error("No preset file read is waiting");
      release();
      await reading;
      // Let Promise.race, the import continuation and React's render finish.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      return state.__heldPresetReads;
    };

    new MutationObserver(() => {
      for (const notification of document.querySelectorAll('[data-testid="notification"]')) {
        const text = notification.textContent ?? "";
        if (/\b\d+ presets? imported\b/i.test(text))
          state.__presetImportSuccesses.push(text);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }, fileName);
}

async function startHeldImport(page: Page, file: ReturnType<typeof presetFile>) {
  await holdPresetText(page, file.name);
  await openPresets(page);
  await page.getByLabel("Import preset file", { exact: true }).setInputFiles(file);
  await expect.poll(() => page.evaluate(() => (window as PresetRaceWindow).__heldPresetReads)).toBe(1);
  await expect(page.getByRole("button", { name: "Import presets", exact: true })).toBeDisabled();
}

async function expectNoImportSuccess(page: Page) {
  expect(await page.evaluate(() => (window as PresetRaceWindow).__presetImportSuccesses)).toEqual([]);
  await expect(page.getByTestId("notification").filter({ hasText: /\b\d+ presets? imported\b/i })).toHaveCount(0);
}

test("confirmed clear invalidates a pending preset file read and a fresh import still works", async ({ page }) => {
  await openEditor(page);
  await uploadSolid(page, "before-preset-clear.png", 640, 360);
  const file = presetFile("Delayed clear look");
  await startHeldImport(page, file);
  await closeDialog(page);

  await page.getByRole("button", { name: "Help and privacy", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear local data", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Clear your local workspace?");
  await page.getByRole("dialog").getByRole("button", { name: "Clear local data", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect.poll(() => readStore(page)).toMatchObject({
    version: 2,
    composition: { status: "empty", source: null, annotations: [] },
    presets: [],
    jobs: [],
  });
  const cleared = await readStore(page);
  const clearedRaw = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);

  expect(await page.evaluate(() => (window as PresetRaceWindow).__releasePresetText())).toBe(1);
  expect(await readStore(page)).toEqual(cleared);
  expect((await readStore(page))!.presets).toEqual([]);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORE_KEY)).toBe(clearedRaw);
  expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_STORE_KEY)).toBeNull();
  await expectNoImportSuccess(page);
  await expect(page.getByRole("button", { name: "Export PNG", exact: true })).toBeDisabled();

  await openPresets(page);
  await expect(page.getByRole("button", { name: "Apply Delayed clear look", exact: true })).toHaveCount(0);
  // Re-select the same valid file after cancellation; the native read now runs normally.
  await page.getByLabel("Import preset file", { exact: true }).setInputFiles(file);
  await expect.poll(async () => (await readStore(page))?.presets).toHaveLength(1);
  expect((await readStore(page))!.presets[0]).toMatchObject({
    name: "Delayed clear look",
    style: JSON.parse(file.buffer.toString("utf8")).presets[0].style,
  });
  await expect(page.getByTestId("notification")).toHaveText("1 preset imported · 0 already saved.");
  await expect(page.getByRole("button", { name: "Apply Delayed clear look", exact: true })).toBeVisible();
});

test("storage clear and either workspace key event invalidate a pending library read without overwriting new raw data", async ({ page }) => {
  await openEditor(page);
  for (const key of [null, STORE_KEY, LEGACY_STORE_KEY]) {
    await test.step(`storage event key ${String(key)}`, async () => {
      // A reload gives each event case a fresh mounted library and write epoch.
      const initial = createStore();
      await page.evaluate(({ storeKey, legacyKey, raw }) => {
        localStorage.removeItem(legacyKey);
        localStorage.setItem(storeKey, raw);
      }, { storeKey: STORE_KEY, legacyKey: LEGACY_STORE_KEY, raw: JSON.stringify(initial) });
      await page.reload();
      await expect(page.getByRole("button", { name: "Use example", exact: true })).toBeEnabled();
      await startHeldImport(page, presetFile("Stale other-tab look"));

      const authoritative = createStore();
      authoritative.composition.style.padding = 144;
      const newRaw = JSON.stringify(authoritative);
      // Emulate browser delivery after another tab changes storage. For clear(),
      // key/newValue are null even when a newer store exists by delivery time.
      await page.evaluate(({ key, storeKey, raw }) => {
        const oldValue = key === null ? null : localStorage.getItem(key);
        localStorage.setItem(storeKey, raw);
        if (key !== null && key !== storeKey) localStorage.setItem(key, raw);
        window.dispatchEvent(new StorageEvent("storage", {
          key,
          oldValue,
          newValue: key === null ? null : raw,
          storageArea: localStorage,
          url: window.location.href,
        }));
      }, { key, storeKey: STORE_KEY, raw: newRaw });
      await expect(page.getByText(/This workspace changed in another tab\./)).toBeVisible();

      expect(await page.evaluate(() => (window as PresetRaceWindow).__releasePresetText())).toBe(1);
      await expect(page.getByRole("button", { name: "Import presets", exact: true })).toBeEnabled();
      expect(await page.evaluate((storeKey) => localStorage.getItem(storeKey), STORE_KEY)).toBe(newRaw);
      expect(await readStore(page)).toEqual(authoritative);
      await expect(page.getByRole("button", { name: "Apply Stale other-tab look", exact: true })).toHaveCount(0);
      await expect(page.getByText("Saved only in this browser · 0/24 looks", { exact: true })).toBeVisible();
      await expectNoImportSuccess(page);

      await closeDialog(page);
      await page.reload();
      await expect(page.getByRole("slider", { name: "Padding", exact: true })).toHaveValue("144");
      expect(await page.evaluate((storeKey) => localStorage.getItem(storeKey), STORE_KEY)).toBe(newRaw);
    });
  }
});
