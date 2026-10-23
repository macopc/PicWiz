import { describe, expect, it, vi } from "vitest";
import { renderComposition } from "../../lib/canvas";
import { DEFAULT_STYLE } from "../../lib/domain";

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
      expect(x).toBeGreaterThanOrEqual(64.8);
      expect(y).toBeGreaterThanOrEqual(64.8);
      expect(x + width).toBeLessThanOrEqual(1080 - 64.8);
      expect(y + height).toBeLessThanOrEqual(1080 - 64.8);
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
