import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { compose, writeWav } from "./music.ts";
import { seedOf } from "./guide.ts";
import type { Beat, Spec } from "./spec.ts";
import { introTime, plan } from "./timing.ts";
import { BODY_STRONG, ENERGIES, FONT_SOURCES, FORMATS, MONO, PALETTES, QUOTE_MARK, TEMPLATES, TYPE_PAIRS, TYPE_SCALE, type TypeFace } from "./tokens.ts";
import { type Ctx, type SceneOut, r, tw } from "./scenes/kit.ts";
import { readable } from "./color.ts";
import { end, quote, statement, title } from "./scenes/text.ts";
import { bars, compare, list, stat } from "./scenes/data.ts";
import { code } from "./scenes/code.ts";
import { flow, steps } from "./scenes/diagram.ts";
import { custom } from "./scenes/custom.ts";
import { app, chat, columns, kinetic } from "./scenes/ui.ts";
import { collage, logo, media } from "./scenes/media.ts";
import { imageSize } from "./media.ts";
import { RUNTIME } from "./custom.ts";

const require = createRequire(import.meta.url);

const SCENES: { [K in Beat["scene"]]: (b: Extract<Beat, { scene: K }>, c: Ctx) => SceneOut } = {
  title, statement, stat, list, quote, compare, bars, code, flow, steps, custom, end, kinetic, chat, app, columns, media, collage, logo,
};

export interface Timeline {
  duration: number;
  beats: { scene: string; start: number; duration: number }[];
}

export interface Compiled extends Timeline {
  html: string;
  fonts: TypeFace[];
}

const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 128;
};

