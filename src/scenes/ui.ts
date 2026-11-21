import type { Beat } from "../spec.ts";
import { appTimes, chatTimes } from "../timing.ts";
import { type Ctx, type SceneOut, esc, fitSize, fontFace, maskedWords, tw } from "./kit.ts";

// Scenes built from objects people recognise (a phone, an app window, big
// letters, coloured panels). The content itself moves: a reply is typed, a
// cursor clicks, letters fall and settle. Every scene keeps a little motion
// through its hold so nothing sits frozen.

type B<S extends Beat["scene"]> = Extract<Beat, { scene: S }>;

const mix = (a: string, pct: number, b = "transparent") => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

// Deterministic pseudo-random per scene and element, so renders repeat.
const rnd = (seed: number, i: number) => {
  let h = Math.imul(seed * 2654435761 + i * 40503, 2246822519) >>> 0;
  h ^= h >>> 15;
  return (h % 10000) / 10000;
};

// A slow float for the hold: up and back down, ending where it started.
function float(c: Ctx, sel: string, amp: number, from: number, period = 2.4): string {
  const span = c.t0 + c.dur - from;
  const n = Math.max(1, Math.floor(span / period));
  return tw("fromTo", sel, { y: 0 }, { y: -amp, duration: period / 2, ease: "sine.inOut", repeat: n * 2 - 1, yoyo: true, immediateRender: false }, from);
}

// ---------------------------------------------------------------- kinetic

export function kinetic(b: B<"kinetic">, c: Ctx): SceneOut {
  const lines = c.portrait && b.text.trim().split(/\s+/).length > 1 ? 2 : 1;
  const fs = fitSize(b.text, c.size.hero * (lines === 1 ? 2.3 : 1.8), c.availW, c.type.display.family, lines);
  let n = 0;
  const words = b.text.trim().split(/\s+/).map((w) =>
    `<span class="kw">${[...w].map((ch) => `<span class="kl" data-i="${n++}">${esc(ch)}</span>`).join("")}</span>`).join(" ");
  const html = `<h1 class="kin">${words}</h1>${b.sub ? `<p class="ksub">${maskedWords(b.sub)}</p>` : ""}`;
  const css = `
    #${c.id} .kin { margin: 0; font-size: ${fs}px; line-height: 0.95; letter-spacing: ${c.type.displayTracking}; text-align: center;
      max-width: ${c.availW}px; text-wrap: balance; }
    #${c.id} .kw { display: inline-block; white-space: nowrap; }
    #${c.id} .kl { display: inline-block; transform-origin: 50% 100%; }
    #${c.id} .ksub { margin: ${Math.round(fs * 0.22)}px 0 0; ${fontFace(c.type.body)} font-size: ${Math.round(c.size.body * 1.2)}px;
      color: ${c.pal.ink}; opacity: 0.8; text-align: center; max-width: ${Math.round(c.availW * 0.8)}px; text-wrap: balance; }`;
  const js: string[] = [];
  const start = c.t0 + 0.2;
  for (let i = 0; i < n; i++) {
    const at = start + i * 0.055;
    const rot = Math.round((rnd(c.index + 7, i) - 0.5) * 40);
    js.push(tw("fromTo", `#${c.id} .kl[data-i="${i}"]`, { yPercent: -170, rotation: rot, opacity: 0 },
      { yPercent: 0, rotation: 0, opacity: 1, duration: 0.6, ease: "power3.in" }, at));
    // The landing: a quick squash, then it springs back to shape.
    js.push(tw("fromTo", `#${c.id} .kl[data-i="${i}"]`, { scaleX: 1.16, scaleY: 0.8 },
      { scaleX: 1, scaleY: 1, duration: 0.55, ease: "elastic.out(1, 0.45)", immediateRender: false }, at + 0.6));
  }
  const settled = start + n * 0.055 + 1.15;
  // Through the hold the letters ripple gently, one after another.
  const span = c.t0 + c.dur - settled;
  if (span > 0.8) {
    const reps = Math.max(1, Math.floor(span / 1.3)) * 2 - 1;
    js.push(tw("fromTo", `#${c.id} .kl`, { y: 0 }, { y: -Math.round(fs * 0.035), duration: 0.65, ease: "sine.inOut", immediateRender: false,
      stagger: { each: 0.06, repeat: reps, yoyo: true } }, settled));
  }
  if (b.sub) js.push(tw("fromTo", `#${c.id} .ksub .wi`, { yPercent: 115 }, { yPercent: 0, duration: c.e.enter, ease: c.e.ease, stagger: c.e.stagger * 0.6 }, start + n * 0.055 + 0.5));
  return { html, css, js };
}

