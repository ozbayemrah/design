// ============================================================
// OZBAY portfolio — small, dependency-free behaviors:
// live clock, GitHub stats readout, scroll-reveal.
// ============================================================

/* ---------- theme switch: day / night / ops, persisted in localStorage.
   "dark" is the base palette (no data-theme attribute). ---------- */
(function () {
  const root = document.documentElement;
  const opts = Array.from(document.querySelectorAll("[data-theme-opt]"));
  if (!opts.length) return;

  function current() {
    return root.getAttribute("data-theme") || "dark";
  }
  function sync() {
    const t = current();
    opts.forEach((o) => {
      const on = o.dataset.themeOpt === t;
      o.setAttribute("aria-checked", String(on));
      o.tabIndex = on ? 0 : -1; // roving tabindex: one tab stop for the group
    });
  }
  function apply(t) {
    if (t === "dark") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch (e) {}
    sync();
    window.dispatchEvent(new Event("theme:change"));
  }

  opts.forEach((o, i) => {
    o.addEventListener("click", () => apply(o.dataset.themeOpt));
    o.addEventListener("keydown", (e) => {
      const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const next = opts[(i + dir + opts.length) % opts.length];
      apply(next.dataset.themeOpt);
      next.focus();
    });
  });
  sync();
})();

/* ---------- hero: copy email (for people without a mail app) ----------
   The address isn't printed on the page. Copies synchronously through a
   throwaway off-screen textarea (works inside the click everywhere),
   falling back to the async Clipboard API — which can hang on a
   permission prompt. If both fail, the button shows the address itself. */
document.querySelectorAll("[data-copy]").forEach((btn) => {
  const label = btn.textContent;
  const text = btn.dataset.copy;
  let resetTimer = null;

  function feedback(ok) {
    btn.textContent = ok ? "Copied ✓" : text;
    btn.classList.add("is-done");
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { btn.textContent = label; btn.classList.remove("is-done"); }, ok ? 2000 : 6000);
  }

  function copySync() {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    return ok;
  }

  btn.addEventListener("click", () => {
    if (copySync()) {
      feedback(true);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => feedback(true), () => feedback(false));
    } else {
      feedback(false);
    }
  });
});

/* ---------- live clock: Vienna (home base) ---------- */
const TIME_OPTS = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };

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
  const zone = gmtOffsetLabel(now, "Europe/Vienna");
  const timeEl = document.getElementById("clock-time");
  const zoneEl = document.getElementById("clock-zone-vienna");
  if (timeEl) timeEl.textContent = viennaTime;
  if (zoneEl) zoneEl.textContent = zone;
  // contact section: Austria time without seconds
  const hm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Vienna" });
  document.querySelectorAll("[data-vienna-time]").forEach((el) => { el.textContent = hm; });
  document.querySelectorAll("[data-vienna-zone]").forEach((el) => { el.textContent = zone; });
}
tickClock();
setInterval(tickClock, 1000);


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
  const prevGroupEl = document.querySelector(".project-jump-group");
  const prevEl = document.querySelector(".project-jump--prev");
  const nextEl = document.querySelector(".project-jump--next");
  const sections = Array.from(document.querySelectorAll(".project"));
  if (!prevGroupEl || !prevEl || !nextEl || !sections.length) return;

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
      // ignore a unit that's only a sliver tucked under the sticky header
      // (e.g. on the Contact screen) — it isn't really "the current project"
      if (rect.bottom > 140 && rect.top < window.innerHeight) {
        const dist = Math.abs((rect.top + rect.bottom) / 2 - viewportMid);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
    });

    if (bestIndex === -1) {
      prevGroupEl.classList.remove("is-visible");
      nextEl.classList.remove("is-visible");
      return;
    }

    const prevItem = items[bestIndex - 1];
    const nextItem = items[bestIndex + 1];

    if (prevItem) {
      prevEl.href = "#" + prevItem.id;
      prevTitleEl.textContent = prevItem.title;
      prevGroupEl.classList.add("is-visible");
    } else {
      prevGroupEl.classList.remove("is-visible");
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

  const topBtn = document.querySelector(".project-jump--top");
  if (topBtn) {
    topBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
})();

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

