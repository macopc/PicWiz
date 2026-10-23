"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  Files,
  ImagePlus,
  LoaderCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { SIZES, type Style } from "@/lib/domain";
import type { Annotation } from "@/lib/annotations";
import type { Source } from "@/lib/storage";
import { downloadFile, isPngEncoderBusy } from "@/lib/browser";
import {
  createBatchPlan,
  isRetryableBatchError,
  packageBatchResult,
  retryBatchPlan,
  runBatch,
  type BatchSource,
  type BatchProgress,
  type BatchResult,
} from "@/lib/batch";

type Props = {
  source: Source | null;
  annotations: Annotation[];
  style: Style;
  encoderBusy: boolean;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
  onStart: (
    id: string,
    formats: Style["size"][],
    scale: 1 | 2,
    total: number,
  ) => void;
  onFinish: (
    id: string,
    stats: {
      completed: number;
      failed: number;
      cancelled?: boolean;
      error?: string;
    },
  ) => void;
};

const failureMessages: Record<string, string> = {
  image_type: "Choose a PNG, JPEG, or WebP instead.",
  image_decode: "This image could not be read. Replace it and start again.",
  image_size: "This image exceeds the input limit.",
  image_dimensions: "This image exceeds the pixel limit.",
  resource_limit: "PNG budget reached. Use fewer images, sizes, or 1× scale.",
  png_timeout: "The browser is still finishing this image. Wait or reload.",
  image_timeout: "Opening this image timed out.",
  png_encode: "The PNG could not be encoded. Try again.",
  zip_failed: "Packaging failed. Your completed PNGs are still here.",
};

