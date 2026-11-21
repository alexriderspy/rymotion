// The taste lives here. The model only ever picks names from these tables;
// every pixel, millisecond and easing curve comes from this file.

export const FORMATS = {
  "16:9": { width: 1920, height: 1080, safe: { x: 0.07, top: 0.09, bottom: 0.09 } },
  "9:16": { width: 1080, height: 1920, safe: { x: 0.08, top: 0.13, bottom: 0.2 } },
  "1:1": { width: 1080, height: 1080, safe: { x: 0.08, top: 0.08, bottom: 0.08 } },
  "4:5": { width: 1080, height: 1350, safe: { x: 0.08, top: 0.08, bottom: 0.1 } },
} as const;
export type FormatName = keyof typeof FORMATS;

export interface Palette {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  // Text drawn on top of an accent fill.
  onAccent: string;
  glow: string;
  // Flat palettes: every beat sits on its own colour field, taken in turn.
  // All fields share ink, so text reads on each one.
  fields?: string[];
  description: string;
}

export const PALETTES: Record<string, Palette> = {
  "cobalt-glyph": {
    bg: "#1838c4", surface: "#1430a8", ink: "#ffffff", muted: "#c9d3ff",
    accent: "#ffffff", onAccent: "#1838c4", glow: "transparent",
    description: "saturated cobalt with drifting character clouds, white type; data, science, AI labs, launches",
  },
  "studio-dark": {
    bg: "#0c0c0e", surface: "#17171a", ink: "#f3f2ef", muted: "#9d9c98",
    accent: "#7ef0a0", onAccent: "#0c0c0e", glow: "transparent",
    description: "near-black product UI with hairline panels and a mint accent; apps, dashboards, developer tools, health and money",
  },
  "paper-serif": {
    bg: "#f2ede3", surface: "#fbf8f2", ink: "#171513", muted: "#5e5850",
    accent: "#c2381b", onAccent: "#fbf8f2", glow: "transparent",
    description: "warm paper with grain and a vermilion accent; editorial, essays, brands, food, culture",
  },
  "dither-noir": {
    bg: "#0b0b0b", surface: "#161616", ink: "#f4f1ea", muted: "#9b978f",
    accent: "#ff5533", onAccent: "#0b0b0b", glow: "transparent",
    description: "black with dot-matrix texture and one hot coral accent; security, privacy, bold claims, tech launches",
  },
  "pastel-pop": {
    bg: "#e6f5a8", surface: "#ffffff", ink: "#111111", muted: "#4a4a45",
    accent: "#111111", onAccent: "#ffffff", glow: "transparent",
    fields: ["#e6f5a8", "#d8d3ea", "#cfe3f5", "#f4ecdd", "#ffd8c7"],
    description: "flat pastel colour fields that change every scene, black ink; product demos, launches, friendly explainers",
  },
  "sorbet": {
    bg: "#ffe6a1", surface: "#ffffff", ink: "#1b1530", muted: "#4f4766",
    accent: "#c93412", onAccent: "#ffffff", glow: "transparent",
    fields: ["#ffe6a1", "#ffcfdb", "#c8efdf", "#e0dbff"],
    description: "warm flat sorbet fields with a coral accent; playful, social, lifestyle",
  },
  "night-studio": {
    bg: "#121212", surface: "#1f1f22", ink: "#f5f3ee", muted: "#9b9a96",
    accent: "#d4ff3f", onAccent: "#121212", glow: "transparent",
    fields: ["#121212", "#1a1d2b", "#221a26", "#15211c"],
    description: "flat deep fields that shift hue every scene, lime accent; developer tools, AI, night mood",
  },
  "midnight-lime": {
    bg: "#0b0d10", surface: "#16191f", ink: "#f4f1ea", muted: "#8a8f98",
    accent: "#c6f432", onAccent: "#0b0d10", glow: "#c6f43233",
    description: "near-black with acid lime; edgy launches, hype, showreels",
  },
  "paper-ink": {
    bg: "#f3efe6", surface: "#e8e2d4", ink: "#141414", muted: "#5f5b55",
    accent: "#d4351c", onAccent: "#fbf8f2", glow: "#d4351c22",
    description: "warm paper with red ink; editorial, essays, explainers",
  },
  "electric-blue": {
    bg: "#070b24", surface: "#111840", ink: "#ffffff", muted: "#8e97c7",
    accent: "#3d6bff", onAccent: "#ffffff", glow: "#3d6bff40",
    description: "deep navy with electric blue; AI products, startups, corporate-but-cool",
  },
  "sunset-ember": {
    bg: "#160d09", surface: "#24150e", ink: "#fff3e6", muted: "#b39a88",
    accent: "#ff7a3d", onAccent: "#160d09", glow: "#ff7a3d33",
    description: "dark warm brown with orange; storytelling, lifestyle, emotional",
  },
  "mono-noir": {
    bg: "#000000", surface: "#141414", ink: "#ffffff", muted: "#8c8c8c",
    accent: "#ffffff", onAccent: "#000000", glow: "#ffffff1f",
    description: "pure black and white; minimal, luxury, serious",
  },
  "ultraviolet": {
    bg: "#110b1f", surface: "#1d1433", ink: "#f3eeff", muted: "#a497c4",
    accent: "#b98cff", onAccent: "#110b1f", glow: "#b98cff33",
    description: "deep violet with lavender; developer tools, crypto, futuristic, music",
  },
  "graphite-orange": {
    bg: "#121212", surface: "#1e1e1e", ink: "#f2f2f2", muted: "#9a9a9a",
    accent: "#ff6a1a", onAccent: "#121212", glow: "#ff6a1a2e",
    description: "graphite with safety orange; engineering, systems, trading, hardware",
  },
  "arctic": {
    bg: "#f4f7fb", surface: "#e6ecf5", ink: "#0b1220", muted: "#56627a",
    accent: "#2457e6", onAccent: "#ffffff", glow: "#2457e61f",
    description: "bright white with cobalt; clean explainers, SaaS, docs, teaching",
  },
  "mint-cream": {
    bg: "#eaf4ee", surface: "#d9ece0", ink: "#0e2a1f", muted: "#4a6a5b",
    accent: "#0a7f56", onAccent: "#ffffff", glow: "#0a7f5622",
    description: "soft mint with deep green; health, finance, calm education",
  },
};

