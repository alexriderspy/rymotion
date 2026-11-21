(() => {
  const $ = (id) => document.getElementById(id);
  const form = $("ask"), box = $("prompt"), body = document.body;
  const player = $("player"), viewport = $("viewport");
  const SIZES = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080], "4:5": [1080, 1350] };
  let format = "16:9";
  let template = "";
  const atts = []; // { file, name, about, url }
  let project = null;
  let total = 0, playing = false, busy = false;

  const mode = (m) => { body.className = `studio mode-${m}`; $("home").hidden = m !== "home"; $("screen").hidden = m === "home"; };

  // ---- prompt box
  const sync = () => {
    form.classList.toggle("ready", box.value.trim().length > 0 && !busy);
    box.style.height = "auto";
    box.style.height = Math.min(box.scrollHeight, 160) + "px";
  };
  box.addEventListener("input", sync);
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  const setFormat = (f) => {
    format = SIZES[f] ? f : "16:9";
    document.querySelectorAll(".formats button").forEach((o) => o.setAttribute("aria-checked", String(o.dataset.format === format)));
  };
  document.querySelectorAll(".formats button").forEach((b) => b.addEventListener("click", () => setFormat(b.dataset.format)));
  document.querySelectorAll("#looks button").forEach((b) => b.addEventListener("click", () => {
    template = b.dataset.template;
    document.querySelectorAll("#looks button").forEach((o) => o.setAttribute("aria-checked", String(o === b)));
  }));

  // ---- attachments: screenshots and logos the video is built around
  const list = $("atts");
  const drawAtts = () => {
    list.hidden = !atts.length;
    list.innerHTML = atts.map((a, i) => `<li><img src="${a.url}" alt="" /><input data-i="${i}" placeholder="What it shows, e.g. the export button top right" value="${a.about.replace(/"/g, "&quot;")}" /><button type="button" data-x="${i}" aria-label="Remove">×</button></li>`).join("");
    list.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => (atts[Number(inp.dataset.i)].about = inp.value)));
    list.querySelectorAll("button").forEach((x) => x.addEventListener("click", () => { atts.splice(Number(x.dataset.x), 1); drawAtts(); }));
  };
  const add = async (files) => {
    for (const f of [...files].slice(0, 8 - atts.length)) {
      const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
      const r = await fetch(`/api/upload?ext=${encodeURIComponent(ext)}`, { method: "POST", body: f });
      const j = await r.json();
      if (!r.ok) { $("err").textContent = j.error; $("err").hidden = false; continue; }
      const base = f.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20) || "picture";
      let name = base, k = 2;
      while (atts.some((a) => a.name === name)) name = `${base}_${k++}`;
      atts.push({ file: j.file, name, about: /logo|icon/i.test(f.name) ? "the logo" : "", url: URL.createObjectURL(f) });
    }
    drawAtts();
  };
  $("attach").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", (e) => { add(e.target.files); e.target.value = ""; });
  form.addEventListener("dragover", (e) => { e.preventDefault(); form.classList.add("drop"); });
  form.addEventListener("dragleave", () => form.classList.remove("drop"));
  form.addEventListener("drop", (e) => { e.preventDefault(); form.classList.remove("drop"); add(e.dataTransfer.files); });

  document.querySelectorAll("#ideas button").forEach((b) => b.addEventListener("click", () => { box.value = b.textContent; sync(); box.focus(); }));

  // A prompt passed on the command line arrives in the URL.
  const q = new URLSearchParams(location.search);
  if (q.get("prompt")) box.value = q.get("prompt");
  if (q.get("format")) setFormat(q.get("format"));
  history.replaceState(null, "", "/");

  // ---- key
  let hasKey = false;
  const loadConfig = async () => {
    const c = await fetch("/api/config").then((r) => r.json());
    hasKey = c.hasKey;
    $("model").textContent = `${c.model} · ${c.provider}`;
    $("keybox").hidden = hasKey;
    form.hidden = !hasKey;
    if (hasKey) box.focus(); else $("key").focus();
  };
  $("keybox").addEventListener("submit", async (e) => {
    e.preventDefault();
    const r = await fetch("/api/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: $("key").value }) });
    if (r.ok) { $("key").value = ""; await loadConfig(); sync(); }
    else $("keybox").querySelector("label").textContent = (await r.json()).error;
  });

  // ---- preview frame sizing: the composition renders at full size, scaled to fit.
  const fit = () => {
    const [w, h] = SIZES[project?.format ?? format];
    const frame = $("frame");
    const maxW = frame.clientWidth, maxH = frame.clientHeight;
    const s = Math.min(maxW / w, maxH / h);
    viewport.style.width = `${Math.round(w * s)}px`;
    viewport.style.height = `${Math.round(h * s)}px`;
    player.style.width = `${w}px`; player.style.height = `${h}px`;
    player.style.transform = `scale(${s})`;
  };
  // Refit whenever the space changes, e.g. when the controls appear.
  new ResizeObserver(fit).observe($("frame"));

  // ---- generate
  let timer = 0;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prompt = box.value.trim();
    if (!prompt || busy) return;
    busy = true; sync();
    project = null;
    mode("work");
    $("controls").hidden = true; $("err").hidden = true; viewport.classList.remove("on"); $("progress").hidden = false;
    document.querySelectorAll("#progress li").forEach((li) => { li.className = ""; li.hidden = li.dataset.stage === "draw"; });
    fit();
    const t0 = Date.now();
    clearInterval(timer);
    timer = setInterval(() => ($("elapsed").textContent = `${Math.round((Date.now() - t0) / 1000)}s`), 500);
    const mark = (stage) => {
      const order = ["plan", "draw", "build"];
      const k = order.indexOf(stage);
      document.querySelectorAll("#progress li").forEach((li) => {
        const j = order.indexOf(li.dataset.stage);
        li.className = j < k ? "done" : j === k ? "now" : "";
        if (li.dataset.stage === "draw" && stage === "draw") li.hidden = false;
      });
    };
    try {
      const res = await fetch("/api/make", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, format, template, assets: atts.map(({ file, name, about }) => ({ file, name, about })) }) });
      if (!res.ok) throw new Error((await res.json()).error);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const msg = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1);
          if (msg.stage === "error") throw new Error(msg.error);
          if (msg.stage === "done") { open(msg.project, msg.beats); }
          else mark(msg.stage);
        }
      }
    } catch (err) {
      $("progress").hidden = true;
      $("err").textContent = err.message || "Something went wrong.";
      $("err").hidden = false;
    } finally {
      clearInterval(timer);
      busy = false; sync();
    }
  });

  // ---- open a project in the player
  function open(p, beats) {
    project = p;
    mode("result");
    fit();
    $("progress").hidden = true; $("err").hidden = true;
    viewport.classList.remove("on");
    player.src = `/p/${p.id}/index.html`;
    $("ticks").innerHTML = (beats ?? []).slice(1).map((b) => `<i style="left:${(b.start / p.duration) * 100}%"></i>`).join("");
    document.querySelectorAll(".ex").forEach((b) => { b.disabled = false; b.textContent = b.dataset.kind === "mp4" ? "Export MP4" : "WebM"; });
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const post = (m) => player.contentWindow?.postMessage({ rymotion: m.type, t: m.t }, "*");
  addEventListener("message", (e) => {
    if (e.source !== player.contentWindow) return;
    const m = e.data || {};
    if (m.rymotion === "ready") {
      total = m.total;
      $("controls").hidden = false;
      viewport.classList.add("on");
      post({ type: "play" });
    } else if (m.rymotion === "tick") {
      playing = m.playing;
      $("play").classList.toggle("is-playing", playing);
      const k = total ? m.t / total : 0;
      $("fill").style.transform = `scaleX(${k})`;
      $("knob").style.left = `${k * 100}%`;
      $("time").textContent = `${fmt(m.t)} / ${fmt(total)}`;
    }
  });
  $("play").addEventListener("click", () => post({ type: playing ? "pause" : "play" }));
  addEventListener("keydown", (e) => {
    if (e.code === "Space" && document.activeElement !== box && project) { e.preventDefault(); $("play").click(); }
  });
  const scrub = $("scrub");
  const seekAt = (x) => { const r = scrub.getBoundingClientRect(); post({ type: "seek", t: Math.max(0, Math.min(1, (x - r.left) / r.width)) * total }); };
  scrub.addEventListener("pointerdown", (e) => {
    post({ type: "pause" }); seekAt(e.clientX); scrub.setPointerCapture(e.pointerId);
    const move = (ev) => seekAt(ev.clientX);
    const up = () => { scrub.removeEventListener("pointermove", move); scrub.removeEventListener("pointerup", up); };
    scrub.addEventListener("pointermove", move); scrub.addEventListener("pointerup", up);
  });

  // ---- export
  document.querySelectorAll(".ex").forEach((btn) => btn.addEventListener("click", async () => {
    if (!project || btn.disabled) return;
    const kind = btn.dataset.kind;
    const label = btn.textContent;
    btn.disabled = true; btn.classList.add("working"); btn.textContent = "Rendering…";
    try {
      const r = await fetch(`/api/export/${project.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const a = document.createElement("a");
      a.href = j.url; a.download = `${project.id}.${kind}`;
      document.body.append(a); a.click(); a.remove();
      btn.textContent = "Saved ✓";
    } catch (err) {
      btn.textContent = "Failed";
      $("err").textContent = err.message; $("err").hidden = false;
    } finally {
      btn.classList.remove("working");
      setTimeout(() => { btn.disabled = false; btn.textContent = label; }, 2400);
    }
  }));

  // ---- history
  const menu = $("menu"), hb = $("history");
  hb.addEventListener("click", async () => {
    if (!menu.hidden) { menu.hidden = true; hb.setAttribute("aria-expanded", "false"); return; }
    const list = await fetch("/api/history").then((r) => r.json());
    menu.innerHTML = list.length
      ? list.map((p, i) => `<li><button type="button" data-i="${i}"><b>${p.title.replace(/</g, "&lt;")}</b><span>${p.format} · ${Math.round(p.duration)}s · ${new Date(p.created).toLocaleDateString()}</span></button></li>`).join("")
      : `<li class="empty">Your videos will show up here.</li>`;
    menu.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const p = list[Number(b.dataset.i)];
      menu.hidden = true; hb.setAttribute("aria-expanded", "false");
      setFormat(p.format); open(p, []);
    }));
    menu.hidden = false; hb.setAttribute("aria-expanded", "true");
  });
  addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest(".hist")) { menu.hidden = true; hb.setAttribute("aria-expanded", "false"); } });

  loadConfig().then(sync);
})();