export function compile(spec: Spec, opts: { music?: string } = {}): Compiled {
  const fmt = FORMATS[spec.format];
  const base = PALETTES[spec.palette];
  const pal = { ...base, accentText: readable(base.accent, base.ink, base.bg), accentOnSurface: readable(base.accent, base.ink, base.surface) };
  const type = TYPE_PAIRS[spec.type];
  const e = ENERGIES[spec.energy];
  const short = Math.min(fmt.width, fmt.height);
  const portrait = fmt.height > fmt.width;
  // Vertical video is watched on a phone at arm's length: small text grows.
  const boost: Partial<Record<keyof typeof TYPE_SCALE, number>> = portrait ? { body: 1.3, caption: 1.3, headline: 1.15 } : {};
  // Flat colour fields carry bigger type: the field is the backdrop, so the
  // words can fill the frame the way a product film's do.
  // A condensed serif reads small at the same size as a grotesk: set it larger.
  if (type.display.family === "Instrument Serif" && !type.display.style) for (const k of ["hero", "display", "headline"] as const) boost[k] = (boost[k] ?? 1) * 1.3;
  if (base.fields) for (const [k, v] of Object.entries({ hero: 1.2, display: 1.22, headline: 1.18, body: 1.12 }))
    boost[k as keyof typeof TYPE_SCALE] = (boost[k as keyof typeof TYPE_SCALE] ?? 1) * v;
  const size = Object.fromEntries(Object.entries(TYPE_SCALE).map(([k, v]) =>
    [k, Math.round(v * short * (boost[k as keyof typeof TYPE_SCALE] ?? 1))])) as Ctx["size"];
  const availW = Math.round(fmt.width * (1 - 2 * fmt.safe.x));
  const travel = Math.round(e.travel * (short / 1080));

  let t = 0;
  const timeline: Timeline["beats"] = [];
  const sections: string[] = [];
  const css: string[] = [];
  const js: string[] = [];
  const durations = plan(spec).durations;
  // Shots overlap at every cut: the outgoing beat stays on screen while the
  // incoming one arrives through a transition, the way an edited film hands
  // attention from one shot to the next instead of swapping slides.
  const OVERLAP = 0.6;
  const fields = base.fields;
  const fieldOf = (i: number) => (fields ? fields[i % fields.length] : base.bg);
  const cuts = cutPlan(spec, !!fields);
  const assets = assetTable(spec);
  const n = spec.beats.length;

  spec.beats.forEach((b, i) => {
    const id = `b${i}`;
    const dur = durations[i];
    const field = fieldOf(i);
    const bpal = fields ? { ...pal, bg: field, accentText: readable(base.accent, base.ink, field) } : pal;
    const ctx: Ctx = { id, t0: r(t), dur, intro: introTime(b, e), e, pal: bpal, type, fmt, size, availW, portrait, travel, index: i, fields: fields ?? [base.bg], assets };
    const out = (SCENES[b.scene] as (b: Beat, c: Ctx) => SceneOut)(b, ctx);
    const shown = i < n - 1 ? r(dur + OVERLAP) : dur;
    sections.push(`<section id="${id}" class="clip scene" data-start="${r(t)}" data-duration="${shown}" data-track-index="${1 + (i % 2)}"${fields ? ` style="background:${field}"` : ""}>
      <div class="stage">${out.html}</div>
    </section>`);
    css.push(out.css);
    js.push(`// ${id}: ${b.scene}`, ...out.js);
    // Camera: every shot keeps a slow push-in, so no frame is ever frozen.
    js.push(tw("fromTo", `#${id} .stage`, { scale: 1 }, { scale: 1.045, duration: shown, ease: "sine.inOut" }, t));
    if (i > 0) js.push(...transition(cuts[i - 1], `#b${i - 1}`, `#${id}`, t, OVERLAP, !!fields));
    timeline.push({ scene: b.scene, start: r(t), duration: dur });
    t += dur;
  });
  const total = r(t);

  const fonts = uniqueFonts([type.display, type.body, BODY_STRONG, MONO, QUOTE_MARK]);
  const dark = isDark(pal.bg);
  const bg = base.fields ? { html: "", css: "", js: [] as string[] } : background(spec.background, pal, short, total, dark, fmt.width, fmt.height, seedOf(spec.title));
  const chrome = spec.template && TEMPLATES[spec.template].frame ? frameChrome(spec, timeline, pal, fmt, short) : { html: "", css: "", js: [] as string[] };

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${fmt.width}, height=${fmt.height}" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:; connect-src 'none'" />
<title>${spec.title.replace(/</g, "&lt;")}</title>
<script src="assets/gsap.min.js"></script>
<style>
${fonts.map((f) => `@font-face { font-family: "${f.family}"; src: url("assets/fonts/${f.file}") format("woff2"); font-weight: ${f.weight}; font-style: ${f.style ?? "normal"}; }`).join("\n")}
body { margin: 0; background: ${pal.bg}; }
#root { position: relative; width: 100%; height: 100%; overflow: hidden; background: ${pal.bg}; color: ${pal.ink};
  font-family: "${type.display.family}"; font-weight: ${type.display.weight}; font-style: ${type.display.style ?? "normal"};
  text-transform: ${type.upper ? "uppercase" : "none"};
  -webkit-font-smoothing: antialiased; }
.bg { position: absolute; inset: 0; overflow: hidden; }
.fontload { position: absolute; left: 0; top: 0; opacity: 0.001; font-size: 10px; pointer-events: none; }
.vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 55%, ${dark ? "rgba(0,0,0,0.45)" : "rgba(60,40,20,0.10)"}); }
.scene { position: absolute; inset: 0; }
.stage { position: absolute; inset: 0; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: ${Math.round(fmt.height * fmt.safe.top)}px ${Math.round(fmt.width * fmt.safe.x)}px ${Math.round(fmt.height * fmt.safe.bottom)}px; }
.w { display: inline-block; overflow: hidden; vertical-align: top; padding: 0.06em 0.04em 0.14em; margin: -0.06em -0.04em -0.14em; }
.wi { display: inline-block; }
.hl { position: relative; display: inline-block; }
.hl .w { position: relative; z-index: 1; }
.mark { position: absolute; left: -0.14em; right: -0.14em; top: 0.1em; bottom: 0.02em; border-radius: 0.1em; background: ${pal.accent};
  transform-origin: left center; z-index: 0; }