export interface TypeFace {
  family: string;
  file: string;
  weight: number;
  style?: "italic";
}

export interface TypePair {
  display: TypeFace;
  body: TypeFace;
  // Big type is set tight; condensed capitals need none.
  displayTracking: string;
  // Condensed display faces are designed for capitals.
  upper?: boolean;
  description: string;
}

// One quiet family carries every small word in every video; only the
// headline face changes with the mood.
export const BODY: TypeFace = { family: "Geist", file: "geist-latin-500-normal.woff2", weight: 500 };
export const BODY_STRONG: TypeFace = { family: "Geist", file: "geist-latin-700-normal.woff2", weight: 700 };
export const MONO: TypeFace = { family: "Geist Mono", file: "geist-mono-latin-500-normal.woff2", weight: 500 };
export const QUOTE_MARK: TypeFace = { family: "Instrument Serif", file: "instrument-serif-latin-400-italic.woff2", weight: 400, style: "italic" };

export const TYPE_PAIRS: Record<string, TypePair> = {
  modern: {
    display: { family: "Geist", file: "geist-latin-800-normal.woff2", weight: 800 },
    body: BODY,
    displayTracking: "-0.05em",
    description: "tight heavy sans; clean, confident, tech and explainers",
  },
  punchy: {
    display: { family: "Anton", file: "anton-latin-400-normal.woff2", weight: 400 },
    body: BODY,
    displayTracking: "0em",
    upper: true,
    description: "tall condensed capitals; hype, sports, social-first, bold claims",
  },
  wide: {
    display: { family: "Unbounded", file: "unbounded-latin-700-normal.woff2", weight: 700 },
    body: BODY,
    displayTracking: "-0.03em",
    description: "wide rounded sans; futuristic, crypto, gaming, launches",
  },
  friendly: {
    display: { family: "Geist", file: "geist-latin-600-normal.woff2", weight: 600 },
    body: BODY,
    displayTracking: "-0.045em",
    description: "semi-bold tight sans; friendly product voice, apps, demos",
  },
  serif: {
    display: { family: "Instrument Serif", file: "instrument-serif-latin-400-normal.woff2", weight: 400 },
    body: BODY,
    displayTracking: "-0.02em",
    description: "upright display serif; editorial, premium, brands, culture",
  },
  light: {
    display: { family: "Geist", file: "geist-latin-300-normal.woff2", weight: 300 },
    body: BODY,
    displayTracking: "-0.05em",
    description: "light, large and calm sans; dashboards, numbers, quiet products",
  },
  editorial: {
    display: QUOTE_MARK,
    body: BODY,
    displayTracking: "-0.01em",
    description: "elegant italic serif; essays, stories, food, culture, quotes",
  },
};

