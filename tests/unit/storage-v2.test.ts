import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STYLE, lookOf } from "../../lib/domain";
import { migrate001 } from "../../lib/migrations/001-local-store";
import { migrate002 } from "../../lib/migrations/002-picwiz-v2";
import { validateV1Store, type V1Store } from "../../lib/migrations/frozen-v1";
import {
  addPreset,
  backupLocalData,
  clearStore,
  createBatchJob,
  createJob,
  createStore,
  exportPresets,
  finishBatchJob,
  finishJob,
  importPresets,
  LEGACY_STORAGE_KEY,
  loadStore,
  saveStore,
  STORAGE_KEY,
  updatePreset,
  validateStore,
  type Store,
} from "../../lib/storage";
const instant = "2026-10-23T12:00:00.000Z";
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0b8AAAAASUVORK5CYII=";
class MemoryStorage implements Storage {
  values = new Map<string, string>();
  failWrite = false;
  get length() {
    return this.values.size;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrite)
      throw Object.assign(new Error("full"), { name: "QuotaExceededError" });
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  clear() {
    this.values.clear();
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
}
const code = (action: () => unknown, expected: string) =>
  expect(action).toThrow(expect.objectContaining({ code: expected }));
function v1(): V1Store {
  const old = migrate001(null, instant) as V1Store;
  old.composition.status = "ready";
  old.composition.source = {
    dataUrl: PIXEL,
    name: "Screenshot.png",
    width: 1,
    height: 1,
  };
  old.composition.style = {
    ...old.composition.style,
    size: "square",
    scale: 2,
  };
  old.presets = [
    {
      id: "old_nonUUID-ID",
      name: "Old look",
      createdAt: instant,
      updatedAt: instant,
      style: { ...old.composition.style, size: "portrait" },
    },
  ];
  old.jobs = (["pending", "succeeded", "failed"] as const).map((status, i) => ({
    id: `old-job-${i}`,
    compositionId: "current",
    kind: "download",
    status,
    createdAt: instant,
    completedAt: status === "pending" ? null : instant,
    width: 2160,
    height: 2700,
    error: status === "failed" ? "png_encode" : null,
  }));
  return old;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(instant);
});
afterEach(() => vi.useRealTimers());

