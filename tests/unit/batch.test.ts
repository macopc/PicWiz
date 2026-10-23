import { unzipSync, strFromU8 } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnnotation } from "../../lib/annotations";
import { canvasToPng, isPngEncoderBusy } from "../../lib/browser";
import { AppError, DEFAULT_STYLE, SIZES, type SizeId } from "../../lib/domain";
import {
  BATCH_LIMITS, createBatchPlan, isRetryableBatchError, packageBatchResult,
  retryBatchPlan, runBatch, type BatchAdapters, type BatchProgress, type BatchSource,
} from "../../lib/batch";

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0b8AAAAASUVORK5CYII=";
const PNG = new Blob(["png"], { type: "image/png" });
const ZIP = new Blob(["zip"], { type: "application/zip" });
const fileSource = (id = "a", name = `${id}.png`): BatchSource => ({ id, name, file: new File(["local"], name, { type: "image/png" }) });
const currentSource = (): BatchSource => ({ id: "current", name: "Current.png", dataUrl: PIXEL, width: 1, height: 1, annotations: [createAnnotation("text", "note")] });
const makePlan = (sources = [fileSource()], formats: SizeId[] = ["landscape"]) => createBatchPlan(sources, formats, DEFAULT_STYLE);
const bigPng = (size: number) => new Blob([new Uint8Array(size)], { type: "image/png" });
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function fakeAdapters(overrides: Partial<BatchAdapters> = {}) {
  let activeImages = 0;
  let activeCanvases = 0;
  const events: string[] = [];
  const decoded = () => {
    expect(activeImages).toBe(0);
    activeImages++;
    events.push("decode");
    return { naturalWidth: 1, naturalHeight: 1, removeAttribute: vi.fn() } as unknown as HTMLImageElement;
  };
  const adapters: Omit<BatchAdapters, "createZip"> & { createZip?: BatchAdapters["createZip"] } = {
    importImage: vi.fn(async () => ({ dataUrl: PIXEL, name: "source.png", width: 1, height: 1, image: decoded() })),
    loadImage: vi.fn(async () => decoded()),
    createCanvas: vi.fn(() => {
      expect(activeCanvases).toBe(0); activeCanvases++;
      return { width: 0, height: 0 } as HTMLCanvasElement;
    }),
    renderComposition: vi.fn((canvas, _image, _size, style, output) => {
      events.push(`render:${style.size}`); canvas.width = output!.width; canvas.height = output!.height;
    }),
    canvasToPng: vi.fn(async () => { events.push("encode"); return PNG; }),
    isPngEncoderBusy: () => false,
    releaseImage: vi.fn(() => { activeImages--; events.push("release-image"); }),
    releaseCanvas: vi.fn((canvas) => { activeCanvases--; canvas.width = canvas.height = 0; events.push("release-canvas"); }),
    yieldControl: vi.fn(async () => { events.push("yield"); }),
    // Real ZIP writer is used unless a test deliberately injects packaging failure.
    createZip: undefined,
    now: () => new Date("2026-10-23T12:34:56.000Z"),
    ...overrides,
  };
  const { createZip: injectedZip, ...rest } = adapters;
  return { adapters: injectedZip ? adapters : rest, events, counts: () => ({ activeImages, activeCanvases }) };
}

