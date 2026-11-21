import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { writeProject } from "./compile.ts";
import { lint, render } from "./hyperframes.ts";
import { makeSpec, modelConfig, writeCustomCode, type ModelConfig } from "./make.ts";
import type { Spec } from "./spec.ts";
import { TEMPLATES } from "./tokens.ts";
import { MEDIA_EXT } from "./media.ts";
import { createWriteStream } from "node:fs";

// Rymotion studio: the local app behind `rymotion studio`. It serves the
// studio page, talks to the model with the user's own key, builds each video
// into ~/Rymotion and renders exports on demand. It listens on 127.0.0.1
// only, and the key never leaves this process: no route returns it.

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(here, "..", "web", "public");
const HOME = join(homedir(), "Rymotion");
const CONFIG_DIR = join(homedir(), ".config", "rymotion");
const CONFIG = join(CONFIG_DIR, "config.json");
// Pictures people attach are kept here until a video uses them.
const UPLOADS = join(HOME, ".uploads");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json",
  ".mp4": "video/mp4", ".webm": "video/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".txt": "text/plain; charset=utf-8",
};

interface Saved { apiKey?: string; baseUrl?: string; model?: string }

function loadSaved(): Saved {
  try { return JSON.parse(readFileSync(CONFIG, "utf8")) as Saved; } catch { return {}; }
}

function currentModel(): ModelConfig {
  const s = loadSaved();
  // Environment wins, so `DEEPSEEK_API_KEY=... rymotion studio` just works.
  const env = modelConfig();
  return { apiKey: env.apiKey || s.apiKey || "", baseUrl: process.env.DEEPSEEK_MOTION_BASE_URL ?? s.baseUrl ?? env.baseUrl, model: process.env.DEEPSEEK_MOTION_MODEL ?? s.model ?? env.model };
}
const isLocalModel = (c: ModelConfig) => /localhost|127\.0\.0\.1/.test(c.baseUrl);

// The player is injected into a project's page when the studio shows it.
// HyperFrames normally drives the timeline; here a few lines do the same:
// seek the paused GSAP timeline and show each clip only inside its window.
const PLAYER = `<script>window.__timelines = {};</script>
<style>html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }</style>
<script>
addEventListener("load", () => {
  const root = document.getElementById("root");
  const total = parseFloat(root.dataset.duration);
  const tl = window.__timelines.main;
  const clips = [...root.querySelectorAll(":scope > [data-start]")].filter((el) => el.tagName !== "AUDIO");
  const music = document.getElementById("music");
  let t = 0, playing = false, last = 0;
  const seek = (v) => {
    t = Math.max(0, Math.min(total, v));
    tl.time(t, false);
    for (const c of clips) {
      const s = parseFloat(c.dataset.start), d = parseFloat(c.dataset.duration);
      c.style.visibility = t >= s && t < s + d ? "visible" : "hidden";
    }
    parent.postMessage({ rymotion: "tick", t, total, playing }, "*");
  };
  const frame = (now) => {
    if (!playing) return;
    seek(t + (now - last) / 1000); last = now;
    if (t >= total) { playing = false; if (music) music.pause(); seek(total); return; }
    requestAnimationFrame(frame);
  };
  addEventListener("message", (e) => {
    const m = e.data || {};
    if (m.rymotion === "play") {
      if (t >= total) seek(0);
      playing = true; last = performance.now();
      if (music) { music.currentTime = t; music.play().catch(() => {}); }
      requestAnimationFrame(frame);
    } else if (m.rymotion === "pause") {
      playing = false; if (music) music.pause(); seek(t);
    } else if (m.rymotion === "seek") {
      seek(m.t); if (music) music.currentTime = t;
    }
  });
  document.fonts.ready.then(() => { seek(0); parent.postMessage({ rymotion: "ready", total }, "*"); });
});
</script>`;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "video";

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 1e6) throw new Error("body too large"); }
  return raw ? JSON.parse(raw) : {};
}

async function sendFile(res: ServerResponse, file: string, inject = "") {
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error("not a file");
    let data: Buffer | string = await readFile(file);
    if (inject && extname(file) === ".html") data = data.toString("utf8").replace("<head>", `<head>\n${inject}`);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404).end("not found");
  }
}

// Resolve a request path inside a base folder, refusing anything that escapes it.
function inside(base: string, rel: string): string | undefined {
  const full = resolve(base, "." + normalize("/" + rel));
  return full === base || full.startsWith(base + sep) ? full : undefined;
}

interface Project { id: string; title: string; prompt: string; format: string; duration: number; created: number; exports: string[] }