// ---------------------------------------------------------------- chat

export function chat(b: B<"chat">, c: Ctx): SceneOut {
  const side = !c.portrait && !!b.title;
  const usableH = c.fmt.height * (1 - c.fmt.safe.top - c.fmt.safe.bottom);
  // In landscape the phone rises from the bottom edge and is cropped by it,
  // the way product films show one: no dead screen below the messages.
  const ph = Math.round(c.portrait ? usableH * (b.title ? 0.8 : 0.95) : c.fmt.height * 0.98);
  const pw = Math.round(ph * (c.portrait ? 0.56 : 0.5));
  const drop = c.portrait ? 0 : Math.round(c.fmt.height * 0.17);
  const fs = Math.round(Math.max(c.size.caption, pw * (c.portrait ? 0.058 : 0.064)));
  const pad = Math.round(pw * 0.06);
  const dark = c.pal.surface.toLowerCase() < "#888888";
  const them = dark ? mix(c.pal.ink, 12, c.pal.surface) : "#efeeeb";
  const titleW = side ? Math.round(c.availW - pw - c.availW * 0.08) : c.availW;
  const tfs = b.title ? fitSize(b.title, c.size.display * (side ? 1.1 : 0.8), titleW, c.type.display.family, side ? 4 : 2) : 0;
  const msgs = b.messages.map((m, i) => `
        <div class="m ${m.from}" data-i="${i}">
          ${m.from === "them" ? `<div class="typing"><i></i><i></i><i></i></div>` : ""}
          <div class="bub">${esc(m.text)}</div>
        </div>`).join("");
  const html = `
    <div class="chatwrap">
      ${b.title ? `<h2 class="ct">${maskedWords(b.title)}</h2>` : ""}
      <div class="phone">
        <div class="island"></div>
        <div class="head"><span class="av"></span><span class="nm">${esc(b.name ?? "Assistant")}</span></div>
        <div class="msgs">${msgs}</div>
      </div>
    </div>`;
  const css = `
    #${c.id} .chatwrap { display: flex; flex-direction: ${side ? "row" : "column"}; align-items: center; justify-content: center;
      gap: ${side ? Math.round(c.availW * 0.08) : Math.round(c.size.body)}px; width: ${c.availW}px; }
    #${c.id} .ct { margin: 0; width: ${titleW}px; font-size: ${tfs}px; line-height: 1.02; letter-spacing: ${c.type.displayTracking};
      text-align: ${side ? "left" : "center"}; text-wrap: balance; }
    #${c.id} .phone { position: relative; top: ${drop}px; flex: none; width: ${pw}px; height: ${ph}px; box-sizing: border-box; border-radius: ${Math.round(pw * 0.14)}px;
      background: ${c.pal.surface}; border: ${Math.max(6, Math.round(pw * 0.022))}px solid ${c.pal.ink}; overflow: hidden;
      padding: ${Math.round(pw * 0.17)}px ${pad}px ${pad}px; box-shadow: 0 ${Math.round(pw * 0.06)}px ${Math.round(pw * 0.14)}px ${mix("#000000", dark ? 40 : 14)}; }
    #${c.id} .island { position: absolute; top: ${Math.round(pw * 0.035)}px; left: 50%; width: ${Math.round(pw * 0.3)}px; height: ${Math.round(pw * 0.07)}px;
      margin-left: -${Math.round(pw * 0.15)}px; border-radius: 999px; background: ${c.pal.ink}; }
    #${c.id} .head { display: flex; align-items: center; gap: ${Math.round(pad * 0.6)}px; padding-bottom: ${pad}px; margin-bottom: ${pad}px;
      border-bottom: 2px solid ${mix(c.pal.ink, 8)}; ${fontFace(c.type.body)} font-size: ${fs}px; color: ${c.pal.ink}; }
    #${c.id} .av { width: ${Math.round(fs * 1.5)}px; height: ${Math.round(fs * 1.5)}px; border-radius: 50%; background: ${c.pal.accent}; }
    #${c.id} .msgs { display: flex; flex-direction: column; gap: ${Math.round(fs * 0.55)}px; }
    #${c.id} .m { position: relative; display: flex; }
    #${c.id} .m.me { justify-content: flex-end; }
    #${c.id} .bub { max-width: 80%; padding: ${Math.round(fs * 0.55)}px ${Math.round(fs * 0.8)}px; border-radius: ${Math.round(fs * 0.95)}px;
      ${fontFace(c.type.body)} font-size: ${fs}px; line-height: 1.32; }
    #${c.id} .me .bub { background: ${c.pal.accent}; color: ${c.pal.onAccent}; border-bottom-right-radius: ${Math.round(fs * 0.25)}px; transform-origin: 100% 100%; }
    #${c.id} .them .bub { background: ${them}; color: ${c.pal.ink}; border-bottom-left-radius: ${Math.round(fs * 0.25)}px; transform-origin: 0% 100%; }
    #${c.id} .typing { position: absolute; left: 0; top: 0; display: flex; gap: ${Math.round(fs * 0.22)}px; padding: ${Math.round(fs * 0.62)}px ${Math.round(fs * 0.75)}px;
      border-radius: ${Math.round(fs * 0.95)}px; background: ${them}; }
    #${c.id} .typing i { display: block; width: ${Math.round(fs * 0.36)}px; height: ${Math.round(fs * 0.36)}px; border-radius: 50%; background: ${mix(c.pal.ink, 45)}; }`;
  const js: string[] = [];
  const t = c.t0;
  if (b.title) js.push(tw("fromTo", `#${c.id} .ct .wi`, { yPercent: 115 }, { yPercent: 0, duration: c.e.enter, ease: c.e.ease, stagger: c.e.stagger }, t + 0.1));
  js.push(tw("fromTo", `#${c.id} .phone`, { y: Math.round(c.fmt.height * 0.5), rotation: 5 },
    { y: 0, rotation: 0, duration: 1.0, ease: "expo.out" }, t));
  const times = chatTimes(b);
  b.messages.forEach((m, i) => {
    const sel = `#${c.id} .m[data-i="${i}"]`;
    const at = t + times.show[i];
    if (m.from === "them") {
      js.push(tw("fromTo", `${sel} .typing`, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.25, ease: "back.out(2)" }, at - times.typing));
      js.push(tw("fromTo", `${sel} .typing i`, { y: 0 }, { y: -Math.round(fs * 0.22), duration: 0.18, ease: "sine.inOut", immediateRender: false,
        stagger: { each: 0.09, repeat: Math.max(1, Math.round(times.typing / 0.36)) * 2 - 1, yoyo: true } }, at - times.typing + 0.1));
      js.push(tw("to", `${sel} .typing`, { opacity: 0, duration: 0.12, ease: "none" }, at - 0.05));
    }
    js.push(tw("fromTo", `${sel} .bub`, { opacity: 0, scale: 0.4, y: Math.round(fs * 0.6) },
      { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "back.out(1.7)" }, at));
  });
  js.push(float(c, `#${c.id} .phone`, Math.round(pw * 0.015), t + 1.0, 3.2));
  return { html, css, js };
}