function unpack(archive: Blob) {
  return archive.arrayBuffer().then((buffer) => {
    const files = unzipSync(new Uint8Array(buffer));
    return { files, manifest: JSON.parse(strFromU8(files["picwiz-manifest.json"])) };
  });
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("batch planning and immutable snapshots", () => {
  it("rejects invalid structures, counts, duplicate formats/IDs, and aggregate input bytes before decoding", () => {
    for (const sources of [[], Array.from({ length: 11 }, (_, n) => fileSource(String(n)))])
      expect(() => makePlan(sources)).toThrow(AppError);
    for (const formats of [[], ["square", "square"], ["landscape", "square", "portrait", "story"], ["bogus"]] as SizeId[][])
      expect(() => makePlan([fileSource()], formats)).toThrow(AppError);
    expect(() => makePlan([fileSource(), fileSource()])).toThrow(AppError);
    expect(() => makePlan([{ id: "broken", name: "broken", file: {} as File }])).toThrow(AppError);
    expect(() => createBatchPlan([fileSource()], ["square"], { ...DEFAULT_STYLE, scale: 3 } as never)).toThrow(AppError);
    const source = fileSource() as { id: string; name: string; file: File };
    Object.defineProperty(source.file, "size", { value: BATCH_LIMITS.inputBytes });
    expect(makePlan([source]).tasks).toHaveLength(1);
    expect(() => makePlan([source, fileSource("b")])).toThrow(AppError);
    const exact = Array.from({ length: 6 }, (_, index) => {
      const item = fileSource(String(index)) as { id: string; name: string; file: File };
      Object.defineProperty(item.file, "size", { value: 25 * 1024 * 1024 });
      return item;
    });
    expect(makePlan(exact).tasks).toHaveLength(6);
    expect(() => makePlan([...exact, { id: "extra", name: "extra.png", file: new File(["x"], "extra.png") }])).toThrow(AppError);
  });

  it("deep-freezes independent source/style/annotation snapshots and strips file annotations", () => {
    const current = currentSource();
    if ("file" in current) throw new Error("fixture");
    const style = { ...DEFAULT_STYLE };
    const formats: SizeId[] = ["square", "story"];
    const extra = { ...fileSource(), annotations: current.annotations };
    const sources = [current, extra];
    const plan = createBatchPlan(sources, formats, style);
    style.padding = 12; formats[0] = "portrait"; current.annotations[0].text = "changed"; current.dataUrl = "https://remote.invalid";
    expect(plan.style.padding).toBe(DEFAULT_STYLE.padding);
    expect(plan.formats).toEqual(["square", "story"]);
    expect(plan.sources[0]).toMatchObject({ dataUrl: PIXEL, annotations: [{ text: "Your text" }] });
    expect(plan.sources[1]).not.toHaveProperty("annotations");
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.tasks[0])).toBe(true);
    expect(Object.isFrozen((plan.sources[0] as Exclude<BatchSource, { file: File }>).annotations[0])).toBe(true);
    expect(() => { plan.style.scale = 2; }).toThrow();
  });

  it("creates stable numbered unique ASCII paths and exact dimensions at both scales", () => {
    for (const scale of [1, 2] as const) {
      for (const size of Object.keys(SIZES) as SizeId[]) {
        const plan = createBatchPlan([fileSource("a", "../../Évil 用户!.PNG"), fileSource("b", "../../Évil 用户!.PNG")], [size], { ...DEFAULT_STYLE, scale });
        expect(plan.tasks.map((task) => task.id)).toEqual([`0:${size}`, `1:${size}`]);
        expect(plan.tasks[0]).toMatchObject({ width: SIZES[size].width * scale, height: SIZES[size].height * scale });
        expect(plan.tasks[0].path).toBe(`01-evil/${size}-${SIZES[size].width * scale}x${SIZES[size].height * scale}.png`);
        expect(plan.tasks[1].path.startsWith("02-evil/")).toBe(true);
        expect(plan.tasks.every((task) => /^[A-Za-z0-9/-]+\.png$/.test(task.path))).toBe(true);
      }
    }
    expect(makePlan([fileSource("x", "用户.png")]).tasks[0].path.startsWith("01-screenshot/")).toBe(true);
    expect(makePlan([fileSource("x", `${"a".repeat(100)}.png`)]).tasks[0].path.split("/")[0].length).toBe(63);
  });
});

