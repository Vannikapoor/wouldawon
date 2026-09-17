# WouldaWon

A fun, honest Powerball / Strike ticket simulator for NZ. Generate lines, "buy" them, check them against real draws, and watch a running surplus/deficit ledger track how it's going.

**Lotto (the standalone game) was intentionally removed** — this app only tracks Powerball and Strike now. Note that Powerball still involves the same 6 main Lotto numbers internally (that's inherent to how Powerball works), it's just no longer offered as its own separate ticket type.

**Powerball's rules changed on 13 September 2026** — this app is already built on the new format: pool of 1–14 (was 1–10), a new Division 8 (2 main numbers + Powerball, fixed $12), starting jackpot $5 million (was $4 million), cap $60 million (was $50 million).

## Files
- `index.html` — the app itself. Vanilla HTML/CSS/JS, no build step, no framework.
- `sample-history.js` — a **synthetic** 5-year (2021–2026) draw history used to power the Stats tab and the "hot/cold weighted" number generator. It's randomly generated, not real results — see below for how to replace it.
- `scraper.js` — an earlier, **superseded** attempt at pulling draw history automatically. Kept for reference only; real results now come through the admin portal instead (see below).
- `logo.svg` — the app's logo as a standalone asset (also inlined directly in `index.html`).

## Running it
Just open `index.html` in a browser, or drag the whole folder into Netlify (same deploy pattern as your other apps). `sample-history.js` needs to sit in the same folder as `index.html` — it's loaded via a `<script src="sample-history.js">` tag.

## Going from sample data to real data (superseded — kept for history)
This section describes an earlier approach that's no longer the recommended path. `scraper.js` was a scaffold for pulling real draw history from mylotto.co.nz — but that site renders as a JavaScript app with nothing to scrape, and third-party alternatives proved too fragile (see "What this replaces" below). Real results now come through the admin portal instead.

1. **Find mylotto's underlying data endpoint** via your browser's DevTools Network tab (fastest once you locate it — mylotto.co.nz renders results client-side via JavaScript, so the raw HTML alone won't contain the numbers).
2. **Render with a headless browser** (Puppeteer) if no clean API turns up.

Once `scraper.js` is wired up and run, it outputs a `real-history.js` file in the exact same shape as `sample-history.js` — rename it and drop it in to make the whole app run on genuine results.

### Keeping it current automatically
Once the scraper works, a scheduled GitHub Action (cron, e.g. twice a week after Wed/Sat draws) can re-run it and commit the refreshed `sample-history.js`, so the Stats tab and weighting stay current without you touching it. Happy to help set that workflow file up once the scraper itself is confirmed working against the real site.

## Remembering you
Your tickets, ledger and balance are saved automatically to this browser's local storage — buy tickets today, close the tab, come back in a few days on the same device, and everything's still there. No login needed. A "Reset all saved data" link in the footer clears it if you ever want a clean slate.

This is per-browser, per-device — it won't follow you to a different computer or phone, and clearing your browser's site data wipes it. If you want it to follow you across devices, that needs real accounts (Supabase Auth, still free-tier) with your tickets stored server-side instead of in the browser — a genuine step up in complexity from everything else in this project, worth doing only if same-device storage turns out not to be enough in practice.

## Real results — how it actually works now
Real results are entered through a **hidden admin portal**, not by hand-editing a file. `official-results.json` is the data (draws + upcoming jackpots), and `admin.html` is a password-protected form that updates it without you ever touching GitHub directly.

**How it works under the hood:** `admin.html` isn't linked anywhere in the main app — you just bookmark the URL. It's not real security by itself (an unlisted URL can still be found), so the actual protection is server-side: `netlify/functions/admin-update-results.js` checks your password before doing anything, and that check happens on the server, never in the browser's own JavaScript. Once the password's confirmed, the function uses the GitHub API to commit the update directly to `official-results.json` in your repo — the same event as you editing and pushing it yourself, so Netlify redeploys automatically.

### One-time setup for the admin portal
Four secrets need to be set in Netlify (**Site configuration → Environment variables** — never put these in a file that gets committed):

1. **`ADMIN_PASSWORD`** — pick any password. This is what you'll type into `admin.html`.
2. **`GITHUB_TOKEN`** — a GitHub Personal Access Token:
   - GitHub → your profile photo → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token
   - Set **Repository access** to "Only select repositories" → choose your `wouldawon` repo specifically (never grant access to all repos)
   - Under **Permissions**, set **Contents** to "Read and write" — that's the only permission this needs
   - Generate, and copy the token immediately (GitHub only shows it once)
3. **`GITHUB_OWNER`** — your GitHub username
4. **`GITHUB_REPO`** — the repo name (e.g. `wouldawon`)

After setting all four, redeploy the site once so the function picks them up. Then visit `yoursite.netlify.app/admin.html`, enter your password, and you'll see two forms: one for adding a draw result, one for updating the upcoming jackpot figures.

**Security notes worth understanding:**
- The GitHub token is scoped to *only* this one repo with *only* content read/write — even if it leaked, the damage is contained to this repo, not your whole GitHub account.
- Nobody who isn't in Netlify's environment variables settings (i.e. just you) can see the password or the token — they live server-side only.
- `admin.html` includes `<meta name="robots" content="noindex, nofollow">` so search engines won't index or link to it, though this is a courtesy, not a security measure — the real protection is the server-side password check.

If a draw hasn't been entered yet when a user clicks "Check real result" in the main app, it says so plainly and suggests "Simulate instead," rather than pretending to have data it doesn't.

**What this replaces:** `netlify/functions/fetch-latest-draw.js` and `backfill-history.js` are no longer used — scraping third-party sites turned out to be too fragile (a multi-country jackpot mixup, stale caches, layout drift). They're left in the repo for reference, but nothing calls them anymore.

## Notes on the numbers
- Ticket prices are real, confirmed against Lotto NZ's own figures: $0.70 Lotto, $1.50 Powerball (doubles the base line price), $1.00 Strike.
- Draw days/times are real: Wednesdays 8:20pm NZT, Saturdays 8:00pm NZT. The countdown and "this ticket belongs to draw X" labelling run on genuine NZ time (`Pacific/Auckland`), not a fake clock.
- The Recent Draws tab shows genuine historical results (with Powerball and Strike numbers included) as a manually-updated static snapshot — check mylotto.co.nz for anything newer than the dates shown.
- Powerball and Strike jackpots shown in the hero cards are real figures entered by the owner via the admin portal, dated to when they were last updated — not a live feed.
- Both result buttons stay disabled until the real NZ draw time has passed. "Check real result" hits the live scraper function; "Simulate instead" generates a random result on the spot as a fallback.
- Every division/prize rule (Lotto Div 1–7, Powerball boost, Strike 1–4) matches NZ Lotto's actual published rules — only the dollar amounts for anything below Division 1 are illustrative averages, and can differ a lot from real payouts since actual dividends depend on that draw's sales and winner count.
- The weighted "hot/cold" generator is a fun feature, not a strategy — every line has equal odds every draw regardless of history. The app says so, and it's true.

## A bug that's now fixed
The Stats tab previously showed "sample history not loaded" even with both files in the same folder — this wasn't a file-placement issue. `sample-history.js` declared its data with `const`, and top-level `const`/`let` in a plain script doesn't attach to `window` the way `var` does, so `window.SAMPLE_LOTTO_HISTORY` was always empty. Fixed by assigning explicitly onto `window` in the generator script.
