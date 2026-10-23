import { describe, expect, it } from "vitest";
import {
  ANNOTATION_COLORS,
  createAnnotation,
  validateAnnotations,
  moveAnnotation,
  addAnnotation,
  replaceAnnotation,
  createHistory,
  pushHistory,
  undoHistory,
  redoHistory,
} from "../../lib/annotations";

describe("annotation schema and edits", () => {
  it("validates every default, clones records, and rejects hidden or malformed fields", () => {
    for (const type of ["arrow", "rectangle", "text"] as const) {
      const a = createAnnotation(type, type);
      expect(validateAnnotations([a])).toEqual([a]);
      expect(validateAnnotations([a])[0]).not.toBe(a);
      for (const patch of [
        { x: NaN },
        { y: Infinity },
        { width: 0.019 },
        { height: 1.01 },
        { x: 0.9 },
        { y: 0.9 },
        { x: 0.7000000000000002 },
        { color: "red" },
        { stroke: 3 },
        { fontSize: 0.04 },
        { flipX: 0 },
        { flipY: null },
        { extra: "payload" },
        { id: "../bad" },
        { text: "a\nb\nc\nd" },
        { text: "\u0000" },
        { text: "x".repeat(141) },
      ])
        expect(() => validateAnnotations([{ ...a, ...patch }])).toThrow();
      expect(() => validateAnnotations([{ ...a, id: undefined }])).toThrow();
    }
    const shape = createAnnotation("rectangle", "shape");
    expect(() => validateAnnotations([{ ...shape, text: "hidden" }])).toThrow();
    expect(() =>
      validateAnnotations([{ ...shape, fontSize: 0.022 }]),
    ).toThrow();
    expect(ANNOTATION_COLORS).toHaveLength(6);
  });
  it("enforces unique IDs and 30 objects without mutating previous content", () => {
    const a = createAnnotation("arrow", "one");
    expect(() => validateAnnotations([a, a])).toThrow();
    const annotations = Array.from({ length: 30 }, (_, i) =>
      createAnnotation("text", `a-${i}`),
    );
    expect(validateAnnotations(annotations)).toHaveLength(30);
    expect(() => addAnnotation(annotations, a)).toThrow();
    const changed = replaceAnnotation([a], {
      ...a,
      color: ANNOTATION_COLORS[1],
    });
    expect(changed[0].color).toBe(ANNOTATION_COLORS[1]);
    expect(a.color).toBe(ANNOTATION_COLORS[0]);
    expect(() => replaceAnnotation([], a)).toThrow();
  });
  it("clamps moves at each edge and accepts exact screenshot bounds", () => {
    const a = createAnnotation("arrow", "arrow");
    expect(moveAnnotation(a, -100, -100)).toMatchObject({ x: 0, y: 0 });
    const right = moveAnnotation(a, 100, 100);
    expect(right).toMatchObject({ x: 0.7, y: 0.8 });
    expect(validateAnnotations([right])).toEqual([right]);
    expect(a).toMatchObject({ x: 0.2, y: 0.2 });
    expect(() => moveAnnotation(a, NaN, 0)).toThrow();
    expect(
      validateAnnotations([{ ...a, x: 0, y: 0, width: 1, height: 1 }]),
    ).toHaveLength(1);
  });
});

describe("session annotation history", () => {
  it("undoes and redoes independent snapshots, resets redo after an edit, and ignores no-ops", () => {
    const a = createAnnotation("text", "text");
    const first = createHistory([a]);
    a.text = "mutated later";
    expect(first.present[0].text).toBe("Your text");
    const second = pushHistory(first, [
      moveAnnotation(first.present[0], 0.1, 0),
    ]);
    expect(first.past).toEqual([]);
    expect(undoHistory(second).present).toEqual(first.present);
    expect(redoHistory(undoHistory(second)).present).toEqual(second.present);
    expect(pushHistory(second, second.present)).toBe(second);
    const branched = pushHistory(undoHistory(second), []);
    expect(branched.future).toEqual([]);
    expect(redoHistory(branched)).toBe(branched);
  });
  it("retains exactly 50 committed edits and never records preview movement", () => {
    let h = createHistory([createAnnotation("text", "text")]);
    for (let i = 0; i < 60; i++)
      h = pushHistory(h, [{ ...h.present[0], text: `edit ${i}` }]);
    expect(h.past).toHaveLength(50);
    for (let i = 0; i < 50; i++) h = undoHistory(h);
    expect(h.present[0].text).toBe("edit 9");
    expect(undoHistory(h)).toBe(h);
    const preview = moveAnnotation(h.present[0], 0.1, 0);
    expect(preview.x).not.toBe(h.present[0].x);
    expect(h.past).toEqual([]);
    expect(h.future).toHaveLength(50);
  });
});
