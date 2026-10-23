"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  LayoutTemplate,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { STARTER_PRESETS, type Style } from "@/lib/domain";
import { renderComposition } from "@/lib/canvas";
import { downloadFile } from "@/lib/browser";
import { exportPresets, type Preset, type Store } from "@/lib/storage";

let neutral: HTMLCanvasElement | null = null;
function neutralScreenshot() {
  if (neutral) return neutral;
  const source = document.createElement("canvas");
  source.width = 640;
  source.height = 400;
  const context = source.getContext("2d")!;
  context.fillStyle = "#fbfaff";
  context.fillRect(0, 0, 640, 400);
  context.fillStyle = "#302a43";
  context.fillRect(0, 0, 120, 400);
  context.fillStyle = "#ad94e8";
  context.fillRect(24, 26, 70, 10);
  context.fillStyle = "#5d506f";
  for (let i = 0; i < 5; i++) context.fillRect(24, 76 + i * 35, 64, 6);
  context.fillStyle = "#493e5a";
  context.fillRect(153, 40, 150, 12);
  context.fillStyle = "#e6def1";
  context.fillRect(153, 68, 255, 6);
  for (let i = 0; i < 3; i++) {
    context.fillStyle = "#efeaf7";
    context.fillRect(153 + i * 153, 110, 131, 65);
    context.fillStyle = "#c2addf";
    context.fillRect(170 + i * 153, 133, 70, 9);
  }
  context.fillStyle = "#f1ecf8";
  context.fillRect(153, 205, 438, 150);
  context.beginPath();
  context.moveTo(174, 322);
  context.bezierCurveTo(235, 340, 275, 247, 333, 281);
  context.bezierCurveTo(390, 304, 454, 238, 568, 232);
  context.strokeStyle = "#b095db";
  context.lineWidth = 5;
  context.stroke();
  neutral = source;
  return source;
}

export function LookThumbnail({
  style,
  name,
  className = "",
}: {
  style: Style;
  name: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current)
      renderComposition(
        ref.current,
        neutralScreenshot(),
        { width: 640, height: 400 },
        { ...style, size: "landscape", scale: 1 },
        { width: 320, height: 180 },
      );
  }, [style]);
  return (
    <canvas
      ref={ref}
      className={`look-thumbnail ${className}`}
      width="320"
      height="180"
      role="img"
      aria-label={`${name} style preview`}
    />
  );
}

