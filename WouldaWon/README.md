# WouldaWon

A fun, honest Lotto / Powerball / Strike ticket simulator for NZ. Generate lines, "buy" them, simulate the next draw, and watch a running surplus/deficit ledger track how it's going.

## Files
- `index.html` — the app itself. Vanilla HTML/CSS/JS, no build step, no framework.
- `sample-history.js` — a **synthetic** 5-year (2021–2026) draw history used to power the Stats tab and the "hot/cold weighted" number generator. It's randomly generated, not real results — see below for how to replace it.
- `scraper.js` — a documented scaffold for pulling **real** draw history from mylotto.co.nz. Needs a bit of setup on your end (see comments in the file) since it wasn't possible to build and test this against the live site from here.
- `logo.svg` — the app's logo as a standalone asset (also inlined directly in `index.html`).

## Running it
Just open `index.html` in a browser, or drag the whole folder into Netlify (same deploy pattern as your other apps). `sample-history.js` needs to sit in the same folder as `index.html` — it's loaded via a `<script src="sample-history.js">` tag.

## Going from sample data to real data
The synthetic dataset exists because this environment has no internet access to actually scrape mylotto.co.nz for you — so `scraper.js` is a well-commented starting point, not a finished pipeline. Two honest ways to finish it, both explained inline in the file:

1. **Find mylotto's underlying data endpoint** via your browser's DevTools Network tab (fastest once you locate it — mylotto.co.nz renders results client-side via JavaScript, so the raw HTML alone won't contain the numbers).
2. **Render with a headless browser** (Puppeteer) if no clean API turns up.

Once `scraper.js` is wired up and run, it outputs a `real-history.js` file in the exact same shape as `sample-history.js` — rename it and drop it in to make the whole app run on genuine results.

### Keeping it current automatically
Once the scraper works, a scheduled GitHub Action (cron, e.g. twice a week after Wed/Sat draws) can re-run it and commit the refreshed `sample-history.js`, so the Stats tab and weighting stay current without you touching it. Happy to help set that workflow file up once the scraper itself is confirmed working against the real site.

## Remembering you
Your tickets, ledger and balance are saved automatically to this browser's local storage — buy tickets today, close the tab, come back in a few days on the same device, and everything's still there. No login needed. A "Reset all saved data" link in the footer clears it if you ever want a clean slate.

This is per-browser, per-device — it won't follow you to a different computer or phone, and clearing your browser's site data wipes it. If you want it to follow you across devices, that needs real accounts (Supabase Auth, still free-tier) with your tickets stored server-side instead of in the browser — a genuine step up in complexity from everything else in this project, worth doing only if same-device storage turns out not to be enough in practice.

## Real results — how it actually works now
`netlify/functions/fetch-latest-draw.js` is a serverless function that scrapes [businesslist.nz](https://www.businesslist.nz/lottery/result/lotto)'s Lotto, Powerball and Strike results pages on demand — not the official Lotto NZ site (mylotto.co.nz), because that one renders as a JavaScript app with no plain HTML to scrape. businesslist.nz is a **third-party, unofficial** results mirror — good enough for a fun tracker, not something to treat as authoritative.

In the app, "Check real result" calls this function and resolves your pending tickets against genuine numbers. "Simulate instead" is still there as a fallback that uses a random result on the spot, in case the real fetch fails or you don't want to wait.

**Deploying this needs one extra step beyond drag-and-drop.** Netlify Drop (the simple drag-a-folder flow used for your other apps) is static-hosting only — it doesn't run serverless Functions. To get Functions working, connect this folder to Netlify one of these ways instead (both still free):
- **Git-based deploy (recommended):** push this folder to a GitHub repo, then "Import from Git" in Netlify. Netlify auto-detects `netlify.toml` and deploys the function alongside the site, and redeploys automatically on every push.
- **Netlify CLI:** `npm install -g netlify-cli`, then `netlify deploy --prod` from inside this folder. Slightly more setup, no GitHub account needed.

**Untested against the live site** — built in a sandbox with no internet access to actually deploy and confirm it. The parsing patterns are based on real fetched content, so they should work, but if a result comes back blank after you deploy, that's the signal something needs a small regex tweak — send me what the function returns and I can fix it quickly.

**One caching quirk found during testing:** the Strike results page returned a stale cached result (three weeks old) even though Lotto and Powerball were current — so Strike results may occasionally lag behind. Worth knowing rather than assuming something's broken.

## Making it more realistic — status of each piece
1. **Real live jackpot figure** — done. The "Refresh with live figure" link on the Powerball card calls the function and pulls the actual current jackpot from lotto.net.
2. **Real historical backfill** — `backfill-history.js` is a real scraper targeting lotto.net's year-archive pages (plain HTML, actually scrapeable, unlike mylotto.co.nz). Run it with `node backfill-history.js` and drop the output in as `sample-history.js` to replace the synthetic dataset with genuine draws. Strike history isn't covered by this backfill yet.
3. **Real dividend amounts per division** — genuinely blocked, not by scraping difficulty but by Lotto NZ's own publishing schedule: dividend breakdowns aren't verified/published until the Sunday after each draw, so there's nothing accurate to fetch same-night. This is a real constraint of the source data, not something a better scraper fixes.

**A confirmed, real, upcoming change worth knowing about:** Lotto NZ has announced that from **13 September**, Powerball adds 4 more balls to the draw machine (the pool becomes 1–14, not 1–10) plus a new Division 8. This app's Powerball logic is still built on the current 1–10 rules — flagged with a comment right at `PB_DIVIDENDS` in `index.html` so it's easy to find when it's time to update.

## Notes on the numbers
- Ticket prices are real, confirmed against Lotto NZ's own figures: $0.70 Lotto, $1.50 Powerball (doubles the base line price), $1.00 Strike.
- Draw days/times are real: Wednesdays 8:20pm NZT, Saturdays 8:00pm NZT. The countdown and "this ticket belongs to draw X" labelling run on genuine NZ time (`Pacific/Auckland`), not a fake clock.
- The Recent Draws tab shows genuine historical results (with Powerball and Strike numbers included) as a manually-updated static snapshot — check mylotto.co.nz for anything newer than the dates shown.
- Lotto Division 1's $1 million jackpot is fixed and real. Powerball and Strike jackpots shown in the hero cards are real snapshot figures too, dated to when they were last checked — not a live feed.
- Both result buttons stay disabled until the real NZ draw time has passed. "Check real result" hits the live scraper function; "Simulate instead" generates a random result on the spot as a fallback.
- Every division/prize rule (Lotto Div 1–7, Powerball boost, Strike 1–4) matches NZ Lotto's actual published rules — only the dollar amounts for anything below Division 1 are illustrative averages, and can differ a lot from real payouts since actual dividends depend on that draw's sales and winner count.
- The weighted "hot/cold" generator is a fun feature, not a strategy — every line has equal odds every draw regardless of history. The app says so, and it's true.

## A bug that's now fixed
The Stats tab previously showed "sample history not loaded" even with both files in the same folder — this wasn't a file-placement issue. `sample-history.js` declared its data with `const`, and top-level `const`/`let` in a plain script doesn't attach to `window` the way `var` does, so `window.SAMPLE_LOTTO_HISTORY` was always empty. Fixed by assigning explicitly onto `window` in the generator script.