describe("frozen migration and dual-key recovery", () => {
  it("preserves source, IDs and dates, converts V1 units, and infers precise job counters", () => {
    const original = v1(),
      raw = JSON.stringify(original);
    const next = validateStore(migrate002(original));
    expect(JSON.stringify(original)).toBe(raw);
    expect(next.version).toBe(2);
    expect(next.composition.source).toEqual(original.composition.source);
    expect(next.composition).toMatchObject({
      annotations: [],
      style: { padding: 65, radius: 8, shadow: 36, size: "square", scale: 2 },
    });
    expect(next.presets[0]).toMatchObject({
      id: "old_nonUUID-ID",
      createdAt: instant,
      updatedAt: instant,
      style: { padding: 65, radius: 8, size: "portrait" },
    });
    expect(
      next.jobs.map((j) => [
        j.formats,
        j.scale,
        j.total,
        j.completed,
        j.failed,
      ]),
    ).toEqual([
      [["portrait"], 2, 1, 0, 0],
      [["portrait"], 2, 1, 1, 0],
      [["portrait"], 2, 1, 0, 1],
    ]);
  });
  it("never repairs invalid V1 fields using current defaults or new size catalogs", () => {
    for (const mutate of [
      (s: V1Store) => {
        s.composition.style.size = "story" as never;
      },
      (s: V1Store) => {
        s.composition.style.padding = 201;
      },
      (s: V1Store) => {
        s.presets[0].id = "a".repeat(129);
      },
      (s: V1Store) => {
        s.jobs[0].width = 1200;
        s.jobs[0].height = 627;
      },
      (s: V1Store) => {
        s.composition.source!.dataUrl = "data:image/svg+xml;base64,PHN2Zz4=";
      },
      (s: V1Store) => {
        Object.assign(s.composition, { annotations: [] });
      },
    ]) {
      const s = v1();
      mutate(s);
      expect(() => migrate002(s)).toThrow();
    }
    expect(validateV1Store(v1()).presets[0].id).toBe("old_nonUUID-ID");
  });
  it("adopts legacy once, retains raw backup, and commits interruption recovery atomically", () => {
    const storage = new MemoryStorage(),
      raw = JSON.stringify(v1());
    storage.setItem(LEGACY_STORAGE_KEY, raw);
    const store = loadStore(storage);
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(raw);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(store);
    expect(store.jobs[0]).toMatchObject({
      status: "failed",
      error: "interrupted",
      completed: 0,
      failed: 1,
    });
    const writes = vi.spyOn(storage, "setItem");
    expect(loadStore(storage)).toEqual(store);
    expect(writes).not.toHaveBeenCalled();
    const changed = structuredClone(store);
    changed.jobs[1].error = "png_encode";
    changed.jobs[1].status = "failed";
    changed.jobs[1].completed = 0;
    changed.jobs[1].failed = 1;
    code(() => saveStore(storage, changed), "job_terminal");
  });
  it("preserves the only source on migration quota failure and can retry", () => {
    const storage = new MemoryStorage(),
      raw = JSON.stringify(v1());
    storage.setItem(LEGACY_STORAGE_KEY, raw);
    storage.failWrite = true;
    code(() => loadStore(storage), "storage_quota");
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(raw);
    storage.failWrite = false;
    expect(loadStore(storage).version).toBe(2);
  });
  it("always honors corrupt/future new-key data and validates legacy even on direct save", () => {
    for (const [raw, expected] of [
      ["{broken", "storage_corrupt"],
      [JSON.stringify({ version: 3 }), "storage_version"],
    ]) {
      const storage = new MemoryStorage();
      storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(v1()));
      storage.setItem(STORAGE_KEY, raw);
      code(() => loadStore(storage), expected);
      code(() => saveStore(storage, createStore()), expected);
      expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    }
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY, "{bad");
    code(() => saveStore(storage, createStore()), "storage_corrupt");
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
  it("detects a legacy adoption race and a new-key insertion during adoption", () => {
    for (const changedKey of [LEGACY_STORAGE_KEY, STORAGE_KEY]) {
      const storage = new MemoryStorage();
      const raw = JSON.stringify(v1());
      storage.setItem(LEGACY_STORAGE_KEY, raw);
      let reads = 0;
      const original = storage.getItem.bind(storage);
      storage.getItem = (key: string) => {
        if (++reads === 3)
          storage.values.set(changedKey, JSON.stringify(createStore()));
        return original(key);
      };
      code(() => loadStore(storage), "storage_conflict");
      if (changedKey === LEGACY_STORAGE_KEY)
        expect(storage.values.has(STORAGE_KEY)).toBe(false);
      else expect(storage.values.get(LEGACY_STORAGE_KEY)).toBe(raw);
    }
  });
  it("compares both snapshots after load and backs up malformed raw strings verbatim", () => {
    const storage = new MemoryStorage();
    const store = loadStore(storage);
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(v1()));
    code(() => saveStore(storage, store), "storage_conflict");
    storage.setItem(STORAGE_KEY, "{do-not-parse");
    const backup = JSON.parse(backupLocalData(storage));
    expect(backup.keys[STORAGE_KEY]).toBe("{do-not-parse");
    expect(backup.keys[LEGACY_STORAGE_KEY]).toBe(JSON.stringify(v1()));
    storage.getItem = () => {
      throw new Error("denied");
    };
    code(() => backupLocalData(storage), "storage_unavailable");
  });
  it("clears legacy first, verifies both keys, and blocks saving after partial clear", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY, "legacy");
    storage.setItem(STORAGE_KEY, "new");
    const remove = vi.spyOn(storage, "removeItem");
    clearStore(storage);
    expect(remove.mock.calls).toEqual([[LEGACY_STORAGE_KEY], [STORAGE_KEY]]);
    expect(storage.length).toBe(0);
    saveStore(storage, createStore());
    storage.removeItem = () => {};
    code(() => clearStore(storage), "storage_clear");
    code(() => saveStore(storage, createStore()), "storage_unavailable");
    code(() => loadStore(storage), "storage_unavailable");
    storage.removeItem = (key: string) => {
      storage.values.delete(key);
    };
    clearStore(storage);
    saveStore(storage, createStore());
  });
});

