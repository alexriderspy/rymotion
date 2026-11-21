import type { Beat, Spec } from "./spec.ts";
import { ENERGIES, MIN_HOLD, WORDS_PER_SECOND, type Energy } from "./tokens.ts";

// Rhythm is computed, never chosen by the model: entrance time from the
// scene's choreography, hold time from how long the words take to read.

const wc = (s?: string) => (s ? s.trim().split(/\s+/).filter(Boolean).length : 0);

export function readingWords(b: Beat): number {
  switch (b.scene) {
    case "title": return wc(b.text) + wc(b.kicker);
    case "statement": return wc(b.text);
    case "stat": return 1 + wc(b.label);
    case "list": return wc(b.title) + b.items.reduce((n, it) => n + wc(it), 0);
    case "quote": return wc(b.text) + wc(b.author);
    case "compare": return wc(b.title) + wc(b.left.label) + wc(b.right.label) + wc(b.left.value) + wc(b.right.value);
    case "bars": return wc(b.title) + b.bars.reduce((n, x) => n + wc(x.label) + 1, 0);
    // Code is skimmed, not read word by word.
    case "code": return Math.ceil(b.lines.join(" ").length / 12);
    case "end": return wc(b.text) + wc(b.cta);
    case "flow": return wc(b.title) + b.nodes.reduce((n, x) => n + wc(x), 0) + wc(b.caption);
    case "steps": return wc(b.title) + b.steps.reduce((n, x) => n + wc(x), 0);
    case "custom": return 0;
    case "kinetic": return wc(b.text) + wc(b.sub);
    // Chat and app scenes are read as they play; their intro covers it.
    case "chat": return wc(b.title);
    case "app": return wc(b.title);
    case "columns": return wc(b.title) + b.items.reduce((n, it) => n + wc(it.label) + wc(it.note), 0);
    case "media": return wc(b.title) + wc(b.label);
    case "collage": return wc(b.title) + b.cards.reduce((n, x) => n + wc(x.label), 0);
    case "logo": return wc(b.name) + wc(b.sub);
  }
}

// A media beat: the device lands, extra pictures step through, then the
// camera pushes toward the focus and the label pins on.
export function mediaTimes(b: Extract<Beat, { scene: "media" }>) {
  const frames = (b.then ?? []).map((_, i) => 1.3 + i * 1.5);
  const zoomAt = frames.length ? frames[frames.length - 1] + 0.9 : 1.15;
  const zoom = (b.zoom ?? 1.5) > 1.02 ? 1.5 : 0;
  const label = zoomAt + Math.max(0.3, zoom * 0.7);
  return { frames, zoomAt, zoom: zoom || 0.01, label, end: label + (b.label ? 0.7 : 0.2) };
}

const chars = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim().length;

// When each chat message appears, in seconds from the start of the beat.
// A reply is preceded by a typing indicator; each message stays alone long
// enough to read before the next one lands.
export function chatTimes(b: Extract<Beat, { scene: "chat" }>): { show: number[]; typing: number; end: number } {
  const typing = 0.75;
  let t = 0.9;
  const show = b.messages.map((m) => {
    if (m.from === "them") t += typing;
    const at = t;
    t += 0.3 + wc(m.text) / 4.5;
    return at;
  });
  return { show, typing, end: t };
}

// Key moments of an app demo: typing, the cursor's travel, the click, the result.
export function appTimes(b: Extract<Beat, { scene: "app" }>) {
  const typeStart = 0.75;
  const typeEnd = typeStart + Math.min(1.8, Math.max(0.3, chars(b.input) * 0.045));
  const move = 0.85;
  const click = typeEnd + 0.25 + move;
  const result = click + 0.95;
  return { typeStart, typeEnd, move, click, result, end: result + 0.9 };
}

export const countDuration = (e: Energy) => Math.max(1.2, e.enter * 1.8);

