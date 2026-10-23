import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STYLE } from "../../lib/domain";
import {
  addPreset,
  AppError,
  createJob,
  createStore,
  deletePreset,
  finishJob,
  loadStore,
  renamePreset,
  saveStore,
  STORAGE_KEY,
  type Store,
} from "../../lib/storage";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0b8AAAAASUVORK5CYII=";

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  failure: Error | null = null;
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failure) throw this.failure;
    this.values.set(key, value);
  }
}

function expectCode(action: () => unknown, code: string) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected ${code}`);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-10-23T12:00:00.000Z");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("versioned local storage", () => {
  it("initializes without writing and round-trips the current source and presets", () => {
    const storage = new MemoryStorage();
    const empty = loadStore(storage);
    expect(empty.composition).toMatchObject({
      id: "current",
      status: "empty",
      source: null,
    });
    expect(storage.length).toBe(0);
    const store = addPreset(empty, "  Ocean   blue  ", {
      ...DEFAULT_STYLE,
      background: "ocean",
    });
    store.composition.status = "ready";
    store.composition.source = {
      dataUrl: PIXEL,
      name: "screenshot.png",
      width: 1,
      height: 1,
    };
    saveStore(storage, store);
    const loaded = loadStore(storage);
    expect(loaded).toEqual(store);
    expect(loaded.presets[0].name).toBe("Ocean blue");
    expect(loaded.composition.source?.dataUrl).toBe(PIXEL);
    loaded.composition.style.padding = 0;
    expect(store.composition.style.padding).toBe(96);
    expect(storage.length).toBe(1);
  });

  it.each([
    "{broken",
    JSON.stringify({ version: 3, unknown: "keep" }),
    JSON.stringify({ ...createStore(), version: 0 }),
  ])("preserves unsupported or corrupt data: %s", (raw) => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const code = raw.includes('"version":3')
      ? "storage_version"
      : "storage_corrupt";
    expectCode(() => loadStore(storage), code);
    expectCode(() => saveStore(storage, createStore()), code);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("validates every full write, including source, foreign keys, dimensions and styles", () => {
    const storage = new MemoryStorage();
    saveStore(storage, createStore());
    const before = storage.getItem(STORAGE_KEY);
    const mutations: ((store: Store) => void)[] = [
      (store) => {
        store.composition.style.padding = 201;
      },
      (store) => {
        store.composition.style.background = "#ff0000";
      },
      (store) => {
        store.composition.status = "ready";
      },
      (store) => {
        store.composition.updatedAt = "yesterday";
      },
      (store) => {
        store.composition.source = {
          dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
          name: "bad.svg",
          width: 1,
          height: 1,
        };
        store.composition.status = "ready";
      },
      (store) => {
        store.jobs = [
          {
            id: "bad",
            compositionId: "wrong",
            kind: "download",
            status: "pending",
            createdAt: store.composition.createdAt,
            completedAt: null,
            width: 1600,
            height: 900,
            error: null,
          } as never,
        ];
      },
      (store) => {
        store.jobs = createJob(store, "download", DEFAULT_STYLE, "bad").jobs;
        store.jobs[0].width = 1;
      },
    ];
    for (const mutate of mutations) {
      const store = createStore();
      mutate(store);
      expectCode(() => saveStore(storage, store), "storage_corrupt");
      expect(storage.getItem(STORAGE_KEY)).toBe(before);
    }
  });

  it("commits pending-job recovery once while preserving terminal records", () => {
    const storage = new MemoryStorage();
    let store = createJob(createStore(), "download", DEFAULT_STYLE, "finished");
    store = finishJob(store, "finished", "succeeded");
    store = createJob(store, "clipboard", DEFAULT_STYLE, "interrupted");
    saveStore(storage, store);
    const before = storage.getItem(STORAGE_KEY);
    vi.setSystemTime("2026-10-23T12:01:00.000Z");
    const reloaded = loadStore(storage);
    expect(reloaded.jobs[0]).toEqual(store.jobs[0]);
    expect(reloaded.jobs[1]).toMatchObject({
      status: "failed",
      error: "interrupted",
      completedAt: "2026-10-23T12:01:00.000Z",
    });
    expect(storage.getItem(STORAGE_KEY)).not.toBe(before);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(reloaded);
    saveStore(storage, reloaded);
    expect(loadStore(storage)).toEqual(reloaded);
  });

  it("keeps the previous envelope on quota errors and permits an explicit retry", () => {
    const storage = new MemoryStorage();
    const store = loadStore(storage);
    saveStore(storage, store);
    const previous = storage.getItem(STORAGE_KEY);
    const next = addPreset(store, "New", DEFAULT_STYLE);
    storage.failure = Object.assign(new Error("full"), {
      name: "QuotaExceededError",
    });
    expectCode(() => saveStore(storage, next), "storage_quota");
    expect(storage.getItem(STORAGE_KEY)).toBe(previous);
    storage.failure = null;
    saveStore(storage, next);
    expect(loadStore(storage).presets).toHaveLength(1);
  });

  it("reports blocked reads and detects an external change before writing", () => {
    const blocked = new MemoryStorage();
    blocked.getItem = () => {
      throw new Error("denied");
    };
    expectCode(() => loadStore(blocked), "storage_unavailable");
    const storage = new MemoryStorage();
    const local = loadStore(storage);
    const external = addPreset(createStore(), "Other tab", DEFAULT_STYLE);
    storage.setItem(STORAGE_KEY, JSON.stringify(external));
    expectCode(() => saveStore(storage, local), "storage_conflict");
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(external);
    const refreshed = loadStore(storage);
    saveStore(storage, refreshed);
  });
});

describe("preset invariants", () => {
  it("normalizes names, rejects case-insensitive duplicates, and keeps applied styles independent", () => {
    const original = createStore();
    const created = addPreset(original, "  Ｖiolet   look  ", DEFAULT_STYLE);
    expect(original.presets).toHaveLength(0);
    expect(created.presets[0].name).toBe("Violet look");
    expectCode(
      () => addPreset(created, "violet LOOK", DEFAULT_STYLE),
      "preset_duplicate",
    );
    expectCode(() => addPreset(created, " ", DEFAULT_STYLE), "preset_name");
    expectCode(
      () => addPreset(created, "a".repeat(41), DEFAULT_STYLE),
      "preset_name",
    );
    const next = addPreset(created, "Second", DEFAULT_STYLE);
    expectCode(
      () => renamePreset(next, next.presets[1].id, "Violet look"),
      "preset_duplicate",
    );
    vi.setSystemTime("2026-10-23T12:01:00.000Z");
    const renamed = renamePreset(created, created.presets[0].id, "Renamed");
    expect(renamed.presets[0]).toMatchObject({
      name: "Renamed",
      createdAt: created.presets[0].createdAt,
      updatedAt: "2026-10-23T12:01:00.000Z",
    });
    const deleted = deletePreset(renamed, renamed.presets[0].id);
    expect(deleted.presets).toEqual([]);
    expect(deleted.composition).toEqual(original.composition);
  });

  it("enforces the 24-preset limit at the domain boundary", () => {
    let store = createStore();
    for (let index = 0; index < 24; index++)
      store = addPreset(store, `Look ${index}`, DEFAULT_STYLE);
    expectCode(
      () => addPreset(store, "Look 25", DEFAULT_STYLE),
      "preset_limit",
    );
    store = deletePreset(store, store.presets[0].id);
    expect(addPreset(store, "Replacement", DEFAULT_STYLE).presets).toHaveLength(
      24,
    );
  });
});

describe("export lifecycle", () => {
  it("captures exact submission dimensions and rejects duplicate IDs and terminal rewrites", () => {
    const original = createStore();
    const pending = createJob(
      original,
      "download",
      { ...DEFAULT_STYLE, size: "portrait", scale: 2 },
      "job-1",
    );
    expect(original.jobs).toEqual([]);
    expect(pending.jobs[0]).toMatchObject({
      width: 2160,
      height: 2700,
      status: "pending",
      error: null,
      completedAt: null,
    });
    expectCode(
      () => createJob(pending, "download", DEFAULT_STYLE, "job-1"),
      "job_duplicate",
    );
    const failed = finishJob(pending, "job-1", "failed", "clipboard_denied");
    expect(failed.jobs[0]).toMatchObject({
      status: "failed",
      error: "clipboard_denied",
    });
    expect(pending.jobs[0].status).toBe("pending");
    expectCode(() => finishJob(failed, "job-1", "succeeded"), "job_terminal");
    const storage = new MemoryStorage();
    saveStore(storage, failed);
    const tampered = structuredClone(failed);
    tampered.jobs[0].error = "other_error";
    expectCode(() => saveStore(storage, tampered), "job_terminal");
    const retried = createJob(failed, "download", DEFAULT_STYLE, "job-2");
    expect(retried.jobs[0]).toEqual(failed.jobs[0]);
    expect(retried.jobs[1].status).toBe("pending");
  });

  it("retains the newest 20 attempts and stores only normalized error codes", () => {
    let store = createStore();
    for (let index = 0; index < 22; index++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 9, 23, 12, 0, index)));
      store = finishJob(
        createJob(store, "clipboard", DEFAULT_STYLE, `job-${index}`),
        `job-${index}`,
        "failed",
        "untrusted details https://private.example/screenshot",
      );
    }
    expect(store.jobs).toHaveLength(20);
    expect(store.jobs[0].id).toBe("job-2");
    expect(store.jobs.at(-1)?.id).toBe("job-21");
    expect(store.jobs.every((job) => job.error === "export_failed")).toBe(true);
    expectCode(() => finishJob(store, "missing", "failed"), "job_not_found");
  });
});
