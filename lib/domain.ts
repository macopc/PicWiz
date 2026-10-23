export type Style = {
  background: string;
  padding: number;
  radius: number;
  shadow: number;
  frame: "none" | "browser" | "device";
  appearance: "light" | "dark";
  size: SizeId;
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
  landscape: {
    width: 1600,
    height: 900,
    label: "Landscape",
    description: "Landscape · X composition",
  },
  square: {
    width: 1080,
    height: 1080,
    label: "Square",
    description: "Square · 1:1",
  },
  portrait: {
    width: 1080,
    height: 1350,
    label: "Portrait",
    description: "Portrait · 4:5",
  },
  story: {
    width: 1080,
    height: 1920,
    label: "Story",
    description: "Story · 9:16",
  },
  linkedin: {
    width: 1200,
    height: 627,
    label: "LinkedIn",
    description: "LinkedIn Page link image",
  },
  pinterest: {
    width: 1000,
    height: 1500,
    label: "Pinterest",
    description: "Pinterest standard image ad",
  },
} as const;

export type SizeId = keyof typeof SIZES;
export type Look = Omit<Style, "size" | "scale">;

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
      typeof input.size === "string" && Object.hasOwn(SIZES, input.size)
        ? (input.size as SizeId)
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

/** Output format belongs to the composition, never to a look. */
export function applyLook(current: Style, look: Look | Style): Style {
  return { ...normalizeStyle(look), size: current.size, scale: current.scale };
}

export function lookOf(style: Style): Look {
  const { background, padding, radius, shadow, frame, appearance } =
    normalizeStyle(style);
  return { background, padding, radius, shadow, frame, appearance };
}

export const STARTER_PRESETS: {
  id: string;
  name: string;
  description: string;
  style: Style;
}[] = [
  {
    id: "studio",
    name: "Studio",
    description: "Violet, generous space and a soft shadow",
    style: { ...DEFAULT_STYLE },
  },
  {
    id: "paper",
    name: "Paper",
    description: "A light browser frame on paper",
    style: {
      ...DEFAULT_STYLE,
      background: "paper",
      padding: 80,
      radius: 16,
      shadow: 20,
      frame: "browser",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark browser chrome and a deeper shadow",
    style: {
      ...DEFAULT_STYLE,
      background: "midnight",
      padding: 96,
      radius: 18,
      shadow: 55,
      frame: "browser",
      appearance: "dark",
    },
  },
  {
    id: "mint",
    name: "Mint",
    description: "Fresh green with generous corners",
    style: {
      ...DEFAULT_STYLE,
      background: "mint",
      padding: 112,
      radius: 24,
      shadow: 28,
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "A warm background and a device frame",
    style: {
      ...DEFAULT_STYLE,
      background: "sunset",
      padding: 88,
      radius: 16,
      shadow: 45,
      frame: "device",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool blue with a light browser frame",
    style: {
      ...DEFAULT_STYLE,
      background: "ocean",
      padding: 104,
      radius: 14,
      shadow: 40,
      frame: "browser",
    },
  },
];
