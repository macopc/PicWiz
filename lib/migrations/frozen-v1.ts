import { AppError } from "../domain";
import {
  IMAGE_LIMITS,
  isRasterDataUrl,
  validDimensions,
} from "../image-format";
type Style = {
  background: string;
  padding: number;
  radius: number;
  shadow: number;
  frame: "none" | "browser" | "device";
  appearance: "light" | "dark";
  size: "landscape" | "square" | "portrait";
  scale: 1 | 2;
};
export const V1_DEFAULT_STYLE: Style = {
  background: "violet",
  padding: 96,
  radius: 12,
  shadow: 36,
  frame: "none",
  appearance: "light",
  size: "landscape",
  scale: 1,
};
const DEFAULT_STYLE = V1_DEFAULT_STYLE;
export const V1_SIZES = {
  landscape: { width: 1600, height: 900 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
} as const;
const SIZES = V1_SIZES;
const BACKGROUNDS = [
  "violet",
  "sunset",
  "ocean",
  "mint",
  "rose",
  "midnight",
  "paper",
  "ink",
];
function normalizeStyle(input: Record<string, unknown>): Style {
  const integer = (value: unknown, fallback: number, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.min(max, Math.round(value)))
      : fallback;
  return {
    background:
      typeof input.background === "string" &&
      BACKGROUNDS.includes(input.background)
        ? input.background
        : "violet",
    padding: integer(input.padding, 96, 200),
    radius: integer(input.radius, 12, 48),
    shadow: integer(input.shadow, 36, 100),
    frame:
      input.frame === "browser" || input.frame === "device"
        ? input.frame
        : "none",
    appearance: input.appearance === "dark" ? "dark" : "light",
    size:
      input.size === "square" || input.size === "portrait"
        ? input.size
        : "landscape",
    scale: input.scale === 2 ? 2 : 1,
  };
}
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
export type V1Store = {
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

const fail = (): never => {
  throw new AppError(
    "storage_corrupt",
    "Saved browser data is invalid. It has been preserved; clear local data to start again.",
  );
};
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

export function validateV1Store(value: unknown): V1Store {
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
