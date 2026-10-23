export type Style = {
  background: string;
  padding: number;
  radius: number;
  shadow: number;
  frame: "none" | "browser" | "device";
  appearance: "light" | "dark";
  size: "landscape" | "square" | "portrait";
  scale: 1 | 2;
};

type Background = {
  id: string;
  name: string;
  kind: "gradient" | "solid";
  colors: string[];
  angle?: number;
};

export const BACKGROUNDS: Background[] = [
  {
    id: "violet",
    name: "Violet",
    kind: "gradient",
    colors: ["#b9a1ff", "#7950d9", "#403081"],
    angle: 135,
  },
  {
    id: "sunset",
    name: "Sunset",
    kind: "gradient",
    colors: ["#ffd6a5", "#ff8f9c", "#b56be2"],
    angle: 135,
  },
  {
    id: "ocean",
    name: "Ocean",
    kind: "gradient",
    colors: ["#9ce7ed", "#58a8e8", "#5362b7"],
    angle: 135,
  },
  {
    id: "mint",
    name: "Mint",
    kind: "gradient",
    colors: ["#dcf5d3", "#93d6bb", "#398b8c"],
    angle: 135,
  },
  {
    id: "rose",
    name: "Rose",
    kind: "gradient",
    colors: ["#ffe0e8", "#e7a1c3", "#aa82c9"],
    angle: 135,
  },
  {
    id: "midnight",
    name: "Midnight",
    kind: "gradient",
    colors: ["#3b436b", "#202338", "#10131f"],
    angle: 135,
  },
  { id: "paper", name: "Paper", kind: "solid", colors: ["#f2f0f7"] },
  { id: "ink", name: "Ink", kind: "solid", colors: ["#23212b"] },
];

export const SIZES = {
  landscape: { width: 1600, height: 900, label: "Landscape" },
  square: { width: 1080, height: 1080, label: "Square" },
  portrait: { width: 1080, height: 1350, label: "Portrait" },
} as const;

export const DEFAULT_STYLE: Style = {
  background: "violet",
  padding: 96,
  radius: 12,
  shadow: 36,
  frame: "none",
  appearance: "light",
  size: "landscape",
  scale: 1,
};

export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

function integer(value: unknown, fallback: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.round(value)))
    : fallback;
}

export function normalizeStyle(value: unknown = {}): Style {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    background: BACKGROUNDS.some(({ id }) => id === input.background)
      ? (input.background as string)
      : DEFAULT_STYLE.background,
    padding: integer(input.padding, DEFAULT_STYLE.padding, 200),
    radius: integer(input.radius, DEFAULT_STYLE.radius, 48),
    shadow: integer(input.shadow, DEFAULT_STYLE.shadow, 100),
    frame:
      input.frame === "browser" || input.frame === "device"
        ? input.frame
        : "none",
    appearance: input.appearance === "dark" ? "dark" : "light",
    size:
      input.size === "square" || input.size === "portrait"
        ? input.size
        : "landscape",
    scale: input.scale === 2 ? 2 : 1,
  };
}

export function dimensions(style: Style): { width: number; height: number } {
  const normalized = normalizeStyle(style);
  const size = SIZES[normalized.size];
  return {
    width: size.width * normalized.scale,
    height: size.height * normalized.scale,
  };
}
