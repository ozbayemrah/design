// ============================================================
// OZBAY portfolio — small, dependency-free behaviors:
// live clock, GitHub stats readout, scroll-reveal.
// ============================================================

const GITHUB_USER = "ozbayemrah";

/* ---------- live clock ---------- */
function tickClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const date = now.toLocaleDateString([], { weekday: "long", month: "short", day: "2-digit", year: "numeric" }).toUpperCase();
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  if (timeEl) timeEl.textContent = time;
  if (dateEl) dateEl.textContent = date;
}
tickClock();
setInterval(tickClock, 1000);

/* ---------- GitHub live stats ---------- */
async function loadGithubStats() {
  const elRepos = document.getElementById("stat-repos");
  const elLang = document.getElementById("stat-lang");
  const elLast = document.getElementById("stat-last");
  const statusEl = document.getElementById("stat-status");

  try {
    const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`);
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const repos = await res.json();

    const repoCount = repos.length;

    const langCounts = {};
    repos.forEach((r) => {
      if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    });
    const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0];

    const mostRecent = repos[0];

    if (elRepos) elRepos.textContent = String(repoCount).padStart(2, "0");
    if (elLang) elLang.textContent = topLang ? topLang[0].toUpperCase() : "—";
    if (elLast) elLast.textContent = mostRecent ? mostRecent.name.toUpperCase() : "—";
    if (statusEl) {
      statusEl.textContent = "ONLINE";
      statusEl.classList.add("on");
    }
  } catch (err) {
    console.warn("GitHub stats unavailable:", err);
    if (statusEl) {
      statusEl.textContent = "OFFLINE";
      statusEl.classList.remove("on");
    }
    [elRepos, elLang, elLast].forEach((el) => {
      if (el) el.textContent = "--";
    });
  }
}
loadGithubStats();

/* ---------- scroll reveal ---------- */
const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && revealEls.length) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("in"));
}

/* ---------- bio panel toggle: one arrow opens/closes all three panels ---------- */
document.querySelectorAll("[data-toggle-group]").forEach((btn) => {
  const group = document.querySelectorAll(`.${btn.dataset.toggleGroup}__panel`);
  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    group.forEach((panel) => panel.classList.toggle("is-open", !open));
  });
});

/* ---------- project videos: load + autoplay only once visible ---------- */
const projectVideos = document.querySelectorAll(".project__video");
if ("IntersectionObserver" in window && projectVideos.length) {
  const vio = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.25 }
  );
  projectVideos.forEach((v) => vio.observe(v));
} else {
  projectVideos.forEach((v) => v.play().catch(() => {}));
}

/* ---------- ID card: matrix-style decrypt/re-encrypt loop ---------- */
/* Operates on individual text nodes (not elements) so structural children
   like <br> and <strong> survive the animation intact. */
const DECRYPT_CHARS = "!<>-_\\/[]{}—=+*^?#01";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const idcOriginal = new WeakMap();
const idcLocked = new WeakSet();

function scrambleReveal(node, duration) {
  if (idcLocked.has(node)) return;
  idcLocked.add(node);
  if (!idcOriginal.has(node)) idcOriginal.set(node, node.nodeValue);
  const original = idcOriginal.get(node);
  const len = original.length;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const revealCount = Math.floor(progress * len);
    let out = "";
    for (let i = 0; i < len; i++) {
      const ch = original[i];
      out += i < revealCount || ch === " " || ch === "\n" ? ch : DECRYPT_CHARS[(Math.random() * DECRYPT_CHARS.length) | 0];
    }
    node.nodeValue = out;
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      node.nodeValue = original;
      idcLocked.delete(node);
    }
  }
  requestAnimationFrame(frame);
}

function collectIdCardTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.nodeValue.trim().length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}

function startIdCardDecryptLoop() {
  const root = document.querySelector(".idcard");
  if (!root) return;
  const targets = collectIdCardTextNodes(root);
  if (!targets.length) return;

  function tick() {
    const pool = targets.filter((node) => !idcLocked.has(node));
    const count = 2 + ((Math.random() * 4) | 0);
    for (let i = 0; i < count && pool.length; i++) {
      const node = pool.splice((Math.random() * pool.length) | 0, 1)[0];
      scrambleReveal(node, 400 + Math.random() * 600);
    }
    setTimeout(tick, 700 + Math.random() * 1400);
  }
  setTimeout(tick, 600 + Math.random() * 800);
}

if (!reducedMotion) startIdCardDecryptLoop();

/* ---------- tactical cursor ---------- */
(function () {
  const cursor = document.querySelector(".tactical-cursor");
  if (!cursor) return;

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!finePointer) {
    cursor.remove();
    return;
  }

  document.documentElement.classList.add("has-tactical-cursor");

  window.addEventListener(
    "mousemove",
    (e) => {
      cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      cursor.classList.add("is-active");
    },
    { passive: true }
  );
  window.addEventListener("mousedown", () => cursor.classList.add("is-down"), { passive: true });
  window.addEventListener("mouseup", () => cursor.classList.remove("is-down"), { passive: true });
  document.addEventListener("mouseleave", () => cursor.classList.remove("is-active"));
  document.addEventListener("mouseenter", () => cursor.classList.add("is-active"));
})();

/* ---------- tactical cursor: content-aware +/. halftone lens ----------
   Reads real pixels — sampled from the actual <img> bitmap, or from a
   faithful re-render of the hovered text's own glyphs — and draws a
   density-based +/. pattern through a circular lens that tracks the
   cursor, 2x its diameter. Dark/ink areas get bigger "+", light areas
   get small ".". */
(function () {
  const shaderCanvas = document.querySelector(".tc-shader");
  if (!shaderCanvas) return;

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!finePointer) {
    shaderCanvas.remove();
    return;
  }

  const sctx = shaderCanvas.getContext("2d", { willReadFrequently: false });
  const LENS_R = 88; // 2x the 88px cursor diameter

  function resizeShader() {
    shaderCanvas.width = window.innerWidth;
    shaderCanvas.height = window.innerHeight;
  }
  resizeShader();
  window.addEventListener("resize", resizeShader, { passive: true });

  const imgRasterCache = new WeakMap();
  function getImageRaster(img) {
    if (!img.complete || !img.naturalWidth) return null;
    let raster = imgRasterCache.get(img);
    if (raster) return raster;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cx = c.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    let data;
    try {
      data = cx.getImageData(0, 0, c.width, c.height);
    } catch (err) {
      return null; // CORS-tainted source, skip gracefully
    }
    raster = { width: c.width, height: c.height, data };
    imgRasterCache.set(img, raster);
    return raster;
  }

  const textRasterCache = new WeakMap();
  function getTextRaster(el) {
    const rect = el.getBoundingClientRect();
    const w = Math.max(1, Math.ceil(rect.width));
    const h = Math.max(1, Math.ceil(rect.height));
    const text = el.textContent;
    const cached = textRasterCache.get(el);
    if (cached && cached.srcW === w && cached.srcH === h && cached.text === text) return cached;

    const cs = getComputedStyle(el);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d", { willReadFrequently: true });
    cx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
    cx.fillStyle = "#fff";
    cx.textBaseline = "alphabetic";
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    let y = parseFloat(cs.fontSize);
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (cx.measureText(test).width > w && line) {
        cx.fillText(line, 0, y);
        line = word;
        y += lineHeight;
        if (y > h + lineHeight) {
          line = "";
          break;
        }
      } else {
        line = test;
      }
    }
    if (line && y <= h + lineHeight) cx.fillText(line, 0, y);

    const data = cx.getImageData(0, 0, w, h);
    const raster = { width: w, height: h, data, srcW: w, srcH: h, text };
    textRasterCache.set(el, raster);
    return raster;
  }

  const TEXT_SELECTOR =
    "h1, h2, h3, p, .label, .project__title, .project__desc, .hero__tagline, " +
    ".bio__body p, .idcard__field-value, .idcard__row-value, .idcard__name, .idcard__footnote";

  function getShaderTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const img = el.closest("img");
    if (img) return { type: "image", el: img };
    const textEl = el.closest(TEXT_SELECTOR);
    if (textEl && textEl.textContent.trim()) return { type: "text", el: textEl };
    return null;
  }

  let mouseX = -9999;
  let mouseY = -9999;
  window.addEventListener(
    "mousemove",
    (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    },
    { passive: true }
  );

  function drawLensGrid(raster, mode, mapX, mapY) {
    const step = 9;
    const cx = mouseX;
    const cy = mouseY;
    const d = raster.data.data;
    sctx.save();
    sctx.beginPath();
    sctx.arc(cx, cy, LENS_R, 0, Math.PI * 2);
    sctx.clip();
    for (let gx = cx - LENS_R; gx <= cx + LENS_R; gx += step) {
      for (let gy = cy - LENS_R; gy <= cy + LENS_R; gy += step) {
        const dx = gx - cx;
        const dy = gy - cy;
        if (dx * dx + dy * dy > LENS_R * LENS_R) continue;
        const rx = Math.round(mapX(gx));
        const ry = Math.round(mapY(gy));
        if (rx < 0 || ry < 0 || rx >= raster.width || ry >= raster.height) continue;
        const idx = (ry * raster.width + rx) * 4;
        const a = d[idx + 3];
        if (a < 10) continue;

        let density;
        if (mode === "image") {
          const lum = (0.2126 * d[idx] + 0.7152 * d[idx + 1] + 0.0722 * d[idx + 2]) / 255;
          density = 1 - lum;
        } else {
          density = a / 255;
        }

        if (density > 0.45) {
          const size = 2 + density * 4;
          sctx.strokeStyle = `rgba(255,255,255,${0.45 + density * 0.5})`;
          sctx.lineWidth = 1;
          sctx.beginPath();
          sctx.moveTo(gx - size, gy);
          sctx.lineTo(gx + size, gy);
          sctx.moveTo(gx, gy - size);
          sctx.lineTo(gx, gy + size);
          sctx.stroke();
        } else {
          const size = 0.7 + (1 - density) * 0.9;
          sctx.fillStyle = `rgba(255,255,255,${0.35 + (1 - density) * 0.35})`;
          sctx.beginPath();
          sctx.arc(gx, gy, size, 0, Math.PI * 2);
          sctx.fill();
        }
      }
    }
    sctx.restore();
  }

  function drawShader() {
    sctx.clearRect(0, 0, shaderCanvas.width, shaderCanvas.height);
    const target = getShaderTarget(mouseX, mouseY);

    if (target && target.type === "image") {
      const raster = getImageRaster(target.el);
      if (raster) {
        const rect = target.el.getBoundingClientRect();
        const scale = Math.max(rect.width / raster.width, rect.height / raster.height);
        const dispW = raster.width * scale;
        const dispH = raster.height * scale;
        const offX = rect.left + (rect.width - dispW) / 2;
        const offY = rect.top + (rect.height - dispH) / 2;
        drawLensGrid(
          raster,
          "image",
          (sx) => (sx - offX) / scale,
          (sy) => (sy - offY) / scale
        );
      }
    } else if (target && target.type === "text") {
      const raster = getTextRaster(target.el);
      if (raster) {
        const rect = target.el.getBoundingClientRect();
        drawLensGrid(
          raster,
          "text",
          (sx) => sx - rect.left,
          (sy) => sy - rect.top
        );
      }
    }

    requestAnimationFrame(drawShader);
  }
  requestAnimationFrame(drawShader);
})();

/* ---------- background music toggle ---------- */
(function () {
  const audio = document.getElementById("bg-audio");
  const toggle = document.querySelector(".sound-toggle");
  if (!audio || !toggle) return;
  const label = toggle.querySelector(".sound-toggle__label");

  function setState(playing) {
    toggle.setAttribute("aria-pressed", String(playing));
    if (label) label.textContent = playing ? "Audio: On" : "Audio: Off";
  }

  toggle.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });
  audio.addEventListener("play", () => setState(true));
  audio.addEventListener("pause", () => setState(false));
})();