${bg.css}
${chrome.css}
.wipe { position: absolute; inset: 0; background: ${pal.accent}; z-index: 5; }
.cover { position: absolute; inset: 0; z-index: 4; }
${css.join("\n")}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${fmt.width}" data-height="${fmt.height}" data-duration="${total}" data-fps="30">
  <div class="bg">${bg.html}</div>
  ${chrome.html}
  <div class="fontload" aria-hidden="true">${fonts.map((f) => `<span style="font-family:'${f.family}';font-weight:${f.weight};font-style:${f.style ?? "normal"}">Aa</span>`).join("")}</div>
  ${sections.join("\n  ")}

  ${base.fields ? "" : `<div class="vignette"></div>`}
  ${opts.music ? `<audio id="music" src="${opts.music}" data-start="0" data-duration="${total}" data-volume="0.85"></audio>` : ""}
</div>
<script>
${spec.beats.some((b) => b.scene === "custom") ? RUNTIME : ""}
const tl = gsap.timeline({ paused: true });

${bg.js.join("\n")}
${chrome.js.join("\n")}
${js.join("\n")}
window.__timelines["main"] = tl;
</script>
</body>
</html>
`;
  return { html, fonts, duration: total, beats: timeline };
}

export type Cut = "iris" | "slant" | "push" | "zoom" | "rise";

// Which transition each cut uses. Flat palettes have opaque shots, so the
// incoming one can be revealed over the outgoing one (iris, slant); shared
// backgrounds hand over by moving whole shots (push, zoom, rise). The order
// is varied per video but never repeats back to back, and calm videos avoid
// the most energetic moves.
export function cutPlan(spec: Pick<Spec, "title" | "energy" | "beats">, flat: boolean): Cut[] {
  const calm = spec.energy === "calm";
  const pool: Cut[] = flat ? (calm ? ["iris", "zoom", "rise"] : ["iris", "slant", "push", "zoom", "rise"]) : (calm ? ["zoom", "rise"] : ["zoom", "push", "rise"]);
  let k = seedOf(spec.title) % pool.length;
  const out: Cut[] = [];
  for (let i = 0; i < spec.beats.length - 1; i++) {
    out.push(pool[k]);
    k = (k + 1 + (seedOf(spec.title + i) % Math.max(1, pool.length - 1))) % pool.length;
    if (out.length && pool[k] === out[out.length - 1]) k = (k + 1) % pool.length;
  }
  return out;
}

// Every tween is fromTo with immediateRender off so any frame can be seeked.
function transition(kind: Cut, from: string, to: string, at: number, T: number, opaque = true): string[] {
  const go = (sel: string, a: object, b: object, ease = "expo.inOut", d = T) =>
    tw("fromTo", sel, a, { ...b, duration: d, ease, immediateRender: false }, at);
  // Shots on a shared background are see-through: the outgoing one has to
  // be gone by mid-cut or the two shots' words would overlap.
  const out = (props: Record<string, unknown>) => opaque ? go(from, ...split(props)) : go(from, ...split({ ...props, opacity: 0 }), "power2.in", T * 0.5);
  switch (kind) {
    case "iris":
      return [go(to, { clipPath: "circle(0% at 50% 55%)" }, { clipPath: "circle(75% at 50% 55%)" }, "power3.inOut"), out({ scale: [1, 0.94] })];
    case "slant":
      return [go(to, { clipPath: "polygon(110% 0%, 160% 0%, 140% 100%, 90% 100%)" }, { clipPath: "polygon(-60% 0%, 160% 0%, 140% 100%, -80% 100%)" }), out({ xPercent: [0, -12] })];
    case "push":
      return [go(to, { xPercent: 100 }, { xPercent: 0 }), out({ xPercent: [0, -38], opacity: [1, 0.4] })];
    case "zoom":
      return [go(to, { scale: 0.86, opacity: 0 }, { scale: 1, opacity: 1 }, "power3.out"), out({ scale: [1, 1.3], opacity: [1, 0] })];
    case "rise":
      return [go(to, { yPercent: 100 }, { yPercent: 0 }), out({ yPercent: [0, -30], opacity: [1, 0.3] })];
  }
}

// { prop: [from, to] } into a fromTo pair; a bare value means "to", from 1.
function split(props: Record<string, unknown>): [object, object] {
  const a: Record<string, unknown> = {}, b: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (Array.isArray(v)) { a[k] = v[0]; b[k] = v[1]; } else { a[k] = 1; b[k] = v; }
  }
  return [a, b];
}

// Each asset is copied into the project as assets/media/<safe name>.<ext>.
const assetFile = (name: string, path: string) => `assets/media/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}${extname(path).toLowerCase()}`;

function assetTable(spec: Spec): Ctx["assets"] {
  const out: Ctx["assets"] = {};
  for (const [name, path] of Object.entries(spec.assets ?? {})) {
    const { w, h } = imageSize(path);
    out[name] = { src: assetFile(name, path), w, h };
  }
  return out;
}

function uniqueFonts(list: TypeFace[]): TypeFace[] {
  const seen = new Map<string, TypeFace>();
  for (const f of list) seen.set(f.file, f);
  return [...seen.values()];
}

// Corner labels in mono, as on a printed spec sheet: the title top left and
// a beat counter top right that ticks over at every cut.
function frameChrome(spec: Spec, beats: Timeline["beats"], pal: (typeof PALETTES)[string], fmt: (typeof FORMATS)[keyof typeof FORMATS], short: number) {
  const fs = Math.round(short * 0.02);
  const top = Math.round(fmt.height * Math.min(0.05, fmt.safe.top * 0.6));
  const side = Math.round(fmt.width * fmt.safe.x * 0.6);
  const n = beats.length;
  const pad = (k: number) => String(k).padStart(2, "0");
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<div class="fchrome"><span class="ft">${esc(spec.title)}</span><span class="fc">${beats.map((_, i) => `<i data-i="${i}">${pad(i + 1)} / ${pad(n)}</i>`).join("")}</span></div>`;
  const css = `.fchrome { position: absolute; left: ${side}px; right: ${side}px; top: ${top}px; z-index: 6; display: flex; justify-content: space-between;
  font-family: "Geist Mono"; font-weight: 500; font-size: ${fs}px; letter-spacing: 0.08em; text-transform: uppercase; color: ${pal.ink}; opacity: 0.72; }
.ft { max-width: 60%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fc { position: relative; }
.fc i { font-style: normal; position: absolute; right: 0; top: 0; white-space: nowrap; opacity: 0; }`;
  const js = [tw("fromTo", ".fchrome", { opacity: 0 }, { opacity: 0.72, duration: 0.6, ease: "power2.out" }, 0.1)];
  beats.forEach((b, i) => {
    js.push(tw("fromTo", `.fc i[data-i="${i}"]`, { opacity: 0, yPercent: 60 }, { opacity: 1, yPercent: 0, duration: 0.35, ease: "power3.out", immediateRender: false }, b.start + 0.05));
    if (i < n - 1) js.push(tw("to", `.fc i[data-i="${i}"]`, { opacity: 0, yPercent: -60, duration: 0.25, ease: "power2.in" }, b.start + b.duration - 0.2));
  });
  return { html, css, js };
}