/* ---------- project galleries: sideways strip of every still/clip.
   Native scroll does the work (swipe, trackpad, shift+wheel); this
   adds arrow buttons, a live "03 / 08" counter and mouse drag. ---------- */
document.querySelectorAll(".project").forEach((section) => {
  const track = section.querySelector(".project__track");
  const ui = section.querySelector(".project__gallery-ui");
  if (!track || !ui) return;
  const slides = Array.from(track.querySelectorAll(".project__slide"));
  const indexEl = ui.querySelector(".project__gallery-index");
  const prevBtn = ui.querySelector('[data-dir="-1"]');
  const nextBtn = ui.querySelector('[data-dir="1"]');

  if (slides.length < 2) {
    ui.classList.add("is-single");
    track.style.cursor = "default";
    return;
  }

  // scroll position that puts slide i flush with the strip's left
  // padding (the text column edge) — the strip itself is full-bleed
  function slideLeft(i) {
    const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    return slides[i].offsetLeft - track.offsetLeft - pad;
  }

  function currentIndex() {
    const left = track.scrollLeft;
    let best = 0;
    slides.forEach((s, i) => {
      if (Math.abs(slideLeft(i) - left) < Math.abs(slideLeft(best) - left)) best = i;
    });
    return best;
  }

  function update() {
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    const i = atEnd ? slides.length - 1 : currentIndex();
    indexEl.textContent = String(i + 1).padStart(2, "0");
    prevBtn.disabled = track.scrollLeft <= 2;
    nextBtn.disabled = atEnd;
  }

  // rapid clicks stack: count from the slide we're already heading to,
  // not from wherever the smooth scroll happens to be mid-flight
  let target = null;
  let targetTimer = null;
  function go(dir) {
    const from = target === null ? currentIndex() : target;
    target = Math.min(Math.max(from + dir, 0), slides.length - 1);
    clearTimeout(targetTimer);
    targetTimer = setTimeout(() => { target = null; }, 700);
    track.scrollTo({ left: slideLeft(target), behavior: "smooth" });
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });

  let ticking = false;
  track.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  }, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  // lazy stills/clips have no width until they load — re-measure then,
  // otherwise the strip can look "already at the end" with → disabled
  track.querySelectorAll("img").forEach((img) => img.addEventListener("load", update));
  track.querySelectorAll("video").forEach((v) => v.addEventListener("loadedmetadata", update));
  update();

  // mouse drag-to-scroll (touch already scrolls natively)
  let startX = 0;
  let startLeft = 0;
  let dragging = false;
  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startLeft = track.scrollLeft;
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) track.classList.add("is-dragging");
    track.scrollLeft = startLeft - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    if (!track.classList.contains("is-dragging")) return;
    track.classList.remove("is-dragging");
    go(0); // re-settle onto the nearest slide
  });
});

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

  // only scramble while the card is actually on screen
  let onScreen = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => { onScreen = entries[0].isIntersecting; }).observe(root);
  } else {
    onScreen = true;
  }

  function tick() {
    if (!onScreen) { setTimeout(tick, 1500); return; }
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
   the first time it scrolls into view. Title only — description and
   specs stay readable from the first frame. ---------- */
function decryptRevealProject(section) {
  if (reducedMotion) return;
  const nodes = [];
  section
    .querySelectorAll(".project__title")
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


  // the reticle is a hero-only flourish: everywhere else the native
  // cursor comes back, so reading and clicking stay precise
  const root = document.documentElement;
  window.addEventListener(
    "mousemove",
    (e) => {
      cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      cursor.classList.add("is-active");
      root.classList.toggle("tc-in-hero", !!(e.target.closest && e.target.closest(".hero")));
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
    if (!document.documentElement.classList.contains("tc-in-hero")) {
      running = false; // idle outside the hero; mousemove restarts it
      return;
    }
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
  let running = false;
  function startShader() {
    if (running || !document.documentElement.classList.contains("tc-in-hero")) return;
    running = true;
    requestAnimationFrame(drawShader);
  }
  window.addEventListener("mousemove", startShader, { passive: true });
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