// ---------------------------------------------------------------- app

export function app(b: B<"app">, c: Ctx): SceneOut {
  const ww = Math.round(c.portrait ? c.availW : Math.min(c.availW * 0.8, c.fmt.width * 0.66));
  const fs = Math.round(Math.max(c.size.caption, ww * (c.portrait ? 0.05 : 0.037)));
  const pad = Math.round(fs * 1.25);
  const chromeH = Math.round(fs * 2.1);
  const inputH = Math.round(fs * 2.7);
  const btnW = Math.round(Math.max(fs * 5.5, b.button.length * fs * 0.62 + fs * 2.4));
  const stacked = c.portrait;
  const dark = c.pal.surface.toLowerCase() < "#888888";
  const fieldBg = dark ? mix(c.pal.ink, 7, c.pal.surface) : "#f4f3f0";
  // Button centre in window coordinates, for the cursor to land on.
  const bx = stacked ? Math.round(ww / 2) : ww - pad - Math.round(btnW / 2);
  const by = stacked ? chromeH + pad + inputH + Math.round(fs * 0.7) + Math.round(inputH / 2) : chromeH + pad + Math.round(inputH / 2);
  const input = b.input ?? "";
  // The typed line must fit the field on one line: shrink it if it is long.
  const fieldW = stacked ? ww - pad * 2 : ww - pad * 2 - btnW - Math.round(fs * 0.7);
  const ifs = Math.max(Math.round(fs * 0.62), Math.min(fs, Math.floor((fieldW - fs * 1.8) / (Math.max(1, input.length) * 0.53))));
  const html = `
    <div class="appw">
      <div class="chrome"><i></i><i></i><i></i><span class="an">${esc(b.name)}</span></div>
      <div class="body">
        <div class="ask">
          <div class="field"><span class="typed">${esc(input)}</span><span class="caret"></span></div>
          <div class="btn">${esc(b.button)}</div>
        </div>
        <div class="res">
          <div class="skel"><i></i><i></i><i></i></div>
          <div class="out"><span class="tick"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><p>${maskedWords(b.result)}</p></div>
        </div>
      </div>
      <svg class="cur" viewBox="0 0 24 24"><path d="M5 3l14 8.2-6.2 1.4-3 5.9z" fill="${c.pal.ink}" stroke="${dark ? c.pal.bg : "#ffffff"}" stroke-width="1.6" stroke-linejoin="round"/></svg>
    </div>
    ${b.title ? `<div class="pillcap">${esc(b.title)}</div>` : ""}`;
  // One line of result needs less room than two.
  const resH = Math.round(fs * (b.result.length > 44 || c.portrait ? 3.9 : 2.5));
  const css = `
    #${c.id} .appw { position: relative; width: ${ww}px; transform-origin: 40% 75%; background: ${c.pal.surface}; border-radius: ${Math.round(fs * 0.9)}px;
      border: 2px solid ${mix(c.pal.ink, 10)}; box-shadow: 0 ${Math.round(fs * 1.2)}px ${Math.round(fs * 3.4)}px ${mix("#000000", dark ? 45 : 16)}; }
    #${c.id} .chrome { height: ${chromeH}px; display: flex; align-items: center; gap: ${Math.round(fs * 0.4)}px; padding: 0 ${Math.round(fs * 0.8)}px;
      border-bottom: 2px solid ${mix(c.pal.ink, 7)}; }
    #${c.id} .chrome i { width: ${Math.round(fs * 0.5)}px; height: ${Math.round(fs * 0.5)}px; border-radius: 50%; background: #ff5f57; }
    #${c.id} .chrome i:nth-child(2) { background: #febc2e; } #${c.id} .chrome i:nth-child(3) { background: #28c840; }
    #${c.id} .an { position: absolute; left: 0; right: 0; text-align: center; pointer-events: none; ${fontFace(c.type.body)} font-size: ${Math.round(fs * 0.8)}px;
      color: ${c.pal.muted}; line-height: ${chromeH}px; top: 0; }
    #${c.id} .body { padding: ${pad}px; }
    #${c.id} .ask { display: flex; flex-direction: ${stacked ? "column" : "row"}; gap: ${Math.round(fs * 0.7)}px; }
    #${c.id} .field { flex: 1; height: ${inputH}px; box-sizing: border-box; display: flex; align-items: center; padding: 0 ${Math.round(fs * 0.8)}px;
      border-radius: ${Math.round(fs * 0.6)}px; background: ${fieldBg}; ${fontFace(c.type.body)} font-size: ${ifs}px; color: ${c.pal.ink};
      white-space: nowrap; overflow: hidden; }
    #${c.id} .typed { display: inline-block; overflow: hidden; vertical-align: bottom; }
    #${c.id} .caret { display: inline-block; width: 2px; height: ${Math.round(fs * 1.15)}px; margin-left: 2px; background: ${c.pal.ink}; }
    #${c.id} .btn { flex: none; width: ${stacked ? "auto" : `${btnW}px`}; height: ${inputH}px; display: grid; place-items: center;
      border-radius: ${Math.round(fs * 0.6)}px; background: ${c.pal.accent}; color: ${c.pal.onAccent}; ${fontFace(c.type.body)} font-size: ${fs}px; }
    #${c.id} .res { position: relative; height: ${resH}px; margin-top: ${pad}px; }
    #${c.id} .skel { position: absolute; inset: 0; display: flex; flex-direction: column; gap: ${Math.round(fs * 0.55)}px; padding-top: ${Math.round(fs * 0.3)}px; }
    #${c.id} .skel i { display: block; height: ${Math.round(fs * 0.75)}px; border-radius: 999px; background: ${fieldBg}; transform-origin: left center; }
    #${c.id} .skel i:nth-child(2) { width: 82%; } #${c.id} .skel i:nth-child(3) { width: 58%; }
    #${c.id} .out { position: absolute; inset: 0; display: flex; gap: ${Math.round(fs * 0.7)}px; align-items: flex-start; }
    #${c.id} .tick { flex: none; display: grid; place-items: center; width: ${Math.round(fs * 1.6)}px; height: ${Math.round(fs * 1.6)}px; border-radius: 50%;
      background: ${c.pal.accent}; color: ${c.pal.onAccent}; }
    #${c.id} .tick svg { width: 62%; height: 62%; }
    #${c.id} .out p { margin: 0; ${fontFace(c.type.display)} font-size: ${Math.round(fs * 1.25)}px; line-height: 1.22; letter-spacing: -0.02em; color: ${c.pal.ink};
      text-wrap: balance; }
    #${c.id} .cur { position: absolute; left: 0; top: 0; width: ${Math.round(fs * 1.7)}px; height: ${Math.round(fs * 1.7)}px; z-index: 3;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,0.25)); }
    #${c.id} .pillcap { margin-top: ${Math.round(fs * 1.6)}px; padding: ${Math.round(fs * 0.55)}px ${Math.round(fs * 1.2)}px; border-radius: 999px;
      background: ${c.pal.ink}; color: ${c.pal.bg}; ${fontFace(c.type.display)} font-size: ${Math.round(fs * 1.3)}px; letter-spacing: -0.02em; }`;
  const T = appTimes(b);
  const t = c.t0;
  const js = [
    tw("fromTo", `#${c.id} .appw`, { y: Math.round(c.fmt.height * 0.18), scale: 0.94, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: 0.9, ease: "expo.out" }, t),
    tw("fromTo", `#${c.id} .skel i`, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "expo.out", stagger: 0.08 }, t + 0.35),
    // Caret blinks while typing and waiting.
    tw("fromTo", `#${c.id} .caret`, { opacity: 1 }, { opacity: 0, duration: 0.45, ease: "steps(1)", repeat: Math.max(1, Math.round((T.click - 0.4) / 0.45)), yoyo: true }, t + 0.4),
    tw("to", `#${c.id} .caret`, { opacity: 0, duration: 0.01 }, t + T.click),
  ];
  if (input) js.push(tw("fromTo", `#${c.id} .typed`, { width: 0 }, { width: "auto", duration: T.typeEnd - T.typeStart, ease: `steps(${Math.max(1, input.length)})` }, t + T.typeStart));
  else js.push(tw("set", `#${c.id} .typed`, { width: 0 }, t));
  // The cursor arcs in from the lower right: x and y on different curves.
  const sx = ww + Math.round(fs * 3), sy = Math.round(by + fs * 9);
  js.push(tw("fromTo", `#${c.id} .cur`, { x: sx, opacity: 0 }, { x: bx - Math.round(fs * 0.25), opacity: 1, duration: T.move, ease: "power2.inOut" }, t + T.click - T.move));
  js.push(tw("fromTo", `#${c.id} .cur`, { y: sy }, { y: by - Math.round(fs * 0.3), duration: T.move, ease: "power3.out" }, t + T.click - T.move));
  // Press: cursor and button dip together, then release.
  js.push(tw("fromTo", `#${c.id} .cur`, { scale: 1 }, { scale: 0.82, duration: 0.1, ease: "power2.in", yoyo: true, repeat: 1, immediateRender: false }, t + T.click));
  js.push(tw("fromTo", `#${c.id} .btn`, { scale: 1 }, { scale: 0.93, duration: 0.1, ease: "power2.in", yoyo: true, repeat: 1, immediateRender: false }, t + T.click));
  // Thinking: skeleton shimmers, then gives way to the answer.
  js.push(tw("fromTo", `#${c.id} .skel i`, { opacity: 1 }, { opacity: 0.45, duration: 0.25, ease: "sine.inOut", yoyo: true, repeat: 3, stagger: 0.07, immediateRender: false }, t + T.click + 0.15));
  js.push(tw("to", `#${c.id} .skel`, { opacity: 0, duration: 0.2, ease: "none" }, t + T.result - 0.1));
  js.push(tw("fromTo", `#${c.id} .tick`, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.5, ease: "back.out(2.2)" }, t + T.result));
  js.push(tw("fromTo", `#${c.id} .out .wi`, { yPercent: 115 }, { yPercent: 0, duration: 0.6, ease: "expo.out", stagger: 0.035 }, t + T.result + 0.1));
  js.push(tw("to", `#${c.id} .cur`, { x: bx + Math.round(fs * 4), y: by + Math.round(fs * 4), duration: 1.2, ease: "power2.inOut" }, t + T.result + 0.2));
  // Camera: a slow push in on the answer once it lands.
  js.push(tw("fromTo", `#${c.id} .appw`, { scale: 1 }, { scale: 1.09, duration: 1.6, ease: "power2.inOut", immediateRender: false }, t + T.result + 0.15));
  if (b.title) js.push(tw("fromTo", `#${c.id} .pillcap`, { opacity: 0, y: Math.round(fs), scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.8)" }, t + T.result + 0.4));
  js.push(float(c, `#${c.id} .appw`, Math.round(fs * 0.25), t + 0.9, 3.0));
  return { html, css, js };
}

// ---------------------------------------------------------------- columns

export function columns(b: B<"columns">, c: Ctx): SceneOut {
  const n = b.items.length;
  const colors = c.fields.length > 1
    ? b.items.map((_, i) => c.fields[(c.index + i + 1) % c.fields.length])
    : b.items.map((_, i) => mix(c.pal.accent, 12 + i * 14, c.pal.surface));
  const W = c.fmt.width;
  const top = Math.round(c.fmt.height * c.fmt.safe.top);
  const colW = W / n;
  const lfs = Math.round(Math.min(c.size.body * (c.portrait ? 1.05 : 1.15), colW * 0.13));
  const big = Math.round(Math.min(colW * 0.62, c.size.hero * 1.6));
  const pick = b.pick !== undefined && b.pick >= 0 && b.pick < n ? b.pick : undefined;
  const html = `
    <div class="cols">${b.items.map((it, i) => `
      <div class="col" data-i="${i}" style="background:${colors[i]}">
        <div class="cl">${esc(it.label)}</div>
        <div class="cn">${String(i + 1).padStart(2, "0")}</div>
        ${it.note ? `<div class="cnote">${esc(it.note)}</div>` : ""}
      </div>`).join("")}
    </div>
    ${b.title ? `<div class="pillcap">${esc(b.title)}</div>` : ""}`;
  const css = `
    #${c.id} .cols { position: absolute; inset: 0; display: flex; }
    #${c.id} .col { position: relative; flex: 1 1 0; min-width: 0; overflow: hidden; display: flex; flex-direction: column; align-items: center;
      padding: ${top}px ${Math.round(colW * 0.06)}px ${Math.round(c.fmt.height * c.fmt.safe.bottom)}px; box-sizing: border-box; }
    #${c.id} .cl { ${fontFace(c.type.display)} font-size: ${lfs}px; letter-spacing: -0.02em; text-align: center; line-height: 1.1; white-space: nowrap; }
    #${c.id} .cn { margin: auto 0; ${fontFace(c.type.display)} font-size: ${big}px; letter-spacing: -0.05em; line-height: 1; }
    #${c.id} .cnote { ${fontFace(c.type.body)} font-size: ${Math.round(lfs * 0.75)}px; opacity: 0.75; text-align: center; white-space: nowrap; }
    #${c.id} .pillcap { position: absolute; left: 0; right: 0; margin: 0 auto; width: max-content; bottom: ${Math.round(c.fmt.height * Math.max(0.08, c.fmt.safe.bottom))}px;
      padding: ${Math.round(c.size.body * 0.4)}px ${Math.round(c.size.body * 0.9)}px; border-radius: 999px; background: ${c.pal.ink}; color: ${c.fields[0] === c.pal.bg && c.fields.length > 1 ? c.fields[0] : c.pal.bg};
      ${fontFace(c.type.display)} font-size: ${Math.round(c.size.body * 1.15)}px; letter-spacing: -0.02em; white-space: nowrap; z-index: 2; }`;
  const t = c.t0;
  const js = [
    tw("fromTo", `#${c.id} .col`, { yPercent: 100 }, { yPercent: 0, duration: 0.95, ease: "expo.out", stagger: 0.09 }, t),
    tw("fromTo", `#${c.id} .cn`, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: "back.out(1.6)", stagger: 0.09 }, t + 0.35),
    tw("fromTo", `#${c.id} .cl, #${c.id} .cnote`, { opacity: 0, y: c.travel / 2 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.05 }, t + 0.5),
  ];
  if (b.title) js.push(tw("fromTo", `#${c.id} .pillcap`, { opacity: 0, y: c.travel, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.8)" }, t + 0.8));
  const at = t + 1.25 + n * 0.09;
  if (pick !== undefined) {
    // The chosen column takes the frame; the rest close up beside it.
    b.items.forEach((_, i) => {
      js.push(tw("fromTo", `#${c.id} .col[data-i="${i}"]`, { flexGrow: 1 }, { flexGrow: i === pick ? n * 2.2 : 0.35, duration: 1.0, ease: "expo.inOut", immediateRender: false }, at));
      if (i !== pick) js.push(tw("to", `#${c.id} .col[data-i="${i}"] > *`, { opacity: 0, duration: 0.3, ease: "none" }, at));
    });
    js.push(tw("fromTo", `#${c.id} .col[data-i="${pick}"] .cn`, { scale: 1 }, { scale: 1.6, duration: 1.0, ease: "expo.inOut", immediateRender: false }, at));
  } else {
    js.push(tw("fromTo", `#${c.id} .cn`, { y: 0 }, { y: -Math.round(big * 0.06), duration: 0.9, ease: "sine.inOut", immediateRender: false,
      stagger: { each: 0.15, repeat: Math.max(1, Math.floor((c.dur - 1.5) / 1.8)) * 2 - 1, yoyo: true } }, at));
  }
  return { html, css, js };
}