function readProject(id: string): Project | undefined {
  try {
    const dir = join(HOME, id);
    const meta = JSON.parse(readFileSync(join(dir, "rymotion.json"), "utf8")) as Omit<Project, "exports">;
    const exports = ["final.mp4", "final.webm"].filter((f) => existsSync(join(dir, f)));
    return { ...meta, id, exports };
  } catch { return undefined; }
}

function history(): Project[] {
  if (!existsSync(HOME)) return [];
  return readdirSync(HOME).map(readProject).filter((p): p is Project => !!p).sort((a, b) => b.created - a.created).slice(0, 30);
}

function ffmpeg(args: string[]): Promise<boolean> {
  return new Promise((done) => {
    const p = spawn("ffmpeg", args, { stdio: "ignore" });
    p.on("error", () => done(false));
    p.on("close", (code) => done(code === 0));
  });
}

// One export at a time per project; repeated clicks share the same job.
const jobs = new Map<string, Promise<{ ok: boolean; error?: string }>>();

async function exportVideo(id: string, kind: "mp4" | "webm"): Promise<{ ok: boolean; error?: string }> {
  const dir = join(HOME, id);
  const mp4 = join(dir, "final.mp4");
  if (!existsSync(mp4)) {
    const r = await render(dir, mp4, "looks");
    if (!r.ok) return { ok: false, error: r.output.split("\n").filter(Boolean).slice(-4).join("\n") || "render failed" };
  }
  if (kind === "webm" && !existsSync(join(dir, "final.webm"))) {
    const ok = await ffmpeg(["-y", "-i", mp4, "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1", "-c:a", "libopus", join(dir, "final.webm")]);
    if (!ok) return { ok: false, error: "ffmpeg could not make the WebM. Is ffmpeg installed?" };
  }
  return { ok: true };
}

async function make(req: IncomingMessage, res: ServerResponse) {
  const b = await body(req);
  const prompt = String(b.prompt ?? "").trim().slice(0, 1200);
  const format = ["16:9", "9:16", "1:1", "4:5"].includes(String(b.format)) ? String(b.format) as Spec["format"] : "16:9";
  const template = typeof b.template === "string" && b.template in TEMPLATES ? b.template : undefined;
  if (!prompt) return send(res, 400, { error: "Type what the video should be about." });
  const cfg = currentModel();
  if (!cfg.apiKey && !isLocalModel(cfg)) return send(res, 401, { error: "Add your API key first." });
  // Attached pictures: { name, file (an upload id), about }. The model sees
  // names and notes; the files are attached to the spec by the tool.
  const assets: Record<string, string> = {};
  const about: string[] = [];
  for (const a of Array.isArray(b.assets) ? b.assets.slice(0, 8) : []) {
    const x = a as { name?: string; file?: string; about?: string };
    const name = String(x.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24);
    const file = String(x.file ?? "");
    const path = /^[\w-]+\.(png|jpe?g|gif|webp|svg)$/i.test(file) ? join(UPLOADS, file) : "";
    if (!name || !path || !existsSync(path)) continue;
    assets[name] = path;
    about.push(`  - ${name}: ${String(x.about ?? "").slice(0, 300) || "(no description)"}`);
  }
  const full = `${prompt}\n\nUse format "${format}".${template ? `\nUse template "${template}".` : ""}${about.length ? `\n\nAssets you can use (by name):\n${about.join("\n")}` : ""}`;

  // Progress streams as one JSON object per line.
  res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });
  const say = (o: object) => res.write(JSON.stringify(o) + "\n");
  try {
    say({ stage: "plan" });
    const made = await makeSpec(full, cfg, { assets });
    made.spec.format = format;
    if (template) Object.assign(made.spec, { template, palette: TEMPLATES[template].palette, type: TEMPLATES[template].type, background: TEMPLATES[template].background });
    const customs = made.spec.beats.filter((x) => x.scene === "custom").length;
    if (customs) {
      say({ stage: "draw", count: customs });
      await writeCustomCode(made.spec, cfg);
    }
    say({ stage: "build" });
    const id = `${slug(made.spec.title)}-${Date.now().toString(36).slice(-5)}`;
    const dir = join(HOME, id);
    mkdirSync(dir, { recursive: true });
    const c = writeProject(made.spec, dir, { music: "auto" });
    const l = await lint(dir);
    if (!l.ok) throw new Error("The video did not pass its layout check. Try again or rephrase the prompt.");
    const meta = { title: made.spec.title, prompt, format, duration: c.duration, created: Date.now() };
    writeFileSync(join(dir, "rymotion.json"), JSON.stringify(meta, null, 2) + "\n");
    say({ stage: "done", project: { ...meta, id, exports: [] }, beats: c.beats });
  } catch (err) {
    say({ stage: "error", error: (err as Error).message.replace(/Bearer\s+\S+/g, "Bearer …") });
  }
  res.end();
}