describe("serial runner and partial results", () => {
  it("runs the maximum 10×3 batch serially, yields/releases each group, and reports accurate progress", async () => {
    const { adapters, counts, events } = fakeAdapters();
    const progress: BatchProgress[] = [];
    const plan = makePlan(Array.from({ length: 10 }, (_, n) => fileSource(String(n))), ["landscape", "square", "portrait"]);
    const result = await runBatch(plan, { adapters, onProgress: (value) => progress.push(value) });
    expect(result).toMatchObject({ status: "succeeded", completed: 30, failed: 0, retainedBytes: PNG.size * 30, error: null });
    expect(counts()).toEqual({ activeImages: 0, activeCanvases: 0 });
    expect(adapters.importImage).toHaveBeenCalledTimes(10);
    expect(adapters.createCanvas).toHaveBeenCalledTimes(10);
    expect(adapters.canvasToPng).toHaveBeenCalledTimes(30);
    expect(adapters.releaseCanvas).toHaveBeenCalledTimes(10);
    expect(events.slice(0, 7)).toEqual(["decode", "render:landscape", "encode", "yield", "render:square", "encode", "yield"]);
    expect(progress.at(-1)).toMatchObject({ phase: "complete", current: 30, total: 30 });
    expect(progress.every((item) => item.total === 30 && Object.isFrozen(item.tasks[0]))).toBe(true);
    expect(plan.tasks.every((task) => task.status === "queued")).toBe(true);
    const { files, manifest } = await unpack(result.archive!);
    expect(Object.keys(files)).toHaveLength(31);
    expect(manifest).toMatchObject({ app: "picwiz", version: 2, scale: 1, createdAt: "2026-10-23T12:34:56.000Z", planId: plan.id });
    expect(manifest.entries).toHaveLength(30);
    expect(JSON.stringify(manifest)).not.toContain("data:image");
    expect(JSON.stringify(manifest)).not.toContain("annotations");
    expect(manifest.attempts[0]).toMatchObject({ id: plan.id, total: 30, completed: 30, failed: 0 });
  });

  it("passes current-image annotations only to that source", async () => {
    const { adapters } = fakeAdapters();
    await runBatch(makePlan([currentSource(), fileSource()], ["square", "story"]), { adapters });
    const calls = vi.mocked(adapters.renderComposition).mock.calls;
    expect(calls.map((call) => call[5]?.length)).toEqual([1, 1, 0, 0]);
    expect(calls[0][5]?.[0].text).toBe("Your text");
    expect(adapters.loadImage).toHaveBeenCalledWith(PIXEL);
  });

  it("continues after rejected files and item encoding failures, keeping the partial ZIP", async () => {
    const { adapters } = fakeAdapters();
    vi.mocked(adapters.importImage).mockRejectedValueOnce(new AppError("image_decode", "damaged"));
    vi.mocked(adapters.canvasToPng).mockRejectedValueOnce(new AppError("png_encode", "temporary"));
    const result = await runBatch(makePlan([fileSource("bad"), fileSource("good")], ["square", "story"]), { adapters });
    expect(result).toMatchObject({ status: "failed", error: "batch_partial", completed: 1, failed: 3 });
    expect(result.tasks.map((task) => task.error)).toEqual(["image_decode", "image_decode", "png_encode", null]);
    const { files, manifest } = await unpack(result.archive!);
    expect(Object.keys(files)).toHaveLength(2);
    expect(manifest.entries.map((entry: { status: string }) => entry.status)).toEqual(["failed", "failed", "failed", "succeeded"]);
    expect(adapters.releaseImage).toHaveBeenCalledOnce();
    expect(adapters.releaseCanvas).toHaveBeenCalledOnce();
  });

  it("returns all-failed without a ZIP, and rejects permanent inputs before invoking decode", async () => {
    const empty = { id: "empty", name: "empty.png", file: new File([], "empty.png", { type: "image/png" }) };
    const wrong = { id: "wrong", name: "wrong.svg", file: new File(["<svg/>"], "wrong.svg", { type: "image/svg+xml" }) };
    const oversized = fileSource("large") as { id: string; name: string; file: File };
    Object.defineProperty(oversized.file, "size", { value: 25 * 1024 * 1024 + 1 });
    const { adapters } = fakeAdapters();
    const result = await runBatch(makePlan([empty, wrong, oversized]), { adapters });
    expect(result).toMatchObject({ status: "failed", completed: 0, failed: 3, archive: null });
    expect(result.tasks.map((task) => task.error)).toEqual(["image_empty", "image_type", "image_size"]);
    expect(adapters.importImage).not.toHaveBeenCalled();
    await expect(packageBatchResult(result)).rejects.toMatchObject({ code: "batch_empty" });
    expect(() => retryBatchPlan(result)).toThrow(AppError);
  });

  it("normalizes unexpected encode/render rejection and releases resources", async () => {
    const { adapters, counts } = fakeAdapters();
    vi.mocked(adapters.renderComposition).mockImplementationOnce(() => { throw new Error("render"); });
    vi.mocked(adapters.canvasToPng).mockRejectedValueOnce(new Error("encode"));
    const result = await runBatch(makePlan([fileSource()], ["square", "portrait", "story"]), { adapters });
    expect(result.tasks.map((task) => task.error)).toEqual(["render_failed", "png_encode", null]);
    expect(counts()).toEqual({ activeImages: 0, activeCanvases: 0 });
  });

  it("prevents progress observers from mutating tasks or discarding accepted results", async () => {
    const { adapters } = fakeAdapters();
    const result = await runBatch(makePlan(), { adapters, onProgress: (progress) => {
      progress.tasks[0].status = "failed";
    } });
    expect(result).toMatchObject({ status: "succeeded", completed: 1, failed: 0, retainedBytes: PNG.size });
    expect(result.archive).toBeInstanceOf(Blob);
  });

  it("guards decoded dimension mismatches and nonlocal current image URLs", async () => {
    const source = currentSource();
    if ("file" in source) throw new Error("fixture");
    source.dataUrl = "https://example.invalid/photo.png";
    const { adapters } = fakeAdapters();
    const badUrl = await runBatch(makePlan([source]), { adapters });
    expect(badUrl.tasks[0].error).toBe("image_type");
    expect(adapters.loadImage).not.toHaveBeenCalled();
    const local = currentSource();
    if ("file" in local) throw new Error("fixture");
    local.width = 2;
    const mismatch = await runBatch(makePlan([local]), { adapters });
    expect(mismatch.tasks[0].error).toBe("image_dimensions");
    expect(adapters.releaseImage).toHaveBeenCalledOnce();
    expect(adapters.createCanvas).not.toHaveBeenCalled();
  });
});