export const FONT_SOURCES: Record<string, string> = {
  "Geist": "@fontsource/geist",
  "Geist Mono": "@fontsource/geist-mono",
  "Anton": "@fontsource/anton",
  "Unbounded": "@fontsource/unbounded",
  "Instrument Serif": "@fontsource/instrument-serif",
};

// A template is a whole look: palette, type, background and frame chrome
// chosen together so they work as one design. Each takes its cue from a
// different design language (see README credits).
export interface Template {
  palette: string;
  type: string;
  background: "glow" | "grid" | "dots" | "plain" | "glyph" | "halftone" | "grain" | "hairline";
  // Small mono labels in the corners: the title and a beat counter.
  frame: boolean;
  description: string;
}

export const TEMPLATES: Record<string, Template> = {
  pastel: { palette: "pastel-pop", type: "friendly", background: "plain", frame: false,
    description: "flat pastel colour fields that change every scene; friendly products, apps, ads, explainers" },
  glyph: { palette: "cobalt-glyph", type: "modern", background: "glyph", frame: true,
    description: "cobalt blue with drifting clouds of characters and mono corner labels; AI, data, labs, research, launches" },
  studio: { palette: "studio-dark", type: "light", background: "hairline", frame: true,
    description: "dark product UI, hairline grid, big calm numbers; apps, dashboards, developer tools, health, finance" },
  editorial: { palette: "paper-serif", type: "serif", background: "grain", frame: true,
    description: "paper grain and a large upright serif; brands, food, cafes, culture, essays, premium" },
  dither: { palette: "dither-noir", type: "modern", background: "halftone", frame: true,
    description: "black with a rippling dot matrix and one hot accent; security, privacy, bold claims, tech" },
  night: { palette: "night-studio", type: "modern", background: "plain", frame: false,
    description: "deep fields shifting hue every scene with a lime accent; developer tools, night mood" },
};

export interface Energy {
  ease: string;
  // Hero entrance length; supporting elements derive from it.
  enter: number;
  stagger: number;
  exit: number;
  // Distance (in px at 1080 short side) elements travel on entry.
  travel: number;
  description: string;
}

export const ENERGIES: Record<string, Energy> = {
  calm: { ease: "sine.out", enter: 1.1, stagger: 0.14, exit: 0.5, travel: 24, description: "slow and soft; reflective, premium" },
  smooth: { ease: "expo.out", enter: 0.9, stagger: 0.09, exit: 0.4, travel: 48, description: "fluid and polished; the safe default" },
  snappy: { ease: "power4.out", enter: 0.55, stagger: 0.06, exit: 0.3, travel: 64, description: "fast and punchy; shorts, hype, launches" },
  bouncy: { ease: "back.out(1.7)", enter: 0.7, stagger: 0.08, exit: 0.3, travel: 56, description: "playful overshoot; fun, casual, kids" },
};

// Type scale as a fraction of the canvas short side.
export const TYPE_SCALE = {
  hero: 0.13,
  display: 0.095,
  headline: 0.07,
  body: 0.042,
  caption: 0.03,
};

// Reading speed used to hold text on screen long enough to read on a phone.
export const WORDS_PER_SECOND = 3.4;
export const MIN_HOLD = 1.1;
export const MAX_BEAT = 9;