// Deterministic characters for the glyph field, so renders repeat.
function glyphText(cols: number, rows: number, seed: number): string {
  const set = "01#%&*+=-:.<>/\\|{}[]$@xo";
  let s = seed || 7;
  const out: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; line += set[(s >>> 16) % set.length]; }
    out.push(line);
  }
  return out.join("\n");
}

function background(kind: Spec["background"], pal: (typeof PALETTES)[string], short: number, total: number, dark: boolean, W = 1920, H = 1080, seed = 1) {
  const out = { html: "", css: "", js: [] as string[] };
  // Three soft masks wander across the frame; whatever texture sits under
  // them shows only inside, so the pattern reads as drifting weather.
  const clouds = (sel: string) => {
    const pts = [[22, 30, 70, 62], [72, 24, 30, 76], [50, 78, 82, 40]];
    const vars = pts.map(([x], i) => `--x${i}: ${x}%;`).join(" ") + pts.map(([, y], i) => ` --y${i}: ${y}%;`).join("");
    const mask = pts.map((_, i) => `radial-gradient(${i === 2 ? 34 : 28}% ${i === 1 ? 36 : 30}% at var(--x${i}) var(--y${i}), #000 0%, rgba(0,0,0,0.55) 45%, transparent 100%)`).join(", ");
    const css = `${sel} { ${vars} -webkit-mask-image: ${mask}; mask-image: ${mask}; }`;
    const js = pts.map(([, , x2, y2], i) => tw("fromTo", sel, { [`--x${i}`]: `${pts[i][0]}%`, [`--y${i}`]: `${pts[i][1]}%` },
      { [`--x${i}`]: `${x2}%`, [`--y${i}`]: `${y2}%`, duration: total, ease: "sine.inOut" }, 0));
    return { css, js };
  };
  if (kind === "glyph") {
    const fs = Math.round(short * 0.021);
    const cols = Math.ceil((W * 1.25) / (fs * 0.6)), rows = Math.ceil((H * 1.25) / (fs * 1.15));
    out.html = `<pre class="glyphs" aria-hidden="true" data-layout-ignore data-layout-allow-overflow>${glyphText(cols, rows, seed).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
    const c = clouds(".glyphs");
    out.css = `.glyphs { position: absolute; left: -10%; top: -10%; margin: 0; font-family: "Geist Mono"; font-weight: 500; font-size: ${fs}px; line-height: 1.15;
  color: color-mix(in srgb, ${pal.ink} 40%, transparent); white-space: pre; }
${c.css}`;
    out.js.push(...c.js, tw("fromTo", ".glyphs", { x: 0, y: 0 }, { x: -Math.round(short * 0.08), y: -Math.round(short * 0.04), duration: total, ease: "none" }, 0));
    return out;
  }
  if (kind === "halftone") {
    const step = Math.round(short * 0.022);
    out.html = `<div class="dots-a" data-layout-ignore data-layout-allow-overflow></div><div class="dots-b" data-layout-ignore data-layout-allow-overflow></div>`;
    const c = clouds(".dots-a");
    out.css = `.dots-a, .dots-b { position: absolute; inset: -6%; }
.dots-a { background-image: radial-gradient(circle, color-mix(in srgb, ${pal.ink} 55%, transparent) ${step * 0.2}px, transparent ${step * 0.24}px); background-size: ${step}px ${step}px; }
.dots-b { background-image: radial-gradient(circle, color-mix(in srgb, ${pal.ink} 12%, transparent) ${step * 0.12}px, transparent ${step * 0.16}px); background-size: ${step}px ${step}px; }
${c.css}`;
    out.js.push(...c.js, tw("fromTo", ".dots-a, .dots-b", { backgroundPosition: "0px 0px" }, { backgroundPosition: `${-step * 6}px 0px`, duration: total, ease: "none" }, 0));
    return out;
  }
  if (kind === "grain") {
    // Paper: fine fractal noise, multiplied in, plus a faint ruled margin.
    const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.3 0 0 0 0 0.25 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
    out.html = `<div class="paper"></div><div class="rule-l"></div>`;
    out.css = `.paper { position: absolute; inset: 0; background-image: ${noise}; opacity: 0.32; mix-blend-mode: multiply; }
.rule-l { position: absolute; top: 0; bottom: 0; left: ${Math.round(W * 0.035)}px; width: 1px; background: color-mix(in srgb, ${pal.accent} 35%, transparent); transform-origin: top; }`;
    out.js.push(tw("fromTo", ".rule-l", { scaleY: 0 }, { scaleY: 1, duration: 1.4, ease: "expo.inOut" }, 0));
    return out;
  }
  if (kind === "hairline") {
    const step = Math.round(short * 0.11);
    const line = `color-mix(in srgb, ${pal.ink} 6%, transparent)`;
    out.html = `<div class="hair" data-layout-ignore data-layout-allow-overflow></div>`;
    out.css = `.hair { position: absolute; inset: -${step}px; background-image: linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px);
  background-size: ${step}px ${step}px; -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, #000 20%, transparent 85%); mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, #000 20%, transparent 85%); }`;
    out.js.push(tw("fromTo", ".hair", { x: 0 }, { x: -step, duration: total, ease: "none" }, 0));
    return out;
  }
  const line = `color-mix(in srgb, ${pal.ink} ${dark ? 7 : 9}%, transparent)`;
  const fade = "mask-image: radial-gradient(ellipse at center, #000 30%, transparent 75%);";
  if (kind === "glow") {
    const s = Math.round(short * 1.2);
    out.html = `<div class="blob ba" data-layout-allow-overflow></div><div class="blob bb" data-layout-allow-overflow></div>`;
    out.css = `.blob { position: absolute; width: ${s}px; height: ${s}px; border-radius: 50%; background: radial-gradient(closest-side, ${pal.glow}, transparent); }
.ba { left: -${Math.round(s * 0.35)}px; top: -${Math.round(s * 0.4)}px; }
.bb { right: -${Math.round(s * 0.4)}px; bottom: -${Math.round(s * 0.45)}px; }`;
    out.js.push(tw("fromTo", ".ba", { xPercent: 0, yPercent: 0 }, { xPercent: 18, yPercent: 12, duration: total, ease: "sine.inOut" }, 0));
    out.js.push(tw("fromTo", ".bb", { xPercent: 0, yPercent: 0 }, { xPercent: -15, yPercent: -10, duration: total, ease: "sine.inOut" }, 0));
  } else if (kind === "grid" || kind === "dots") {
    const step = Math.round(short * 0.07);
    const img = kind === "grid"
      ? `linear-gradient(${line} 2px, transparent 2px), linear-gradient(90deg, ${line} 2px, transparent 2px)`
      : `radial-gradient(circle, color-mix(in srgb, ${pal.ink} ${dark ? 18 : 22}%, transparent) 2.5px, transparent 3px)`;
    out.html = `<div class="pattern"></div>`;
    out.css = `.pattern { position: absolute; inset: 0; background-image: ${img}; background-size: ${step}px ${step}px; ${fade} }`;
    out.js.push(tw("fromTo", ".pattern", { backgroundPosition: "0px 0px" }, { backgroundPosition: `0px ${-step * Math.max(1, Math.round(total / 4))}px`, duration: total, ease: "none" }, 0));
  }
  return out;
}

