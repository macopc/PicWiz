import { type Annotation, validateAnnotations } from "./annotations";
import {
  canvasToPng,
  importImage,
  isPngEncoderBusy,
  loadImage,
} from "./browser";
import { renderComposition } from "./canvas";
import { AppError, dimensions, normalizeStyle, SIZES, type SizeId, type Style } from "./domain";
import { IMAGE_LIMITS, isRasterDataUrl, validDimensions } from "./image-format";
import { createZip, type ZipEntry, type ZipOptions } from "./zip";

export const BATCH_LIMITS = Object.freeze({
  sources: 10,
  formats: 3,
  tasks: 30,
  inputBytes: 150 * 1024 * 1024,
  retainedBytes: 64 * 1024 * 1024,
  zipBytes: 65 * 1024 * 1024,
});

export type BatchSource =
  | { id: string; name: string; file: File }
  | { id: string; name: string; dataUrl: string; width: number; height: number; annotations: Annotation[] };
export type BatchTaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type BatchTask = {
  id: string;
  sourceIndex: number;
  size: SizeId;
  width: number;
  height: number;
  status: BatchTaskStatus;
  error: string | null;
  attemptId: string;
  path: string;
  blob?: Blob;
};
export type BatchPlan = {
  id: string;
  createdAt: string;
  sources: BatchSource[];
  formats: SizeId[];
  style: Style;
  tasks: BatchTask[];
};
export type BatchProgress = {
  tasks: BatchTask[];
  current: number;
  total: number;
  phase: "rendering" | "packaging" | "complete" | "cancelled";
  retainedBytes: number;
};
export type BatchAttempt = {
  id: string;
  createdAt: string;
  kind: "render" | "package";
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
};
export type BatchResult = {
  plan: BatchPlan;
  tasks: BatchTask[];
  archive: Blob | null;
  error: string | null;
  status: "succeeded" | "failed" | "cancelled";
  completed: number;
  failed: number;
  retainedBytes: number;
  attempts: BatchAttempt[];
};
export type BatchAdapters = {
  importImage(file: File): ReturnType<typeof importImage>;
  loadImage(dataUrl: string): ReturnType<typeof loadImage>;
  createCanvas(): HTMLCanvasElement;
  renderComposition: typeof renderComposition;
  canvasToPng(canvas: HTMLCanvasElement, options: { signal?: AbortSignal }): Promise<Blob>;
  isPngEncoderBusy(): boolean;
  releaseImage(image: HTMLImageElement): void;
  releaseCanvas(canvas: HTMLCanvasElement): void;
  yieldControl(): Promise<void>;
  createZip(entries: ZipEntry[], options: ZipOptions): Promise<Blob>;
  now(): Date;
};
export type BatchOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: BatchProgress) => void;
  previous?: BatchResult;
  adapters?: Partial<BatchAdapters>;
};

type Session = { latest: BatchResult | null; rootTasks: BatchTask[] };
type PlanContext = { session: Session; previous?: BatchResult };
type ResultContext = {
  plan: BatchPlan;
  session: Session;
  adapters: BatchAdapters;
  tasks: BatchTask[];
  attempts: BatchAttempt[];
};
const plans = new WeakMap<BatchPlan, PlanContext>();
const results = new WeakMap<BatchResult, ResultContext>();
const submittedIds = new Set<string>();
let running = false;

const defaults: BatchAdapters = {
  importImage,
  loadImage,
  createCanvas: () => document.createElement("canvas"),
  renderComposition,
  canvasToPng,
  isPngEncoderBusy,
  releaseImage: (image) => {
    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");
  },
  releaseCanvas: (canvas) => {
    canvas.width = 0;
    canvas.height = 0;
  },
  yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
  createZip,
  now: () => new Date(),
};

function identifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 160 && !/[\u0000-\u001f\u007f]/.test(value);
}

function attemptId(id?: string): string {
  const value = id ?? crypto.randomUUID();
  if (!identifier(value))
    throw new AppError("batch_input", "Choose a valid batch attempt ID.");
  return value;
}

function freezeTasks(tasks: BatchTask[]): BatchTask[] {
  return Object.freeze(tasks.map((task) => Object.freeze({ ...task }))) as unknown as BatchTask[];
}

