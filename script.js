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
  const elStars = document.getElementById("stat-stars");
  const elLang = document.getElementById("stat-lang");
  const elLast = document.getElementById("stat-last");
  const statusEl = document.getElementById("stat-status");

  try {
    const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`);
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const repos = await res.json();

    const repoCount = repos.length;
    const starCount = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

    const langCounts = {};
    repos.forEach((r) => {
      if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    });
    const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0];

    const mostRecent = repos[0];

    if (elRepos) elRepos.textContent = String(repoCount).padStart(2, "0");
    if (elStars) elStars.textContent = String(starCount).padStart(2, "0");
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
    [elRepos, elStars, elLang, elLast].forEach((el) => {
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
