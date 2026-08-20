# ozbayemrah.github.io

Personal portfolio for Emrah Özbay. Single-page, no build step — plain HTML/CSS/JS,
styled as an industrial "status readout" system (dark ground, one mono typeface for
data/labels, one bold display face for headings, one accent color, live GitHub stats).

## Structure

```
index.html      all markup, three placeholder project sections
styles.css      the whole design system (colors, type, layout live in :root + sections)
script.js       live clock, GitHub API stats fetch, scroll-reveal
assets/         drop your Behance exports here (see below)
```

## 1. Swap in your identity

In `index.html`:

- Header CTA `mailto:you@example.com` → your real email (appears twice: header + footer)
- `.hero__wordmark` → already set to "Emrah Özbay", edit if you want it phrased differently
- `.hero__tagline` → replace the placeholder line with your actual one-liner
- `.hero__eyebrow` → replace "Designing for &lt;replace with your focus&gt;"
- `.status-block` in the header and `.hero__readout` chips → your real location / focus areas
- Footer links → confirm/replace the GitHub and Behance URLs (currently pointed at
  `github.com/ozbayemrah` and `behance.net/ozbayemrah` — update the Behance handle if it differs)

## 2. Add real projects

Each `<section class="project">` is one case study. For each one:

1. Export the cover image from Behance (or your local files) as a `.jpg`/`.png`/`.webp`,
   ideally close to a 4:3 crop since that's the placeholder's aspect ratio.
2. Drop it in `assets/`, e.g. `assets/project-01-cover.jpg`.
3. In the matching section, delete the `.project__placeholder` block and uncomment
   the `<img>` tag right below it, pointing `src` at your file.
4. Replace the title, description, meta row (Role / Year / Tools / Type), and the
   Behance / repo links.

Need more than three project sections? Copy a whole `<section class="project reveal">`
block (or `project--reverse` for the alternating layout) and paste it before `</footer>`.
The `unit / project — 0N` counter in `.project__bar` is just text, bump it manually.

## 3. Live GitHub stats

`script.js` fetches `https://api.github.com/users/ozbayemrah/repos` client-side (no token,
no build step) and fills in repo count, total stars, top language, and most recently
updated repo in the "System Status" band under the hero. If the username in
`GITHUB_USER` at the top of `script.js` is ever wrong, update it there. The panel
degrades to `OFFLINE` / `--` if the API call fails (rate limits, no network) rather
than breaking the page.

## 4. Deploy

This repo *is* the site — GitHub Pages serves `index.html` from the root automatically
for a `<username>.github.io` repo once it exists on the `main` branch.

```bash
cd ozbayemrah.github.io
git init                      # skip if already a repo
git add .
git commit -m "Initial portfolio"
git branch -M main
git remote add origin https://github.com/ozbayemrah/ozbayemrah.github.io.git
git push -u origin main
```

Then in the repo's GitHub Settings → Pages, confirm the source is "Deploy from branch"
→ `main` / `root`. It's usually already correct for a `<username>.github.io` repo name.
Give it a minute or two after pushing — it'll be live at `https://ozbayemrah.github.io`.

## Notes

- Fonts are loaded from Google Fonts (`JetBrains Mono` + `Space Grotesk`) — both free,
  open-source stand-ins for the mono/display pairing this style is based on.
- No build tooling, no dependencies. Open `index.html` directly in a browser to preview,
  or run a tiny local server (`python3 -m http.server`) from this folder if you want the
  `fetch()` calls to behave exactly like they will once deployed.
- Colors, fonts, and spacing all live as CSS variables at the top of `styles.css`
  (`:root { ... }`) — change `--accent` there to re-theme the whole site in one line.