function freezeAttempts(attempts: BatchAttempt[]): BatchAttempt[] {
  return Object.freeze(attempts.map((attempt) => Object.freeze({ ...attempt }))) as unknown as BatchAttempt[];
}

function sourceStem(name: string): string {
  return name.replace(/\.[^.]*$/, "").normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60).replace(/-+$/g, "").toLowerCase() || "screenshot";
}

function snapshotSource(source: BatchSource): BatchSource {
  if (!source || typeof source !== "object" || !identifier(source.id) || typeof source.name !== "string")
    throw new AppError("batch_input", "Each batch source needs an ID and a name.");
  const name = source.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) || "screenshot";
  if ("file" in source) {
    if ("dataUrl" in source || !(source.file instanceof Blob) || typeof source.file.name !== "string" || !Number.isSafeInteger(source.file.size) || source.file.size < 0)
      throw new AppError("batch_input", "Choose local image files for this batch.");
    // File sources deliberately do not copy any active-image annotations.
    return Object.freeze({ id: source.id, name, file: source.file });
  }
  if (typeof source.dataUrl !== "string" || !Number.isSafeInteger(source.width) || !Number.isSafeInteger(source.height) || !Array.isArray(source.annotations))
    throw new AppError("batch_input", "The current screenshot snapshot is invalid.");
  const annotations = validateAnnotations(source.annotations).map((annotation) => Object.freeze({ ...annotation }));
  Object.freeze(annotations);
  return Object.freeze({ id: source.id, name, dataUrl: source.dataUrl, width: source.width, height: source.height, annotations });
}

export function createBatchPlan(
  sources: BatchSource[],
  formats: SizeId[],
  style: Style,
  id?: string,
): BatchPlan {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > BATCH_LIMITS.sources || !Array.isArray(formats) || formats.length < 1 || formats.length > BATCH_LIMITS.formats || new Set(formats).size !== formats.length || formats.some((size) => !Object.hasOwn(SIZES, size)))
    throw new AppError("batch_input", "Choose 1–10 sources and 1–3 different output sizes.");
  const normalized = normalizeStyle(style);
  if (!style || typeof style !== "object" || (Object.keys(normalized) as (keyof Style)[]).some((key) => normalized[key] !== style[key]))
    throw new AppError("batch_input", "The batch style is invalid.");
  const snapshot = sources.map(snapshotSource);
  if (new Set(snapshot.map((source) => source.id)).size !== snapshot.length)
    throw new AppError("batch_input", "Batch source IDs must be unique.");
  const inputBytes = snapshot.reduce((sum, source) => sum + ("file" in source ? source.file.size : 0), 0);
  if (!Number.isSafeInteger(inputBytes) || inputBytes > BATCH_LIMITS.inputBytes)
    throw new AppError("batch_input", "Batch input files must total at most 150 MiB.");
  const planId = attemptId(id);
  const tasks = freezeTasks(snapshot.flatMap((source, sourceIndex) => formats.map((size) => {
    const output = dimensions({ ...normalized, size });
    return {
      id: `${sourceIndex}:${size}`, sourceIndex, size, ...output,
      status: "queued" as const, error: null, attemptId: planId,
      path: `${String(sourceIndex + 1).padStart(2, "0")}-${sourceStem(source.name)}/${size}-${output.width}x${output.height}.png`,
    };
  })));
  if (tasks.length > BATCH_LIMITS.tasks)
    throw new AppError("batch_input", "A batch can contain at most 30 PNGs.");
  const plan: BatchPlan = Object.freeze({
    id: planId, createdAt: new Date().toISOString(),
    sources: Object.freeze(snapshot) as unknown as BatchSource[],
    formats: Object.freeze([...formats]) as unknown as SizeId[],
    style: Object.freeze({ ...normalized }), tasks,
  });
  plans.set(plan, { session: { latest: null, rootTasks: tasks } });
  return plan;
}

const RETRYABLE = new Set([
  "image_read", "image_timeout", "image_encode", "png_encode", "png_timeout",
  "png_busy", "render_failed", "canvas_unavailable", "zip_failed",
]);
export function isRetryableBatchError(code: string | null): boolean {
  return code !== null && RETRYABLE.has(code);
}