describe("preset files and updates", () => {
  const file = (presets: unknown[]) =>
    JSON.stringify({
      app: "picwiz",
      type: "style-presets",
      version: 1,
      presets,
    });
  it("exports looks only and updates look without replacing format, ID or creation time", () => {
    const old = addPreset(createStore(), "First", {
      ...DEFAULT_STYLE,
      size: "story",
      scale: 2,
    });
    vi.setSystemTime("2026-10-23T13:00:00.000Z");
    const next = updatePreset(old, old.presets[0].id, {
      ...DEFAULT_STYLE,
      size: "linkedin",
      background: "mint",
    });
    expect(next.presets[0]).toMatchObject({
      id: old.presets[0].id,
      createdAt: instant,
      updatedAt: "2026-10-23T13:00:00.000Z",
      style: { background: "mint", size: "story", scale: 2 },
    });
    const exported = JSON.parse(exportPresets(next));
    expect(exported.presets).toEqual([
      { name: "First", style: lookOf(next.presets[0].style) },
    ]);
    expect(exportPresets(next)).not.toMatch(
      /source|dataUrl|annotations|"size"|"scale"/,
    );
  });
  it("renames deterministically, deduplicates within the file and is idempotent across imports", () => {
    const name = "A".repeat(40),
      original = addPreset(createStore(), name, DEFAULT_STYLE);
    const style = lookOf({ ...DEFAULT_STYLE, background: "mint" });
    const json = file([
      { name, style },
      { name, style },
    ]);
    const first = importPresets(original, json);
    expect(first).toMatchObject({ added: 1, skipped: 1 });
    expect(first.store.presets[1].name).toBe("A".repeat(36) + " (2)");
    const second = importPresets(first.store, json);
    expect(second).toMatchObject({ added: 0, skipped: 2 });
    expect(second.store).toEqual(first.store);
    expect(original.presets).toHaveLength(1);
  });
  it("validates all entries before mutation and enforces the byte budget at exact/+1 boundaries", () => {
    const original = createStore(),
      valid = { name: "Valid", style: lookOf(DEFAULT_STYLE) };
    for (const bad of [
      { ...valid, source: PIXEL },
      { ...valid, style: { ...valid.style, size: "story" } },
      { ...valid, style: { ...valid.style, padding: 201 } },
      { ...valid, style: { ...valid.style, background: "unknown" } },
    ])
      code(() => importPresets(original, file([valid, bad])), "preset_file");
    expect(original.presets).toEqual([]);
    const json = file([valid]);
    expect(
      importPresets(
        original,
        json + " ".repeat(100 * 1024 - new TextEncoder().encode(json).length),
      ).added,
    ).toBe(1);
    code(
      () =>
        importPresets(
          original,
          json + " ".repeat(100 * 1024 - json.length + 1),
        ),
      "preset_file_size",
    );
    code(
      () =>
        importPresets(original, file(Array.from({ length: 25 }, () => valid))),
      "preset_file",
    );
  });
  it("checks capacity after deduplication and never partially imports a too-large transaction", () => {
    let full = createStore();
    for (let i = 0; i < 24; i++)
      full = addPreset(full, `Look ${i}`, DEFAULT_STYLE);
    expect(
      importPresets(
        full,
        file([{ name: "Look 0", style: lookOf(DEFAULT_STYLE) }]),
      ),
    ).toMatchObject({ added: 0, skipped: 1 });
    code(
      () =>
        importPresets(
          full,
          file([
            { name: "Look 0", style: lookOf(DEFAULT_STYLE) },
            { name: "extra", style: lookOf(DEFAULT_STYLE) },
          ]),
        ),
      "preset_limit",
    );
    expect(full.presets).toHaveLength(24);
  });
});

