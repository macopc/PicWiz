"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Expand,
  ImagePlus,
  LayoutTemplate,
  LoaderCircle,
  LockKeyhole,
  Maximize,
  Minus,
  Monitor,
  Plus,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Moon,
  Trash2,
  Upload,
  X,
  ArrowUpRight,
  Square,
  Type,
  Undo2,
  Redo2,
  Files,
  Crop,
} from "lucide-react";
import {
  BACKGROUNDS,
  DEFAULT_STYLE,
  SIZES,
  dimensions,
  type Style,
  applyLook,
} from "@/lib/domain";
import {
  addPreset,
  createJob,
  createStore,
  deletePreset,
  finishJob,
  loadStore,
  renamePreset,
  saveStore,
  type Store,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  backupLocalData,
  clearStore,
  updatePreset,
  importPresets,
  createBatchJob,
  finishBatchJob,
  validateStore,
} from "@/lib/storage";
import { migrateLocalDocument } from "@/lib/migrations";
import {
  canvasToPng,
  copyPng,
  downloadPng,
  importImage,
  loadImage,
  downloadFile,
  isPngEncoderBusy,
  subscribePngEncoder,
} from "@/lib/browser";
import { renderComposition } from "@/lib/canvas";
import {
  createAnnotation,
  createHistory,
  pushHistory,
  undoHistory,
  redoHistory,
  validateAnnotations,
  type Annotation,
  type AnnotationHistory,
} from "@/lib/annotations";
import { AnnotationLayer, AnnotationInspector } from "./annotation-layer";
import { PresetLibrary, StarterLooks } from "./preset-library";
import { SocialSizes } from "./social-sizes";
import { BatchExport } from "./batch-export";

type Dialog =
  | { type: "save" }
  | { type: "presets" }
  | { type: "rename"; id: string; name: string }
  | { type: "delete"; id: string; name: string }
  | { type: "update"; id: string; name: string }
  | { type: "sizes" }
  | { type: "clear" }
  | { type: "remove" }
  | { type: "help" }
  | null;
type Notice = { message: string; error: boolean } | null;

function backgroundCss(background: (typeof BACKGROUNDS)[number]) {
  return background.kind === "solid"
    ? background.colors[0]
    : `linear-gradient(${background.angle ?? 135}deg, ${background.colors.join(", ")})`;
}

