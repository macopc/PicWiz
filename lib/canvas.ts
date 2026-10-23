import {
  AppError,
  BACKGROUNDS,
  dimensions,
  normalizeStyle,
  type Style,
} from "./domain";
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

export function renderComposition(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource | null,
  sourceSize: { width: number; height: number },
  input: Style,
  output?: { width: number; height: number },
): void {
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

    const unit = width / 1600;
    const padding = style.padding * unit;
    const availableWidth = Math.max(1, width - 2 * padding);
    const availableHeight = Math.max(1, height - 2 * padding);
    const border =
      style.frame === "device"
        ? 10 * unit
        : style.frame === "browser"
          ? unit
          : 0;
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
