/**
 * scraper.js — pulls real NZ Lotto / Powerball / Strike draw history from
 * mylotto.co.nz and writes it out in the same shape as sample-history.js,
 * so it's a drop-in replacement.
 *
 * IMPORTANT — read this before running:
 * mylotto.co.nz/results is a JavaScript single-page app, not a static page,
 * so a plain HTTP request (fetch/axios/curl) will only return an empty shell.
 * There are two honest ways to get real data out of it:
 *
 *   OPTION A — Find the underlying data API (recommended, lighter weight)
 *   1. Open mylotto.co.nz/results in a browser.
 *   2. Open DevTools → Network tab → filter by "Fetch/XHR".
 *   3. Pick a past date and watch which request fires — it'll return JSON.
 *   4. Copy that request's URL pattern into fetchDrawJSON() below.
 *   This is the standard, legitimate way to find a site's public data
 *   endpoint — you're just reading requests your own browser already makes.
 *
 *   OPTION B — Headless browser rendering (works regardless of the API)
 *   Install Puppeteer (`npm install puppeteer`) and render each results
 *   page, then read the numbers out of the rendered DOM. Slower, but
 *   doesn't depend on finding an API. A rough scaffold for this is in
 *   scrapeViaPuppeteer() below — fill in the actual DOM selectors once
 *   you've inspected the rendered page.
 *
 * Either way: keep requests rate-limited (there's a delay built in below)
 * and respect mylotto.co.nz's robots.txt and terms of use.
 *
 * Usage once wired up:
 *   node scraper.js --from 2021-08-19 --to 2026-08-15 --out real-history.js
 */

const fs = require('fs');

function parseArgs(){
  const args = process.argv.slice(2);
  const out = { from: null, to: null, out: 'real-history.js' };
  for(let i=0;i<args.length;i+=2){
    const key = args[i].replace(/^--/,'');
    out[key] = args[i+1];
  }
  return out;
}

// ---------- OPTION A: direct data endpoint (fill in once you've found it) ----------
async function fetchDrawJSON(dateStr){
  // TODO: replace with the real endpoint found via DevTools, e.g.:
  // const res = await fetch(`https://api.mylotto.co.nz/results/lotto/${dateStr}`);
  // return await res.json();
  throw new Error('fetchDrawJSON() not wired up yet — see comments at top of file.');
}

// ---------- OPTION B: headless browser scaffold ----------
async function scrapeViaPuppeteer(dateStr){
  // const puppeteer = require('puppeteer');
  // const browser = await puppeteer.launch();
  // const page = await browser.newPage();
  // await page.goto(`https://www.mylotto.co.nz/results/lotto/${dateStr}`, { waitUntil: 'networkidle0' });
  // const data = await page.evaluate(() => {
  //   // TODO: fill in real selectors once you've inspected the rendered page
  //   const main = Array.from(document.querySelectorAll('.SELECTOR-main-ball')).map(el => Number(el.textContent));
  //   const bonus = Number(document.querySelector('.SELECTOR-bonus-ball').textContent);
  //   const powerball = Number(document.querySelector('.SELECTOR-powerball').textContent);
  //   return { main, bonus, powerball };
  // });
  // await browser.close();
  // return data;
  throw new Error('scrapeViaPuppeteer() not wired up yet — see comments at top of file.');
}

function eachDrawDate(from, to){
  const dates = [];
  let d = new Date(from);
  const end = new Date(to);
  while (d <= end){
    if (d.getDay() === 3 || d.getDay() === 6){ // Wed=3, Sat=6
      dates.push(new Date(d).toISOString().slice(0,10));
    }
    d.setDate(d.getDate()+1);
  }
  return dates;
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function main(){
  const { from, to, out } = parseArgs();
  if(!from || !to){
    console.error('Usage: node scraper.js --from YYYY-MM-DD --to YYYY-MM-DD --out real-history.js');
    process.exit(1);
  }

  const dates = eachDrawDate(from, to);
  console.log(`Fetching ${dates.length} draw dates from ${from} to ${to}...`);

  const lottoHistory = [];
  const strikeHistory = [];

  for (const dateStr of dates){
    try {
      // Swap this for scrapeViaPuppeteer(dateStr) if you go with Option B.
      const data = await fetchDrawJSON(dateStr);
      lottoHistory.push({ date: dateStr, main: data.main, bonus: data.bonus, powerball: data.powerball });
      if (data.strikeOrder){
        strikeHistory.push({ date: dateStr, order: data.strikeOrder });
      }
      console.log(`  ✓ ${dateStr}`);
    } catch (err){
      console.warn(`  ✗ ${dateStr} — ${err.message}`);
    }
    await sleep(500); // be polite — don't hammer the site
  }

  const output =
    `// Real scraped draw history, generated ${new Date().toISOString()}\n` +
    `const SAMPLE_LOTTO_HISTORY = ${JSON.stringify(lottoHistory)};\n` +
    `const SAMPLE_STRIKE_HISTORY = ${JSON.stringify(strikeHistory)};\n`;

  fs.writeFileSync(out, output);
  console.log(`Wrote ${lottoHistory.length} draws to ${out}`);
  console.log(`Rename this file to sample-history.js (replacing the synthetic one) to go live.`);
}

main();
