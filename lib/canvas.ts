import {
  AppError,
  BACKGROUNDS,
  dimensions,
  normalizeStyle,
  SIZES,
  type Style,
} from "./domain";
import { validateAnnotations, type Annotation } from "./annotations";
import { validDimensions } from "./image-format";

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(Math.max(0, radius), width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

export type Rect = { x: number; y: number; width: number; height: number };
export type CompositionLayout = {
  width: number;
  height: number;
  unit: number;
  imageRect: Rect;
  frameRect: Rect;
  radius: number;
  top: number;
  border: number;
  bottom: number;
};

export function compositionLayout(
  sourceSize: { width: number; height: number },
  input: Style,
  output?: { width: number; height: number },
): CompositionLayout {
  const style = normalizeStyle(input);
  const { width, height } = output ?? dimensions(style);
  if (!validDimensions(width, height))
    throw new AppError(
      "canvas_dimensions",
      "The canvas dimensions exceed browser limits.",
    );
  if (!validDimensions(sourceSize.width, sourceSize.height))
    throw new AppError(
      "image_dimensions",
      "The screenshot dimensions are invalid.",
    );
  const unit = width / SIZES[style.size].width;
  const padding = style.padding * unit;
  const availableWidth = Math.max(1, width - 2 * padding);
  const availableHeight = Math.max(1, height - 2 * padding);
  const border =
    style.frame === "device" ? 10 * unit : style.frame === "browser" ? unit : 0;
  const top =
    style.frame === "browser"
      ? 44 * unit
      : style.frame === "device"
        ? 30 * unit
        : 0;
  const bottom = style.frame === "device" ? 16 * unit : border;
  const fit = Math.min(
    Math.max(unit, availableWidth - border * 2) / sourceSize.width,
    Math.max(unit, availableHeight - top - bottom) / sourceSize.height,
  );
  const imageWidth = sourceSize.width * fit;
  const imageHeight = sourceSize.height * fit;
  const frameWidth = imageWidth + border * 2;
  const frameHeight = imageHeight + top + bottom;
  const x = (width - frameWidth) / 2;
  const y = (height - frameHeight) / 2;
  const radius = style.radius * unit;

  return {
    width,
    height,
    unit,
    imageRect: {
      x: x + border,
      y: y + top,
      width: imageWidth,
      height: imageHeight,
    },
    frameRect: { x, y, width: frameWidth, height: frameHeight },
    radius,
    top,
    border,
    bottom,
  };
}

/** Wrap explicit lines, words and long tokens, while bounding work and rendered lines. */
export function layoutAnnotationText(
  context: Pick<CanvasRenderingContext2D, "measureText">,
  text: string,
  width: number,
): string[] {
  if (!Number.isFinite(width) || width <= 0) return [];
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= width) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
        if (lines.length >= 3) return lines;
      }
      for (const character of Array.from(word)) {
        if (line && context.measureText(line + character).width > width) {
          lines.push(line);
          line = "";
          if (lines.length >= 3) return lines;
        }
        line += character;
      }
    }
    lines.push(line);
    if (lines.length >= 3) return lines;
  }
  return lines;
}

function drawAnnotations(
  context: CanvasRenderingContext2D,
  imageRect: Rect,
  annotations: Annotation[],
): void {
  if (!annotations.length) return;
  context.save();
  context.beginPath();
  context.rect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
  context.clip();
  for (const a of annotations) {
    const x = imageRect.x + a.x * imageRect.width,
      y = imageRect.y + a.y * imageRect.height;
    const width = a.width * imageRect.width,
      height = a.height * imageRect.height;
    context.strokeStyle = a.color;
    context.fillStyle = a.color;
    context.lineWidth = (a.stroke * imageRect.width) / 1600;
    context.lineCap = "round";
    context.lineJoin = "round";
    if (a.type === "rectangle") {
      context.strokeRect(x, y, width, height);
    } else if (a.type === "arrow") {
      const fromX = a.flipX ? x + width : x,
        toX = a.flipX ? x : x + width;
      const fromY = a.flipY ? y : y + height,
        toY = a.flipY ? y + height : y;
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const head = Math.min(
        Math.hypot(width, height) * 0.4,
        Math.max(context.lineWidth * 4, imageRect.width * 0.012),
      );
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      context.moveTo(
        toX - head * Math.cos(angle - Math.PI / 6),
        toY - head * Math.sin(angle - Math.PI / 6),
      );
      context.lineTo(toX, toY);
      context.lineTo(
        toX - head * Math.cos(angle + Math.PI / 6),
        toY - head * Math.sin(angle + Math.PI / 6),
      );
      context.stroke();
    } else {
      context.save();
      context.beginPath();
      context.rect(x, y, width, height);
      context.clip();
      const fontSize = a.fontSize * imageRect.width;
      context.font = `${fontSize}px Arial, Helvetica, sans-serif`;
      context.textBaseline = "top";
      context.textAlign = "left";
      layoutAnnotationText(context, a.text, width).forEach((line, index) =>
        context.fillText(line, x, y + index * fontSize * 1.25),
      );
      context.restore();
    }
  }
  context.restore();
}

