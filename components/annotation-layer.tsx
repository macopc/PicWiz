"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  FlipHorizontal2,
  FlipVertical2,
  Layers,
  Trash2,
} from "lucide-react";
import {
  ANNOTATION_COLORS,
  moveAnnotation,
  type Annotation,
} from "@/lib/annotations";
import { compositionLayout, layoutAnnotationText } from "@/lib/canvas";
import type { Style } from "@/lib/domain";

type LayerProps = {
  annotations: Annotation[];
  previewAnnotations: Annotation[] | null;
  committedRevision: number;
  selectedId: string | null;
  style: Style;
  sourceSize: { width: number; height: number };
  onSelect: (id: string | null) => void;
  onPreview: (annotations: Annotation[] | null, revision: number) => void;
  onCommit: (annotations: Annotation[], revision: number) => void;
  onDelete: (id: string) => void;
};

export function AnnotationLayer({
  annotations,
  previewAnnotations,
  committedRevision,
  selectedId,
  style,
  sourceSize,
  onSelect,
  onPreview,
  onCommit,
  onDelete,
}: LayerProps) {
  const layout = compositionLayout(sourceSize, style);
  const drag = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    original: Annotation[];
    latest: Annotation[];
    revision: number;
  } | null>(null);

  function sourcePoint(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x:
        (((event.clientX - rect.left) / rect.width) * layout.width -
          layout.imageRect.x) /
        layout.imageRect.width,
      y:
        (((event.clientY - rect.top) / rect.height) * layout.height -
          layout.imageRect.y) /
        layout.imageRect.height,
    };
  }
  function endDrag(
    event: React.PointerEvent<SVGSVGElement>,
    cancelled: boolean,
  ) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    onPreview(null, active.revision);
    if (
      !cancelled &&
      active.revision === committedRevision &&
      JSON.stringify(active.latest) !== JSON.stringify(active.original)
    )
      onCommit(active.latest, active.revision);
  }

  useEffect(() => {
    if (drag.current && drag.current.revision !== committedRevision) {
      drag.current = null;
      onPreview(null, committedRevision);
    }
  }, [committedRevision, onPreview]);

  return (
    <svg
      className="annotation-layer"
      data-testid="annotation-layer"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-label="Editable annotations"
      onPointerDown={(event) => {
        const id = (event.target as Element)
          .closest("[data-annotation-id]")
          ?.getAttribute("data-annotation-id");
        if (!id) {
          onSelect(null);
          return;
        }
        event.preventDefault();
        onSelect(id);
        const point = sourcePoint(event);
        const original = annotations.map((annotation) => ({ ...annotation }));
        drag.current = {
          id,
          pointerId: event.pointerId,
          startX: point.x,
          startY: point.y,
          original,
          latest: original,
          revision: committedRevision,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const point = sourcePoint(event);
        active.latest = active.original.map((annotation) =>
          annotation.id === active.id
            ? moveAnnotation(
                annotation,
                point.x - active.startX,
                point.y - active.startY,
              )
            : annotation,
        );
        if (active.revision !== committedRevision) {
          drag.current = null;
          onPreview(null, committedRevision);
          return;
        }
        onPreview(active.latest, active.revision);
      }}
      onPointerUp={(event) => endDrag(event, false)}
      onPointerCancel={(event) => endDrag(event, true)}
    >
      {(previewAnnotations ?? annotations).map((annotation, index) => {
        const selected = annotation.id === selectedId;
        const { imageRect } = layout;
        const x = imageRect.x + annotation.x * imageRect.width;
        const y = imageRect.y + annotation.y * imageRect.height;
        const width = annotation.width * imageRect.width;
        const height = annotation.height * imageRect.height;
        return (
          <g
            key={annotation.id}
            data-annotation-id={annotation.id}
            role="button"
            tabIndex={0}
            aria-label={`Move ${annotation.type} annotation ${index + 1}`}
            aria-pressed={selected}
            onFocus={() => onSelect(annotation.id)}
            onKeyDown={(event) => {
              if (event.key === "Delete" || event.key === "Backspace") {
                event.preventDefault();
                onDelete(annotation.id);
                return;
              }
              const step = event.shiftKey ? 0.05 : 0.01;
              const delta: Record<string, [number, number]> = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
              };
              if (delta[event.key]) {
                event.preventDefault();
                const [dx, dy] = delta[event.key];
                onCommit(
                  annotations.map((item) =>
                    item.id === annotation.id
                      ? moveAnnotation(item, dx, dy)
                      : item,
                  ),
                  committedRevision,
                );
              }
            }}
          >
            <rect
              className={`annotation-hit ${selected ? "is-selected" : ""}`}
              x={x}
              y={y}
              width={width}
              height={height}
              fill="transparent"
              vectorEffect="non-scaling-stroke"
            />
            {selected && (
              <>
                <circle
                  className="annotation-handle"
                  cx={x}
                  cy={y}
                  r={layout.width / 230}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  className="annotation-handle"
                  cx={x + width}
                  cy={y + height}
                  r={layout.width / 230}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

type InspectorProps = {
  sourceSize: { width: number; height: number } | null;
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
  onAdd: (type: Annotation["type"]) => void;
};

export function AnnotationInspector({
  sourceSize,
  annotations,
  selectedId,
  onSelect,
  onChange,
  onDelete,
  onAdd,
}: InspectorProps) {
  const selected = annotations.find(
    (annotation) => annotation.id === selectedId,
  );
  const [textStatus, setTextStatus] = useState("");
  useEffect(() => {
    if (selected?.type !== "text" || !sourceSize) {
      setTextStatus("");
      return;
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    const font = selected.fontSize * 1600;
    context.font = `${font}px Arial, Helvetica, sans-serif`;
    const lines = layoutAnnotationText(
      context,
      selected.text,
      selected.width * 1600,
    );
    const clipped =
      lines.join("").replace(/\s/g, "") !== selected.text.replace(/\s/g, "") ||
      (lines.length - 1) * font * 1.25 + font >
        (selected.height * 1600 * sourceSize.height) / sourceSize.width;
    setTextStatus(
      clipped
        ? "Some text is clipped. Increase the box size or use smaller text."
        : `Text fits · ${lines.length} rendered line${lines.length === 1 ? "" : "s"}.`,
    );
    canvas.width = 0;
    canvas.height = 0;
  }, [selected, sourceSize]);
  const colorNames = ["Coral", "Violet", "Mint", "Blue", "Ink", "White"];
  function changeGeometry(key: "x" | "y" | "width" | "height", value: number) {
    if (!selected || !Number.isFinite(value)) return;
    const limits = {
      x: 1 - selected.width,
      y: 1 - selected.height,
      width: 1 - selected.x,
      height: 1 - selected.y,
    };
    onChange(selected.id, {
      [key]: Math.min(
        limits[key],
        Math.max(key === "x" || key === "y" ? 0 : 0.02, value / 100),
      ),
    });
  }
  return (
    <section
      className="annotation-inspector"
      aria-label="Annotation properties"
    >
      <div className="section-title">
        <h3>Give it a little context</h3>
        <span>{annotations.length}/30</span>
      </div>
      {!annotations.length ? (
        <div className="annotation-empty">
          <ArrowUpRight size={25} />
          <strong>Point out the good part.</strong>
          <p>
            Add an arrow, a rectangle, or a short label. It stays anchored to
            your screenshot.
          </p>
          <button className="secondary-button" onClick={() => onAdd("arrow")}>
            Add your first arrow
          </button>
        </div>
      ) : (
        <>
          <div className="annotation-layers" aria-label="Annotation layers">
            <span className="layers-title">
              <Layers size={13} />
              Layers
            </span>
            {annotations.map((annotation, index) => (
              <button
                id={`layer-${annotation.id}`}
                key={annotation.id}
                aria-label={`Select annotation ${index + 1}: ${annotation.type === "text" ? annotation.text || "Text label" : annotation.type === "arrow" ? "Arrow" : "Rectangle"} ${index + 1}`}
                aria-pressed={selectedId === annotation.id}
                className={selectedId === annotation.id ? "selected" : ""}
                onClick={() => onSelect(annotation.id)}
              >
                <span
                  className="layer-color"
                  style={{ background: annotation.color }}
                />
                <span>
                  {annotation.type === "text"
                    ? annotation.text || "Text label"
                    : annotation.type === "arrow"
                      ? "Arrow"
                      : "Rectangle"}
                </span>{" "}
                <span>{index + 1}</span>
              </button>
            ))}
          </div>
          {selected ? (
            <div className="annotation-properties">
              <div className="section-title">
                <h3>
                  {selected.type === "text"
                    ? "Text label"
                    : selected.type === "arrow"
                      ? "Arrow"
                      : "Rectangle"}
                </h3>
                <button
                  className="icon-button"
                  aria-label="Delete annotation"
                  title="Delete annotation"
                  onClick={() => onDelete(selected.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {selected.type === "text" && (
                <div className="annotation-field">
                  <label htmlFor="annotation-text">Annotation text</label>
                  <textarea
                    id="annotation-text"
                    rows={3}
                    maxLength={140}
                    value={selected.text}
                    onChange={(event) =>
                      onChange(selected.id, { text: event.target.value })
                    }
                    aria-describedby="annotation-text-help"
                  />
                  <small id="annotation-text-help">
                    Up to 140 characters and 3 rendered lines. Enlarge the box
                    if text is clipped.
                  </small>
                  <p className="text-layout-status" role="status">
                    {textStatus}
                  </p>
                </div>
              )}
              <div className="annotation-property-grid">
                <label>
                  Color
                  <select
                    aria-label="Annotation color"
                    value={selected.color}
                    onChange={(event) =>
                      onChange(selected.id, { color: event.target.value })
                    }
                  >
                    {ANNOTATION_COLORS.map((color, index) => (
                      <option key={color} value={color}>
                        {colorNames[index] ?? color}
                      </option>
                    ))}
                  </select>
                </label>
                {selected.type === "text" ? (
                  <label>
                    Label size
                    <select
                      aria-label="Annotation font size"
                      value={selected.fontSize}
                      onChange={(event) =>
                        onChange(selected.id, {
                          fontSize: Number(
                            event.target.value,
                          ) as Annotation["fontSize"],
                        })
                      }
                    >
                      <option value="0.022">Small</option>
                      <option value="0.03">Medium</option>
                      <option value="0.045">Large</option>
                    </select>
                  </label>
                ) : (
                  <label>
                    Line weight
                    <select
                      aria-label="Annotation stroke"
                      value={selected.stroke}
                      onChange={(event) =>
                        onChange(selected.id, {
                          stroke: Number(
                            event.target.value,
                          ) as Annotation["stroke"],
                        })
                      }
                    >
                      <option value="2">Thin</option>
                      <option value="4">Regular</option>
                      <option value="8">Bold</option>
                    </select>
                  </label>
                )}
              </div>
              <div className="annotation-property-grid geometry-grid">
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <label key={key}>
                    {key === "x" || key === "y"
                      ? key.toUpperCase()
                      : key[0].toUpperCase() + key.slice(1)}
                    <span className="number-input">
                      <input
                        aria-label={`Annotation ${key === "x" || key === "y" ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1)}`}
                        type="number"
                        min={key === "x" || key === "y" ? 0 : 2}
                        max="100"
                        step="1"
                        value={Math.round(selected[key] * 100)}
                        onChange={(event) =>
                          changeGeometry(key, Number(event.target.value))
                        }
                      />
                      <span>%</span>
                    </span>
                  </label>
                ))}
              </div>
              {selected.type === "arrow" && (
                <div className="annotation-flips">
                  <button
                    className="secondary-button"
                    aria-label="Flip arrow horizontally"
                    onClick={() =>
                      onChange(selected.id, { flipX: !selected.flipX })
                    }
                  >
                    <FlipHorizontal2 size={14} />
                    Flip X
                  </button>
                  <button
                    className="secondary-button"
                    aria-label="Flip arrow vertically"
                    onClick={() =>
                      onChange(selected.id, { flipY: !selected.flipY })
                    }
                  >
                    <FlipVertical2 size={14} />
                    Flip Y
                  </button>
                </div>
              )}
              <p className="annotation-help">
                Drag to move. Arrow keys nudge 1%; Shift nudges 5%. These marks
                explain your image; they do not redact it.
              </p>
            </div>
          ) : (
            <p className="annotation-help">
              Choose an annotation on the canvas or in the layer list to edit
              it.
            </p>
          )}
        </>
      )}
    </section>
  );
}