export function StarterLooks({
  onApply,
  onBrowse,
}: {
  onApply: (style: Style, name: string) => void;
  onBrowse: () => void;
}) {
  return (
    <section className="starter-looks">
      <div className="section-title">
        <h3>A head start</h3>
        <button onClick={onBrowse}>
          All looks <ArrowRight size={11} />
        </button>
      </div>
      <div className="starter-grid">
        {STARTER_PRESETS.slice(0, 3).map((preset) => (
          <button
            key={preset.id}
            aria-label={`Apply ${preset.name}`}
            aria-describedby={`look-description-${preset.id}`}
            onClick={() => onApply(preset.style, preset.name)}
          >
            <LookThumbnail style={preset.style} name={preset.name} />
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

type Props = {
  store: Store;
  onApply: (style: Style, name: string) => void;
  onSave: () => void;
  onRename: (preset: Preset) => void;
  onDelete: (preset: Preset) => void;
  onUpdate: (preset: Preset) => void;
  onImport: (json: string) => {
    added: number;
    skipped: number;
    saved: boolean;
  };
  onNotice: (message: string, error?: boolean) => void;
};

export function PresetLibrary({
  store,
  onApply,
  onSave,
  onRename,
  onDelete,
  onUpdate,
  onImport,
  onNotice,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const importGeneration = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ++importGeneration.current;
    };
  }, []);
  async function importFile(file: File) {
    const generation = ++importGeneration.current;
    setPending(true);
    setError("");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (file.size > 100 * 1024)
        throw new Error("Choose a preset JSON file smaller than 100 KB.");
      const json = await Promise.race([
        file.text(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "Reading the preset file took too long. Choose it again.",
                ),
              ),
            15000,
          );
        }),
      ]);
      if (!mounted.current || generation !== importGeneration.current) return;
      const result = onImport(json);
      onNotice(
        `${result.added} preset${result.added === 1 ? "" : "s"} imported · ${result.skipped} already saved.${result.saved ? "" : " Kept for this session; retry local saving."}`,
        !result.saved,
      );
    } catch (cause) {
      if (!mounted.current || generation !== importGeneration.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "This preset file could not be read. Choose a PicWiz preset JSON file.",
      );
    } finally {
      clearTimeout(timer);
      if (mounted.current && generation === importGeneration.current)
        setPending(false);
    }
  }
  return (
    <>
      <span className="dialog-symbol">
        <LayoutTemplate size={23} />
      </span>
      <h2 id="dialog-title">Good looks, on repeat.</h2>
      <p className="dialog-description">
        A look remembers your style. Your size and annotations stay yours.
      </p>
      <div className="library-section-heading">
        <h3>Made for a head start</h3>
        <span>6 built-in looks</span>
      </div>
      <div className="look-library-grid">
        {STARTER_PRESETS.map((preset) => (
          <article className="look-card-wrapper" key={preset.id}>
            <button
              className="look-card"
              aria-label={`Apply ${preset.name}`}
              aria-describedby={`look-description-${preset.id}`}
              onClick={() => onApply(preset.style, preset.name)}
            >
              <LookThumbnail style={preset.style} name={preset.name} />
              <span>
                <strong>{preset.name}</strong>
                <ArrowRight size={13} />
              </span>
            </button>
            <small id={`look-description-${preset.id}`}>
              {preset.description}
            </small>
          </article>
        ))}
      </div>
      <div className="library-section-heading your-looks-heading">
        <h3>Your saved looks</h3>
        <button className="text-button" onClick={onSave}>
          <Plus size={14} />
          Save current style
        </button>
      </div>
      {store.presets.length ? (
        <div className="saved-look-list">
          {store.presets.map((preset) => (
            <article key={preset.id} className="saved-look">
              <button
                className="saved-look-apply"
                aria-label={`Apply ${preset.name}`}
                onClick={() => onApply(preset.style, preset.name)}
              >
                <LookThumbnail style={preset.style} name={preset.name} />
                <span>
                  <strong>{preset.name}</strong>
                </span>
                <ArrowRight size={15} />
              </button>
              <p className="saved-look-meta">
                {preset.style.frame === "none"
                  ? "No frame"
                  : `${preset.style.frame} frame`}{" "}
                · {preset.style.padding}px padding
              </p>
              <div className="saved-look-actions">
                <button
                  aria-label={`Update ${preset.name}`}
                  onClick={() => onUpdate(preset)}
                >
                  <RefreshCw size={12} />
                  Update
                </button>
                <button
                  aria-label={`Rename ${preset.name}`}
                  onClick={() => onRename(preset)}
                >
                  Rename
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${preset.name}`}
                  onClick={() => onDelete(preset)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="saved-looks-empty">
          <Check size={17} />
          <p>Find your look, then save it for the next screenshot.</p>
          <button className="secondary-button" onClick={onSave}>
            Save current style
          </button>
        </div>
      )}
      <div className="preset-portability">
        <div>
          <strong>Your look can travel.</strong>
          <p>
            Preset files contain styles, never your screenshots or annotations.
          </p>
        </div>
        <div>
          <button
            className="secondary-button"
            disabled={!store.presets.length}
            onClick={() => {
              try {
                downloadFile(
                  new Blob([exportPresets(store)], {
                    type: "application/json",
                  }),
                  "picwiz-presets.json",
                );
                onNotice("Presets exported. Keep your look wherever you work.");
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Preset export failed. Try again.",
                );
              }
            }}
          >
            <ArrowDownToLine size={13} />
            Export presets
          </button>
          <button
            className="secondary-button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ? (
              <LoaderCircle className="spin" size={13} />
            ) : (
              <Upload size={13} />
            )}
            Import presets
          </button>
        </div>
      </div>
      <input
        type="file"
        ref={fileRef}
        accept="application/json,.json"
        aria-label="Import preset file"
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.target.value = "";
        }}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="dialog-footnote">
        Saved only in this browser · {store.presets.length}/24 looks
      </p>
    </>
  );
}