export function retryBatchPlan(result: BatchResult, id?: string): BatchPlan {
  const context = results.get(result);
  if (!context || context.session.latest !== result)
    throw new AppError("batch_input", "Retry the latest batch result.");
  const eligible = context.tasks.filter((task) => task.status === "failed" && isRetryableBatchError(task.error));
  if (!eligible.length)
    throw new AppError("batch_retry", "There are no failed items eligible for this retry. Start a new batch with different inputs or settings.");
  const planId = attemptId(id);
  if (context.attempts.some((attempt) => attempt.id === planId) || submittedIds.has(planId))
    throw new AppError("batch_duplicate", "This batch attempt ID has already been submitted.");
  const plan: BatchPlan = Object.freeze({
    id: planId, createdAt: new Date().toISOString(),
    sources: context.plan.sources, style: context.plan.style,
    formats: Object.freeze([...new Set(eligible.map((task) => task.size))]) as unknown as SizeId[],
    tasks: freezeTasks(eligible.map(({ blob: _blob, ...task }) => ({ ...task, status: "queued", error: null, attemptId: planId }))),
  });
  plans.set(plan, { session: context.session, previous: result });
  return plan;
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new AppError("cancelled", "Batch export was cancelled.");
}

function codeOf(error: unknown, fallback: string): string {
  return error instanceof AppError ? error.code : fallback;
}

function retainedBytes(tasks: BatchTask[]): number {
  return tasks.reduce((sum, task) => sum + (task.status === "succeeded" ? task.blob?.size ?? 0 : 0), 0);
}

function manifestEntries(tasks: BatchTask[]) {
  return tasks.map(({ id, sourceIndex, path, size, width, height, status, error, attemptId }) => ({ id, sourceIndex, path, size, width, height, status, error, attemptId }));
}

async function packageTasks(
  plan: BatchPlan,
  tasks: BatchTask[],
  attempts: BatchAttempt[],
  adapters: BatchAdapters,
  signal?: AbortSignal,
): Promise<Blob> {
  checkAbort(signal);
  const successes = tasks.filter((task) => task.status === "succeeded");
  if (!successes.length)
    throw new AppError("batch_empty", "There are no completed PNGs to package.");
  if (retainedBytes(tasks) > BATCH_LIMITS.retainedBytes || successes.some((task) => !(task.blob instanceof Blob) || !task.blob.size || task.blob.type !== "image/png"))
    throw new AppError("resource_limit", "The retained PNG results are invalid or exceed 64 MiB.");
  const manifest = new Blob([JSON.stringify({
    app: "picwiz", version: 2, createdAt: adapters.now().toISOString(),
    planId: plan.id, scale: plan.style.scale, attempts,
    entries: manifestEntries(tasks),
  }, null, 2)], { type: "application/json" });
  const archive = await adapters.createZip([
    { name: "picwiz-manifest.json", blob: manifest },
    ...successes.map((task) => ({ name: task.path, blob: task.blob! })),
  ], { signal, maxBytes: BATCH_LIMITS.zipBytes });
  checkAbort(signal);
  if (!(archive instanceof Blob) || !archive.size || archive.size > BATCH_LIMITS.zipBytes)
    throw new AppError("zip_failed", "The ZIP could not fit within 65 MiB.");
  return archive;
}

/** Explicit ZIP-only recovery; does not decode, render, encode, save, or download. */
export async function packageBatchResult(
  result: BatchResult,
  options: { signal?: AbortSignal } = {},
): Promise<Blob> {
  const context = results.get(result);
  if (!context)
    throw new AppError("batch_input", "Choose a batch result from this session.");
  if (running)
    throw new AppError("batch_busy", "Wait for the active batch operation to finish.");
  checkAbort(options.signal);
  running = true;
  try {
    result.archive = null;
    const count = context.tasks.filter((task) => task.status === "succeeded").length;
    const attempt: BatchAttempt = {
      id: attemptId(), createdAt: context.adapters.now().toISOString(), kind: "package",
      total: count, completed: count, failed: 0, cancelled: 0,
    };
    const archive = await packageTasks(context.plan, context.tasks, [...context.attempts, attempt], context.adapters, options.signal);
    checkAbort(options.signal);
    return archive;
  } catch (error) {
    checkAbort(options.signal);
    if (error instanceof AppError && error.code === "batch_empty") throw error;
    throw new AppError("zip_failed", "The ZIP could not be prepared. Try preparing it again.");
  } finally {
    running = false;
  }
}