describe("retry budgets and recovery", () => {
  it("submits only eligible stable pairs with a fresh ID and subset formats, retaining previous successes", async () => {
    const { adapters } = fakeAdapters();
    vi.mocked(adapters.canvasToPng).mockResolvedValueOnce(PNG).mockRejectedValueOnce(new AppError("png_encode", "temporary"));
    const first = await runBatch(makePlan([fileSource()], ["square", "story"]), { adapters });
    const oldTasks = first.tasks;
    const retry = retryBatchPlan(first);
    expect(retry.id).not.toBe(first.plan.id);
    expect(retry.formats).toEqual(["story"]);
    expect(retry.tasks.map((task) => task.id)).toEqual(["0:story"]);
    expect(retry.sources).toBe(first.plan.sources);
    const progress: BatchProgress[] = [];
    const result = await runBatch(retry, { previous: first, adapters, onProgress: (value) => progress.push(value) });
    expect(result).toMatchObject({ status: "succeeded", completed: 1, failed: 0, retainedBytes: PNG.size * 2 });
    expect(result.tasks[0].blob).toBe(oldTasks[0].blob);
    expect(first.tasks).toBe(oldTasks);
    expect(first.tasks[1].status).toBe("failed");
    expect(first.archive).toBeNull();
    expect(adapters.canvasToPng).toHaveBeenCalledTimes(3);
    expect(progress.at(-1)).toMatchObject({ total: 1, current: 1 });
    expect(progress.at(-1)?.tasks).toHaveLength(2);
    const { files, manifest } = await unpack(result.archive!);
    expect(Object.keys(files)).toHaveLength(3);
    expect(manifest.attempts.map((item: { total: number }) => item.total)).toEqual([2, 1]);
    expect(manifest.entries.map((item: { attemptId: string }) => item.attemptId)).toEqual([first.plan.id, retry.id]);
    expect(() => retryBatchPlan(first)).toThrow(AppError);
  });

  it("does not offer same-configuration retries for permanent failures or cancelled pairs", () => {
    for (const code of [null, "resource_limit", "image_type", "image_decode", "image_dimensions", "image_size", "image_empty", "cancelled"])
      expect(isRetryableBatchError(code)).toBe(false);
    for (const code of ["image_read", "image_timeout", "png_encode", "png_timeout", "png_busy", "zip_failed"])
      expect(isRetryableBatchError(code)).toBe(true);
  });

  it("accepts exactly 64 MiB, discards +1 byte, and fails all unstarted pairs without further encoding", async () => {
    const accepted = bigPng(BATCH_LIMITS.retainedBytes);
    const { adapters } = fakeAdapters({ createZip: vi.fn(async () => ZIP) });
    vi.mocked(adapters.canvasToPng).mockResolvedValueOnce(accepted).mockResolvedValueOnce(new Blob(["x"], { type: "image/png" }));
    const result = await runBatch(makePlan([fileSource("a"), fileSource("b"), fileSource("c")]), { adapters });
    expect(result).toMatchObject({ completed: 1, failed: 2, retainedBytes: BATCH_LIMITS.retainedBytes, error: "batch_partial" });
    expect(result.tasks.map((task) => task.error)).toEqual([null, "resource_limit", "resource_limit"]);
    expect(result.tasks[1]).not.toHaveProperty("blob");
    expect(adapters.canvasToPng).toHaveBeenCalledTimes(2);
    expect(adapters.importImage).toHaveBeenCalledTimes(2);
    expect(() => retryBatchPlan(result)).toThrow(AppError);
  });

  it("does not retain or package a first PNG that alone exceeds the budget by one byte", async () => {
    const zip = vi.fn(async () => ZIP);
    const { adapters } = fakeAdapters({ createZip: zip });
    vi.mocked(adapters.canvasToPng).mockResolvedValueOnce(bigPng(BATCH_LIMITS.retainedBytes + 1));
    const result = await runBatch(makePlan([fileSource()], ["square", "story"]), { adapters });
    expect(result).toMatchObject({ completed: 0, failed: 2, retainedBytes: 0, archive: null, error: "resource_limit" });
    expect(result.tasks.every((task) => task.error === "resource_limit" && !task.blob)).toBe(true);
    expect(adapters.canvasToPng).toHaveBeenCalledOnce();
    expect(zip).not.toHaveBeenCalled();
  });

  it("keeps permanent failed pairs in merged rows while retry job statistics cover only eligible pairs", async () => {
    const { adapters } = fakeAdapters();
    vi.mocked(adapters.importImage).mockRejectedValueOnce(new AppError("image_decode", "bad input"));
    vi.mocked(adapters.canvasToPng).mockRejectedValueOnce(new AppError("png_encode", "temporary"));
    const first = await runBatch(makePlan([fileSource("bad"), fileSource("retry")]), { adapters });
    const retry = retryBatchPlan(first);
    expect(retry.tasks.map((task) => task.id)).toEqual(["1:landscape"]);
    const next = await runBatch(retry, { previous: first, adapters });
    expect(next).toMatchObject({ status: "succeeded", completed: 1, failed: 0, error: null });
    expect(next.tasks.map((task) => task.status)).toEqual(["failed", "succeeded"]);
    expect((await unpack(next.archive!)).manifest.entries[0].error).toBe("image_decode");
  });

  it("enforces cumulative retention through multiple subset retries and rejects stale previous results", async () => {
    const { adapters } = fakeAdapters({ createZip: async () => ZIP });
    const encode = vi.mocked(adapters.canvasToPng);
    const transient = new AppError("png_encode", "retry");
    encode.mockResolvedValueOnce(bigPng(40 * 1024 * 1024)).mockRejectedValueOnce(transient).mockRejectedValueOnce(transient).mockRejectedValueOnce(transient);
    const first = await runBatch(makePlan([fileSource("a"), fileSource("b"), fileSource("c"), fileSource("d")]), { adapters });
    const retry1 = retryBatchPlan(first);
    const stale = retryBatchPlan(first);
    encode.mockResolvedValueOnce(bigPng(16 * 1024 * 1024)).mockRejectedValueOnce(transient).mockRejectedValueOnce(transient);
    const second = await runBatch(retry1, { previous: first, adapters });
    expect(second).toMatchObject({ completed: 1, failed: 2, retainedBytes: 56 * 1024 * 1024 });
    await expect(runBatch(stale, { previous: first, adapters })).rejects.toMatchObject({ code: "batch_input" });
    const retry2 = retryBatchPlan(second);
    await expect(runBatch(retry2, { adapters })).rejects.toMatchObject({ code: "batch_input" });
    encode.mockResolvedValueOnce(bigPng(8 * 1024 * 1024)).mockResolvedValueOnce(new Blob(["x"], { type: "image/png" }));
    const third = await runBatch(retry2, { previous: second, adapters });
    expect(third).toMatchObject({ completed: 1, failed: 1, retainedBytes: BATCH_LIMITS.retainedBytes });
    expect(third.tasks.map((task) => task.status)).toEqual(["succeeded", "succeeded", "succeeded", "failed"]);
    expect(third.tasks[3].error).toBe("resource_limit");
    expect(third.attempts.map((attempt) => attempt.total)).toEqual([4, 3, 2]);
    expect(() => retryBatchPlan(third)).toThrow(AppError);
  });

  it("recovers ZIP failures without decoding or re-encoding and preserves PNG-only job counts", async () => {
    const zip = vi.fn().mockRejectedValueOnce(new Error("zip failed")).mockResolvedValueOnce(ZIP);
    const { adapters } = fakeAdapters({ createZip: zip });
    const result = await runBatch(makePlan([fileSource()], ["square", "story"]), { adapters });
    expect(result).toMatchObject({ status: "failed", error: "zip_failed", archive: null, completed: 2, failed: 0 });
    expect(() => retryBatchPlan(result)).toThrow(AppError);
    expect(await packageBatchResult(result)).toBe(ZIP);
    expect(adapters.importImage).toHaveBeenCalledOnce();
    expect(adapters.canvasToPng).toHaveBeenCalledTimes(2);
    expect(zip).toHaveBeenCalledTimes(2);
    expect(zip.mock.calls[0][0][1].blob).toBe(zip.mock.calls[1][0][1].blob);
    const manifest = JSON.parse(await zip.mock.calls[1][0][0].blob.text());
    expect(manifest.attempts.at(-1)).toMatchObject({ kind: "package", total: 2, completed: 2, failed: 0 });
  });
});