export function startStudio(opts: { port?: number; prompt?: string; format?: string; open?: boolean } = {}) {
  mkdirSync(HOME, { recursive: true });
  const port = opts.port ?? 5177;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = decodeURIComponent(url.pathname);
      // Only this machine's pages may call the API.
      // Refuse other hostnames too, so a web page can't reach the studio by
      // pointing its own domain at 127.0.0.1.
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? "")) return send(res, 403, { error: "forbidden" });
      const origin = req.headers.origin;
      if (req.method === "POST" && origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return send(res, 403, { error: "forbidden" });

      if (path === "/api/config" && req.method === "GET") {
        const c = currentModel();
        return send(res, 200, { hasKey: !!c.apiKey || isLocalModel(c), model: c.model, provider: new URL(c.baseUrl).host, home: HOME });
      }
      if (path === "/api/key" && req.method === "POST") {
        const b = await body(req);
        const apiKey = String(b.apiKey ?? "").trim();
        if (!/^\S{8,200}$/.test(apiKey)) return send(res, 400, { error: "That doesn't look like an API key." });
        mkdirSync(CONFIG_DIR, { recursive: true });
        writeFileSync(CONFIG, JSON.stringify({ ...loadSaved(), apiKey }, null, 2), { mode: 0o600 });
        chmodSync(CONFIG, 0o600);
        return send(res, 200, { ok: true });
      }
      if (path === "/api/make" && req.method === "POST") return await make(req, res);
      if (path === "/api/upload" && req.method === "POST") {
        // Raw file body; the extension comes from the query. Capped at 15 MB.
        const ext = String(url.searchParams.get("ext") ?? "").toLowerCase();
        if (!MEDIA_EXT.includes(ext)) return send(res, 400, { error: "Use PNG, JPEG, GIF, WebP or SVG." });
        mkdirSync(UPLOADS, { recursive: true });
        const file = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${ext === ".jpeg" ? ".jpg" : ext}`;
        let size = 0;
        const out = createWriteStream(join(UPLOADS, file));
        for await (const chunk of req) {
          size += (chunk as Buffer).length;
          if (size > 15e6) { out.destroy(); return send(res, 413, { error: "Pictures must be under 15 MB." }); }
          out.write(chunk);
        }
        await new Promise((done) => out.end(done));
        return send(res, 200, { file });
      }
      if (path === "/api/templates" && req.method === "GET")
        return send(res, 200, Object.entries(TEMPLATES).map(([name, t]) => ({ name, description: t.description })));
      if (path === "/api/history" && req.method === "GET") return send(res, 200, history());
      const ex = path.match(/^\/api\/export\/([\w-]+)$/);
      if (ex && req.method === "POST") {
        const id = ex[1];
        if (!readProject(id)) return send(res, 404, { error: "No such video." });
        const kind = (await body(req)).kind === "webm" ? "webm" : "mp4";
        const key = `${id}:${kind}`;
        if (!jobs.has(key)) jobs.set(key, exportVideo(id, kind).finally(() => jobs.delete(key)));
        const r = await jobs.get(key)!;
        return r.ok ? send(res, 200, { url: `/p/${id}/final.${kind}` }) : send(res, 500, { error: r.error });
      }
      const proj = path.match(/^\/p\/([\w-]+)\/(.*)$/);
      if (proj) {
        const file = inside(join(HOME, proj[1]), proj[2] || "index.html");
        if (!file || !readProject(proj[1])) return send(res, 404, { error: "not found" });
        return sendFile(res, file, proj[2] === "index.html" || proj[2] === "" ? PLAYER : "");
      }
      const file = inside(PUBLIC, path === "/" ? "studio.html" : path);
      if (!file) return send(res, 404, { error: "not found" });
      return sendFile(res, file);
    } catch (err) {
      if (!res.headersSent) send(res, 500, { error: (err as Error).message });
      else res.end();
    }
  });
  server.listen(port, "127.0.0.1", () => {
    const q = new URLSearchParams();
    if (opts.prompt) q.set("prompt", opts.prompt);
    if (opts.format) q.set("format", opts.format);
    const link = `http://127.0.0.1:${port}/${q.size ? `?${q}` : ""}`;
    console.log(`\n  Rymotion studio is running: ${link}\n  Videos are saved in ${HOME}\n  Press Ctrl+C to stop.\n`);
    if (opts.open !== false) {
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
      const args = process.platform === "win32" ? ["/c", "start", "", link] : [link];
      spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
    }
  });
  return server;
}