/** Serial bounded runner; PNG failures return as task rows rather than rejecting. */
export async function runBatch(plan: BatchPlan, options: BatchOptions = {}): Promise<BatchResult> {
  const context = plans.get(plan);
  if (!context || context.previous !== options.previous || (context.previous && context.session.latest !== context.previous))
    throw new AppError("batch_input", "Use a valid plan and its matching latest previous result for retry.");
  if (running)
    throw new AppError("batch_busy", "Wait for the active batch operation to finish.");
  if (submittedIds.has(plan.id))
    throw new AppError("batch_duplicate", "This batch attempt ID has already been submitted.");
  const adapters = { ...defaults, ...options.adapters };
  if (!options.signal?.aborted && adapters.isPngEncoderBusy())
    throw new AppError("png_busy", "Wait for the browser PNG encoder to finish; reload if it never responds.");
  submittedIds.add(plan.id);
  running = true;
  // A cancelled retry may never reach packaging, so release the old ZIP on acceptance.
  if (options.previous) options.previous.archive = null;
  const previous = options.previous ? results.get(options.previous) : undefined;
  const submitted = new Set(plan.tasks.map((task) => task.id));
  const replacements = new Map(plan.tasks.map((task) => [task.id, task]));
  const tasks = (previous?.tasks ?? context.session.rootTasks).map((task) => ({ ...replacements.get(task.id) ?? task }));
  let bytes = retainedBytes(tasks);
  let archive: Blob | null = null;
  let cancelled = false;
  let zipFailed = false;
  const pending = () => tasks.filter((task) => submitted.has(task.id) && (task.status === "queued" || task.status === "running"));
  const emit = (phase: BatchProgress["phase"]) => {
    // Observers get detached frozen rows; they cannot alter runner accounting.
    const progress: BatchProgress = Object.freeze({ tasks: freezeTasks(tasks), current: tasks.filter((task) => submitted.has(task.id) && !["queued", "running"].includes(task.status)).length, total: plan.tasks.length, phase, retainedBytes: bytes });
    try {
      options.onProgress?.(progress);
    } catch {
      // UI observers must not interrupt cleanup or discard accepted results.
    }
  };
  const failPending = (code: string) => {
    for (const task of pending()) { task.status = "failed"; task.error = code; }
  };
  const attempt = (): BatchAttempt => ({
    id: plan.id, createdAt: plan.createdAt, kind: "render", total: plan.tasks.length,
    completed: tasks.filter((task) => submitted.has(task.id) && task.status === "succeeded").length,
    failed: tasks.filter((task) => submitted.has(task.id) && task.status === "failed").length,
    cancelled: tasks.filter((task) => submitted.has(task.id) && task.status === "cancelled").length,
  });
  try {
    checkAbort(options.signal);
    emit("rendering");
    for (let sourceIndex = 0; sourceIndex < plan.sources.length; sourceIndex++) {
      checkAbort(options.signal);
      const group = tasks.filter((task) => task.sourceIndex === sourceIndex && submitted.has(task.id) && task.status === "queued");
      if (!group.length) continue;
      if (adapters.isPngEncoderBusy()) { failPending("png_busy"); break; }
      let image: HTMLImageElement | undefined;
      let canvas: HTMLCanvasElement | undefined;
      let stage = "image_read";
      try {
        group[0].status = "running";
        emit("rendering");
        checkAbort(options.signal);
        const source = plan.sources[sourceIndex];
        let width: number;
        let height: number;
        let annotations: Annotation[] = [];
        if ("file" in source) {
          if (!source.file.size) throw new AppError("image_empty", "Choose a nonempty image.");
          if (source.file.size > IMAGE_LIMITS.bytes) throw new AppError("image_size", "Choose an image no larger than 25 MiB.");
          if (source.file.type && !["image/png", "image/jpeg", "image/webp"].includes(source.file.type.toLowerCase()))
            throw new AppError("image_type", "Choose a PNG, JPEG, or WebP image.");
          const decoded = await adapters.importImage(source.file);
          image = decoded.image;
          width = decoded.width;
          height = decoded.height;
          checkAbort(options.signal);
        } else {
          if (!isRasterDataUrl(source.dataUrl)) throw new AppError("image_type", "The current screenshot is not a local raster image.");
          if (!validDimensions(source.width, source.height, IMAGE_LIMITS.normalizedEdge)) throw new AppError("image_dimensions", "The current screenshot dimensions are invalid.");
          image = await adapters.loadImage(source.dataUrl);
          checkAbort(options.signal);
          width = source.width;
          height = source.height;
          annotations = source.annotations;
        }
        if (!validDimensions(width, height, IMAGE_LIMITS.normalizedEdge) || image.naturalWidth !== width || image.naturalHeight !== height)
          throw new AppError("image_dimensions", "The decoded screenshot dimensions are invalid.");
        stage = "canvas_unavailable";
        canvas = adapters.createCanvas();
        for (const task of group) {
          checkAbort(options.signal);
          if (task.status === "failed") break;
          task.status = "running";
          emit("rendering");
          checkAbort(options.signal);
          try {
            if (adapters.isPngEncoderBusy()) throw new AppError("png_busy", "The browser PNG encoder is still busy.");
            stage = "render_failed";
            adapters.renderComposition(canvas, image, { width, height }, { ...plan.style, size: task.size }, { width: task.width, height: task.height }, annotations);
            checkAbort(options.signal);
            stage = "png_encode";
            if (adapters.isPngEncoderBusy()) throw new AppError("png_busy", "The browser PNG encoder is still busy.");
            const blob = await adapters.canvasToPng(canvas, { signal: options.signal });
            checkAbort(options.signal);
            if (!(blob instanceof Blob) || blob.type !== "image/png" || !blob.size)
              throw new AppError("png_encode", "This item did not produce a valid PNG.");
            if (bytes + blob.size > BATCH_LIMITS.retainedBytes) {
              failPending("resource_limit");
              break;
            }
            task.blob = blob;
            task.status = "succeeded";
            task.error = null;
            bytes += blob.size;
          } catch (error) {
            checkAbort(options.signal);
            task.status = "failed";
            task.error = codeOf(error, stage);
            if (adapters.isPngEncoderBusy() || task.error === "png_busy") { failPending("png_busy"); break; }
          }
          emit("rendering");
          checkAbort(options.signal);
          await adapters.yieldControl();
          checkAbort(options.signal);
        }
      } catch (error) {
        checkAbort(options.signal);
        for (const task of group) {
          if (task.status === "queued" || task.status === "running") {
            task.status = "failed";
            task.error = codeOf(error, stage);
          }
        }
      } finally {
        if (image) adapters.releaseImage(image);
        if (canvas) adapters.releaseCanvas(canvas);
      }
      emit("rendering");
      checkAbort(options.signal);
      await adapters.yieldControl();
      checkAbort(options.signal);
    }
    checkAbort(options.signal);
    if (tasks.some((task) => task.status === "succeeded")) {
      emit("packaging");
      checkAbort(options.signal);
      try {
        archive = await packageTasks(plan, tasks, [...previous?.attempts ?? [], attempt()], adapters, options.signal);
        checkAbort(options.signal);
      } catch {
        checkAbort(options.signal);
        zipFailed = true;
      }
    }
  } catch (error) {
    if (options.signal?.aborted || codeOf(error, "") === "cancelled") {
      cancelled = true;
      archive = null;
      for (const task of pending()) { task.status = "cancelled"; task.error = "cancelled"; }
    } else {
      // Unexpected environment failures remain visible and retain accepted PNGs.
      failPending(codeOf(error, "batch_failed"));
    }
  } finally {
    running = false;
  }
  const counts = attempt();
  const result: BatchResult = {
    plan, tasks: freezeTasks(tasks), archive,
    status: cancelled ? "cancelled" : zipFailed || counts.failed > 0 ? "failed" : "succeeded",
    error: cancelled ? "cancelled" : zipFailed ? "zip_failed" : counts.failed ? (tasks.some((task) => task.status === "succeeded") ? "batch_partial" : tasks.find((task) => task.status === "failed")?.error ?? "batch_failed") : null,
    completed: counts.completed, failed: counts.failed, retainedBytes: bytes,
    attempts: freezeAttempts([...previous?.attempts ?? [], counts]),
  };
  results.set(result, { plan, session: context.session, adapters, tasks: result.tasks, attempts: result.attempts });
  context.session.latest = result;
  emit(cancelled ? "cancelled" : "complete");
  return result;
}
