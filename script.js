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