// music: "auto" scores the video with the built-in synth, "none" leaves it
// silent, anything else is a path to the user's own track.
export function writeProject(spec: Spec, dir: string, opts: { music?: string } = {}): Compiled {
  const music = opts.music ?? "auto";
  mkdirSync(join(dir, "assets", "fonts"), { recursive: true });
  let src: string | undefined;
  if (music === "auto") {
    const draft = compile(spec);
    writeWav(join(dir, "assets", "music.wav"), compose({
      duration: draft.duration, energy: spec.energy, seed: seedOf(spec.title), cuts: draft.beats.slice(1).map((b) => b.start),
    }));
    src = "assets/music.wav";
  } else if (music !== "none") {
    src = `assets/music${extname(music) || ".mp3"}`;
    copyFileSync(music, join(dir, src));
  }
  const c = compile(spec, { music: src });
  for (const f of c.fonts) {
    const pkgDir = dirname(require.resolve(`${FONT_SOURCES[f.family]}/package.json`));
    copyFileSync(join(pkgDir, "files", f.file), join(dir, "assets", "fonts", f.file));
  }
  copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "assets", "gsap.min.js"));
  const used = Object.entries(spec.assets ?? {});
  if (used.length) mkdirSync(join(dir, "assets", "media"), { recursive: true });
  for (const [name, path] of used) copyFileSync(path, join(dir, assetFile(name, path)));
  writeFileSync(join(dir, "index.html"), c.html);
  writeFileSync(join(dir, "spec.json"), JSON.stringify(spec, null, 2) + "\n");
  return c;
}
