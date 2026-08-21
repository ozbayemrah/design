// ============================================================
// OZBAY portfolio — small, dependency-free behaviors:
// live clock, GitHub stats readout, scroll-reveal.
// ============================================================

const GITHUB_USER = "ozbayemrah";

/* ---------- theme toggle: light/dark, persisted in localStorage ---------- */
(function () {
  const root = document.documentElement;
  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;

  function isLight() {
    return root.getAttribute("data-theme") === "light";
  }
  function updateButton() {
    btn.setAttribute("aria-pressed", String(isLight()));
    btn.setAttribute("aria-label", isLight() ? "Switch to dark theme" : "Switch to light theme");
  }
  updateButton();

  btn.addEventListener("click", () => {
    if (isLight()) {
      root.removeAttribute("data-theme");
      localStorage.setItem("theme", "dark");
    } else {
      root.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
    updateButton();
    window.dispatchEvent(new Event("theme:change"));
  });
})();

/* ---------- live clock: Vienna (home base) + the visitor's own local time ---------- */
const TIME_OPTS = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
const DATE_OPTS = { weekday: "long", month: "short", day: "2-digit", year: "numeric" };

// "GMT+1" / "GMT+2" — computed live so it stays correct across DST
// changes instead of hardcoding Vienna's offset.
function gmtOffsetLabel(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "shortOffset" }).formatToParts(date);
    const tz = parts.find((p) => p.type === "timeZoneName");
    return tz ? tz.value : "GMT";
  } catch (e) {
    return "GMT";
  }
}

