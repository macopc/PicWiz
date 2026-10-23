import { describe, expect, it, vi } from "vitest";
import {
  compositionLayout,
  layoutAnnotationText,
  renderComposition,
} from "../../lib/canvas";
import { DEFAULT_STYLE, SIZES, type SizeId } from "../../lib/domain";
import { createAnnotation } from "../../lib/annotations";

function drawingCanvas() {
  const context = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fillRect: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    rect: vi.fn(),
    strokeRect: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    arc: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  const canvas = { width: 0, height: 0, getContext: () => context };
  return { context, canvas: canvas as unknown as HTMLCanvasElement };
}

describe("composition renderer", () => {
  it("renders the complete screenshot with proportional logical padding and exact export size", () => {
    const { canvas, context } = drawingCanvas();
    const image = {} as CanvasImageSource;
    renderComposition(
      canvas,
      image,
      { width: 1200, height: 600 },
      { ...DEFAULT_STYLE, padding: 100, scale: 2 },
    );
    expect(canvas.width).toBe(3200);
    expect(canvas.height).toBe(1800);
    expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(
      image,
      200,
      200,
      2800,
      1400,
    );
    const preview = drawingCanvas();
    renderComposition(
      preview.canvas,
      image,
      { width: 1200, height: 600 },
      { ...DEFAULT_STYLE, padding: 100 },
      { width: 800, height: 450 },
    );
    expect(preview.context.drawImage).toHaveBeenCalledExactlyOnceWith(
      image,
      50,
      50,
      700,
      350,
    );
  });

  it.each(["none", "browser", "device"] as const)(
    "aspect-fits a portrait screenshot inside a %s frame",
    (frame) => {
      const { canvas, context } = drawingCanvas();
      const source = {} as CanvasImageSource;
      renderComposition(
        canvas,
        source,
        { width: 400, height: 1600 },
        { ...DEFAULT_STYLE, frame, size: "square" },
      );
      const [, x, y, width, height] = context.drawImage.mock
        .calls[0] as unknown as [
        CanvasImageSource,
        number,
        number,
        number,
        number,
      ];
      expect(width / height).toBeCloseTo(0.25);
      expect(x).toBeGreaterThanOrEqual(96 - 1e-9);
      expect(y).toBeGreaterThanOrEqual(96 - 1e-9);
      expect(x + width).toBeLessThanOrEqual(1080 - 96 + 1e-9);
      expect(y + height).toBeLessThanOrEqual(1080 - 96 + 1e-9);
      expect(context.clip).toHaveBeenCalledOnce();
      expect(context.save.mock.calls).toHaveLength(
        context.restore.mock.calls.length,
      );
      if (frame === "browser") expect(context.arc).toHaveBeenCalledTimes(3);
    },
  );

  it("draws a solid empty background without requiring source dimensions", () => {
    const { canvas, context } = drawingCanvas();
    renderComposition(
      canvas,
      null,
      { width: 0, height: 0 },
      { ...DEFAULT_STYLE, background: "paper", size: "portrait" },
    );
    expect(canvas.height).toBe(1350);
    expect(context.fillRect).toHaveBeenCalledExactlyOnceWith(0, 0, 1080, 1350);
    expect(context.createLinearGradient).not.toHaveBeenCalled();
    expect(context.drawImage).not.toHaveBeenCalled();
  });

  it("rejects invalid allocation and image dimensions before drawing", () => {
    const { canvas, context } = drawingCanvas();
    expect(() =>
      renderComposition(canvas, null, { width: 0, height: 0 }, DEFAULT_STYLE, {
        width: 100_000,
        height: 100_000,
      }),
    ).toThrow();
    expect(() =>
      renderComposition(
        canvas,
        {} as CanvasImageSource,
        { width: 0, height: 20 },
        DEFAULT_STYLE,
      ),
    ).toThrow();
    expect(context.fillRect).not.toHaveBeenCalled();
    expect(() =>
      renderComposition(
        { getContext: () => null } as unknown as HTMLCanvasElement,
        null,
        { width: 0, height: 0 },
        DEFAULT_STYLE,
      ),
    ).toThrow("drawing canvas");
  });
});