export function renderComposition(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource | null,
  sourceSize: { width: number; height: number },
  input: Style,
  output?: { width: number; height: number },
  annotations: Annotation[] = [],
): void {
  const validAnnotations = validateAnnotations(annotations);
  const style = normalizeStyle(input);
  const { width, height } = output ?? dimensions(style);
  if (!validDimensions(width, height))
    throw new AppError(
      "canvas_dimensions",
      "The canvas dimensions exceed browser limits.",
    );
  if (source && !validDimensions(sourceSize.width, sourceSize.height))
    throw new AppError(
      "image_dimensions",
      "The screenshot dimensions are invalid.",
    );
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context)
    throw new AppError(
      "canvas_unavailable",
      "This browser could not create a drawing canvas.",
    );
  try {
    const background = BACKGROUNDS.find(
      (value) => value.id === style.background,
    )!;
    if (background.kind === "solid") {
      context.fillStyle = background.colors[0];
    } else {
      const radians = ((background.angle ?? 135) * Math.PI) / 180;
      const dx = Math.sin(radians);
      const dy = -Math.cos(radians);
      const length = Math.abs(width * dx) + Math.abs(height * dy);
      const gradient = context.createLinearGradient(
        width / 2 - (dx * length) / 2,
        height / 2 - (dy * length) / 2,
        width / 2 + (dx * length) / 2,
        height / 2 + (dy * length) / 2,
      );
      background.colors.forEach((color, index) =>
        gradient.addColorStop(index / (background.colors.length - 1), color),
      );
      context.fillStyle = gradient;
    }
    context.fillRect(0, 0, width, height);
    if (!source) return;

    const { unit, imageRect, frameRect, radius, top, border } =
      compositionLayout(sourceSize, style, { width, height });
    const { x, y, width: frameWidth, height: frameHeight } = frameRect;
    const { width: imageWidth, height: imageHeight } = imageRect;
    const dark = style.appearance === "dark";
    const surface =
      style.frame === "device"
        ? dark
          ? "#121217"
          : "#f8f8fc"
        : dark
          ? "#292832"
          : "#f7f6fb";

    context.save();
    context.shadowColor = `rgba(9, 6, 25, ${(style.shadow / 100) * 0.55})`;
    context.shadowBlur = style.shadow * 0.7 * unit;
    context.shadowOffsetY = style.shadow * 0.28 * unit;
    context.fillStyle = surface;
    roundedRect(context, x, y, frameWidth, frameHeight, radius);
    context.fill();
    context.restore();

    context.save();
    roundedRect(context, x, y, frameWidth, frameHeight, radius);
    context.clip();
    context.fillStyle = surface;
    context.fillRect(x, y, frameWidth, frameHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, x + border, y + top, imageWidth, imageHeight);
    drawAnnotations(context, imageRect, validAnnotations);
    if (style.frame === "browser") {
      context.fillStyle = dark ? "#383743" : "#e8e6ee";
      context.fillRect(x, y + top - unit, frameWidth, unit);
      ["#ff6058", "#ffbd2e", "#28c840"].forEach((color, index) => {
        context.beginPath();
        context.fillStyle = color;
        context.arc(
          x + (20 + index * 18) * unit,
          y + top / 2,
          5 * unit,
          0,
          Math.PI * 2,
        );
        context.fill();
      });
      context.fillStyle = dark ? "#454450" : "#e5e3ed";
      const addressWidth = Math.min(frameWidth * 0.46, 420 * unit);
      // Very narrow screenshots still show traffic lights without an overlapping address bar.
      if (frameWidth > 210 * unit) {
        roundedRect(
          context,
          x + (frameWidth - addressWidth) / 2,
          y + 12 * unit,
          addressWidth,
          20 * unit,
          5 * unit,
        );
        context.fill();
      }
    } else if (style.frame === "device") {
      context.fillStyle = dark ? "#050508" : "#c6c4cf";
      roundedRect(
        context,
        x + frameWidth / 2 - Math.min(22 * unit, frameWidth / 5),
        y + 12 * unit,
        Math.min(44 * unit, frameWidth * 0.4),
        5 * unit,
        2.5 * unit,
      );
      context.fill();
    }
    context.restore();
  } catch {
    throw new AppError(
      "render_failed",
      "The browser could not draw this screenshot. Try importing it again.",
    );
  }
}