function tickClock() {
  const now = new Date();
  const viennaTime = now.toLocaleTimeString("en-GB", { ...TIME_OPTS, timeZone: "Europe/Vienna" });
  const viennaDate = now.toLocaleDateString("en-GB", { ...DATE_OPTS, timeZone: "Europe/Vienna" }).toUpperCase();
  const localTime = now.toLocaleTimeString("en-GB", TIME_OPTS);
  const localDate = now.toLocaleDateString("en-GB", DATE_OPTS).toUpperCase();

  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  const viennaZoneEl = document.getElementById("clock-zone-vienna");
  const localTimeEl = document.getElementById("clock-time-local");
  const localDateEl = document.getElementById("clock-date-local");
  if (timeEl) timeEl.textContent = viennaTime;
  if (dateEl) dateEl.textContent = viennaDate;
  if (viennaZoneEl) viennaZoneEl.textContent = gmtOffsetLabel(now, "Europe/Vienna");
  if (localTimeEl) localTimeEl.textContent = localTime;
  if (localDateEl) localDateEl.textContent = localDate;
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
          if (entry.target.classList.contains("project")) decryptRevealProject(entry.target);
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

/* ---------- prev/next project hints: track whichever unit is
   centered in the viewport while scrolling through the project list ---------- */
(function () {
  const prevEl = document.querySelector(".project-jump--prev");
  const nextEl = document.querySelector(".project-jump--next");
  const sections = Array.from(document.querySelectorAll(".project"));
  if (!prevEl || !nextEl || !sections.length) return;

  // titles are captured once, up front — reading them live later could
  // catch a project mid decrypt-reveal and show scrambled text
  const items = sections.map((section) => ({
    id: section.id,
    title: section.querySelector(".project__title")?.textContent.trim() || "",
    section,
  }));

  const prevTitleEl = prevEl.querySelector(".project-jump__title");
  const nextTitleEl = nextEl.querySelector(".project-jump__title");

  let ticking = false;

  function update() {
    ticking = false;
    const viewportMid = window.innerHeight / 2;
    let bestIndex = -1;
    let bestDist = Infinity;

    items.forEach((item, i) => {
      const rect = item.section.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        const dist = Math.abs((rect.top + rect.bottom) / 2 - viewportMid);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
    });

    if (bestIndex === -1) {
      prevEl.classList.remove("is-visible");
      nextEl.classList.remove("is-visible");
      return;
    }

    const prevItem = items[bestIndex - 1];
    const nextItem = items[bestIndex + 1];

    if (prevItem) {
      prevEl.href = "#" + prevItem.id;
      prevTitleEl.textContent = prevItem.title;
      prevEl.classList.add("is-visible");
    } else {
      prevEl.classList.remove("is-visible");
    }
    if (nextItem) {
      nextEl.href = "#" + nextItem.id;
      nextTitleEl.textContent = nextItem.title;
      nextEl.classList.add("is-visible");
    } else {
      nextEl.classList.remove("is-visible");
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
})();

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

/* ---------- generic mixed slideshow: cycles a set of stills AND
   webm clips (in filename order), only while its card is on screen.
   Swaps between a <video> and an <img> element rather than trying to
   reassign one element's src across two media types. ---------- */
function createMixedSlideshow(videoId, imgId, base, slides) {
  const videoEl = document.getElementById(videoId);
  const imgEl = document.getElementById(imgId);
  if (!videoEl || !imgEl || !slides.length) return;
  const container = videoEl.closest(".project__media");

  function url(file) {
    return base + encodeURIComponent(file);
  }

  let index = 0;
  let timer = null;
  let running = false;

  function preloadNext() {
    const next = slides[(index + 1) % slides.length];
    if (!next.video) new Image().src = url(next.file);
  }

  function show(i) {
    index = i;
    const slide = slides[index];
    if (slide.video) {
      imgEl.style.display = "none";
      videoEl.style.display = "";
      videoEl.style.opacity = "0";
      videoEl.addEventListener("loadeddata", () => { videoEl.style.opacity = "1"; }, { once: true });
      videoEl.src = url(slide.file);
      videoEl.play().catch(() => {});
    } else {
      videoEl.pause();
      videoEl.style.display = "none";
      imgEl.style.display = "";
      imgEl.style.opacity = "0";
      imgEl.addEventListener("load", () => { imgEl.style.opacity = "1"; }, { once: true });
      imgEl.src = url(slide.file);
    }
    preloadNext();
  }

  function scheduleNext() {
    clearTimeout(timer);
    const dwell = slides[index].video ? 5000 : 2200;
    timer = setTimeout(() => {
      show((index + 1) % slides.length);
      scheduleNext();
    }, dwell);
  }

  function start() {
    if (running) return;
    running = true;
    if (slides[index].video) videoEl.play().catch(() => {});
    scheduleNext();
  }
  function stop() {
    running = false;
    clearTimeout(timer);
    videoEl.pause();
  }

  if ("IntersectionObserver" in window) {
    const sio = new IntersectionObserver(
      (entries) => entries.forEach((entry) => (entry.isIntersecting ? start() : stop())),
      { threshold: 0.25 }
    );
    sio.observe(container);
  } else {
    start();
  }
}

createMixedSlideshow("spg-slideshow-video", "spg-slideshow-img", "assets/Project_assets/SPG-Staticpen/", [
  { file: "SPG_elements (1).webm", video: true },
  { file: "SPG_elements (2).jpg" },
  { file: "SPG_elements (3).jpg" },
  { file: "SPG_elements (4).jpg" },
  { file: "SPG_elements (5).webm", video: true },
  { file: "SPG_elements (6).jpg" },
  { file: "SPG_elements (7).jpg" },
  { file: "SPG_elements (8).jpg" },
  { file: "SPG_elements (9).webm", video: true },
  { file: "SPG_elements (10).jpg" },
  { file: "SPG_elements (11).jpg" },
  { file: "SPG_elements (12).jpg" },
]);

createMixedSlideshow("hyperion-slideshow-video", "hyperion-slideshow-img", "assets/Project_assets/WT-hyperion/", [
  { file: "WT-hyperion (1).webm", video: true },
  { file: "WT-hyperion (2).jpg" },
  { file: "WT-hyperion (3).webm", video: true },
  { file: "WT-hyperion (4).webm", video: true },
  { file: "WT-hyperion (5).jpg" },
  { file: "WT-hyperion (6).jpg" },
]);

createMixedSlideshow("paradox-slideshow-video", "paradox-slideshow-img", "assets/Project_assets/WT-paradox/", [
  { file: "WT-paradox (1).webm", video: true },
  { file: "WT-paradox (2).webm", video: true },
  { file: "WT-paradox (3).webm", video: true },
  { file: "WT-paradox (4).jpg" },
  { file: "WT-paradox (5).jpg" },
  { file: "WT-paradox (6).jpg" },
  { file: "WT-paradox (7).jpg" },
]);

/* ---------- generic video-only slideshow: plays each clip through
   to its natural end, then advances — no artificial dwell timer. ---------- */
function createVideoSlideshow(videoId, base, files) {
  const video = document.getElementById(videoId);
  if (!video || !files.length) return;
  const container = video.closest(".project__media");

  function url(file) {
    return base + encodeURIComponent(file);
  }

  let index = 0;
  let running = false;

  function playCurrent() {
    video.src = url(files[index]);
    video.play().catch(() => {});
  }

  video.addEventListener("ended", () => {
    index = (index + 1) % files.length;
    playCurrent();
  });

  function start() {
    if (running) return;
    running = true;
    if (!video.src) playCurrent();
    else video.play().catch(() => {});
  }
  function stop() {
    running = false;
    video.pause();
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => (entry.isIntersecting ? start() : stop())),
      { threshold: 0.25 }
    );
    io.observe(container);
  } else {
    start();
  }
}

createVideoSlideshow("reckoning-slideshow-video", "assets/Project_assets/WT-reckoning/", [
  "WT-Reckoning (1).webm",
  "WT-Reckoning (6).webm",
  "WT-Reckoning (7).webm",
  "WT-Reckoning (8).webm",
  "WT-Reckoning (9).webm",
]);

createVideoSlideshow("postmortem-slideshow-video", "assets/Project_assets/DestroyCam/", [
  "Destorycam (2).webm",
  "Destorycam (3).webm",
  "Destorycam (4).webm",
]);

/* ---------- generic image slideshow: cycles a set of stills in
   filename order, only while its card is on screen. Used for the
   project covers that are plain jpg sequences (no gif/webm slides). ---------- */
function createImageSlideshow(imgId, base, files, dwell) {
  const img = document.getElementById(imgId);
  if (!img || !files.length) return;
  const container = img.closest(".project__media");

  function url(file) {
    return base + encodeURIComponent(file);
  }

  let index = 0;
  let timer = null;
  let running = false;

  function preloadNext() {
    new Image().src = url(files[(index + 1) % files.length]);
  }

  function show(i) {
    index = i;
    img.style.opacity = "0";
    img.addEventListener("load", () => { img.style.opacity = "1"; }, { once: true });
    img.src = url(files[index]);
    preloadNext();
  }

  function scheduleNext() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      show((index + 1) % files.length);
      scheduleNext();
    }, dwell || 2600);
  }

  function start() {
    if (running) return;
    running = true;
    if (!img.src) show(0);
    scheduleNext();
  }
  function stop() {
    running = false;
    clearTimeout(timer);
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => (entry.isIntersecting ? start() : stop())),
      { threshold: 0.25 }
    );
    io.observe(container);
  } else {
    start();
  }
}

