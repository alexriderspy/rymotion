import type { Beat } from "../spec.ts";
import { mediaTimes } from "../timing.ts";
import { type Ctx, type SceneOut, esc, fitSize, fontFace, maskedWords, tw } from "./kit.ts";

// Scenes built on the user's own pictures: screenshots in a device that
// swings in while the camera pushes toward the part that matters, a collage
// of cards with sticker labels, and a logo that pops in and writes its name.

type B<S extends Beat["scene"]> = Extract<Beat, { scene: S }>;
const mix = (a: string, pct: number, b = "transparent") => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
const isDarkHex = (hex: string) => {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 128;
};
const STICKERS = ["#ffe066", "#ff9ecf", "#9be7c4", "#b7c8ff", "#ffb38a"];

function asset(c: Ctx, name: string) {
  const a = c.assets[name];
  if (!a) throw new Error(`asset "${name}" is missing`);
  return a;
}

// ---------------------------------------------------------------- media

export function media(b: B<"media">, c: Ctx): SceneOut {
  const W = c.fmt.width, H = c.fmt.height;
  const names = [b.asset, ...(b.then ?? [])];
  const first = asset(c, b.asset);
  const ar = first.w / first.h;
  const device = b.device ?? (ar < 0.8 ? "phone" : "browser");
  const split = !!b.title && !c.portrait;

  // The screen keeps the picture's shape within limits; anything beyond is
  // cropped around the focus point.
  const [lo, hi] = device === "phone" ? [0.42, 0.62] : device === "card" ? [0.5, 2.2] : [1.25, 2.0];
  const sar = Math.min(hi, Math.max(lo, ar));
  const boxW = split ? W * 0.55 : c.portrait ? c.availW : W * 0.76;
  const boxH = H * (c.portrait ? (b.title ? 0.56 : 0.66) : 0.8);
  const k = { bar: device === "browser" ? 0.05 : 0, pad: device === "laptop" ? 0.028 : device === "phone" ? 0.04 : 0, base: device === "laptop" ? 0.05 : 0 };
  // Total size per unit of screen width, then scale to fit the box.
  const unitW = 1 + 2 * k.pad;
  const unitH = 1 / sar + k.bar + 2 * k.pad + k.base;
  const sw = Math.floor(Math.min(boxW / unitW, boxH / unitH));
  const sh = Math.round(sw / sar);
  const bar = Math.round(sw * k.bar), pad = Math.round(sw * k.pad), base = Math.round(sw * k.base);
  const devW = sw + 2 * pad, devH = sh + bar + 2 * pad + base;
  const cx = split ? W * 0.635 : W / 2;
  const cy = c.portrait && b.title ? H * 0.57 : H * 0.53;
  const left = Math.round(cx - devW / 2), top = Math.round(cy - devH / 2);
  const [fx0, fy0] = b.focus ?? [0.5, 0.45];
  // Focus point in frame pixels: the camera pushes in around it.
  const fx = Math.round(left + pad + fx0 * sw), fy = Math.round(top + pad + bar + fy0 * sh);
  const zoom = b.zoom ?? 1.5;
  // Beside a headline, the push must not slide the device under the text:
  // move the zoom origin right until the device's left edge stays clear.
  const titleRight = split ? Math.round(W * c.fmt.safe.x + W * 0.3 + W * 0.02) : -Infinity;
  const ox = zoom > 1 && split ? Math.min(fx, Math.max(left, (left * zoom - titleRight) / (zoom - 1))) : fx;
  const oy = fy;
  // Where the focus point ends up after the push, for the pinned label.
  const px = Math.round(ox + (fx - ox) * zoom), py = fy;
  const dark = isDarkHex(c.pal.bg);
  const radius = Math.round(sw * (device === "phone" ? 0.12 : 0.018));

  const imgs = names.map((n, i) => `<img class="shot s${i}" src="${asset(c, n).src}" alt="" style="object-position:${fx0 * 100}% ${fy0 * 100}%" />`).join("");
  const chrome = device === "browser"
    ? `<div class="bar"><i></i><i></i><i></i>${b.url ? `<span class="url">${esc(b.url)}</span>` : ""}</div>` : "";
  const html = `
    ${b.title ? `<h2 class="mt">${maskedWords(b.title)}</h2>` : ""}
    <div class="cam">
      <div class="dev ${device}">${chrome}<div class="scr">${imgs}${device === "phone" ? `<span class="island"></span>` : ""}</div>${device === "laptop" ? `<div class="base"></div>` : ""}</div>
    </div>
    ${b.label ? `<div class="pin"><span class="ring"></span><span class="dot"></span><span class="tag">${esc(b.label)}</span></div>` : ""}`;

  const titleW = split ? Math.round(W * 0.3) : c.availW;
  const tfs = b.title ? fitSize(b.title, c.size.display * (split ? 1.05 : 0.85), titleW, c.type.display.family, split ? 4 : 2) : 0;
  const tagFs = Math.round(c.size.body * (c.portrait ? 1.05 : 0.95));
  
  const tagRight = px < W * 0.62;
  const css = `
    #${c.id} .stage { display: block; padding: 0; }
    #${c.id} .mt { position: absolute; margin: 0; ${split
      ? `left: ${Math.round(W * c.fmt.safe.x)}px; top: 50%; width: ${titleW}px; transform: translateY(-50%); text-align: left;`
      : `left: 50%; top: ${Math.round(H * (c.portrait ? 0.15 : 0.08))}px; width: ${titleW}px; margin-left: -${Math.round(titleW / 2)}px; text-align: center;`}
      font-size: ${tfs}px; line-height: 1.02; letter-spacing: ${c.type.displayTracking}; text-wrap: balance; z-index: 2; }
    #${c.id} .cam { position: absolute; inset: 0; transform-origin: ${Math.round(ox)}px ${oy}px; }
    #${c.id} .dev { position: absolute; left: ${left}px; top: ${top}px; width: ${devW}px; height: ${devH}px; box-sizing: border-box; }
    #${c.id} .dev.browser { border-radius: ${radius}px; overflow: hidden; background: ${dark ? "#1d1d20" : "#ffffff"};
      box-shadow: 0 ${Math.round(sw * 0.03)}px ${Math.round(sw * 0.08)}px ${mix("#000000", dark ? 55 : 22)}, 0 0 0 1px ${mix(c.pal.ink, 10)}; }
    #${c.id} .bar { height: ${bar}px; display: flex; align-items: center; gap: ${Math.round(bar * 0.16)}px; padding: 0 ${Math.round(bar * 0.4)}px; position: relative;
      background: ${dark ? "#26262a" : "#f3f2ef"}; border-bottom: 1px solid ${mix(c.pal.ink, 8)}; }
    #${c.id} .bar i { width: ${Math.round(bar * 0.24)}px; height: ${Math.round(bar * 0.24)}px; border-radius: 50%; background: ${dark ? "#4a4a50" : "#d9d6d0"}; }
    #${c.id} .url { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: ${Math.round(bar * 0.12)}px ${Math.round(bar * 0.6)}px;
      border-radius: 999px; background: ${dark ? "#1a1a1d" : "#ffffff"}; font-family: "Geist Mono"; font-weight: 500; font-size: ${Math.round(bar * 0.32)}px;
      color: ${dark ? "#b9b8b4" : "#5c5852"}; white-space: nowrap; }
    #${c.id} .dev.laptop { padding: ${pad}px ${pad}px ${pad + base}px; }
    #${c.id} .dev.laptop::before { content: ""; position: absolute; left: 0; right: 0; top: 0; bottom: ${base}px; border-radius: ${Math.round(sw * 0.03)}px; background: #0e0e10;
      box-shadow: 0 ${Math.round(sw * 0.03)}px ${Math.round(sw * 0.08)}px ${mix("#000000", 45)}; }
    #${c.id} .base { position: absolute; left: -${Math.round(sw * 0.07)}px; right: -${Math.round(sw * 0.07)}px; bottom: 0; height: ${base}px;
      border-radius: 0 0 ${Math.round(base * 0.9)}px ${Math.round(base * 0.9)}px; background: linear-gradient(#d9d8d6, #a9a8a6); }
    #${c.id} .dev.phone { padding: ${pad}px; border-radius: ${radius + pad}px; background: #0e0e10;
      box-shadow: 0 ${Math.round(sw * 0.06)}px ${Math.round(sw * 0.16)}px ${mix("#000000", dark ? 55 : 28)}; }
    #${c.id} .island { position: absolute; top: ${Math.round(sw * 0.035)}px; left: 50%; width: ${Math.round(sw * 0.3)}px; height: ${Math.round(sw * 0.085)}px;
      margin-left: -${Math.round(sw * 0.15)}px; border-radius: 999px; background: #0e0e10; }
    #${c.id} .dev.card { border-radius: ${radius * 1.4}px; overflow: hidden; box-shadow: 0 ${Math.round(sw * 0.03)}px ${Math.round(sw * 0.09)}px ${mix("#000000", dark ? 55 : 22)}; }
    #${c.id} .scr { position: relative; width: ${sw}px; height: ${sh}px; overflow: hidden; z-index: 1;
      border-radius: ${device === "phone" ? radius : device === "laptop" ? Math.round(sw * 0.008) : 0}px; background: #000; }
    #${c.id} .shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
    #${c.id} .pin { position: absolute; left: ${px}px; top: ${py}px; z-index: 3; }
    #${c.id} .dot, #${c.id} .ring { position: absolute; left: 0; top: 0; border-radius: 50%; }
    #${c.id} .dot { width: ${Math.round(tagFs * 0.55)}px; height: ${Math.round(tagFs * 0.55)}px; margin: -${Math.round(tagFs * 0.275)}px 0 0 -${Math.round(tagFs * 0.275)}px;
      background: ${c.pal.accent}; box-shadow: 0 0 0 ${Math.round(tagFs * 0.12)}px ${dark ? "#00000066" : "#ffffffcc"}; }
    #${c.id} .ring { width: ${tagFs * 2}px; height: ${tagFs * 2}px; margin: -${tagFs}px 0 0 -${tagFs}px; border: 2px solid ${c.pal.accent}; }
    #${c.id} .tag { position: absolute; top: -${Math.round(tagFs * 2.4)}px; ${tagRight ? `left: ${Math.round(tagFs * 0.7)}px` : `right: ${Math.round(tagFs * 0.7)}px`};
      padding: ${Math.round(tagFs * 0.42)}px ${Math.round(tagFs * 0.85)}px; border-radius: 999px; white-space: nowrap; ${fontFace(c.type.body)} font-size: ${tagFs}px;
      background: ${c.pal.ink}; color: ${dark ? "#111111" : "#ffffff"}; transform-origin: ${tagRight ? "0%" : "100%"} 100%;
      box-shadow: 0 ${Math.round(tagFs * 0.3)}px ${Math.round(tagFs * 0.9)}px ${mix("#000000", 25)}; }`;

  const T = mediaTimes(b);
  const t = c.t0;
  const js = [
    // Swing in: up from below with a tilt, like a device set on a desk.
    tw("fromTo", `#${c.id} .dev`, { y: Math.round(H * 0.45), rotationX: 26, rotationZ: -3, scale: 0.9, transformPerspective: 1800, opacity: 0 },
      { y: 0, rotationX: 0, rotationZ: 0, scale: 1, opacity: 1, duration: 1.15, ease: "expo.out" }, t),
    // Camera: push toward the focus once the device has landed, then keep drifting.
    tw("fromTo", `#${c.id} .cam`, { scale: 1 }, { scale: zoom, duration: T.zoom, ease: "power2.inOut", immediateRender: false }, t + T.zoomAt),
    tw("to", `#${c.id} .cam`, { scale: zoom * 1.04, duration: Math.max(0.5, c.dur - T.zoomAt - T.zoom + 0.6), ease: "none" }, t + T.zoomAt + T.zoom),
  ];
  if (b.title) js.push(tw("fromTo", `#${c.id} .mt .wi`, { yPercent: 115 }, { yPercent: 0, duration: c.e.enter, ease: c.e.ease, stagger: c.e.stagger }, t + 0.2));
  names.slice(1).forEach((_, i) => {
    js.push(tw("fromTo", `#${c.id} .s${i + 1}`, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power1.inOut", immediateRender: false }, t + T.frames[i]));
  });
  if (names.length > 1) js.push(tw("set", `#${c.id} .shot:not(.s0)`, { opacity: 0 }, t));
  if (b.label) {
    js.push(tw("fromTo", `#${c.id} .dot`, { scale: 0 }, { scale: 1, duration: 0.4, ease: "back.out(3)" }, t + T.label));
    js.push(tw("fromTo", `#${c.id} .ring`, { scale: 0.3, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 1.1, ease: "power2.out", repeat: 3, immediateRender: false }, t + T.label));
    js.push(tw("fromTo", `#${c.id} .tag`, { scale: 0.4, opacity: 0, y: tagFs * 0.4 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: "back.out(2)" }, t + T.label + 0.12));
  }
  return { html, css, js };
}

// ---------------------------------------------------------------- collage

const SPOTS: Record<string, [number, number, number][]> = {
  "l2": [[0.34, 0.5, -6], [0.66, 0.47, 5]],
  "l3": [[0.24, 0.52, -7], [0.5, 0.45, 3], [0.76, 0.53, -4]],
  "l4": [[0.3, 0.34, -5], [0.69, 0.32, 6], [0.31, 0.7, 4], [0.7, 0.68, -6]],
  "p2": [[0.47, 0.36, -5], [0.54, 0.64, 5]],
  "p3": [[0.4, 0.28, -6], [0.6, 0.5, 4], [0.42, 0.72, -3]],
  "p4": [[0.33, 0.3, -5], [0.67, 0.38, 6], [0.35, 0.62, 4], [0.66, 0.72, -6]],
};

export function collage(b: B<"collage">, c: Ctx): SceneOut {
  const W = c.fmt.width, H = c.fmt.height;
  const n = b.cards.length;
  const spots = SPOTS[`${c.portrait ? "p" : "l"}${n}`];
  const maxW = W * (c.portrait ? 0.62 : n >= 4 ? 0.3 : n === 3 ? 0.29 : 0.38);
  const maxH = H * (c.portrait ? (n >= 3 ? 0.27 : 0.34) : n >= 4 ? 0.36 : 0.5);
  const border = Math.round(Math.min(W, H) * 0.008);
  const dark = isDarkHex(c.pal.bg);
  const lfs = Math.round(c.size.body * 0.95);
  const parts = b.cards.map((card, i) => {
    const a = asset(c, card.asset);
    const s = Math.min(maxW / a.w, maxH / a.h);
    const w = Math.round(a.w * s), h = Math.round(a.h * s);
    const [x, y, rot] = spots[i];
    const left = Math.round(W * x - w / 2), top = Math.round(H * y - h / 2);
    // Stickers sit on their own layer above every card, pinned near the
    // card's top-right corner, so a neighbouring card never hides one.
    return {
      rot, html: `<div class="card c${i}" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px"><img src="${a.src}" alt="" /></div>`,
      stk: card.label ? `<span class="stk k${i}" style="left:${left + w - Math.round(lfs * 3)}px;top:${top - Math.round(lfs * 0.9)}px;background:${STICKERS[(i + c.index) % STICKERS.length]}">${esc(card.label)}</span>` : "",
    };
  });
  const html = `${parts.map((p) => p.html).join("")}${parts.map((p) => p.stk).join("")}${b.title ? `<div class="pillcap">${esc(b.title)}</div>` : ""}`;
  const css = `
    #${c.id} .stage { display: block; padding: 0; }
    #${c.id} .card { position: absolute; box-sizing: border-box; padding: ${border}px; border-radius: ${border * 2.4}px; background: ${dark ? "#2a2a2e" : "#ffffff"};
      box-shadow: 0 ${border * 3}px ${border * 8}px ${mix("#000000", dark ? 50 : 20)}; }
    #${c.id} .card img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: ${border * 1.5}px; }
    #${c.id} .stk { position: absolute; z-index: 2; padding: ${Math.round(lfs * 0.3)}px ${Math.round(lfs * 0.7)}px; border-radius: ${Math.round(lfs * 0.25)}px;
      ${fontFace(c.type.body)} font-size: ${lfs}px; color: #141414; white-space: nowrap; box-shadow: 0 ${Math.round(lfs * 0.2)}px ${Math.round(lfs * 0.6)}px ${mix("#000000", 22)}; }
    #${c.id} .pillcap { position: absolute; left: 0; right: 0; margin: 0 auto; width: max-content; bottom: ${Math.round(H * Math.max(0.07, c.fmt.safe.bottom * 0.8))}px; z-index: 3;
      padding: ${Math.round(c.size.body * 0.42)}px ${Math.round(c.size.body * 0.95)}px; border-radius: 999px; background: ${c.pal.ink}; color: ${c.pal.bg};
      ${fontFace(c.type.display)} font-size: ${Math.round(c.size.body * 1.2)}px; letter-spacing: -0.02em; white-space: nowrap; }`;
  const t = c.t0;
  const js: string[] = [];
  parts.forEach((p, i) => {
    js.push(tw("fromTo", `#${c.id} .c${i}`, { y: Math.round(H * 0.7), rotation: p.rot * 4, scale: 0.85 },
      { y: 0, rotation: p.rot, scale: 1, duration: 0.95, ease: "back.out(1.3)" }, t + 0.1 + i * 0.2));
    if (b.cards[i].label) js.push(tw("fromTo", `#${c.id} .k${i}`, { scale: 0, rotation: -25 }, { scale: 1, rotation: p.rot < 0 ? 6 : -6, duration: 0.5, ease: "back.out(2.6)" }, t + 0.75 + n * 0.2 + i * 0.12));
    js.push(tw("fromTo", `#${c.id} .c${i}, #${c.id} .k${i}`, { y: 0 }, { y: (i % 2 ? 1 : -1) * Math.round(H * 0.012), duration: 1.6, ease: "sine.inOut", yoyo: true,
      repeat: Math.max(1, Math.floor(c.dur / 1.6)), immediateRender: false }, t + 1.1 + i * 0.2));
  });
  if (b.title) js.push(tw("fromTo", `#${c.id} .pillcap`, { opacity: 0, y: c.travel, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.8)" }, t + 0.9 + n * 0.2));
  return { html, css, js };
}

// ---------------------------------------------------------------- logo

export function logo(b: B<"logo">, c: Ctx): SceneOut {
  const a = asset(c, b.asset);
  const markH = Math.round(Math.min(c.fmt.width, c.fmt.height) * (c.portrait ? 0.2 : 0.2));
  const markW = Math.round(markH * (a.w / a.h));
  const gap = Math.round(markH * 0.28);
  const nameW = c.availW - markW - gap;
  const fs = fitSize(b.name, Math.round(markH * 0.78), nameW, c.type.display.family, 1);
  const html = `
    <div class="lrow"><img class="lmark" src="${a.src}" alt="" /><span class="lname">${esc(b.name)}</span></div>
    ${b.sub ? `<p class="lsub">${maskedWords(b.sub)}</p>` : ""}`;
  const css = `
    #${c.id} .lrow { display: flex; align-items: center; gap: ${gap}px; }
    #${c.id} .lmark { width: ${markW}px; height: ${markH}px; display: block; }
    #${c.id} .lname { display: block; font-size: ${fs}px; line-height: 1; letter-spacing: ${c.type.displayTracking}; white-space: nowrap; }
    #${c.id} .lsub { margin: ${Math.round(markH * 0.35)}px 0 0; ${fontFace(c.type.body)} font-size: ${Math.round(c.size.body * 1.15)}px; opacity: 0.8;
      text-align: center; max-width: ${Math.round(c.availW * 0.8)}px; text-wrap: balance; }`;
  // The name's width is estimated so the mark can start centred alone.
  const est = Math.min(nameW, b.name.length * fs * 0.56);
  const shift = Math.round((est + gap) / 2);
  const t = c.t0;
  const js = [
    tw("fromTo", `#${c.id} .lrow`, { x: shift }, { x: 0, duration: 0.9, ease: "expo.inOut" }, t + 0.55),
    tw("fromTo", `#${c.id} .lmark`, { scale: 0, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.75, ease: "back.out(2.2)" }, t + 0.05),
    tw("fromTo", `#${c.id} .lname`, { clipPath: "inset(-20% 100% -20% 0%)", x: -Math.round(fs * 0.3) }, { clipPath: "inset(-20% 0% -20% 0%)", x: 0, duration: 0.9, ease: "expo.out" }, t + 0.75),
    tw("fromTo", `#${c.id} .lmark`, { rotation: 0 }, { rotation: 4, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: Math.max(1, Math.floor(c.dur / 1.4)), immediateRender: false }, t + 1.6),
  ];
  if (b.sub) js.push(tw("fromTo", `#${c.id} .lsub .wi`, { yPercent: 115 }, { yPercent: 0, duration: c.e.enter, ease: c.e.ease, stagger: c.e.stagger * 0.6 }, t + 1.3));
  return { html, css, js };
}