function RangeControl({
  label,
  value,
  max,
  onChange,
  suffix = "px",
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="range-control">
      <div className="control-label">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value}
          <span>{suffix}</span>
        </output>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--range-progress": `${(value / max) * 100}%`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

export function Editor() {
  const [store, setStore] = useState<Store>(() => createStore());
  const storeRef = useRef(store);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const importGeneration = useRef(0);
  const sourceRevision = useRef(0);
  const annotationRevision = useRef(0);
  const writeEpoch = useRef(0);
  const activeExport = useRef<AbortController | null>(null);
  const batchEpochs = useRef(new Map<string, number>());
  const historyRef = useRef<AnnotationHistory>(createHistory());
  const exportLock = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState<"download" | "clipboard" | null>(
    null,
  );
  const [storageError, setStorageError] = useState("");
  const [persistenceBlocked, setPersistenceBlocked] = useState(false);
  const blockedRef = useRef(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [dragging, setDragging] = useState(false);
  const [backgroundTab, setBackgroundTab] = useState<"gradient" | "solid">(
    "gradient",
  );
  const [mobileTab, setMobileTab] = useState<"style" | "frame" | "annotate">(
    "style",
  );
  const [inspectorTab, setInspectorTab] = useState<"style" | "annotate">(
    "style",
  );
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(
    null,
  );
  const [annotationPreview, setAnnotationPreview] = useState<
    Annotation[] | null
  >(null);
  const [annotationHistory, setAnnotationHistory] = useState<AnnotationHistory>(
    () => createHistory(),
  );
  const [encoderBusy, setEncoderBusy] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [upgradeNotice, setUpgradeNotice] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [presetName, setPresetName] = useState("");
  const [formError, setFormError] = useState("");
  const [zoom, setZoom] = useState(100);
  const [previewWidth, setPreviewWidth] = useState(900);
  const [previewHeight, setPreviewHeight] = useState(500);
  const [saveState, setSaveState] = useState("Loading your workspace");
  const [copied, setCopied] = useState(false);
  const style = store.composition.style;
  const output = dimensions(style);
  const annotations = store.composition.annotations ?? [];
  const renderEpoch = writeEpoch.current;
  const renderSourceRevision = sourceRevision.current;
  const batchOpenRef = useRef(false);
  batchOpenRef.current = batchOpen;

  const announce = useCallback(
    (message: string, error = false) => setNotice({ message, error }),
    [],
  );

  const persist = useCallback((next: Store) => {
    if (blockedRef.current) {
      setSaveState("Local saving unavailable");
      return false;
    }
    try {
      saveStore(window.localStorage, next);
      setStorageError("");
      setSaveState("Saved on this device");
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Your browser could not save this change. Free some space and retry.",
      );
      setSaveState("Changes not saved");
      return false;
    }
  }, []);

  const commit = useCallback(
    (next: Store, immediate = false) => {
      storeRef.current = next;
      setStore(next);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      setSaveState("Saving on this device");
      if (immediate) return persist(next);
      else
        persistTimer.current = setTimeout(() => persist(storeRef.current), 180);
    },
    [persist],
  );

  const acceptFile = useCallback(
    async (file: File, reservedGeneration?: number) => {
      const generation = reservedGeneration ?? ++importGeneration.current;
      const epoch = writeEpoch.current;
      setImporting(true);
      try {
        const source = await importImage(file);
        if (
          generation !== importGeneration.current ||
          epoch !== writeEpoch.current
        )
          return;
        ++sourceRevision.current;
        const emptyHistory = createHistory();
        historyRef.current = emptyHistory;
        setAnnotationHistory(emptyHistory);
        setAnnotationPreview(null);
        setSelectedAnnotation(null);
        imageRef.current = source.image;
        setHasImage(true);
        const current = storeRef.current;
        commit(
          {
            ...current,
            composition: {
              ...current.composition,
              status: "ready",
              annotations: [],
              updatedAt: new Date().toISOString(),
              source: {
                dataUrl: source.dataUrl,
                name: source.name,
                width: source.width,
                height: source.height,
              },
            },
          },
          true,
        );
        announce(`${source.name} is ready. Make it yours.`);
      } catch (error) {
        if (generation === importGeneration.current)
          announce(
            error instanceof Error
              ? error.message
              : "This image could not be opened. Try a PNG, JPEG, or WebP.",
            true,
          );
      } finally {
        if (generation === importGeneration.current) setImporting(false);
      }
    },
    [announce, commit],
  );

  const useExample = useCallback(async () => {
    const generation = ++importGeneration.current;
    setImporting(true);
    try {
      const response = await fetch("/example.png", {
        signal: AbortSignal.timeout(10_000),
      });
      if (generation !== importGeneration.current) return;
      if (!response.ok)
        throw new Error(
          "The example could not load. Choose a screenshot to continue.",
        );
      const blob = await response.blob();
      if (generation !== importGeneration.current) return;
      await acceptFile(
        new File([blob], "Example screenshot.png", { type: "image/png" }),
        generation,
      );
    } catch (error) {
      if (generation === importGeneration.current)
        announce(
          error instanceof Error
            ? error.name === "TimeoutError" || error.name === "AbortError"
              ? "The example took too long to load. Add a screenshot or try the example again."
              : error.message
            : "Choose a screenshot to continue.",
          true,
        );
    } finally {
      if (generation === importGeneration.current) setImporting(false);
    }
  }, [acceptFile, announce]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const rawNew = window.localStorage.getItem(STORAGE_KEY);
        const raw = rawNew ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
        const isNew = raw === null;
        let saved: Store;
        try {
          saved = loadStore(window.localStorage);
        } catch (cause) {
          const code =
            cause instanceof Error && "code" in cause ? String(cause.code) : "";
          if (!raw || !["storage_quota", "storage_unavailable"].includes(code))
            throw cause;
          saved = validateStore(
            migrateLocalDocument(JSON.parse(raw), new Date().toISOString()),
          );
          blockedRef.current = true;
          setPersistenceBlocked(true);
          setStorageError(
            cause instanceof Error
              ? cause.message
              : "Local saving failed. Your saved image is available for this session.",
          );
        }
        if (cancelled) return;
        storeRef.current = saved;
        setStore(saved);
        const loadedHistory = createHistory(saved.composition.annotations);
        historyRef.current = loadedHistory;
        setAnnotationHistory(loadedHistory);
        if (saved.composition.annotations.length) {
          setInspectorTab("annotate");
          setMobileTab("annotate");
          setSelectedAnnotation(
            saved.composition.annotations.at(-1)?.id ?? null,
          );
        }
        setUpgradeNotice(!!raw && JSON.parse(raw).version === 1);
        setBackgroundTab(
          BACKGROUNDS.find((b) => b.id === saved.composition.style.background)
            ?.kind ?? "gradient",
        );
        setReady(true);
        setSaveState(
          blockedRef.current
            ? "Editing for this session"
            : "Saved on this device",
        );
        if (!isNew) persist(saved);
        if (
          raw &&
          (JSON.parse(raw).jobs ?? []).some(
            (job: { status: string }) => job.status === "pending",
          )
        ) {
          persist(saved);
          announce(
            "A previous export was interrupted. Your screenshot is safe; export again when ready.",
            true,
          );
        }
        if (saved.composition.source) {
          const revision = sourceRevision.current;
          const savedSource = saved.composition.source;
          try {
            const image = await loadImage(savedSource.dataUrl);
            if (
              !cancelled &&
              revision === sourceRevision.current &&
              storeRef.current.composition.source?.dataUrl ===
                savedSource.dataUrl
            ) {
              imageRef.current = image;
              setHasImage(true);
            }
          } catch {
            if (!cancelled && revision === sourceRevision.current)
              announce(
                "Your saved image could not be opened. Choose it again; your styles are safe.",
                true,
              );
          }
        } else if (isNew && !cancelled) await useExample();
      } catch (error) {
        if (cancelled) return;
        blockedRef.current = true;
        setPersistenceBlocked(true);
        setStorageError(
          error instanceof Error
            ? error.message
            : "Local storage is unavailable. You can still edit and export.",
        );
        setSaveState("Local saving unavailable");
        setReady(true);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [announce, useExample, persist]);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (
        dialogRef.current?.open ||
        batchOpenRef.current ||
        (event.target instanceof HTMLElement &&
          ["INPUT", "TEXTAREA"].includes(event.target.tagName))
      )
        return;
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file")
        ?.getAsFile();
      if (file) {
        event.preventDefault();
        void acceptFile(file);
      }
    }
    function onLeave() {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persist(storeRef.current);
      }
    }
    function onStorage(event: StorageEvent) {
      if (
        event.key !== STORAGE_KEY &&
        event.key !== LEGACY_STORAGE_KEY &&
        event.key !== null
      )
        return;
      ++writeEpoch.current;
      activeExport.current?.abort();
      if (persistTimer.current) clearTimeout(persistTimer.current);
      blockedRef.current = true;
      setPersistenceBlocked(true);
      setStorageError(
        "This workspace changed in another tab. Reload to use those changes, or clear local data to start fresh.",
      );
      setSaveState("Another tab changed this workspace");
    }
    window.addEventListener("paste", onPaste);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("storage", onStorage);
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [acceptFile, persist]);

  useEffect(() => {
    if (!canvasHostRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setPreviewWidth(Math.max(160, entries[0].contentRect.width - 16));
      setPreviewHeight(Math.max(100, entries[0].contentRect.height - 4));
    });
    observer.observe(canvasHostRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!previewRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (!previewRef.current) return;
      const width = Math.round(
        Math.min(
          1600,
          previewWidth * Math.min(window.devicePixelRatio || 1, 2),
        ),
      );
      const ratio = SIZES[style.size].height / SIZES[style.size].width;
      try {
        renderComposition(
          previewRef.current,
          imageRef.current,
          store.composition.source ?? { width: 1200, height: 760 },
          style,
          { width, height: Math.round(width * ratio) },
          annotationPreview ?? store.composition.annotations,
        );
      } catch (error) {
        announce(
          error instanceof Error
            ? error.message
            : "Preview could not render. Try resetting the style.",
          true,
        );
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    style,
    hasImage,
    store.composition.source,
    store.composition.annotations,
    annotationPreview,
    previewWidth,
    announce,
  ]);

  useEffect(() => {
    setFormError("");
    if (dialog) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [dialog]);

  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 5500);
    return () => clearTimeout(timer);
  }, [notice]);

  const updateStyle = (patch: Partial<Style>) => {
    const current = storeRef.current;
    commit({
      ...current,
      composition: {
        ...current.composition,
        style: { ...current.composition.style, ...patch },
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const exportImage = async (kind: "download" | "clipboard") => {
    if (!imageRef.current || !storeRef.current.composition.source) {
      announce("Add a screenshot first, then export your image.", true);
      return;
    }
    if (exportLock.current || isPngEncoderBusy()) {
      announce(
        "The browser is still finishing an image. Wait, or reload if it stops responding.",
        true,
      );
      return;
    }
    exportLock.current = true;
    setExporting(kind);
    const snapshot = storeRef.current;
    const exportStyle = { ...snapshot.composition.style };
    const epoch = writeEpoch.current;
    const controller = new AbortController();
    activeExport.current = controller;
    const id = crypto.randomUUID();
    const canvas = document.createElement("canvas");
    try {
      commit(createJob(snapshot, kind, exportStyle, id), true);
      renderComposition(
        canvas,
        imageRef.current,
        snapshot.composition.source!,
        exportStyle,
        undefined,
        snapshot.composition.annotations,
      );
      const png = canvasToPng(canvas, { signal: controller.signal });
      if (kind === "clipboard") await copyPng(png);
      else {
        const blob = await png;
        if (epoch !== writeEpoch.current || controller.signal.aborted) return;
        downloadPng(
          blob,
          `picwiz-${dimensions(exportStyle).width}x${dimensions(exportStyle).height}.png`,
        );
      }
      if (epoch !== writeEpoch.current) return;
      commit(finishJob(storeRef.current, id, "succeeded"), true);
      announce(
        kind === "clipboard"
          ? "Image copied. Ready for your next post."
          : `PNG downloaded · ${dimensions(exportStyle).width} × ${dimensions(exportStyle).height} px`,
      );
      if (kind === "clipboard") {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (cause) {
      if (epoch !== writeEpoch.current) return;
      const code =
        cause instanceof Error && "code" in cause
          ? String(cause.code)
          : "export_failed";
      try {
        commit(finishJob(storeRef.current, id, "failed", code), true);
      } catch {
        /* Validation may have rejected the submission before it acquired a record. */
      }
      announce(
        cause instanceof Error
          ? cause.message
          : "Export failed. Try again or download a PNG.",
        true,
      );
    } finally {
      exportLock.current = false;
      activeExport.current = null;
      setExporting(null);
      if (!isPngEncoderBusy()) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  };

  const openSave = () => {
    setPresetName("");
    setDialog({ type: "save" });
  };

  function applyPresetLook(look: Style, name: string) {
    updateStyle(applyLook(storeRef.current.composition.style, look));
    setBackgroundTab(
      BACKGROUNDS.find((background) => background.id === look.background)
        ?.kind ?? "gradient",
    );
    setDialog(null);
    announce(`“${name}” applied. Your size and annotations are unchanged.`);
  }
  function focusLayer(id: string | null) {
    requestAnimationFrame(() =>
      (id
        ? document.getElementById(`layer-${id}`)
        : document.getElementById("add-arrow")
      )?.focus(),
    );
  }
  function commitAnnotations(next: Annotation[], record = true) {
    try {
      const validated = validateAnnotations(next);
      ++annotationRevision.current;
      const history = record
        ? pushHistory(historyRef.current, validated)
        : historyRef.current;
      historyRef.current = history;
      setAnnotationHistory(history);
      setAnnotationPreview(null);
      const current = storeRef.current;
      commit({
        ...current,
        composition: {
          ...current.composition,
          annotations: validated,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (cause) {
      announce(
        cause instanceof Error
          ? cause.message
          : "This annotation could not be updated.",
        true,
      );
    }
  }
  function addMark(type: Annotation["type"]) {
    if (!hasImage) {
      announce("Add a screenshot first, then point out the good part.", true);
      return;
    }
    try {
      const mark = createAnnotation(type);
      const next = [...storeRef.current.composition.annotations, mark];
      validateAnnotations(next);
      commitAnnotations(next);
      setSelectedAnnotation(mark.id);
      setInspectorTab("annotate");
      setMobileTab("annotate");
      announce(
        `${type === "text" ? "Text label" : type === "arrow" ? "Arrow" : "Rectangle"} added. Drag it or edit its properties.`,
      );
    } catch (cause) {
      announce(
        cause instanceof Error
          ? cause.message
          : "You can add up to 30 annotations.",
        true,
      );
    }
  }
  function deleteMark(id: string) {
    const current = storeRef.current.composition.annotations;
    const index = current.findIndex((mark) => mark.id === id);
    const next = current.filter((mark) => mark.id !== id);
    commitAnnotations(next);
    const select = next[Math.max(0, index - 1)]?.id ?? null;
    setSelectedAnnotation(select);
    focusLayer(select);
    announce("Annotation deleted. Undo brings it back.");
  }
  function travelHistory(direction: "undo" | "redo") {
    const previous = historyRef.current.present;
    const next =
      direction === "undo"
        ? undoHistory(historyRef.current)
        : redoHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setAnnotationHistory(next);
    commitAnnotations(next.present, false);
    const id =
      next.present.find((mark) => !previous.some((old) => old.id === mark.id))
        ?.id ??
      next.present.find((mark) => mark.id === selectedAnnotation)?.id ??
      next.present.at(-1)?.id ??
      null;
    setSelectedAnnotation(id);
    if (id) {
      setInspectorTab("annotate");
      setMobileTab("annotate");
    }
    focusLayer(id);
    announce(
      direction === "undo"
        ? "Annotation change undone."
        : "Annotation change redone.",
    );
  }
  useEffect(() => {
    setEncoderBusy(isPngEncoderBusy());
    return subscribePngEncoder(setEncoderBusy);
  }, []);
  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if (
        dialogRef.current?.open ||
        batchOpen ||
        (event.target instanceof HTMLElement &&
          (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
            event.target.isContentEditable))
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        travelHistory(event.shiftKey ? "redo" : "undo");
      }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  });
  const confirmDialog = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (dialog?.type === "save") {
        const saved = commit(
          addPreset(storeRef.current, presetName, style),
          true,
        );
        announce(
          saved
            ? `“${presetName.trim()}” saved to your presets.`
            : "Preset kept for this session. Retry saving to keep it after reload.",
          !saved,
        );
      }
      if (dialog?.type === "rename") {
        const saved = commit(
          renamePreset(storeRef.current, dialog.id, presetName),
          true,
        );
        announce(
          saved
            ? "Preset renamed."
            : "Name changed for this session. Retry saving to keep it after reload.",
          !saved,
        );
      }
      if (dialog?.type === "delete") {
        const saved = commit(deletePreset(storeRef.current, dialog.id), true);
        announce(
          saved
            ? `“${dialog.name}” deleted.`
            : "Preset removed for this session. Retry saving to keep the change.",
          !saved,
        );
      }
      if (dialog?.type === "update") {
        const saved = commit(
          updatePreset(storeRef.current, dialog.id, style),
          true,
        );
        announce(
          saved
            ? "Preset updated."
            : "Preset updated for this session. Retry saving to keep the change.",
          !saved,
        );
      }
      if (dialog?.type === "remove") {
        ++writeEpoch.current;
        activeExport.current?.abort();
        const emptyHistory = createHistory();
        historyRef.current = emptyHistory;
        setAnnotationHistory(emptyHistory);
        setSelectedAnnotation(null);
        setAnnotationPreview(null);
        ++importGeneration.current;
        ++sourceRevision.current;
        imageRef.current = null;
        setHasImage(false);
        setImporting(false);
        const current = storeRef.current;
        commit(
          {
            ...current,
            composition: {
              ...current.composition,
              source: null,
              annotations: [],
              status: "empty",
              updatedAt: new Date().toISOString(),
            },
          },
          true,
        );
        announce("Screenshot removed. Your style is ready for the next one.");
      }
      if (dialog?.type === "clear") {
        ++writeEpoch.current;
        ++importGeneration.current;
        ++sourceRevision.current;
        activeExport.current?.abort();
        batchEpochs.current.clear();
        if (persistTimer.current) {
          clearTimeout(persistTimer.current);
          persistTimer.current = null;
        }
        blockedRef.current = true;
        try {
          clearStore(window.localStorage);
        } catch (cause) {
          setPersistenceBlocked(true);
          setStorageError(
            cause instanceof Error
              ? cause.message
              : "Clear was incomplete. Back up your local data or retry.",
          );
          throw cause;
        }
        blockedRef.current = false;
        setPersistenceBlocked(false);
        setStorageError("");
        setUpgradeNotice(false);
        imageRef.current = null;
        setHasImage(false);
        setImporting(false);
        setAnnotationPreview(null);
        setSelectedAnnotation(null);
        const emptyHistory = createHistory();
        historyRef.current = emptyHistory;
        setAnnotationHistory(emptyHistory);
        commit(loadStore(window.localStorage), true);
        announce(
          "Local data cleared, including the legacy backup. A fresh canvas awaits.",
        );
      }
      setDialog(null);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "This change could not be saved. Try again.",
      );
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="PicWiz V2 home">
          <span className="brand-mark">
            <Sparkles size={20} strokeWidth={1.8} />
          </span>
          PicWiz{" "}
          <span className="version-badge" aria-hidden="true">
            V2
          </span>
        </a>
        <div className="header-divider" />
        <span className="workspace-label">Your local screenshot studio</span>
        <div className="header-actions">
          <span className="local-badge">
            <span />
            All yours. All local.
          </span>
          <button
            className="text-button presets-header"
            aria-label="My presets"
            onClick={() => setDialog({ type: "presets" })}
          >
            <LayoutTemplate size={16} />
            <span>My presets</span>
            {store.presets.length > 0 && (
              <span className="count" aria-hidden="true">
                {store.presets.length}
              </span>
            )}
          </button>
          <button
            id="batch-opener"
            className="header-batch-button"
            aria-label="Batch export"
            disabled={!ready || importing}
            onClick={() => setBatchOpen(true)}
          >
            <Files size={15} />
            <span>Batch export</span>
          </button>
          <button
            className="icon-button help-button"
            aria-label="Help and privacy"
            onClick={() => setDialog({ type: "help" })}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>

      <main className="editor-layout">
        <section
          className="workspace"
          id="canvas"
          aria-label="Screenshot canvas"
        >
          <div className="workspace-heading">
            <div>
              <div className="eyebrow">YOUR NEXT POST STARTS HERE.</div>
              <h1>
                One look. Every launch<span>.</span>
              </h1>
              <p>Style once. Add a little context. Share everywhere.</p>
            </div>
            <button
              className="upload-button"
              onClick={() => fileRef.current?.click()}
              disabled={!ready || importing}
            >
              <Upload size={16} />
              {importing ? "Opening image…" : "Add screenshot"}
              <span className="shortcut">↥</span>
            </button>
          </div>
          <input
            ref={fileRef}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Upload screenshot"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void acceptFile(file);
              e.target.value = "";
            }}
          />

          {upgradeNotice && (
            <div className="upgrade-notice" role="status">
              <Sparkles size={17} />
              <p>
                <strong>Shinyshot is now PicWiz.</strong> Your workspace and
                presets are here. Presets now apply appearance only; migrated
                frames and shadows may look slightly different.
              </p>
              <button
                className="icon-button"
                aria-label="Dismiss upgrade notice"
                onClick={() => setUpgradeNotice(false)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div
            className="annotation-toolbar"
            role="toolbar"
            aria-label="Annotation tools"
          >
            <span className="toolbar-label">Add context</span>
            <button
              id="add-arrow"
              aria-label="Add arrow"
              disabled={!hasImage}
              onClick={() => addMark("arrow")}
            >
              <ArrowUpRight size={16} />
              <span>Arrow</span>
            </button>
            <button
              aria-label="Add rectangle"
              disabled={!hasImage}
              onClick={() => addMark("rectangle")}
            >
              <Square size={15} />
              <span>Rectangle</span>
            </button>
            <button
              aria-label="Add text"
              disabled={!hasImage}
              onClick={() => addMark("text")}
            >
              <Type size={16} />
              <span>Text</span>
            </button>
            <span className="toolbar-divider" />
            {/* Firefox otherwise restores dynamic disabled state across reloads. */}
            <button
              className="tool-icon"
              aria-label="Undo annotation"
              {...{ autoComplete: "off" }}
              title="Undo annotation (⌘/Ctrl Z)"
              disabled={!annotationHistory.past.length}
              onClick={() => travelHistory("undo")}
            >
              <Undo2 size={16} />
            </button>
            <button
              className="tool-icon"
              aria-label="Redo annotation"
              {...{ autoComplete: "off" }}
              title="Redo annotation (⌘/Ctrl Shift Z)"
              disabled={!annotationHistory.future.length}
              onClick={() => travelHistory("redo")}
            >
              <Redo2 size={16} />
            </button>
          </div>
          <div
            className="canvas-workspace"
            data-testid="drop-zone"
            onDragOver={(e) => {
              e.preventDefault();
              if (e.dataTransfer.types.includes("Files")) setDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const files = e.dataTransfer.files;
              if (files.length > 1)
                announce(
                  "Choose one screenshot at a time. Your current image is unchanged.",
                  true,
                );
              else if (files[0]) void acceptFile(files[0]);
            }}
          >
            <div className="canvas-topline">
              <span className="canvas-label">
                <span className="canvas-status-dot" />
                {hasImage ? "Your canvas" : "Ready for your screenshot"}
              </span>
              <span className="canvas-dimensions">
                {output.width.toLocaleString()} ×{" "}
                {output.height.toLocaleString()}
                <span> px</span>
              </span>
            </div>
            <div className={`canvas-stage ${style.size}`} ref={canvasHostRef}>
              <div
                className="canvas-transform"
                style={{
                  width:
                    (Math.min(
                      previewWidth,
                      (previewHeight * SIZES[style.size].width) /
                        SIZES[style.size].height,
                    ) *
                      zoom) /
                    100,
                  maxWidth: "none",
                  maxHeight: "none",
                  aspectRatio: `${SIZES[style.size].width}/${SIZES[style.size].height}`,
                }}
              >
                <canvas
                  data-testid="composition-canvas"
                  ref={previewRef}
                  aria-label={`Composition preview, ${output.width} by ${output.height} pixels`}
                  role="img"
                  width="1600"
                  height="900"
                >
                  Your screenshot canvas. Add a PNG, JPEG, or WebP to start.
                </canvas>
                {hasImage && store.composition.source && (
                  <AnnotationLayer
                    key={renderSourceRevision}
                    annotations={annotations}
                    previewAnnotations={annotationPreview}
                    committedRevision={annotationRevision.current}
                    selectedId={selectedAnnotation}
                    style={style}
                    sourceSize={store.composition.source}
                    onSelect={(id) => {
                      setSelectedAnnotation(id);
                      if (id) {
                        setInspectorTab("annotate");
                        setMobileTab("annotate");
                      }
                    }}
                    onPreview={(next, revision) => {
                      if (
                        renderSourceRevision === sourceRevision.current &&
                        revision === annotationRevision.current &&
                        renderEpoch === writeEpoch.current
                      )
                        setAnnotationPreview(next);
                    }}
                    onCommit={(next, revision) => {
                      if (
                        renderSourceRevision === sourceRevision.current &&
                        revision === annotationRevision.current &&
                        renderEpoch === writeEpoch.current
                      )
                        commitAnnotations(next);
                    }}
                    onDelete={deleteMark}
                  />
                )}
                {!hasImage && (
                  <div className="canvas-empty">
                    <span className="empty-upload-icon">
                      <ImagePlus size={28} />
                    </span>
                    <h2>
                      {ready
                        ? "Good things start with a screenshot."
                        : "Warming up your canvas…"}
                    </h2>
                    <p>
                      Drop a PNG, JPEG, or WebP here
                      <br />
                      or paste an image with <kbd>⌘ / Ctrl</kbd> + <kbd>V</kbd>
                    </p>
                    <button
                      className="primary-button"
                      onClick={() => fileRef.current?.click()}
                      disabled={!ready}
                    >
                      Choose screenshot <ArrowRight size={15} />
                    </button>
                    <button
                      className="example-button"
                      onClick={() => void useExample()}
                      disabled={!ready}
                    >
                      Use example
                    </button>
                  </div>
                )}
              </div>
            </div>
            {dragging && (
              <div className="drop-overlay">
                <ImagePlus size={38} />
                <strong>Drop your screenshot here</strong>
                <span>A fresh canvas, in a second.</span>
              </div>
            )}
            {importing && (
              <div className="import-overlay" role="status">
                <LoaderCircle className="spin" size={20} />
                Opening your screenshot…
              </div>
            )}
            <div className="canvas-bottomline">
              <span className="canvas-hint">
                <ImagePlus size={14} />
                Drop a screenshot anywhere, or paste <kbd>⌘ V</kbd>
              </span>
              <div className="zoom-controls">
                <button
                  aria-label="Zoom out"
                  onClick={() => setZoom((v) => Math.max(40, v - 10))}
                  disabled={zoom <= 40}
                >
                  <Minus size={14} />
                </button>
                <span>{zoom}%</span>
                <button
                  aria-label="Zoom in"
                  onClick={() => setZoom((v) => Math.min(150, v + 10))}
                  disabled={zoom >= 150}
                >
                  <Plus size={14} />
                </button>
                <span className="zoom-divider" />
                <button
                  aria-label="Fit canvas"
                  title="Fit canvas"
                  onClick={() => setZoom(100)}
                >
                  <Expand size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="source-row">
            <div className="source-info">
              {hasImage ? (
                <>
                  <span className="source-icon">
                    <Monitor size={16} />
                  </span>
                  <span>
                    <strong>{store.composition.source?.name}</strong>
                    <small>
                      {store.composition.source?.width} ×{" "}
                      {store.composition.source?.height} px
                      <span className="source-separator">·</span>
                      <ShieldCheck size={11} />
                      Only on your device
                    </small>
                  </span>
                </>
              ) : (
                <>
                  <span className="source-icon">
                    <ImagePlus size={17} />
                  </span>
                  <span>
                    <strong>Your next great post starts here</strong>
                    <small>PNG, JPEG or WebP · up to 25 MB</small>
                  </span>
                </>
              )}
            </div>
            {hasImage && (
              <div className="source-actions">
                <button
                  className="text-button"
                  onClick={() => fileRef.current?.click()}
                >
                  Replace
                </button>
                <button
                  className="icon-button"
                  aria-label="Remove screenshot"
                  onClick={() => setDialog({ type: "remove" })}
                >
                  <X size={15} />
                </button>
              </div>
            )}
          </div>
          <div className="workspace-footnote">
            <ShieldCheck size={14} />
            <span>
              Private by design. Your screenshots never leave your browser.
            </span>
            <Link href="/privacy">
              Learn more <ArrowRight size={12} />
            </Link>
          </div>
        </section>

        <aside className="inspector" aria-label="Style panel">
          <div className="inspector-title">
            <h2>Make it yours</h2>
            <button
              className="icon-button reset-style"
              aria-label="Reset style to defaults"
              title="Reset style to defaults"
              onClick={() => {
                updateStyle({ ...DEFAULT_STYLE });
                setBackgroundTab("gradient");
                announce("Style reset to defaults.");
              }}
            >
              <RotateCcw size={15} />
            </button>
          </div>
          <div className="inspector-tabs" aria-label="Inspector view">
            <button
              className={inspectorTab === "style" ? "active" : ""}
              aria-pressed={inspectorTab === "style"}
              onClick={() => setInspectorTab("style")}
            >
              <SlidersHorizontal size={14} />
              Style
            </button>
            <button
              className={inspectorTab === "annotate" ? "active" : ""}
              aria-pressed={inspectorTab === "annotate"}
              onClick={() => setInspectorTab("annotate")}
            >
              <Type size={15} />
              Annotate
              {annotations.length > 0 && <span>{annotations.length}</span>}
            </button>
          </div>
          <div className="mobile-tabs">
            <button
              className={mobileTab === "style" ? "active" : ""}
              onClick={() => setMobileTab("style")}
            >
              <SlidersHorizontal size={14} />
              Style
            </button>
            <button
              className={mobileTab === "frame" ? "active" : ""}
              onClick={() => setMobileTab("frame")}
            >
              <Monitor size={14} />
              Frame
            </button>
            <button
              className={mobileTab === "annotate" ? "active" : ""}
              onClick={() => setMobileTab("annotate")}
            >
              <Type size={14} />
              Annotate
            </button>
          </div>
          <div
            className={`style-controls ${inspectorTab === "style" ? "desktop-visible" : ""} mobile-${mobileTab}`}
          >
            <StarterLooks
              onApply={applyPresetLook}
              onBrowse={() => setDialog({ type: "presets" })}
            />
            <div
              className={`inspector-section background-section mobile-${mobileTab}`}
            >
              <div className="section-title">
                <h3>Background</h3>
                <span className="selected-background">
                  {BACKGROUNDS.find((b) => b.id === style.background)?.name}
                </span>
              </div>
              <div className="segmented background-tabs">
                <button
                  className={backgroundTab === "gradient" ? "active" : ""}
                  onClick={() => setBackgroundTab("gradient")}
                >
                  Gradient
                </button>
                <button
                  className={backgroundTab === "solid" ? "active" : ""}
                  onClick={() => setBackgroundTab("solid")}
                >
                  Solid color
                </button>
              </div>
              <div className="swatches">
                {BACKGROUNDS.filter((b) => b.kind === backgroundTab).map(
                  (background) => (
                    <button
                      key={background.id}
                      className={`swatch ${style.background === background.id ? "selected" : ""}`}
                      style={{ background: backgroundCss(background) }}
                      title={background.name}
                      aria-label={`Background: ${background.name}`}
                      aria-pressed={style.background === background.id}
                      onClick={() => updateStyle({ background: background.id })}
                    >
                      {style.background === background.id && (
                        <Check size={16} strokeWidth={2.5} />
                      )}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div
              className={`inspector-section spacing-section mobile-${mobileTab}`}
            >
              <div className="section-title">
                <h3>Layout</h3>
                <Maximize size={13} />
              </div>
              <RangeControl
                label="Padding"
                value={style.padding}
                max={200}
                onChange={(padding) => updateStyle({ padding })}
              />
              <RangeControl
                label="Corner radius"
                value={style.radius}
                max={48}
                onChange={(radius) => updateStyle({ radius })}
              />
              <RangeControl
                label="Shadow"
                value={style.shadow}
                max={100}
                suffix="%"
                onChange={(shadow) => updateStyle({ shadow })}
              />
            </div>
            <div
              className={`inspector-section frame-section mobile-${mobileTab}`}
            >
              <div className="section-title">
                <h3>Frame</h3>
                <span className="subtle-label">A finishing touch</span>
              </div>
              <div className="frame-options">
                <button
                  aria-label="No frame"
                  aria-pressed={style.frame === "none"}
                  className={style.frame === "none" ? "selected" : ""}
                  onClick={() => updateStyle({ frame: "none" })}
                >
                  <span className="frame-preview frame-none">
                    <span />
                  </span>
                  <span>No frame</span>
                  {style.frame === "none" && (
                    <Check
                      className="frame-check"
                      size={10}
                      aria-hidden="true"
                    />
                  )}
                </button>
                <button
                  aria-label="Browser frame"
                  aria-pressed={style.frame === "browser"}
                  className={style.frame === "browser" ? "selected" : ""}
                  onClick={() => updateStyle({ frame: "browser" })}
                >
                  <span className="frame-preview frame-browser">
                    <i />
                    <span />
                  </span>
                  <span>Browser</span>
                  {style.frame === "browser" && (
                    <Check
                      className="frame-check"
                      size={10}
                      aria-hidden="true"
                    />
                  )}
                </button>
                <button
                  aria-label="Device frame"
                  aria-pressed={style.frame === "device"}
                  className={style.frame === "device" ? "selected" : ""}
                  onClick={() => updateStyle({ frame: "device" })}
                >
                  <span className="frame-preview frame-device">
                    <span />
                  </span>
                  <span>Device</span>
                  {style.frame === "device" && (
                    <Check
                      className="frame-check"
                      size={10}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
              <div
                className={`frame-appearance ${style.frame === "none" ? "appearance-inactive" : ""}`}
              >
                <span>Appearance</span>
                <div className="appearance-options">
                  <button
                    aria-label="Light frame"
                    aria-pressed={style.appearance === "light"}
                    className={style.appearance === "light" ? "active" : ""}
                    onClick={() => updateStyle({ appearance: "light" })}
                  >
                    <Sun size={13} />
                    Light
                  </button>
                  <button
                    aria-label="Dark frame"
                    aria-pressed={style.appearance === "dark"}
                    className={style.appearance === "dark" ? "active" : ""}
                    onClick={() => updateStyle({ appearance: "dark" })}
                  >
                    <Moon size={13} />
                    Dark
                  </button>
                </div>
              </div>
            </div>
            <div className="save-style-card">
              <span className="save-style-icon">
                <LayoutTemplate size={18} />
              </span>
              <div>
                <strong>Found your look?</strong>
                <p>Save it. Make your next post match.</p>
              </div>
              <button className="save-preset-button" onClick={openSave}>
                <Plus size={15} />
                Save preset
              </button>
            </div>
          </div>
          <div
            className={`annotation-pane ${inspectorTab === "annotate" ? "desktop-visible" : ""} ${mobileTab === "annotate" ? "mobile-visible" : ""}`}
          >
            <AnnotationInspector
              sourceSize={store.composition.source}
              annotations={annotations}
              selectedId={selectedAnnotation}
              onSelect={setSelectedAnnotation}
              onAdd={addMark}
              onDelete={deleteMark}
              onChange={(id, patch) =>
                commitAnnotations(
                  storeRef.current.composition.annotations.map((mark) =>
                    mark.id === id ? { ...mark, ...patch } : mark,
                  ),
                )
              }
            />
          </div>
          <div className="inspector-bottom">
            <LockKeyhole size={12} />
            No account. No uploads. Just you.
          </div>
        </aside>
      </main>

      <footer className="export-bar" aria-label="Export controls">
        <div className="export-ready">
          <span className={`saved-dot ${storageError ? "warning" : ""}`} />
          <div>
            <strong>
              {exporting
                ? "Adding the final shine…"
                : hasImage
                  ? "Ready when you are"
                  : "Your canvas is waiting"}
            </strong>
            <span>{saveState}</span>
          </div>
        </div>
        <div className="export-controls">
          <div className="export-size">
            <div className="size-label-row">
              <label htmlFor="output-size">Output size</label>
              <button
                aria-label="Browse social sizes"
                onClick={() => setDialog({ type: "sizes" })}
              >
                <Crop size={11} />
                Sizes
              </button>
            </div>
            <div className="select-wrap">
              <select
                id="output-size"
                aria-label="Output size"
                value={style.size}
                onChange={(e) =>
                  updateStyle({ size: e.target.value as Style["size"] })
                }
              >
                {Object.entries(SIZES).map(([id, size]) => (
                  <option value={id} key={id}>
                    {size.label} · {size.width} × {size.height}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
          <div className="export-scale">
            <label htmlFor="export-scale">Scale</label>
            <div className="select-wrap">
              <select
                id="export-scale"
                aria-label="Export scale"
                value={style.scale}
                onChange={(e) =>
                  updateStyle({ scale: Number(e.target.value) as 1 | 2 })
                }
              >
                <option value="1">1×</option>
                <option value="2">2×</option>
              </select>
              <ChevronDown size={12} />
            </div>
          </div>
          <span className="export-divider" />
          <button
            className="copy-button"
            onClick={() => void exportImage("clipboard")}
            disabled={!hasImage || !!exporting || encoderBusy}
            aria-label="Copy image"
          >
            {exporting === "clipboard" ? (
              <LoaderCircle className="spin" size={16} />
            ) : copied ? (
              <Check size={16} />
            ) : (
              <Copy size={16} />
            )}
            <span>{"Copy image"}</span>
          </button>
          <button
            className="primary-button export-button"
            onClick={() => void exportImage("download")}
            disabled={!hasImage || !!exporting || encoderBusy}
            aria-label="Export PNG"
          >
            {exporting === "download" ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <ArrowDownToLine size={16} />
            )}
            <span>
              {exporting === "download" ? "Exporting…" : "Export PNG"}
            </span>
          </button>
        </div>
      </footer>

      {storageError && (
        <div className="storage-notice" role="alert">
          <div>
            <strong>Local saving needs attention</strong>
            <span>{storageError}</span>
            <small>
              Your image stays on this device. You can keep editing and export
              for this session.
            </small>
          </div>
          <button
            onClick={() => {
              try {
                downloadFile(
                  new Blob([backupLocalData(window.localStorage)], {
                    type: "application/json",
                  }),
                  "picwiz-local-backup.json",
                );
                announce(
                  "Local backup downloaded. It may contain your private screenshot; keep it safe.",
                );
              } catch (cause) {
                announce(
                  cause instanceof Error
                    ? cause.message
                    : "The backup could not be downloaded.",
                  true,
                );
              }
            }}
          >
            Backup local data
          </button>
          <button
            onClick={() => {
              blockedRef.current = true;
              setPersistenceBlocked(true);
              setSaveState("Editing for this session");
              announce(
                "Editing for this session. You can still export PNGs; changes are not saved.",
              );
            }}
          >
            Session-only editing
          </button>
          <button
            onClick={() =>
              persistenceBlocked
                ? window.location.reload()
                : persist(storeRef.current)
            }
          >
            {persistenceBlocked ? "Reload" : "Retry saving"}
          </button>
          <button onClick={() => setDialog({ type: "clear" })}>
            Clear local data
          </button>
        </div>
      )}
      {encoderBusy && !exporting && !batchOpen && (
        <div className="encoder-notice" role="status">
          The browser is finishing an image. Export will be available when it
          finishes. If it stays here, reload the page.
        </div>
      )}
      {batchOpen && (
        <BatchExport
          source={store.composition.source}
          annotations={annotations}
          style={style}
          encoderBusy={encoderBusy}
          onClose={() => {
            setBatchOpen(false);
            requestAnimationFrame(() =>
              document.getElementById("batch-opener")?.focus(),
            );
          }}
          onNotice={announce}
          onStart={(id, formats, scale, total) => {
            const next = createBatchJob(
              storeRef.current,
              formats,
              scale,
              total,
              id,
            );
            batchEpochs.current.set(id, writeEpoch.current);
            commit(next, true);
          }}
          onFinish={(id, stats) => {
            const epoch = batchEpochs.current.get(id);
            batchEpochs.current.delete(id);
            if (
              epoch !== writeEpoch.current ||
              !storeRef.current.jobs.some(
                (job) => job.id === id && job.status === "pending",
              )
            )
              return;
            try {
              commit(finishBatchJob(storeRef.current, id, stats), true);
            } catch (cause) {
              announce(
                cause instanceof Error
                  ? cause.message
                  : "Batch history could not be updated.",
                true,
              );
            }
          }}
        />
      )}
      {notice && (
        <div
          data-testid="notification"
          className={`toast ${notice.error ? "error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? <CircleHelp size={17} /> : <Check size={17} />}
          <span>{notice.message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <dialog
        className={`app-dialog ${dialog?.type === "presets" ? "presets-dialog" : dialog?.type === "sizes" ? "sizes-dialog" : ""}`}
        ref={dialogRef}
        onCancel={() => setDialog(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              setDialog(null);
          }
        }}
        aria-labelledby="dialog-title"
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close dialog"
          onClick={() => setDialog(null)}
        >
          <X size={18} />
        </button>
        {dialog?.type === "presets" ? (
          <PresetLibrary
            store={store}
            onApply={applyPresetLook}
            onSave={openSave}
            onRename={(preset) => {
              setPresetName(preset.name);
              setDialog({ type: "rename", id: preset.id, name: preset.name });
            }}
            onDelete={(preset) =>
              setDialog({ type: "delete", id: preset.id, name: preset.name })
            }
            onUpdate={(preset) =>
              setDialog({ type: "update", id: preset.id, name: preset.name })
            }
            onImport={(json) => {
              if (renderEpoch !== writeEpoch.current)
                throw new Error(
                  "This workspace changed while reading. Reload before importing presets.",
                );
              const result = importPresets(storeRef.current, json);
              const saved = !!commit(result.store, true);
              return { ...result, saved };
            }}
            onNotice={announce}
          />
        ) : dialog?.type === "sizes" ? (
          <SocialSizes
            value={style.size}
            scale={style.scale}
            onSelect={(size) => {
              updateStyle({ size });
              setDialog(null);
              announce(
                `${SIZES[size].label} selected · ${SIZES[size].width * style.scale} × ${SIZES[size].height * style.scale} px`,
              );
            }}
          />
        ) : dialog?.type === "help" ? (
          <>
            <span className="dialog-symbol">
              <Sparkles size={24} />
            </span>
            <h2 id="dialog-title">A little shine goes a long way.</h2>
            <p className="dialog-description">
              Add a screenshot, find a background you love, and export. It’s
              that simple.
            </p>
            <div className="help-steps">
              <p>
                <Upload size={17} />
                <span>
                  <strong>Drop, choose, or paste</strong>PNG, JPEG and WebP · up
                  to 25 MB
                </span>
              </p>
              <p>
                <SlidersHorizontal size={17} />
                <span>
                  <strong>Find your signature look</strong>Everything updates
                  right on the canvas.
                </span>
              </p>
              <p>
                <ArrowDownToLine size={17} />
                <span>
                  <strong>Share at the perfect size</strong>Download a PNG or
                  copy it straight into a post.
                </span>
              </p>
            </div>
            <Link className="privacy-link" href="/privacy">
              <ShieldCheck size={16} />
              Privacy & local storage
              <ArrowRight size={15} />
            </Link>
            <button
              className="help-reset text-button"
              onClick={() => {
                updateStyle({ ...DEFAULT_STYLE });
                setBackgroundTab("gradient");
                setDialog(null);
                announce("Style reset to defaults.");
              }}
            >
              <RotateCcw size={14} />
              Reset style to defaults
            </button>
            <button
              className="danger-link"
              onClick={() => setDialog({ type: "clear" })}
            >
              <Trash2 size={14} />
              Clear local data
            </button>
          </>
        ) : (
          dialog && (
            <form onSubmit={confirmDialog}>
              <span className="dialog-symbol">
                {dialog.type === "save" ||
                dialog.type === "rename" ||
                dialog.type === "update" ? (
                  <LayoutTemplate size={24} />
                ) : (
                  <Trash2 size={22} />
                )}
              </span>
              <h2 id="dialog-title">
                {dialog.type === "save"
                  ? "Keep a good thing."
                  : dialog.type === "rename"
                    ? "A new name for your look."
                    : dialog.type === "update"
                      ? "Update this preset?"
                      : dialog.type === "delete"
                        ? "Delete this preset?"
                        : dialog.type === "remove"
                          ? "Remove this screenshot?"
                          : "Clear your local workspace?"}
              </h2>
              <p className="dialog-description">
                {dialog.type === "save"
                  ? "Save this style for your next screenshot. Same look, two clicks."
                  : dialog.type === "rename"
                    ? "Choose a name that’s easy to find next time."
                    : dialog.type === "update"
                      ? `Replace the appearance in “${dialog.name}” with your current look? Screenshots, sizes and annotations stay as they are.`
                      : dialog.type === "delete"
                        ? `“${dialog.name}” will be deleted from this browser. Your current canvas stays as it is.`
                        : dialog.type === "remove"
                          ? "The current image and its annotations will be removed from this workspace. Your style, presets and any legacy backup stay. Use Clear local data to remove all local records."
                          : "This deletes the current screenshot, every saved preset, annotations, export history, and any legacy backup from this browser. Downloaded files stay yours. This cannot be undone."}
              </p>
              {(dialog.type === "save" || dialog.type === "rename") && (
                <>
                  <label className="form-label" htmlFor="preset-name">
                    Preset name
                  </label>
                  <input
                    autoFocus
                    id="preset-name"
                    maxLength={40}
                    value={presetName}
                    placeholder="e.g. My product updates"
                    onChange={(e) => {
                      setPresetName(e.target.value);
                      setFormError("");
                    }}
                    required
                    aria-describedby={formError ? "form-error" : undefined}
                  />
                </>
              )}
              {formError && (
                <p className="form-error" id="form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={
                    ["delete", "clear", "remove"].includes(dialog.type)
                      ? "danger-button"
                      : "primary-button"
                  }
                >
                  {dialog.type === "save"
                    ? "Save preset"
                    : dialog.type === "rename"
                      ? "Rename preset"
                      : dialog.type === "update"
                        ? "Update preset"
                        : dialog.type === "delete"
                          ? "Delete preset"
                          : dialog.type === "remove"
                            ? "Remove screenshot"
                            : "Clear local data"}
                </button>
              </div>
            </form>
          )
        )}
      </dialog>
    </div>
  );
}
