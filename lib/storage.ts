import {
  AppError,
  DEFAULT_STYLE,
  dimensions,
  normalizeStyle,
  SIZES,
  lookOf,
  type Look,
  type SizeId,
  type Style,
} from "./domain";
import { validateAnnotations, type Annotation } from "./annotations";
import { IMAGE_LIMITS, isRasterDataUrl, validDimensions } from "./image-format";
import { migrateLocalDocument } from "./migrations";
export { AppError } from "./domain";
export const STORAGE_KEY = "picwiz:store";
export const LEGACY_STORAGE_KEY = "shinyshot:store";
export type Source = {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
};
export type Preset = {
  id: string;
  name: string;
  style: Style;
  createdAt: string;
  updatedAt: string;
};
export type ExportJob = {
  id: string;
  compositionId: "current";
  kind: "download" | "clipboard" | "batch";
  status: "pending" | "succeeded" | "failed" | "cancelled";
  createdAt: string;
  completedAt: string | null;
  width: number;
  height: number;
  error: string | null;
  formats: SizeId[];
  scale: 1 | 2;
  total: number;
  completed: number;
  failed: number;
};
export type Store = {
  version: 2;
  composition: {
    id: "current";
    createdAt: string;
    updatedAt: string;
    status: "empty" | "ready";
    style: Style;
    source: Source | null;
    annotations: Annotation[];
  };
  presets: Preset[];
  jobs: ExportJob[];
};
type Snapshot = { current: string | null; legacy: string | null };
const snapshots = new WeakMap<Storage, Snapshot>();
const blocked = new WeakSet<Storage>();
const fail = (): never => {
  throw new AppError(
    "storage_corrupt",
    "Saved browser data is invalid. It has been preserved; clear local data to start again.",
  );
};
const now = () => new Date().toISOString();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const isErrorCode = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value);
const isDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    return fail();
  return value;
}

function strictStyle(value: unknown): Style {
  const input = record(value, Object.keys(DEFAULT_STYLE));
  const normalized = normalizeStyle(input);
  if (Object.entries(normalized).some(([key, val]) => input[key] !== val))
    return fail();
  return normalized;
}

function presetName(value: unknown): string {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new AppError(
      "preset_name",
      "Enter a preset name of 1–40 characters.",
    );
  }
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40)
    throw new AppError(
      "preset_name",
      "Enter a preset name of 1–40 characters.",
    );
  return name;
}

