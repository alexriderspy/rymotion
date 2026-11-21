(() => {
  const form = document.getElementById("ask");
  const box = document.getElementById("prompt");
  const sheet = document.getElementById("sheet");
  const cmd = document.getElementById("cmd");
  const BASE = "npx github:alexriderspy/rymotion studio";
  let format = "16:9";

  const sync = () => {
    form.classList.toggle("ready", box.value.trim().length > 0);
    box.style.height = "auto";
    box.style.height = Math.min(box.scrollHeight, 180) + "px";
  };
  box.addEventListener("input", sync);
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  document.querySelectorAll(".formats button").forEach((b) => b.addEventListener("click", () => {
    format = b.dataset.format;
    document.querySelectorAll(".formats button").forEach((o) => o.setAttribute("aria-checked", String(o === b)));
  }));

  // Whatever they typed travels into the command, so the app opens with it.
  const quote = (s) => `"${s.replace(/["\\$`]/g, "\\$&").replace(/\s+/g, " ")}"`;
  const open = () => {
    const p = box.value.trim();
    cmd.textContent = BASE + (p ? ` ${quote(p)}` : "") + (format !== "16:9" ? ` --format ${format}` : "");
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add("on"));
  };
  const close = () => {
    sheet.classList.remove("on");
    setTimeout(() => (sheet.hidden = true), 380);
  };
  form.addEventListener("submit", (e) => { e.preventDefault(); open(); });
  document.getElementById("start").addEventListener("click", open);
  document.getElementById("close").addEventListener("click", close);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) close(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) close(); });

  // Links from posts can open the panel directly: /#start
  if (location.hash === "#start") open();

  const copy = document.getElementById("copy");
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(cmd.textContent); copy.textContent = "Copied"; }
    catch { copy.textContent = "Select it"; }
    setTimeout(() => (copy.textContent = "Copy"), 1600);
  });

  // The top bar gets a frosted backing once the page scrolls under it.
  const bar = document.querySelector(".bar");
  const onScroll = () => bar.classList.toggle("solid", window.scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Example clips play only while on screen.
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) { v.preload = "auto"; v.play().catch(() => {}); } else v.pause();
  }), { threshold: 0.4 });
  document.querySelectorAll(".reel video").forEach((v) => io.observe(v));
})();