describe("V2 layout and annotation rendering", () => {
  it("uses base-output pixels for every format and scales the whole layout for preview and 2x", () => {
    for (const size of Object.keys(SIZES) as SizeId[]) {
      for (const frame of ["none", "browser", "device"] as const) {
        const style = {
          ...DEFAULT_STYLE,
          size,
          frame,
          padding: 80,
          radius: 16,
        };
        const one = compositionLayout({ width: 1200, height: 800 }, style);
        const two = compositionLayout(
          { width: 1200, height: 800 },
          { ...style, scale: 2 },
        );
        const previewScale = size === "linkedin" ? 1 / 3 : 1 / 2;
        const preview = compositionLayout({ width: 1200, height: 800 }, style, {
          width: one.width * previewScale,
          height: one.height * previewScale,
        });
        expect(one.unit).toBe(1);
        expect(two.unit).toBe(2);
        expect(preview.unit).toBe(previewScale);
        expect(one.radius).toBe(16);
        expect(one.frameRect.x).toBeGreaterThanOrEqual(80 - 1e-9);
        expect(one.frameRect.y).toBeGreaterThanOrEqual(80 - 1e-9);
        expect(one.imageRect.width / one.imageRect.height).toBeCloseTo(1.5);
        for (const rect of ["imageRect", "frameRect"] as const)
          for (const field of ["x", "y", "width", "height"] as const) {
            expect(two[rect][field]).toBeCloseTo(one[rect][field] * 2);
            expect(preview[rect][field]).toBeCloseTo(
              one[rect][field] * previewScale,
            );
          }
        expect(one.top).toBe(
          frame === "browser" ? 44 : frame === "device" ? 30 : 0,
        );
        expect(one.border).toBe(
          frame === "browser" ? 1 : frame === "device" ? 10 : 0,
        );
        expect(one.bottom).toBe(
          frame === "browser" ? 1 : frame === "device" ? 16 : 0,
        );
      }
    }
  });
  it("clips annotations inside the screenshot and text inside its own box, with three rendered lines", () => {
    const { canvas, context } = drawingCanvas();
    const text = {
      ...createAnnotation("text", "text"),
      text: "one two three four five six seven eight nine",
      width: 0.08,
      height: 0.02,
    };
    const rectangle = createAnnotation("rectangle", "rectangle");
    const arrow = {
      ...createAnnotation("arrow", "arrow"),
      flipX: true,
      flipY: true,
    };
    const style = {
      ...DEFAULT_STYLE,
      frame: "browser" as const,
      size: "square" as const,
    };
    const layout = compositionLayout({ width: 1200, height: 800 }, style);
    renderComposition(
      canvas,
      {} as CanvasImageSource,
      { width: 1200, height: 800 },
      style,
      undefined,
      [rectangle, arrow, text],
    );
    expect(context.clip).toHaveBeenCalledTimes(3); // frame, screenshot annotation clip, text box
    expect(context.rect).toHaveBeenNthCalledWith(
      1,
      layout.imageRect.x,
      layout.imageRect.y,
      layout.imageRect.width,
      layout.imageRect.height,
    );
    expect(context.rect).toHaveBeenNthCalledWith(
      2,
      layout.imageRect.x + text.x * layout.imageRect.width,
      layout.imageRect.y + text.y * layout.imageRect.height,
      text.width * layout.imageRect.width,
      text.height * layout.imageRect.height,
    );
    expect(context.fillText.mock.calls).toHaveLength(3);
    const first = context.fillText.mock.calls[0],
      second = context.fillText.mock.calls[1];
    expect(second[2] - first[2]).toBeCloseTo(
      text.fontSize * layout.imageRect.width * 1.25,
    );
    const metrics = context as unknown as CanvasRenderingContext2D;
    expect(metrics.lineWidth).toBeCloseTo((4 * layout.imageRect.width) / 1600);
    expect(metrics.font).toBe(
      `${text.fontSize * layout.imageRect.width}px Arial, Helvetica, sans-serif`,
    );
    expect(metrics.shadowColor).toBe(
      `rgba(9, 6, 25, ${(style.shadow / 100) * 0.55})`,
    );
    expect(metrics.shadowBlur).toBeCloseTo(style.shadow * 0.7);
    expect(metrics.shadowOffsetY).toBeCloseTo(style.shadow * 0.28);
    expect(context.strokeRect).toHaveBeenCalledOnce();
    expect(context.stroke).toHaveBeenCalledOnce();
    expect(context.drawImage.mock.invocationCallOrder[0]).toBeLessThan(
      context.strokeRect.mock.invocationCallOrder[0],
    );
    expect(context.stroke.mock.invocationCallOrder[0]).toBeLessThan(
      context.arc.mock.invocationCallOrder[0],
    );
    expect(context.save.mock.calls.length).toBe(
      context.restore.mock.calls.length,
    );
  });
  it("splits long words and explicit lines without exceeding three lines", () => {
    const context = {
      measureText: (text: string) => ({ width: text.length * 10 }),
    };
    expect(
      layoutAnnotationText(
        context as CanvasRenderingContext2D,
        "abcdefghijk",
        30,
      ),
    ).toEqual(["abc", "def", "ghi"]);
    expect(
      layoutAnnotationText(
        context as CanvasRenderingContext2D,
        "a\nb\nc\nd",
        100,
      ),
    ).toEqual(["a", "b", "c"]);
    expect(
      layoutAnnotationText(
        context as CanvasRenderingContext2D,
        "one two three",
        70,
      ),
    ).toEqual(["one two", "three"]);
    expect(
      layoutAnnotationText(context as CanvasRenderingContext2D, "x", 0),
    ).toEqual([]);
  });
});