export function validateStore(value: unknown): Store {
  if (isRecord(value) && typeof value.version === "number" && value.version > 2)
    throw new AppError(
      "storage_version",
      "This browser data was saved by a newer PicWiz version. It has been preserved.",
    );
  const root = record(value, ["version", "composition", "presets", "jobs"]);
  if (
    root.version !== 2 ||
    !Array.isArray(root.presets) ||
    root.presets.length > 24 ||
    !Array.isArray(root.jobs) ||
    root.jobs.length > 20
  )
    return fail();
  const c = record(root.composition, [
    "id",
    "createdAt",
    "updatedAt",
    "status",
    "style",
    "source",
    "annotations",
  ]);
  if (
    c.id !== "current" ||
    !isDate(c.createdAt) ||
    !isDate(c.updatedAt) ||
    c.updatedAt < c.createdAt ||
    (c.status !== "empty" && c.status !== "ready")
  )
    return fail();
  let source: Source | null = null;
  if (c.source !== null) {
    const s = record(c.source, ["dataUrl", "name", "width", "height"]);
    if (
      !isRasterDataUrl(s.dataUrl) ||
      typeof s.name !== "string" ||
      s.name.length < 1 ||
      s.name.length > 120 ||
      /[\u0000-\u001f\u007f/\\]/.test(s.name) ||
      typeof s.width !== "number" ||
      typeof s.height !== "number" ||
      !validDimensions(s.width, s.height, IMAGE_LIMITS.normalizedEdge)
    )
      return fail();
    source = {
      dataUrl: s.dataUrl,
      name: s.name,
      width: s.width,
      height: s.height,
    };
  }
  let annotations: Annotation[];
  try {
    annotations = validateAnnotations(c.annotations);
  } catch {
    return fail();
  }
  if (
    (c.status === "ready") !== (source !== null) ||
    (!source && annotations.length)
  )
    return fail();
  const presetIds = new Set<string>(),
    names = new Set<string>();
  const presets = root.presets.map((value): Preset => {
    const p = record(value, ["id", "name", "style", "createdAt", "updatedAt"]);
    if (
      !isId(p.id) ||
      presetIds.has(p.id) ||
      !isDate(p.createdAt) ||
      !isDate(p.updatedAt) ||
      p.updatedAt < p.createdAt
    )
      return fail();
    let name: string;
    try {
      name = presetName(p.name);
    } catch {
      return fail();
    }
    if (name !== p.name || names.has(name.toLowerCase())) return fail();
    presetIds.add(p.id);
    names.add(name.toLowerCase());
    return {
      id: p.id,
      name,
      style: strictStyle(p.style),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });
  const ids = new Set<string>();
  const jobs = root.jobs.map((value): ExportJob => {
    const j = record(value, [
      "id",
      "compositionId",
      "kind",
      "status",
      "createdAt",
      "completedAt",
      "width",
      "height",
      "error",
      "formats",
      "scale",
      "total",
      "completed",
      "failed",
    ]);
    if (
      !isId(j.id) ||
      ids.has(j.id) ||
      j.compositionId !== "current" ||
      !["download", "clipboard", "batch"].includes(j.kind as string) ||
      !isDate(j.createdAt)
    )
      return fail();
    if (
      !Array.isArray(j.formats) ||
      j.formats.length < 1 ||
      j.formats.length > 3 ||
      new Set(j.formats).size !== j.formats.length ||
      !j.formats.every(
        (s) => typeof s === "string" && Object.hasOwn(SIZES, s),
      ) ||
      (j.scale !== 1 && j.scale !== 2)
    )
      return fail();
    if (
      ![j.total, j.completed, j.failed].every(
        (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0,
      )
    )
      return fail();
    const total = j.total as number,
      completed = j.completed as number,
      failed = j.failed as number;
    const formats = j.formats as SizeId[];
    if (
      total < 1 ||
      total > 30 ||
      completed + failed > total ||
      (j.kind !== "batch" && (total !== 1 || formats.length !== 1)) ||
      j.width !== SIZES[formats[0]].width * j.scale ||
      j.height !== SIZES[formats[0]].height * j.scale
    )
      return fail();
    if (j.status === "pending") {
      if (j.completedAt !== null || j.error !== null) return fail();
    } else if (
      ["succeeded", "failed", "cancelled"].includes(j.status as string)
    ) {
      if (
        !isDate(j.completedAt) ||
        j.completedAt < j.createdAt ||
        (j.status !== "cancelled" && completed + failed !== total)
      )
        return fail();
      if (
        j.status === "succeeded"
          ? failed !== 0 || j.error !== null
          : !isErrorCode(j.error)
      )
        return fail();
      if (
        j.status === "failed" &&
        failed === 0 &&
        !(
          completed === total &&
          (j.error === "interrupted" ||
            (j.kind === "batch" && j.error === "zip_failed"))
        )
      )
        return fail();
    } else return fail();
    ids.add(j.id);
    return {
      id: j.id,
      compositionId: "current",
      kind: j.kind as ExportJob["kind"],
      status: j.status as ExportJob["status"],
      createdAt: j.createdAt,
      completedAt: j.completedAt as string | null,
      width: j.width as number,
      height: j.height as number,
      error: j.error as string | null,
      formats: [...formats],
      scale: j.scale,
      total,
      completed,
      failed,
    };
  });
  return {
    version: 2,
    composition: {
      id: "current",
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      status: c.status,
      style: strictStyle(c.style),
      source,
      annotations,
    },
    presets,
    jobs,
  };
}

function parse(raw: string): Store {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail();
  }
  return validateStore(migrateLocalDocument(value, now()));
}
function read(storage: Storage): Snapshot {
  try {
    return {
      current: storage.getItem(STORAGE_KEY),
      legacy: storage.getItem(LEGACY_STORAGE_KEY),
    };
  } catch {
    throw new AppError(
      "storage_unavailable",
      "Browser storage is unavailable. Enable site storage, then retry.",
    );
  }
}
function same(a: Snapshot, b: Snapshot): boolean {
  return a.current === b.current && a.legacy === b.legacy;
}
function conflict(): never {
  throw new AppError(
    "storage_conflict",
    "Another tab changed your saved composition. Reload before saving again.",
  );
}
function authoritative(snapshot: Snapshot): Store | null {
  const raw = snapshot.current ?? snapshot.legacy;
  return raw === null ? null : parse(raw);
}
function write(storage: Storage, raw: string): void {
  try {
    storage.setItem(STORAGE_KEY, raw);
  } catch (error) {
    const quota =
      isRecord(error) &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED");
    throw new AppError(
      quota ? "storage_quota" : "storage_unavailable",
      quota
        ? "Browser storage is full. Free site storage, then retry."
        : "The browser could not save your changes. Retry after enabling site storage.",
    );
  }
}
function uniqueId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new AppError(
    "unsupported_browser",
    "This browser cannot generate local record IDs.",
  );
}
export function createStore(): Store {
  return validateStore(migrateLocalDocument(null, now()));
}
export function loadStore(storage: Storage): Store {
  if (blocked.has(storage))
    throw new AppError(
      "storage_unavailable",
      "Local data was only partly cleared. Retry clearing or reload before saving.",
    );
  const snapshot = read(storage);
  let store = authoritative(snapshot) ?? createStore();
  const interrupted = store.jobs.some((j) => j.status === "pending");
  const timestamp = now();
  if (interrupted)
    store = {
      ...store,
      jobs: store.jobs.map((j) =>
        j.status === "pending"
          ? {
              ...j,
              status: "failed",
              completedAt: timestamp < j.createdAt ? j.createdAt : timestamp,
              error: "interrupted",
              failed: j.total - j.completed,
            }
          : j,
      ),
    };
  // Adoption and pending recovery commit a single fully validated envelope, never touch legacy.
  if (
    (snapshot.current === null && snapshot.legacy !== null) ||
    (snapshot.current !== null && JSON.parse(snapshot.current).version !== 2) ||
    interrupted
  ) {
    validateStore(store);
    if (!same(snapshot, read(storage))) return conflict();
    const raw = JSON.stringify(store);
    write(storage, raw);
    const after = read(storage);
    if (after.current !== raw || after.legacy !== snapshot.legacy)
      return conflict();
    snapshots.set(storage, after);
  } else {
    if (!same(snapshot, read(storage))) return conflict();
    snapshots.set(storage, snapshot);
  }
  return store;
}
function checkJobs(previous: Store | null, next: Store): void {
  if (!previous) return;
  const oldIds = new Set(previous.jobs.map((j) => j.id));
  const added = next.jobs.filter((j) => !oldIds.has(j.id));
  // Only appending new attempts may evict the oldest records at the fixed retention cap.
  const expected = (
    added.length
      ? [...previous.jobs, ...added]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(-20)
      : previous.jobs
  ).map((j) => j.id);
  if (JSON.stringify(expected) !== JSON.stringify(next.jobs.map((j) => j.id)))
    throw new AppError(
      "job_retention",
      "Export history can only remove its oldest records when a new attempt is added.",
    );
  for (const job of previous.jobs) {
    const target = next.jobs.find((j) => j.id === job.id);
    if (!target) continue;
    if (
      job.status !== "pending" &&
      JSON.stringify(job) !== JSON.stringify(target)
    )
      throw new AppError(
        "job_terminal",
        "A completed export record cannot be changed.",
      );
    for (const key of [
      "compositionId",
      "kind",
      "createdAt",
      "width",
      "height",
      "formats",
      "scale",
      "total",
    ] as const)
      if (JSON.stringify(job[key]) !== JSON.stringify(target[key]))
        throw new AppError(
          "job_immutable",
          "An export's submitted details cannot be changed.",
        );
    if (target.completed < job.completed || target.failed < job.failed)
      throw new AppError(
        "job_progress",
        "Export counts cannot move backwards.",
      );
  }
}
export function saveStore(storage: Storage, input: Store): void {
  if (blocked.has(storage))
    throw new AppError(
      "storage_unavailable",
      "Local data was only partly cleared. Retry clearing or reload before saving.",
    );
  const store = validateStore(input),
    current = read(storage);
  const previous = authoritative(current); // Validate raw data even for callers that never loaded.
  const snapshot = snapshots.get(storage);
  if (snapshot && !same(snapshot, current)) return conflict();
  checkJobs(previous, store);
  if (!same(current, read(storage))) return conflict();
  const raw = JSON.stringify(store);
  write(storage, raw);
  const after = read(storage);
  if (after.current !== raw || after.legacy !== current.legacy)
    return conflict();
  snapshots.set(storage, after);
}
export function clearStore(storage: Storage): void {
  blocked.add(storage);
  try {
    storage.removeItem(LEGACY_STORAGE_KEY);
    storage.removeItem(STORAGE_KEY);
    const after = read(storage);
    if (after.current !== null || after.legacy !== null)
      throw new Error("incomplete");
    snapshots.set(storage, after);
    blocked.delete(storage);
  } catch {
    throw new AppError(
      "storage_clear",
      "The browser could not clear all local data. Retry clearing; saving is blocked.",
    );
  }
}
export function backupLocalData(storage: Storage): string {
  const raw = read(storage);
  return JSON.stringify(
    {
      app: "picwiz",
      type: "local-data-backup",
      version: 1,
      createdAt: now(),
      keys: { [STORAGE_KEY]: raw.current, [LEGACY_STORAGE_KEY]: raw.legacy },
    },
    null,
    2,
  );
}
export function addPreset(store: Store, name: string, input: Style): Store {
  const current = validateStore(store);
  const normalizedName = presetName(name);
  if (
    current.presets.some(
      (preset) => preset.name.toLowerCase() === normalizedName.toLowerCase(),
    )
  )
    throw new AppError(
      "preset_duplicate",
      "A preset with that name already exists.",
    );
  if (current.presets.length >= 24)
    throw new AppError(
      "preset_limit",
      "You can save up to 24 presets. Delete one before adding another.",
    );
  const timestamp = now();
  return {
    ...current,
    presets: [
      ...current.presets,
      {
        id: uniqueId(),
        name: normalizedName,
        style: normalizeStyle(input),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };
}

export function renamePreset(store: Store, id: string, name: string): Store {
  const current = validateStore(store);
  const normalizedName = presetName(name);
  const preset = current.presets.find((value) => value.id === id);
  if (!preset)
    throw new AppError("preset_not_found", "That preset no longer exists.");
  if (
    current.presets.some(
      (value) =>
        value.id !== id &&
        value.name.toLowerCase() === normalizedName.toLowerCase(),
    )
  )
    throw new AppError(
      "preset_duplicate",
      "A preset with that name already exists.",
    );
  return {
    ...current,
    presets: current.presets.map((value) =>
      value.id === id && value.name !== normalizedName
        ? { ...value, name: normalizedName, updatedAt: now() }
        : value,
    ),
  };
}

export function deletePreset(store: Store, id: string): Store {
  const current = validateStore(store);
  return {
    ...current,
    presets: current.presets.filter((preset) => preset.id !== id),
  };
}

export function updatePreset(store: Store, id: string, input: Style): Store {
  const current = validateStore(store);
  if (!current.presets.some((p) => p.id === id))
    throw new AppError("preset_not_found", "That preset no longer exists.");
  return {
    ...current,
    presets: current.presets.map((p) =>
      p.id === id
        ? {
            ...p,
            style: applyPresetStyle(p.style, input),
            updatedAt: now() < p.createdAt ? p.createdAt : now(),
          }
        : p,
    ),
  };
}
function applyPresetStyle(previous: Style, input: Style): Style {
  return {
    ...normalizeStyle(input),
    size: previous.size,
    scale: previous.scale,
  };
}
const LOOK_KEYS = [
  "background",
  "padding",
  "radius",
  "shadow",
  "frame",
  "appearance",
];
function strictLook(value: unknown): Look {
  const input = record(value, LOOK_KEYS);
  const result = lookOf(normalizeStyle(input));
  if (Object.entries(result).some(([key, value]) => input[key] !== value))
    return fail();
  return result;
}
export function exportPresets(store: Store): string {
  const current = validateStore(store);
  if (!current.presets.length)
    throw new AppError(
      "preset_empty",
      "Save a style preset before exporting a preset file.",
    );
  return JSON.stringify(
    {
      app: "picwiz",
      type: "style-presets",
      version: 1,
      presets: current.presets.map((p) => ({
        name: p.name,
        style: lookOf(p.style),
      })),
    },
    null,
    2,
  );
}
export function importPresets(
  store: Store,
  json: string,
): { store: Store; added: number; skipped: number } {
  const current = validateStore(store);
  if (
    typeof json !== "string" ||
    json.length > 100 * 1024 ||
    new TextEncoder().encode(json).length > 100 * 1024
  )
    throw new AppError(
      "preset_file_size",
      "Preset files must be at most 100 KiB.",
    );
  let entries: { name: string; style: Look }[];
  try {
    const root = record(JSON.parse(json), [
      "app",
      "type",
      "version",
      "presets",
    ]);
    if (
      root.app !== "picwiz" ||
      root.type !== "style-presets" ||
      root.version !== 1 ||
      !Array.isArray(root.presets) ||
      root.presets.length < 1 ||
      root.presets.length > 24
    )
      return fail();
    entries = root.presets.map((value) => {
      const p = record(value, ["name", "style"]);
      return { name: presetName(p.name), style: strictLook(p.style) };
    });
  } catch {
    throw new AppError(
      "preset_file",
      "This is not a valid PicWiz style preset file. Nothing was imported.",
    );
  }
  let result = current,
    added = 0,
    skipped = 0;
  for (const entry of entries) {
    let suffix = 1;
    while (true) {
      const ending = suffix === 1 ? "" : ` (${suffix})`;
      const name = entry.name.slice(0, 40 - ending.length).trimEnd() + ending;
      const existing = result.presets.find(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (!existing) {
        result = addPreset(result, name, { ...DEFAULT_STYLE, ...entry.style });
        added++;
        break;
      }
      if (
        JSON.stringify(lookOf(existing.style)) === JSON.stringify(entry.style)
      ) {
        skipped++;
        break;
      }
      suffix++;
    }
  }
  return { store: result, added, skipped };
}
function appendJob(
  store: Store,
  kind: ExportJob["kind"],
  formats: SizeId[],
  scale: 1 | 2,
  total: number,
  id: string,
): Store {
  const current = validateStore(store);
  if (!isId(id)) throw new AppError("job_id", "The export ID is invalid.");
  if (current.jobs.some((j) => j.id === id))
    throw new AppError(
      "job_duplicate",
      "That export was already submitted. Retry with a new export ID.",
    );
  if (
    !Array.isArray(formats) ||
    !formats.length ||
    !Object.hasOwn(SIZES, formats[0])
  )
    throw new AppError("job_formats", "Choose supported output sizes.");
  const job: ExportJob = {
    id,
    compositionId: "current",
    kind,
    status: "pending",
    createdAt: now(),
    completedAt: null,
    ...dimensions({ ...DEFAULT_STYLE, size: formats[0], scale }),
    error: null,
    formats: [...formats],
    scale,
    total,
    completed: 0,
    failed: 0,
  };
  return validateStore({
    ...current,
    jobs: [...current.jobs, job]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-20),
  });
}
export function createJob(
  store: Store,
  kind: ExportJob["kind"],
  input: Style,
  id: string = uniqueId(),
): Store {
  if (kind !== "download" && kind !== "clipboard")
    throw new AppError(
      "job_kind",
      "Choose a PNG download or clipboard export.",
    );
  const style = normalizeStyle(input);
  return appendJob(store, kind, [style.size], style.scale, 1, id);
}
export function createBatchJob(
  store: Store,
  formats: SizeId[],
  scale: 1 | 2,
  total: number,
  id: string = uniqueId(),
): Store {
  return appendJob(store, "batch", formats, scale, total, id);
}
export function finishBatchJob(
  store: Store,
  id: string,
  result: {
    completed: number;
    failed: number;
    cancelled?: boolean;
    error?: string;
  },
): Store {
  const current = validateStore(store),
    job = current.jobs.find((j) => j.id === id);
  if (!job)
    throw new AppError(
      "job_not_found",
      "That export is no longer in local history.",
    );
  if (job.status !== "pending")
    throw new AppError(
      "job_terminal",
      "A completed export record cannot be changed.",
    );
  if (result.completed < job.completed || result.failed < job.failed)
    throw new AppError("job_progress", "Export counts cannot move backwards.");
  const status = result.cancelled
    ? "cancelled"
    : result.failed || result.error
      ? "failed"
      : "succeeded";
  const error =
    status === "succeeded"
      ? null
      : isErrorCode(result.error)
        ? result.error
        : status === "cancelled"
          ? "cancelled"
          : result.completed
            ? "batch_partial"
            : "export_failed";
  return validateStore({
    ...current,
    jobs: current.jobs.map((j) =>
      j.id === id
        ? {
            ...j,
            status,
            completed: result.completed,
            failed: result.failed,
            error,
            completedAt: now() < j.createdAt ? j.createdAt : now(),
          }
        : j,
    ),
  });
}
export function finishJob(
  store: Store,
  id: string,
  status: "succeeded" | "failed",
  error?: string,
): Store {
  if (status !== "succeeded" && status !== "failed")
    throw new AppError("job_status", "The export result is invalid.");
  return finishBatchJob(store, id, {
    completed: status === "succeeded" ? 1 : 0,
    failed: status === "failed" ? 1 : 0,
    error:
      status === "failed"
        ? isErrorCode(error)
          ? error
          : "export_failed"
        : undefined,
  });
}