createImageSlideshow("interstellar-slideshow", "assets/Project_assets/Interstellar-nav/", [
  "interstellar (1).jpg",
  "interstellar (2).jpg",
  "interstellar (3).jpg",
  "interstellar (4).jpg",
  "interstellar (5).jpg",
  "interstellar (6).jpg",
  "interstellar (7).jpg",
]);

createImageSlideshow("cyberpunk-slideshow", "assets/Project_assets/Cyberpunk-Hud/", [
  "Cyberpunk (1).jpg",
  "Cyberpunk (2).jpg",
  "Cyberpunk (3).jpg",
  "Cyberpunk (4).jpg",
  "Cyberpunk (5).jpg",
  "Cyberpunk (6).jpg",
  "Cyberpunk (7).jpg",
  "Cyberpunk (8).jpg",
]);

createImageSlideshow("fui-slideshow", "assets/Project_assets/FUI/", [
  "Fui (1).jpg",
  "Fui (2).jpg",
  "Fui (3).jpg",
  "Fui (4).jpg",
  "Fui (5).jpg",
  "Fui (6).jpg",
]);

createImageSlideshow("starwars-slideshow", "assets/Project_assets/Starwars/", [
  "starwars (1).jpg",
  "starwars (2).jpg",
  "starwars (3).jpg",
  "starwars (4).jpg",
  "starwars (5).jpg",
  "starwars (6).jpg",
  "starwars (7).jpg",
  "starwars (8).jpg",
]);

createImageSlideshow("language-slideshow", "assets/Project_assets/Language/", [
  "language (1).jpg",
  "language (2).jpg",
  "language (3).jpg",
  "language (4).jpg",
  "language (5).jpg",
  "language (6).jpg",
]);

createVideoSlideshow("lol-slideshow-video", "assets/Project_assets/Leaugeoflegends/", [
  "lol1.webm",
  "lol2.webm",
  "lol3.webm",
]);

createImageSlideshow("dcen-slideshow", "assets/Project_assets/DCEN/", [
  "Dcen (1).jpg",
  "Dcen (2).jpg",
  "Dcen (3).jpg",
  "Dcen (4).jpg",
  "Dcen (5).jpg",
  "Dcen (6).jpg",
  "Dcen (7).jpg",
  "Dcen (8).jpg",
]);

createImageSlideshow("austriawealth-slideshow", "assets/Project_assets/Austria-Wealth/", [
  "Austria_wealth (1).jpg",
  "Austria_wealth (2).jpg",
  "Austria_wealth (3).jpg",
  "Austria_wealth (4).jpg",
]);

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

function collectTextNodes(root) {
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
  const targets = collectTextNodes(root);
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

/* ---------- project cards: same decrypt-reveal motion, once per card,
   the first time it scrolls into view. Copy text only — buttons/links
   keep their plain fade-in from .reveal. ---------- */
function decryptRevealProject(section) {
  if (reducedMotion) return;
  const nodes = [];
  section
    .querySelectorAll(".project__title, .project__desc, .project__meta .label, .project__meta .val")
    .forEach((el) => nodes.push(...collectTextNodes(el)));
  nodes.forEach((node, i) => {
    setTimeout(() => scrambleReveal(node, 500 + Math.random() * 400), i * 55);
  });
}

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
