import { describe, expect, it } from "vitest";
import {
  AppError,
  BACKGROUNDS,
  DEFAULT_STYLE,
  dimensions,
  normalizeStyle,
  SIZES,
} from "../../lib/domain";

describe("style boundary", () => {
  it("provides independent defaults and rejects untrusted background values", () => {
    const style = normalizeStyle({
      background: "url(https://example.com/image)",
      frame: "custom",
      appearance: "system",
      size: "infinite",
      scale: 8,
    });
    expect(style).toEqual(DEFAULT_STYLE);
    style.padding = 0;
    expect(DEFAULT_STYLE.padding).toBe(96);
    expect(normalizeStyle(null)).toEqual(DEFAULT_STYLE);
  });

  it("clamps and rounds finite controls while replacing nonfinite input", () => {
    expect(
      normalizeStyle({ padding: 300, radius: -12, shadow: 26.7 }),
    ).toMatchObject({ padding: 200, radius: 0, shadow: 27 });
    expect(
      normalizeStyle({ padding: NaN, radius: Infinity, shadow: "80" }),
    ).toEqual(DEFAULT_STYLE);
    expect(
      normalizeStyle({ padding: 0, radius: 48, shadow: 100, scale: 2 }),
    ).toMatchObject({ padding: 0, radius: 48, shadow: 100, scale: 2 });
  });

  it("normalizes idempotently and only exposes bounded output sizes", () => {
    for (const size of Object.keys(SIZES) as (keyof typeof SIZES)[]) {
      for (const scale of [1, 2] as const) {
        const style = normalizeStyle({
          size,
          scale,
          padding: 47.8,
          background: "ocean",
        });
        expect(normalizeStyle(style)).toEqual(style);
        expect(dimensions(style)).toEqual({
          width: SIZES[size].width * scale,
          height: SIZES[size].height * scale,
        });
      }
    }
    expect(SIZES).toMatchObject({
      landscape: { width: 1600, height: 900 },
      square: { width: 1080, height: 1080 },
      portrait: { width: 1080, height: 1350 },
    });
    expect(new Set(BACKGROUNDS.map((background) => background.id)).size).toBe(
      BACKGROUNDS.length,
    );
  });

  it("exposes stable error codes alongside user-facing messages", () => {
    const error = new AppError("image_size", "Choose a smaller image.");
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "AppError",
      code: "image_size",
      message: "Choose a smaller image.",
    });
  });
});
