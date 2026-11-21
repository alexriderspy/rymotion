// Background: grey manta rays glide around the prompt, drawn in character
// tiles on a faint grid. Style idea from @stackedlol's ASCII shark prompt
// (x.com/stackedlol/status/2112257760628986188); the code and creatures are ours.
//
// Each frame the rays are painted, shaded, onto a tiny offscreen canvas at
// one pixel per grid cell. Every covered pixel becomes a tile tinted with
// that pixel's grey plus a glyph picked by brightness; thin coverage at the
// edges turns into loose dashes. Motion is slow on purpose: long eased
// glides, a soft wing beat, and glyphs that only reshuffle now and then.
(() => {
  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d");
  const low = document.createElement("canvas");
  const lctx = low.getContext("2d", { willReadFrequently: true });
  const CELL = 11;
  const RAMP = "-:+=o*x%8&#$@"; // light to dark
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, cols = 0, rows = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
    low.width = cols; low.height = rows;
  }

  const hash = (x, y, s = 0) => {
    let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const ease = (t) => t * t * (3 - 2 * t);

  // A glide: a cubic bezier across the screen in normalised coords, taken
  // over `dur` seconds and starting at `at`. Each ray loops through its list.
  const RAYS = [
    { size: 1.0, beat: 2.9, glides: [
      [[-0.15, 0.30], [0.20, 0.02], [0.45, 0.10], [1.15, -0.10]],
      [[1.15, 0.75], [0.80, 0.55], [0.55, 0.95], [-0.15, 1.10]],
    ], dur: 34, at: 0.32 },
    { size: 0.8, beat: 2.4, glides: [
      [[1.15, 0.62], [0.85, 0.40], [0.72, 0.25], [0.95, -0.15]],
      [[-0.15, 0.95], [0.15, 0.75], [0.30, 0.55], [0.05, -0.15]],
    ], dur: 30, at: 0.55 },
    { size: 0.62, beat: 2.1, glides: [
      [[-0.15, 0.88], [0.15, 0.95], [0.35, 0.80], [0.40, 1.15]],
      [[0.70, -0.15], [0.62, 0.15], [0.85, 0.30], [1.15, 0.38]],
    ], dur: 26, at: 0.1 },
  ];

  const bez = (p, t) => {
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [k[0] * p[0][0] + k[1] * p[1][0] + k[2] * p[2][0] + k[3] * p[3][0],
            k[0] * p[0][1] + k[1] * p[1][1] + k[2] * p[2][1] + k[3] * p[3][1]];
  };

  // One manta in local cell units, nose toward +x.
  function manta(x, y, angle, scale, flap, bank) {
    const S = 11 * scale;           // half wingspan
    const L = 7 * scale;            // nose to wing root
    const tip = S * (0.72 + 0.28 * flap);
    lctx.save();
    lctx.translate(x, y);
    lctx.rotate(angle);
    lctx.scale(1, 1 - 0.18 * bank);
    const g = lctx.createRadialGradient(-L * 0.1, 0, 0, -L * 0.1, 0, S * 1.05);
    g.addColorStop(0, "rgb(88,84,80)");
    g.addColorStop(0.45, "rgb(140,135,130)");
    g.addColorStop(1, "rgb(214,210,206)");
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.moveTo(L, 0);
    lctx.bezierCurveTo(L * 0.9, -S * 0.25, L * 0.2, -tip * 0.8, -L * 0.35, -tip);
    lctx.bezierCurveTo(-L * 0.5, -tip * 0.55, -L * 0.75, -S * 0.2, -L, -S * 0.08);
    lctx.lineTo(-L, S * 0.08);
    lctx.bezierCurveTo(-L * 0.75, S * 0.2, -L * 0.5, tip * 0.55, -L * 0.35, tip);
    lctx.bezierCurveTo(L * 0.2, tip * 0.8, L * 0.9, S * 0.25, L, 0);
    lctx.fill();
    // Cephalic fins at the nose
    lctx.fillStyle = "rgb(110,105,100)";
    for (const s of [-1, 1]) {
      lctx.beginPath();
      lctx.ellipse(L * 1.02, s * S * 0.13, L * 0.2, S * 0.05, s * 0.4, 0, Math.PI * 2);
      lctx.fill();
    }
    // Tail: a long thin whip that sways with the beat
    lctx.strokeStyle = "rgb(150,145,140)";
    lctx.lineWidth = Math.max(0.6, 0.9 * scale);
    lctx.lineCap = "round";
    lctx.beginPath();
    lctx.moveTo(-L, 0);
    lctx.quadraticCurveTo(-L * 1.8, (flap - 0.5) * S * 0.25, -L * 2.6, (flap - 0.5) * S * 0.12);
    lctx.stroke();
    lctx.restore();
  }

  function paintLow(time) {
    lctx.clearRect(0, 0, cols, rows);
    RAYS.forEach((ray) => {
      const total = ray.dur * ray.glides.length;
      const local = (time + ray.at * total) % total;
      const gi = Math.floor(local / ray.dur);
      const t = ease((local % ray.dur) / ray.dur);
      const path = ray.glides[gi].map(([px, py]) => [px * cols, py * rows]);
      const [x, y] = bez(path, t);
      const [x2, y2] = bez(path, Math.min(1, t + 0.01));
      const [x0, y0] = bez(path, Math.max(0, t - 0.01));
      const angle = Math.atan2(y2 - y0, x2 - x0);
      // Bank into turns: the change of heading over a short window.
      const [xa, ya] = bez(path, Math.min(1, t + 0.05));
      const turn = Math.atan2(ya - y, xa - x) - angle;
      const flap = 0.5 + 0.5 * Math.sin((time / ray.beat) * Math.PI * 2);
      manta(x, y, angle, ray.size * Math.min(cols, rows * 1.7) / 118, flap, Math.max(-1, Math.min(1, turn * 4)));
    });
    return lctx.getImageData(0, 0, cols, rows).data;
  }

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(28,27,26,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += CELL) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = 0; y <= H; y += CELL) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();

    ctx.font = `500 ${CELL * 0.64}px "Geist Mono", ui-monospace, monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const tick = Math.floor(time * 1.2);

    // Loose dashes drifting in and out across the page.
    for (let i = 0; i < 80; i++) {
      const gx = Math.floor(hash(i, 1) * cols), gy = Math.floor(hash(i, 2) * rows);
      const a = 0.5 + 0.5 * Math.sin(time * 0.45 + hash(i, 3) * 6.28);
      ctx.fillStyle = `rgba(87,83,78,${0.08 + 0.2 * a})`;
      ctx.fillText(hash(i, 4) < 0.85 ? "-" : "o", gx * CELL + CELL / 2, gy * CELL + CELL / 2);
    }

    const px = paintLow(time);
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const i = (gy * cols + gx) * 4;
        const cover = px[i + 3] / 255;
        if (cover < 0.04) continue;
        const h = hash(gx, gy);
        const x = gx * CELL, y = gy * CELL;
        if (cover < 0.3 + 0.35 * hash(gx, gy, 5)) {
          if (h > cover * 2) continue;
          ctx.fillStyle = `rgba(120,113,108,${0.3 + cover})`;
          ctx.fillText(h < 0.35 ? "o" : "-", x + CELL / 2, y + CELL / 2 + 0.5);
          continue;
        }
        // Un-premultiplied grey with a little per-tile grain.
        const grain = (hash(gx, gy, 9) - 0.5) * 26;
        const c = Math.max(60, Math.min(235, px[i] + grain));
        ctx.fillStyle = `rgba(${c},${c - 2},${c - 4},${0.35 + 0.6 * cover})`;
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        if (hash(gx, gy, 3) < 0.88) {
          const dark = 1 - (c - 60) / 175;
          const jitter = hash(gx, gy, Math.floor(tick / 3) + (hash(gx, gy, 2) < 0.15 ? tick : 0)) * 2.4 - 1.2;
          const gi = Math.max(0, Math.min(RAMP.length - 1, Math.round(dark * (RAMP.length - 1) + jitter)));
          ctx.fillStyle = c < 130 ? "rgba(250,250,249,0.75)" : "rgba(41,37,36,0.7)";
          ctx.fillText(RAMP[gi], x + CELL / 2, y + CELL / 2 + 0.5);
        }
      }
    }
  }

  resize();
  addEventListener("resize", () => { resize(); if (reduce) draw(8); });
  const t0 = performance.now();
  let last = 0;
  const loop = (now) => {
    if (now - last > 33) { last = now; draw((now - t0) / 1000 + 8); }
    requestAnimationFrame(loop);
  };
  document.fonts.ready.then(() => (reduce ? draw(8) : requestAnimationFrame(loop)));
})();