export function introTime(b: Beat, e: Energy): number {
  switch (b.scene) {
    case "title": return 0.15 + wc(b.text) * e.stagger + e.enter;
    case "statement": return wc(b.text) * e.stagger * 0.6 + e.enter + (b.highlight ? 0.5 : 0);
    case "stat": return countDuration(e) + 0.35;
    case "list": return 0.25 + b.items.length * e.stagger * 3 + e.enter;
    case "quote": return e.enter + 0.45;
    case "compare": return e.enter + 0.7;
    case "bars": return 0.2 + b.bars.length * e.stagger * 2 + 1.0;
    case "code": return 0.4 + b.lines.length * 0.32;
    case "end": return e.enter + 0.45;
    case "flow": return 0.25 + b.nodes.length * flowGap(e) + 0.4;
    case "steps": return 0.3 + b.steps.length * stepGap(e) + 0.2;
    // A custom moment choreographs itself across its whole length.
    case "custom": return b.seconds;
    case "kinetic": return 0.2 + [...b.text.replace(/\s/g, "")].length * 0.055 + 1.15 + (b.sub ? 0.4 : 0);
    case "chat": return chatTimes(b).end;
    case "app": return appTimes(b).end;
    case "columns": return 1.4 + b.items.length * 0.09 + (b.pick !== undefined ? 1.0 : 0);
    case "media": return mediaTimes(b).end;
    case "collage": return 1.2 + b.cards.length * 0.32;
    case "logo": return 1.7 + (b.sub ? 0.4 : 0);
  }
}

export const flowGap = (e: Energy) => Math.max(0.35, e.enter * 0.6);
export const stepGap = (e: Energy) => Math.max(0.45, e.enter * 0.75);

export function holdTime(b: Beat): number {
  if (b.scene === "custom") return 0;
  if (b.hold !== undefined) return b.hold;
  return Math.max(MIN_HOLD, readingWords(b) / WORDS_PER_SECOND);
}

// Shortest a hold may be squeezed to when the user asked for a length.
const SQUEEZE_MIN = 0.7;
// How far holds may stretch to fill a longer requested length.
const STRETCH_MAX = 2.6;

export interface Plan {
  durations: number[];
  total: number;
  // Set when the requested duration cannot fit these beats.
  overflow?: { minTotal: number; target: number };
  // Set when even stretched holds fall well short of the requested duration.
  underflow?: { total: number; target: number };
}

const round = (n: number) => Math.round(n * 100) / 100;

export function plan(spec: Pick<Spec, "energy" | "beats" | "duration">): Plan {
  const e = ENERGIES[spec.energy];
  // Shots overlap at cuts, so no time is spent on an exit.
  const fixed = spec.beats.map((b) => introTime(b, e) + 0.15);
  let holds = spec.beats.map(holdTime);
  let overflow: Plan["overflow"];
  if (spec.duration) {
    const available = spec.duration - fixed.reduce((a, b) => a + b, 0);
    const natural = holds.reduce((a, b) => a + b, 0);
    // Explicit per-beat holds stay as written; only computed holds flex.
    const flex = spec.beats.map((b) => b.scene !== "custom" && b.hold === undefined);
    const pinned = holds.reduce((a, h, i) => a + (flex[i] ? 0 : h), 0);
    const flexible = natural - pinned;
    const minTotal = fixed.reduce((a, b) => a + b, 0) + pinned + flex.filter(Boolean).length * SQUEEZE_MIN;
    if (minTotal > spec.duration + 0.5) overflow = { minTotal: round(minTotal), target: spec.duration };
    else if (flexible > 0) {
      const scale = Math.min(STRETCH_MAX, (available - pinned) / flexible);
      holds = holds.map((h, i) => (flex[i] ? Math.max(SQUEEZE_MIN, h * scale) : h));
    }
  }
  const durations = spec.beats.map((_, i) => round(fixed[i] + holds[i]));
  const total = round(durations.reduce((a, b) => a + b, 0));
  const underflow = spec.duration && total < spec.duration * 0.85 ? { total, target: spec.duration } : undefined;
  return { durations, total, overflow, underflow };
}
