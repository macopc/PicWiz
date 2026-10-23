import { AppError } from "./domain";

export const ANNOTATION_COLORS = [
  "#ef6351",
  "#7756dc",
  "#20a589",
  "#2585e6",
  "#23212b",
  "#ffffff",
];
export type Annotation = {
  id: string;
  type: "arrow" | "rectangle" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  stroke: 2 | 4 | 8;
  text: string;
  fontSize: 0.022 | 0.03 | 0.045;
  flipX: boolean;
  flipY: boolean;
};
const KEYS = [
  "id",
  "type",
  "x",
  "y",
  "width",
  "height",
  "color",
  "stroke",
  "text",
  "fontSize",
  "flipX",
  "flipY",
];
const invalid = (): never => {
  throw new AppError(
    "annotation_invalid",
    "Annotations must stay inside the screenshot and use supported text and styles.",
  );
};

export function validateAnnotations(value: unknown): Annotation[] {
  if (!Array.isArray(value) || value.length > 30) return invalid();
  const ids = new Set<string>();
  return value.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).length !== KEYS.length ||
      KEYS.some((key) => !Object.hasOwn(item, key))
    )
      return invalid();
    const a = item as Annotation;
    if (
      typeof a.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(a.id) ||
      ids.has(a.id) ||
      !["arrow", "rectangle", "text"].includes(a.type)
    )
      return invalid();
    if (
      ![a.x, a.y, a.width, a.height].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      ) ||
      a.x < 0 ||
      a.y < 0 ||
      a.x > 1 ||
      a.y > 1 ||
      a.width < 0.02 ||
      a.height < 0.02 ||
      a.width > 1 ||
      a.height > 1 ||
      a.x + a.width > 1 ||
      a.y + a.height > 1
    )
      return invalid();
    if (
      !ANNOTATION_COLORS.includes(a.color) ||
      ![2, 4, 8].includes(a.stroke) ||
      typeof a.flipX !== "boolean" ||
      typeof a.flipY !== "boolean" ||
      typeof a.text !== "string" ||
      a.text.length > 140 ||
      /[\u0000-\u0008\u000b-\u001f\u007f\r]/.test(a.text) ||
      a.text.split("\n").length > 3 ||
      ![0.022, 0.03, 0.045].includes(a.fontSize) ||
      (a.type !== "text" && (a.text !== "" || a.fontSize !== 0.03))
    )
      return invalid();
    ids.add(a.id);
    return { ...a };
  });
}

export function createAnnotation(
  type: Annotation["type"],
  id: string = crypto.randomUUID(),
): Annotation {
  return validateAnnotations([
    {
      id,
      type,
      x: 0.2,
      y: 0.2,
      width: type === "text" ? 0.5 : 0.3,
      height: 0.2,
      color: ANNOTATION_COLORS[0],
      stroke: 4,
      text: type === "text" ? "Your text" : "",
      fontSize: 0.03,
      flipX: false,
      flipY: false,
    },
  ])[0];
}

export function moveAnnotation(
  annotation: Annotation,
  dx: number,
  dy: number,
): Annotation {
  const [a] = validateAnnotations([annotation]);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return invalid();
  return {
    ...a,
    x: Math.max(0, Math.min(1 - a.width, a.x + dx)),
    y: Math.max(0, Math.min(1 - a.height, a.y + dy)),
  };
}

export function addAnnotation(
  annotations: Annotation[],
  annotation: Annotation,
): Annotation[] {
  return validateAnnotations([...annotations, annotation]);
}
export function replaceAnnotation(
  annotations: Annotation[],
  annotation: Annotation,
): Annotation[] {
  if (!annotations.some((a) => a.id === annotation.id)) return invalid();
  return validateAnnotations(
    annotations.map((a) => (a.id === annotation.id ? annotation : a)),
  );
}

export type AnnotationHistory = {
  past: Annotation[][];
  present: Annotation[];
  future: Annotation[][];
};
export function createHistory(initial: Annotation[] = []): AnnotationHistory {
  return { past: [], present: validateAnnotations(initial), future: [] };
}
export function pushHistory(
  history: AnnotationHistory,
  next: Annotation[],
): AnnotationHistory {
  const present = validateAnnotations(next);
  if (JSON.stringify(present) === JSON.stringify(history.present))
    return history;
  return {
    past: [...history.past, validateAnnotations(history.present)].slice(-50),
    present,
    future: [],
  };
}
export function undoHistory(history: AnnotationHistory): AnnotationHistory {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: validateAnnotations(history.past.at(-1)),
    future: [validateAnnotations(history.present), ...history.future].slice(
      0,
      50,
    ),
  };
}
export function redoHistory(history: AnnotationHistory): AnnotationHistory {
  if (!history.future.length) return history;
  return {
    past: [...history.past, validateAnnotations(history.present)].slice(-50),
    present: validateAnnotations(history.future[0]),
    future: history.future.slice(1),
  };
}