describe("V2 job counts, immutability and retention", () => {
  it("supports batch partial, cancelled and ZIP-only failure outcomes", () => {
    const pending = createBatchJob(
      createStore(),
      ["story", "linkedin"],
      2,
      6,
      "batch",
    );
    expect(pending.jobs[0]).toMatchObject({
      width: 2160,
      height: 3840,
      scale: 2,
      formats: ["story", "linkedin"],
      total: 6,
      completed: 0,
      failed: 0,
    });
    expect(
      finishBatchJob(pending, "batch", { completed: 4, failed: 2 }).jobs[0],
    ).toMatchObject({ status: "failed", error: "batch_partial" });
    expect(
      finishBatchJob(pending, "batch", {
        completed: 2,
        failed: 0,
        cancelled: true,
      }).jobs[0],
    ).toMatchObject({
      status: "cancelled",
      completed: 2,
      failed: 0,
      error: "cancelled",
    });
    expect(
      finishBatchJob(pending, "batch", {
        completed: 6,
        failed: 0,
        error: "zip_failed",
      }).jobs[0],
    ).toMatchObject({ status: "failed", error: "zip_failed" });
    for (const result of [
      { completed: -1, failed: 7 },
      { completed: 2.5, failed: 3.5 },
      { completed: 2, failed: 0 },
      { completed: 6, failed: 1 },
      { completed: 6, failed: 0, error: "other_failure" },
    ])
      expect(() => finishBatchJob(pending, "batch", result)).toThrow();
  });
  it("rejects submitted-field rewrites, count regressions, terminal rewrites and arbitrary deletion", () => {
    const storage = new MemoryStorage();
    let store = createBatchJob(
      createStore(),
      ["landscape", "square"],
      1,
      4,
      "batch",
    );
    saveStore(storage, store);
    for (const mutate of [
      (s: Store) => {
        s.jobs[0].formats.reverse();
        s.jobs[0].width = 1080;
        s.jobs[0].height = 1080;
      },
      (s: Store) => {
        s.jobs[0].scale = 2;
        s.jobs[0].width *= 2;
        s.jobs[0].height *= 2;
      },
      (s: Store) => {
        s.jobs[0].total = 5;
      },
    ]) {
      const changed = structuredClone(store);
      mutate(changed);
      code(() => saveStore(storage, changed), "job_immutable");
    }
    const erased = structuredClone(store);
    erased.jobs = [];
    code(() => saveStore(storage, erased), "job_retention");
    store.jobs[0].completed = 1;
    saveStore(storage, store);
    const regressed = structuredClone(store);
    regressed.jobs[0].completed = 0;
    code(() => saveStore(storage, regressed), "job_progress");
    store = finishBatchJob(store, "batch", { completed: 4, failed: 0 });
    saveStore(storage, store);
    const changed = structuredClone(store);
    changed.jobs[0].status = "failed";
    changed.jobs[0].error = "zip_failed";
    code(() => saveStore(storage, changed), "job_terminal");
  });
  it("allows only new attempts to evict the oldest entries at the 20-row cap", () => {
    const storage = new MemoryStorage();
    let store = createStore();
    for (let i = 0; i < 21; i++) {
      store = finishJob(
        createJob(store, "download", DEFAULT_STYLE, `job-${i}`),
        `job-${i}`,
        "succeeded",
      );
      saveStore(storage, store);
    }
    expect(store.jobs).toHaveLength(20);
    expect(store.jobs[0].id).toBe("job-1");
    const removed = structuredClone(store);
    removed.jobs.splice(2, 1);
    code(() => saveStore(storage, removed), "job_retention");
    code(
      () => createBatchJob(store, ["story", "story"], 1, 2),
      "storage_corrupt",
    );
    code(() => createBatchJob(store, ["story"], 1, 31), "storage_corrupt");
    code(
      () => createBatchJob(store, ["story"], 1, 2, "job-20"),
      "job_duplicate",
    );
  });
});

describe("interrupted completed encodes", () => {
  it("retains completed counts when reload interrupts the final packaging step", () => {
    const storage = new MemoryStorage();
    const pending = createBatchJob(createStore(), ["story"], 1, 3, "packaging");
    pending.jobs[0].completed = 3;
    saveStore(storage, pending);
    const recovered = loadStore(storage);
    expect(recovered.jobs[0]).toMatchObject({
      status: "failed",
      error: "interrupted",
      total: 3,
      completed: 3,
      failed: 0,
    });
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(recovered);
  });
});
