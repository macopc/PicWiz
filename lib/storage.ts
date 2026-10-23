import {
  AppError,
  DEFAULT_STYLE,
  dimensions,
  normalizeStyle,
  SIZES,
  type Style,
} from "./domain";
import { IMAGE_LIMITS, isRasterDataUrl, validDimensions } from "./image-format";
import { migrateLocalDocument } from "./migrations";

export { AppError } from "./domain";
export const STORAGE_KEY = "shinyshot:store";

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
  kind: "download" | "clipboard";
  status: "pending" | "succeeded" | "failed";
  createdAt: string;
  completedAt: string | null;
  width: number;
  height: number;
  error: string | null;
};
export type Store = {
  version: 1;
  composition: {
    id: "current";
    createdAt: string;
    updatedAt: string;
    status: "empty" | "ready";
    style: Style;
    source: Source | null;
  };
  presets: Preset[];
  jobs: ExportJob[];
};

const snapshots = new WeakMap<Storage, string | null>();
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

function style(value: unknown): Style {
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

function validateStore(value: unknown): Store {
  if (
    isRecord(value) &&
    typeof value.version === "number" &&
    value.version > 1
  ) {
    throw new AppError(
      "storage_version",
      "This browser data was saved by a newer Shinyshot version. It has been preserved.",
    );
  }
  const root = record(value, ["version", "composition", "presets", "jobs"]);
  if (
    root.version !== 1 ||
    !Array.isArray(root.presets) ||
    root.presets.length > 24 ||
    !Array.isArray(root.jobs) ||
    root.jobs.length > 20
  )
    return fail();
  const composition = record(root.composition, [
    "id",
    "createdAt",
    "updatedAt",
    "status",
    "style",
    "source",
  ]);
  if (
    composition.id !== "current" ||
    !isDate(composition.createdAt) ||
    !isDate(composition.updatedAt) ||
    composition.updatedAt < composition.createdAt
  )
    return fail();
  if (composition.status !== "empty" && composition.status !== "ready")
    return fail();
  let source: Source | null = null;
  if (composition.source !== null) {
    const input = record(composition.source, [
      "dataUrl",
      "name",
      "width",
      "height",
    ]);
    if (
      !isRasterDataUrl(input.dataUrl) ||
      typeof input.name !== "string" ||
      input.name.length < 1 ||
      input.name.length > 120 ||
      /[\u0000-\u001f\u007f/\\]/.test(input.name) ||
      typeof input.width !== "number" ||
      typeof input.height !== "number" ||
      !validDimensions(input.width, input.height, IMAGE_LIMITS.normalizedEdge)
    )
      return fail();
    source = {
      dataUrl: input.dataUrl,
      name: input.name,
      width: input.width,
      height: input.height,
    };
  }
  if ((composition.status === "ready") !== (source !== null)) return fail();

  const ids = new Set<string>();
  const names = new Set<string>();
  const presets = root.presets.map((value): Preset => {
    const input = record(value, [
      "id",
      "name",
      "style",
      "createdAt",
      "updatedAt",
    ]);
    if (
      !isId(input.id) ||
      ids.has(input.id) ||
      !isDate(input.createdAt) ||
      !isDate(input.updatedAt) ||
      input.updatedAt < input.createdAt
    )
      return fail();
    let name: string;
    try {
      name = presetName(input.name);
    } catch {
      return fail();
    }
    if (name !== input.name || names.has(name.toLowerCase())) return fail();
    ids.add(input.id);
    names.add(name.toLowerCase());
    return {
      id: input.id,
      name,
      style: style(input.style),
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    };
  });
  ids.clear();
  const jobs = root.jobs.map((value): ExportJob => {
    const input = record(value, [
      "id",
      "compositionId",
      "kind",
      "status",
      "createdAt",
      "completedAt",
      "width",
      "height",
      "error",
    ]);
    if (
      !isId(input.id) ||
      ids.has(input.id) ||
      input.compositionId !== "current" ||
      (input.kind !== "download" && input.kind !== "clipboard") ||
      !isDate(input.createdAt) ||
      typeof input.width !== "number" ||
      typeof input.height !== "number" ||
      !validDimensions(input.width, input.height) ||
      !Object.values(SIZES).some(({ width, height }) =>
        [1, 2].some(
          (scale) =>
            input.width === width * scale && input.height === height * scale,
        ),
      )
    )
      return fail();
    if (input.status === "pending") {
      if (input.completedAt !== null || input.error !== null) return fail();
    } else if (input.status === "succeeded" || input.status === "failed") {
      if (
        !isDate(input.completedAt) ||
        input.completedAt < input.createdAt ||
        (input.status === "succeeded"
          ? input.error !== null
          : !isErrorCode(input.error))
      )
        return fail();
    } else return fail();
    ids.add(input.id);
    return {
      id: input.id,
      compositionId: "current",
      kind: input.kind,
      status: input.status,
      createdAt: input.createdAt,
      completedAt: input.completedAt as string | null,
      width: input.width,
      height: input.height,
      error: input.error as string | null,
    };
  });
  return {
    version: 1,
    composition: {
      id: "current",
      createdAt: composition.createdAt,
      updatedAt: composition.updatedAt,
      status: composition.status,
      style: style(composition.style),
      source,
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

function read(storage: Storage): string | null {
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    throw new AppError(
      "storage_unavailable",
      "Browser storage is unavailable. Enable site storage, then retry.",
    );
  }
}

function uniqueId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new AppError(
    "unsupported_browser",
    "This browser cannot generate local record IDs.",
  );
}

export function createStore(): Store {
  return validateStore(migrateLocalDocument(null, now()));
}

export function loadStore(storage: Storage): Store {
  const raw = read(storage);
  snapshots.set(storage, raw);
  if (raw === null) return createStore();
  const store = parse(raw);
  const timestamp = now();
  return {
    ...store,
    jobs: store.jobs.map((job) =>
      job.status === "pending"
        ? {
            ...job,
            status: "failed",
            completedAt: timestamp < job.createdAt ? job.createdAt : timestamp,
            error: "interrupted",
          }
        : job,
    ),
  };
}

export function saveStore(storage: Storage, store: Store): void {
  const normalized = validateStore(store);
  const current = read(storage);
  // Even a caller that skipped loadStore cannot overwrite corrupt or future data.
  const previous = current === null ? null : parse(current);
  if (snapshots.has(storage) && snapshots.get(storage) !== current) {
    throw new AppError(
      "storage_conflict",
      "Another tab changed your saved composition. Reload before saving again.",
    );
  }
  for (const job of previous?.jobs ?? []) {
    const next = normalized.jobs.find((value) => value.id === job.id);
    if (!next) continue; // Old records can be removed by retention or an explicit reset.
    if (
      job.status !== "pending" &&
      JSON.stringify(job) !== JSON.stringify(next)
    ) {
      throw new AppError(
        "job_terminal",
        "A completed export record cannot be changed.",
      );
    }
    if (
      ["compositionId", "kind", "createdAt", "width", "height"].some(
        (key) => job[key as keyof ExportJob] !== next[key as keyof ExportJob],
      )
    ) {
      throw new AppError(
        "job_immutable",
        "An export's submitted details cannot be changed.",
      );
    }
  }
  const raw = JSON.stringify(normalized);
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
        ? "Browser storage is full. Clear a saved image or free site storage, then retry."
        : "The browser could not save your changes. Retry after enabling site storage.",
    );
  }
  snapshots.set(storage, raw);
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

export function createJob(
  store: Store,
  kind: ExportJob["kind"],
  input: Style,
  id: string = uniqueId(),
): Store {
  const current = validateStore(store);
  if (kind !== "download" && kind !== "clipboard")
    throw new AppError(
      "job_kind",
      "Choose a PNG download or clipboard export.",
    );
  if (!isId(id)) throw new AppError("job_id", "The export ID is invalid.");
  if (current.jobs.some((job) => job.id === id))
    throw new AppError(
      "job_duplicate",
      "That export was already submitted. Retry with a new export ID.",
    );
  const job: ExportJob = {
    id,
    compositionId: "current",
    kind,
    status: "pending",
    createdAt: now(),
    completedAt: null,
    ...dimensions(input),
    error: null,
  };
  return {
    ...current,
    jobs: [...current.jobs, job]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-20),
  };
}

export function finishJob(
  store: Store,
  id: string,
  status: "succeeded" | "failed",
  error?: string,
): Store {
  const current = validateStore(store);
  const job = current.jobs.find((value) => value.id === id);
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
  if (status !== "succeeded" && status !== "failed")
    throw new AppError("job_status", "The export result is invalid.");
  const code =
    status === "failed" ? (isErrorCode(error) ? error : "export_failed") : null;
  const timestamp = now();
  return {
    ...current,
    jobs: current.jobs.map((value) =>
      value.id === id
        ? {
            ...value,
            status,
            completedAt:
              timestamp < value.createdAt ? value.createdAt : timestamp,
            error: code,
          }
        : value,
    ),
  };
}
