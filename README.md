# Chessable — Chess Square Speed Drill

Chessable is a speed-drill web application designed to help chess players improve their board vision and square recognition. Players race against the clock to click the correct square, name a highlighted square, or identify square colors — building fluency in square memorization.

Built with **pure vanilla HTML, CSS and JavaScript** — no frameworks, no build step, no dependencies. It installs as a Progressive Web App and runs fully offline.

## Features

### Drill modes
*   **Find Square** — a square name (e.g. "e5") appears; click the matching square on the board.
*   **Name Square** *(new)* — a square lights up on the board; identify its coordinate by tapping the file/rank pad or typing it.
*   **Color Drill** — a square name appears; decide whether it's a light or dark square.

### Difficulty tiers (board modes)
*   **Easy** — coordinates shown on the board edges (Find Square only).
*   **Normal** — coordinates hidden.
*   **Hard** — coordinates hidden and the board perspective randomly flips between White and Black.

### Sessions
*   **Timed** — 30s, 60s, or 120s.
*   **Survival** *(new)* — no clock; you have 3 lives and play until you run out.

### Feedback & progress
*   **Live streak counter** with a "hot streak" state, plus best-streak tracking.
*   **Stats & heatmap** — after each drill, see score, accuracy, average reaction time and best streak, with a heatmap colored by reaction time (green = fast, red = slow).
*   **Lifetime stats** — total drills, correct answers, lifetime accuracy, best streak and total time trained, saved across sessions.
*   **Personal bests** — high scores saved locally per mode, difficulty and session.
*   **Weighted randomization** — after the first round the app biases prompts toward squares you've missed or are slow at finding.

### Settings menu *(new)*
*   **5 board themes** — Classic, Forest, Ocean, Walnut, Slate.
*   **Sound effects** — synthesized with the Web Audio API (no asset files).
*   **Haptics** — vibration feedback on mistakes (supported mobile devices).
*   **Animations** — master motion/transition toggle (also respects `prefers-reduced-motion`).
*   **Countdown** — turn the 3-2-1 intro on or off.
*   **Reset progress** — clear personal bests and lifetime stats.

### Other
*   **Keyboard support** — type a coordinate (e.g. `e5`) to answer, `L`/`D` for color drill, `Enter` to start, `Esc` to quit.
*   **PWA / offline** — installable, cached via a service worker, works with no network.
*   **Responsive design** — desktop, tablet and mobile, with safe-area insets for notched devices.

## Technologies Used

*   HTML5
*   CSS3 (custom properties, CSS Grid, Flexbox, animations)
*   JavaScript (ES6+), Web Audio API, Web Storage, Service Worker / Web App Manifest

## How to Run

There is no build step. Because the app registers a service worker, it should be served over `http(s)` (or `localhost`) rather than opened directly via `file://`.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly still works for the core drills — only the offline/PWA layer is skipped on `file://`.

## Publishing online

The app is fully static and uses relative paths, so it can be hosted anywhere:

*   **GitHub Pages** — push to a repo and enable Pages on the branch root.
*   **Netlify / Vercel / Cloudflare Pages** — drag-and-drop or connect the repo; no build command needed.
*   **Any static host / CDN** — upload the files as-is.

For social sharing, the Open Graph / Twitter meta tags point at `icon.svg`; swap in a `1200×630` PNG and update the `og:image` URL for richer link previews.

## Project Structure

```text
chessable/
├── index.html      # App structure and three screens + modals
├── manifest.json   # PWA manifest (installable metadata)
├── sw.js           # Service worker (offline app-shell cache)
├── icon.svg        # App / favicon / social icon
├── css/
│   └── style.css   # Styling, themes, layout, animations
└── js/
    └── app.js      # Game logic, settings, audio, stats, state
```