export function BatchExport({
  source,
  annotations,
  style,
  encoderBusy,
  onClose,
  onNotice,
  onStart,
  onFinish,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const running = useRef(false);
  const [files, setFiles] = useState<File[]>([]);
  const [includeCurrent, setIncludeCurrent] = useState(!!source);
  const [formats, setFormats] = useState<Style["size"][]>([style.size]);
  const [scale, setScale] = useState<1 | 2>(style.scale);
  const [phase, setPhase] = useState<
    "idle" | "running" | "packaging" | "stopping" | "finished"
  >("idle");
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [readyArchive, setReadyArchive] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const sourceCount = files.length + (includeCurrent && source ? 1 : 0);
  const busy =
    phase === "running" || phase === "packaging" || phase === "stopping";
  const canConfigure = phase === "idle";
  const successes =
    result?.tasks.filter((task) => task.status === "succeeded") ?? [];
  const failures =
    result?.tasks.filter((task) => task.status === "failed") ?? [];
  const retryable = failures.filter((task) =>
    isRetryableBatchError(task.error),
  );
  const limited = failures.some((task) => task.error === "resource_limit");

  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    return () => {
      alive.current = false;
      abort.current?.abort();
      dialog.current?.close();
    };
  }, []);

  function close() {
    abort.current?.abort();
    onClose();
  }
  function addFiles(incoming: File[]) {
    setError("");
    const next = [...files, ...incoming];
    if (next.length + (includeCurrent && source ? 1 : 0) > 10) {
      setError(
        "Keep this batch to 10 screenshots, including the current image.",
      );
      return;
    }
    if (next.some((file) => file.size > 25 * 1024 * 1024)) {
      setError("Each screenshot must be 25 MB or smaller.");
      return;
    }
    if (next.reduce((sum, file) => sum + file.size, 0) > 150 * 1024 * 1024) {
      setError(
        "This batch exceeds 150 MB of source files. Choose a smaller set.",
      );
      return;
    }
    setFiles(next);
  }
  function toggleFormat(id: Style["size"]) {
    if (!canConfigure) return;
    setError("");
    if (formats.includes(id)) setFormats(formats.filter((size) => size !== id));
    else if (formats.length >= 3)
      setError(
        "Choose up to 3 sizes per batch. You can make another batch for the rest.",
      );
    else setFormats([...formats, id]);
  }
  async function execute(
    plan: ReturnType<typeof createBatchPlan>,
    previous?: BatchResult,
  ) {
    if (running.current) return;
    if (isPngEncoderBusy()) {
      setError(
        "The browser is still finishing an image. Wait for it to finish, or reload if it does not respond.",
      );
      return;
    }
    running.current = true;
    abort.current = new AbortController();
    setPhase("running");
    setError("");
    setProgress(null);
    setReadyArchive(null);
    let submitted = false;
    try {
      onStart(plan.id, plan.formats, plan.style.scale, plan.tasks.length);
      submitted = true;
      const next = await runBatch(plan, {
        signal: abort.current.signal,
        previous,
        onProgress: (nextProgress) => {
          if (alive.current) {
            setProgress(nextProgress);
            if (
              nextProgress.phase === "packaging" &&
              !abort.current?.signal.aborted
            )
              setPhase("packaging");
          }
        },
      });
      onFinish(plan.id, {
        completed: next.completed,
        failed: next.failed,
        cancelled: next.status === "cancelled",
        error: next.error ?? undefined,
      });
      if (alive.current) {
        setResult(next);
        setReadyArchive(next.archive);
        setPhase("finished");
        if (next.status === "cancelled")
          onNotice(
            "Batch cancelled. Completed images can still be packaged while this panel is open.",
          );
        else if (next.archive)
          onNotice(
            `${next.tasks.filter((task) => task.status === "succeeded").length} PNGs ready.${next.tasks.some((task) => task.status === "failed") ? " Some items need attention." : " Download your ZIP when you’re ready."}`,
          );
        else
          setError(
            next.error === "zip_failed"
              ? "Packaging failed. Your completed PNGs are still here; prepare the ZIP again."
              : "No ZIP is ready yet. Review the item errors below.",
          );
      }
    } catch (cause) {
      if (submitted)
        onFinish(plan.id, {
          completed: 0,
          failed: abort.current.signal.aborted ? 0 : plan.tasks.length,
          cancelled: abort.current.signal.aborted,
          error: "batch_failed",
        });
      if (alive.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The batch could not start. Review your files and try again.",
        );
        setPhase(previous ? "finished" : "idle");
      }
    } finally {
      running.current = false;
    }
  }
  function prepare() {
    try {
      const sources: BatchSource[] = [];
      if (includeCurrent && source)
        sources.push({
          id: "current",
          ...source,
          annotations: annotations.map((annotation) => ({ ...annotation })),
        });
      files.forEach((file, index) =>
        sources.push({
          id: `file-${index}`,
          name: file.name.slice(0, 120),
          file,
        }),
      );
      const plan = createBatchPlan(sources, formats, { ...style, scale });
      setResult(null);
      void execute(plan);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Choose screenshots and at least one size to continue.",
      );
    }
  }
  async function packageCompleted() {
    if (!result || !successes.length || running.current) return;
    running.current = true;
    abort.current = new AbortController();
    const id = crypto.randomUUID();
    const snapshot = result;
    const completedFormats = [...new Set(successes.map((task) => task.size))];
    setPhase("packaging");
    setError("");
    setReadyArchive(null);
    let submitted = false;
    try {
      onStart(id, completedFormats, result.plan.style.scale, successes.length);
      submitted = true;
      const archive = await packageBatchResult(snapshot, {
        signal: abort.current.signal,
      });
      onFinish(id, { completed: successes.length, failed: 0 });
      if (alive.current) {
        setReadyArchive(archive);
        onNotice(
          `${successes.length} completed PNGs packaged. Your ZIP is ready.`,
        );
      }
    } catch (cause) {
      if (submitted)
        onFinish(id, {
          completed: successes.length,
          failed: 0,
          cancelled: abort.current.signal.aborted,
          error: "zip_failed",
        });
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Packaging failed. Try again while this panel is open.",
        );
    } finally {
      running.current = false;
      if (alive.current) setPhase("finished");
    }
  }
  function resetBatch() {
    setResult(null);
    setReadyArchive(null);
    setProgress(null);
    setPhase("idle");
    setError("");
  }
  function downloadArchive() {
    if (!result || !readyArchive) return;
    try {
      downloadFile(
        readyArchive,
        `picwiz-batch-${result.plan.id.slice(0, 8)}.zip`,
      );
      onNotice("ZIP downloaded. Your next posts are ready to go.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Download failed. Your ZIP is still ready; try again.",
      );
    }
  }

  return (
    <dialog
      ref={dialog}
      className="app-dialog batch-dialog"
      aria-labelledby="batch-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <button
        className="icon-button dialog-close"
        aria-label="Close batch export"
        onClick={close}
      >
        <X size={18} />
      </button>
      <span className="dialog-symbol">
        <Files size={23} />
      </span>
      <div className="batch-heading">
        <div>
          <h2 id="batch-title">Batch export</h2>
          <p className="dialog-description">
            One look. A whole set of ready-to-post images.
          </p>
        </div>
        <span className="local-pill">
          <ShieldCheck size={12} />
          Entirely local
        </span>
      </div>
      <div className="batch-config">
        <section className="batch-sources">
          <div className="library-section-heading">
            <h3>Your screenshots</h3>
            <span>{sourceCount}/10</span>
          </div>
          <label className="batch-current">
            <input
              type="checkbox"
              aria-label="Include current screenshot"
              checked={includeCurrent && !!source}
              disabled={!source || !canConfigure}
              onChange={(event) => {
                if (event.target.checked && files.length >= 10) {
                  setError(
                    "Remove one file before including the current screenshot.",
                  );
                  return;
                }
                setIncludeCurrent(event.target.checked);
              }}
            />
            <span>
              <strong>Include current screenshot</strong>
              <small>
                {source
                  ? `${source.name} · keeps its ${annotations.length} annotation${annotations.length === 1 ? "" : "s"}`
                  : "Add an image in the editor, or choose files below."}
              </small>
            </span>
          </label>
          {files.length ? (
            <ol className="batch-file-list">
              {files.map((file, index) => (
                <li key={`${index}-${file.name}`}>
                  <ImagePlus size={16} />
                  <span>
                    <strong>{file.name.slice(0, 120)}</strong>
                    <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Remove batch screenshot ${index + 1}`}
                    disabled={!canConfigure}
                    onClick={() =>
                      setFiles(files.filter((_, i) => i !== index))
                    }
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="batch-source-empty">
              <ImagePlus size={22} />
              <p>
                Add a few more screenshots.
                <br />
                They will share the look, not the current image’s annotations.
              </p>
            </div>
          )}
          <button
            className="secondary-button batch-add-files"
            disabled={!canConfigure}
            onClick={() => fileInput.current?.click()}
          >
            <Plus size={14} />
            Add screenshots
          </button>
          <input
            className="visually-hidden"
            ref={fileInput}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            aria-label="Batch screenshots"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </section>
        <section className="batch-formats">
          <div className="library-section-heading">
            <h3>Choose your sizes</h3>
            <span>{formats.length}/3</span>
          </div>
          <div className="batch-size-list">
            {Object.entries(SIZES).map(([id, size]) => (
              <label
                key={id}
                className={
                  formats.includes(id as Style["size"]) ? "selected" : ""
                }
              >
                <input
                  type="checkbox"
                  aria-label={`Batch size: ${size.label}`}
                  checked={formats.includes(id as Style["size"])}
                  disabled={!canConfigure}
                  onChange={() => toggleFormat(id as Style["size"])}
                />
                <span>
                  <strong>{size.label}</strong>
                  <small>
                    {size.width * scale} × {size.height * scale} px
                  </small>
                </span>
                <span className="batch-ratio-icon">
                  <i style={{ aspectRatio: `${size.width}/${size.height}` }} />
                </span>
              </label>
            ))}
          </div>
          <label className="batch-scale">
            Export scale
            <select
              aria-label="Batch scale"
              value={scale}
              disabled={!canConfigure}
              onChange={(event) =>
                setScale(Number(event.target.value) as 1 | 2)
              }
            >
              <option value="1">1× · original output size</option>
              <option value="2">2× · double resolution</option>
            </select>
          </label>
        </section>
      </div>
      <p className="batch-session-note">
        <ShieldCheck size={13} />
        Added files and results stay in this tab. Closing discards this batch;
        refreshing requires adding files again.
      </p>
      {error && (
        <p className="form-error batch-error" role="alert">
          <CircleAlert size={14} />
          {error}
        </p>
      )}
      {encoderBusy && !busy && (
        <p className="batch-native-note" role="status">
          The browser is still finishing the last image. New exports will be
          available when it finishes. Reload if it does not respond.
        </p>
      )}
      {(busy || result) && (
        <section className="batch-progress-section" aria-label="Batch results">
          <div className="batch-progress-heading">
            <strong>
              {phase === "stopping"
                ? "Stopping after the current browser operation…"
                : phase === "packaging"
                  ? "Packaging your PNGs…"
                  : phase === "running"
                    ? "Adding a little polish…"
                    : result?.status === "cancelled" && !readyArchive
                      ? "Batch cancelled"
                      : `${successes.length} PNGs ready${failures.length ? ` · ${failures.length} need attention` : ""}`}
            </strong>
            <span>
              {busy
                ? `${progress?.current ?? 0}/${progress?.total ?? sourceCount * formats.length}`
                : `${((result?.retainedBytes ?? 0) / 1024 / 1024).toFixed(1)} MB / 64 MB`}
            </span>
          </div>
          <progress
            aria-label="Batch export progress"
            max={progress?.total || 1}
            value={busy ? (progress?.current ?? 0) : progress?.total || 1}
          />
          <ol className="batch-result-list">
            {(progress?.tasks ?? result?.tasks ?? []).map((task) => (
              <li key={task.id} data-batch-status={task.status}>
                <span className={`batch-task-icon ${task.status}`}>
                  {task.status === "succeeded" ? (
                    <Check size={14} />
                  ) : task.status === "failed" ? (
                    <CircleAlert size={14} />
                  ) : task.status === "running" ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <span>·</span>
                  )}
                </span>
                <span>
                  <strong>
                    {(
                      result?.plan.sources[task.sourceIndex]?.name ??
                      files[
                        task.sourceIndex - (includeCurrent && source ? 1 : 0)
                      ]?.name ??
                      source?.name ??
                      "Screenshot"
                    ).slice(0, 120)}
                  </strong>
                  <small>
                    {SIZES[task.size].label} · {task.width} × {task.height}
                    {task.error
                      ? ` · ${failureMessages[task.error] ?? "This output could not be prepared."}`
                      : ""}
                  </small>
                </span>
                <span className="batch-task-status">{task.status}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="batch-actions">
        <div className="batch-count">
          <strong>
            {sourceCount} screenshot{sourceCount === 1 ? "" : "s"}{" "}
            <span>×</span> {formats.length} size
            {formats.length === 1 ? "" : "s"}
          </strong>
          <span>{sourceCount * formats.length} PNGs · one ZIP</span>
        </div>
        <div className="batch-action-buttons">
          {canConfigure ? (
            <button
              className="primary-button"
              onClick={prepare}
              disabled={!sourceCount || !formats.length || encoderBusy}
            >
              <Files size={15} />
              Prepare ZIP
            </button>
          ) : busy ? (
            <button
              className="secondary-button"
              onClick={() => {
                abort.current?.abort();
                setPhase("stopping");
              }}
              disabled={phase === "stopping"}
            >
              Cancel export
            </button>
          ) : (
            <>
              <button className="text-button" onClick={resetBatch}>
                {limited
                  ? "Start a smaller batch"
                  : result?.status === "cancelled"
                    ? "Start again"
                    : "Change inputs"}
              </button>
              {retryable.length > 0 && (
                <button
                  className="secondary-button"
                  disabled={encoderBusy}
                  onClick={() => {
                    if (!result) return;
                    try {
                      const previous = result;
                      const plan = retryBatchPlan(previous);
                      setResult(previous);
                      void execute(plan, previous);
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "These items need changed inputs before retrying.",
                      );
                    }
                  }}
                >
                  <RotateCcw size={13} />
                  Retry failed
                </button>
              )}
              {readyArchive ? (
                <button className="primary-button" onClick={downloadArchive}>
                  <ArrowDownToLine size={15} />
                  Download ZIP
                </button>
              ) : (
                successes.length > 0 && (
                  <button
                    className="primary-button"
                    onClick={() => void packageCompleted()}
                  >
                    <Files size={15} />
                    {result?.error === "zip_failed"
                      ? "Prepare ZIP again"
                      : "Download completed results"}
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