describe("cancellation, locks and late results", () => {
  it("rejects overlapping submissions and repeated idempotency keys before decoding", async () => {
    const gate = deferred<Blob>();
    const entered = deferred<void>();
    const { adapters } = fakeAdapters({ canvasToPng: vi.fn(() => { entered.resolve(); return gate.promise; }) });
    const plan = makePlan();
    const active = runBatch(plan, { adapters });
    await entered.promise;
    await expect(runBatch(makePlan(), { adapters })).rejects.toMatchObject({ code: "batch_busy" });
    gate.resolve(PNG);
    const result = await active;
    await expect(runBatch(plan, { adapters })).rejects.toMatchObject({ code: "batch_duplicate" });
    const duplicate = createBatchPlan([fileSource()], ["landscape"], DEFAULT_STYLE, plan.id);
    await expect(runBatch(duplicate, { adapters })).rejects.toMatchObject({ code: "batch_duplicate" });
    await expect(runBatch({ ...plan }, { adapters })).rejects.toMatchObject({ code: "batch_input" });
    expect(result.status).toBe("succeeded");
    expect(adapters.importImage).toHaveBeenCalledOnce();
  });

  it("handles an already-aborted signal without starting any work", async () => {
    const controller = new AbortController(); controller.abort();
    const { adapters } = fakeAdapters();
    const result = await runBatch(makePlan(), { signal: controller.signal, adapters });
    expect(result).toMatchObject({ status: "cancelled", completed: 0, failed: 0, archive: null, retainedBytes: 0 });
    expect(result.tasks[0].status).toBe("cancelled");
    expect(adapters.importImage).not.toHaveBeenCalled();
    expect(() => retryBatchPlan(result)).toThrow(AppError);
  });

  it.each(["importImage", "loadImage", "canvasToPng", "yieldControl", "createZip"] as const)("checks cancellation after awaited %s and discards its late result", async (boundary) => {
    const controller = new AbortController();
    const { adapters, counts } = fakeAdapters();
    const base = boundary === "createZip" ? async () => ZIP : adapters[boundary]!;
    const override = vi.fn(async (...args: unknown[]) => {
      const value = await (base as (...values: unknown[]) => Promise<unknown>)(...args);
      controller.abort();
      return value;
    });
    Object.assign(adapters, { [boundary]: override });
    const source = boundary === "loadImage" ? currentSource() : fileSource();
    const result = await runBatch(makePlan([source], ["square", "story"]), { signal: controller.signal, adapters });
    expect(result.status).toBe("cancelled");
    expect(result.archive).toBeNull();
    expect(result.completed).toBe(boundary === "yieldControl" ? 1 : boundary === "createZip" ? 2 : 0);
    expect(result.failed).toBe(0);
    expect(counts()).toEqual({ activeImages: 0, activeCanvases: 0 });
    if (boundary === "importImage" || boundary === "loadImage") expect(adapters.createCanvas).not.toHaveBeenCalled();
    if (boundary === "canvasToPng") expect(result.retainedBytes).toBe(0);
  });

  it("stops before encode if cancellation arrives through progress or synchronous rendering", async () => {
    const controller = new AbortController();
    const { adapters } = fakeAdapters();
    const result = await runBatch(makePlan(), {
      signal: controller.signal, adapters,
      onProgress: (progress) => { if (progress.tasks.some((task) => task.status === "running")) controller.abort(); },
    });
    expect(result.status).toBe("cancelled");
    expect(adapters.importImage).not.toHaveBeenCalled();
    const second = new AbortController();
    vi.mocked(adapters.renderComposition).mockImplementationOnce(() => second.abort());
    const next = await runBatch(makePlan(), { signal: second.signal, adapters });
    expect(next.status).toBe("cancelled");
    expect(adapters.canvasToPng).not.toHaveBeenCalled();
  });

  it("retains accepted PNGs on cancel and allows explicit ZIP packaging without another encode", async () => {
    const controller = new AbortController();
    const { adapters } = fakeAdapters();
    vi.mocked(adapters.yieldControl).mockImplementationOnce(async () => controller.abort());
    const result = await runBatch(makePlan([fileSource()], ["square", "story"]), { signal: controller.signal, adapters });
    expect(result).toMatchObject({ status: "cancelled", completed: 1, failed: 0, archive: null, retainedBytes: PNG.size });
    expect(result.tasks.map((task) => task.status)).toEqual(["succeeded", "cancelled"]);
    const archive = await packageBatchResult(result);
    const { files, manifest } = await unpack(archive);
    expect(Object.keys(files)).toHaveLength(2);
    expect(manifest.entries[1].status).toBe("cancelled");
    expect(manifest.attempts.at(-1)).toMatchObject({ kind: "package", total: 1 });
    expect(adapters.canvasToPng).toHaveBeenCalledOnce();
    const aborted = new AbortController(); aborted.abort();
    await expect(packageBatchResult(result, { signal: aborted.signal })).rejects.toMatchObject({ code: "cancelled" });
  });

  it("releases the previous ZIP before retry decode and recovers completed results after cancellation", async () => {
    const { adapters, counts } = fakeAdapters();
    vi.mocked(adapters.canvasToPng).mockResolvedValueOnce(PNG).mockRejectedValueOnce(new AppError("png_encode", "retry"));
    const first = await runBatch(makePlan([fileSource()], ["square", "story"]), { adapters });
    expect(first).toMatchObject({ status: "failed", error: "batch_partial", completed: 1, failed: 1 });
    expect(first.archive).toBeInstanceOf(Blob);
    const firstArchive = first.archive;
    const retry = retryBatchPlan(first);
    expect(first.archive).toBe(firstArchive);
    const controller = new AbortController();
    const decode = adapters.importImage;
    const archivesOnProgress: (Blob | null)[] = [];
    const archivesBeforeDecode: (Blob | null)[] = [];
    const next = await runBatch(retry, {
      previous: first, signal: controller.signal,
      onProgress: () => { archivesOnProgress.push(first.archive); },
      adapters: { ...adapters, importImage: async (file) => {
        archivesBeforeDecode.push(first.archive);
        const value = await decode(file);
        controller.abort();
        return value;
      } },
    });
    expect(next).toMatchObject({ status: "cancelled", error: "cancelled", completed: 0, failed: 0, retainedBytes: PNG.size, archive: null });
    expect(next.tasks.map((task) => task.status)).toEqual(["succeeded", "cancelled"]);
    expect(next.tasks[0].blob).toBe(first.tasks[0].blob);
    expect(counts()).toEqual({ activeImages: 0, activeCanvases: 0 });
    const { files, manifest } = await unpack(await packageBatchResult(next));
    expect(Object.keys(files)).toEqual(["picwiz-manifest.json", first.tasks[0].path]);
    expect(files[first.tasks[0].path]).toEqual(new Uint8Array(await PNG.arrayBuffer()));
    expect(manifest.entries.map((entry: { status: string }) => entry.status)).toEqual(["succeeded", "cancelled"]);
    expect(manifest.attempts).toMatchObject([
      { id: first.plan.id, kind: "render", total: 2, completed: 1, failed: 1, cancelled: 0 },
      { id: retry.id, kind: "render", total: 1, completed: 0, failed: 0, cancelled: 1 },
      { kind: "package", total: 1, completed: 1, failed: 0, cancelled: 0 },
    ]);
    expect(adapters.importImage).toHaveBeenCalledTimes(2);
    expect(adapters.renderComposition).toHaveBeenCalledTimes(2);
    expect(adapters.canvasToPng).toHaveBeenCalledTimes(2);
    expect(archivesOnProgress[0]).toBeNull();
    expect(archivesBeforeDecode).toEqual([null]);
    expect(first.archive).toBeNull();
  });

  it("cancels after rejected awaits and after releasing a completed source without starting another", async () => {
    const controller = new AbortController();
    const { adapters, counts } = fakeAdapters();
    vi.mocked(adapters.importImage).mockImplementationOnce(async () => { controller.abort(); throw new Error("late decode failure"); });
    const failedDecode = await runBatch(makePlan(), { signal: controller.signal, adapters });
    expect(failedDecode).toMatchObject({ status: "cancelled", completed: 0, failed: 0 });
    const nextController = new AbortController();
    vi.mocked(adapters.yieldControl).mockResolvedValueOnce().mockImplementationOnce(async () => nextController.abort());
    const afterRelease = await runBatch(makePlan([fileSource("a"), fileSource("b")]), { signal: nextController.signal, adapters });
    expect(afterRelease).toMatchObject({ status: "cancelled", completed: 1, failed: 0, retainedBytes: PNG.size });
    expect(afterRelease.tasks[1].status).toBe("cancelled");
    expect(counts()).toEqual({ activeImages: 0, activeCanvases: 0 });
    expect(adapters.createCanvas).toHaveBeenCalledOnce();
  });

  it("serializes ZIP-only recovery with other submissions and guards packaging cancellation", async () => {
    const gate = deferred<Blob>();
    const entered = deferred<void>();
    const zip = vi.fn().mockRejectedValueOnce(new Error("initial ZIP failure")).mockImplementationOnce(() => { entered.resolve(); return gate.promise; });
    const { adapters } = fakeAdapters({ createZip: zip });
    const result = await runBatch(makePlan(), { adapters });
    const controller = new AbortController();
    const packaging = packageBatchResult(result, { signal: controller.signal });
    await entered.promise;
    await expect(packageBatchResult(result)).rejects.toMatchObject({ code: "batch_busy" });
    await expect(runBatch(makePlan(), { adapters })).rejects.toMatchObject({ code: "batch_busy" });
    controller.abort(); gate.resolve(ZIP);
    await expect(packaging).rejects.toMatchObject({ code: "cancelled" });
    expect(result.retainedBytes).toBe(PNG.size);
    expect(adapters.canvasToPng).toHaveBeenCalledOnce();
  });

  it("preserves the real native lock after soft timeout, prevents more encodes, and ignores the late callback", async () => {
    vi.useFakeTimers();
    let callback!: BlobCallback;
    const native = vi.fn((value: BlobCallback) => { callback = value; });
    const { adapters } = fakeAdapters({
      createCanvas: () => ({ width: 0, height: 0, toBlob: native }) as unknown as HTMLCanvasElement,
      releaseCanvas: vi.fn(),
      isPngEncoderBusy,
      canvasToPng: (canvas, options) => canvasToPng(canvas, { ...options, timeoutMs: 10 }),
    });
    try {
      const pending = runBatch(makePlan([fileSource()], ["square", "story"]), { adapters });
      await vi.advanceTimersByTimeAsync(11);
      const result = await pending;
      expect(result).toMatchObject({ completed: 0, failed: 2, retainedBytes: 0 });
      expect(result.tasks.map((task) => task.error)).toEqual(["png_timeout", "png_busy"]);
      expect(isPngEncoderBusy()).toBe(true);
      expect(native).toHaveBeenCalledOnce();
      const retry = retryBatchPlan(result);
      await expect(runBatch(retry, { previous: result, adapters })).rejects.toMatchObject({ code: "png_busy" });
      callback(PNG);
      expect(isPngEncoderBusy()).toBe(false);
      expect(result.tasks.every((task) => !task.blob)).toBe(true);
      const succeedingNative = vi.fn((done: BlobCallback) => done(PNG));
      const resumed = runBatch(retry, { previous: result, adapters: { ...adapters, createCanvas: () => ({ width: 0, height: 0, toBlob: succeedingNative }) as unknown as HTMLCanvasElement, createZip: async () => ZIP } });
      const next = await resumed;
      expect(next).toMatchObject({ completed: 2, failed: 0, status: "succeeded" });
    } finally { if (isPngEncoderBusy() && callback) callback(null); }
  });

  it("preserves the real native lock after cancellation and can package prior successes while it settles", async () => {
    const controller = new AbortController();
    let callback!: BlobCallback;
    let calls = 0;
    const entered = deferred<void>();
    const { adapters } = fakeAdapters({
      createCanvas: () => ({ width: 0, height: 0, toBlob: (done: BlobCallback) => {
        if (++calls === 1) done(PNG); else { callback = done; entered.resolve(); }
      } }) as unknown as HTMLCanvasElement,
      releaseCanvas: vi.fn(), isPngEncoderBusy, canvasToPng,
    });
    try {
      const pending = runBatch(makePlan([fileSource()], ["square", "story"]), { signal: controller.signal, adapters });
      await entered.promise;
      controller.abort();
      const result = await pending;
      expect(result).toMatchObject({ status: "cancelled", completed: 1, failed: 0, retainedBytes: PNG.size, archive: null });
      expect(isPngEncoderBusy()).toBe(true);
      const { files } = await unpack(await packageBatchResult(result));
      expect(Object.keys(files)).toHaveLength(2);
      expect(calls).toBe(2);
      callback(PNG);
      expect(isPngEncoderBusy()).toBe(false);
      expect(result.retainedBytes).toBe(PNG.size);
      expect(result.tasks[1]).not.toHaveProperty("blob");
    } finally { if (isPngEncoderBusy() && callback) callback(null); }
  });
});
