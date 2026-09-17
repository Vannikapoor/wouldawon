/**
 * backfill-history.js — pulls real multi-year NZ Lotto/Powerball history from
 * lotto.net's year-archive pages and writes it out as sample-history.js,
 * replacing the synthetic dataset with genuine draws.
 *
 * This replaces the old scraper.js, which targeted mylotto.co.nz — a
 * JavaScript app with nothing to scrape. lotto.net renders plain HTML with
 * year-by-year archives (e.g. lotto.net/new-zealand-lotto/results/2024),
 * which is what makes backfilling actually possible.
 *
 * STATUS: like the on-demand function, this is built from real fetched
 * content but has NOT been run against the live site (no internet access
 * in the environment this was built in). Treat the parsing regex as a
 * strong first draft — if a year comes back with 0 draws, that's the
 * signal to check the actual page structure and adjust the pattern.
 *
 * Usage:
 *   node backfill-history.js --years 2021,2022,2023,2024,2025,2026 --out sample-history.js
 */

const fs = require('fs');

function parseArgs(){
  const args = process.argv.slice(2);
  const out = { years: '2021,2022,2023,2024,2025,2026', out: 'sample-history.js' };
  for(let i=0;i<args.length;i+=2){
    const key = args[i].replace(/^--/,'');
    out[key] = args[i+1];
  }
  return out;
}

function stripTags(html){
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchYear(year){
  const url = `https://www.lotto.net/new-zealand-lotto/results/${year}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WouldaWonBackfill/1.0)' } });
  if(!res.ok) throw new Error(`${year}: HTTP ${res.status}`);
  const text = stripTags(await res.text());

  // Expect repeating blocks roughly like:
  // "Wednesday 19th August 2026 13 16 19 20 25 37 Bonus 12 Prize Breakdown"
  const drawRegex = /(\w+day) (\d{1,2})\w* (\w+) (\d{4})\s+((?:\d{1,2}\s+){6})Bonus\s+(\d{1,2})/g;
  const draws = [];
  let m;
  while((m = drawRegex.exec(text)) !== null){
    const [, , day, month, yr, numbersBlock, bonus] = m;
    const main = numbersBlock.trim().split(/\s+/).map(Number);
    const monthIndex = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(month);
    if(monthIndex === -1 || main.length !== 6) continue;
    const dateStr = `${yr}-${String(monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    draws.push({ date: dateStr, main: main.sort((a,b)=>a-b), bonus: Number(bonus) });
  }
  return draws;
}

async function main(){
  const { years, out } = parseArgs();
  const yearList = years.split(',').map(y => y.trim());
  let allDraws = [];

  for(const year of yearList){
    try{
      const draws = await fetchYear(year);
      console.log(`  ${year}: ${draws.length} draws found`);
      allDraws = allDraws.concat(draws);
    } catch(err){
      console.warn(`  ${year}: failed — ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 500)); // be polite
  }

  allDraws.sort((a,b) => a.date.localeCompare(b.date));

  if(allDraws.length === 0){
    console.error('No draws parsed at all — the page structure likely differs from what this regex expects. Fetch one year page manually and compare against the pattern in fetchYear() before retrying.');
    process.exit(1);
  }

  const output =
    `// Real NZ Lotto history, backfilled ${new Date().toISOString()}\n` +
    `// Source: lotto.net year-archive pages (third-party, not official Lotto NZ)\n` +
    `window.SAMPLE_LOTTO_HISTORY = ${JSON.stringify(allDraws)};\n` +
    `// Strike history not included in this backfill — see README for adding it separately.\n` +
    `window.SAMPLE_STRIKE_HISTORY = window.SAMPLE_STRIKE_HISTORY || [];\n`;

  fs.writeFileSync(out, output);
  console.log(`\nWrote ${allDraws.length} real draws to ${out}. Drop this in alongside index.html to replace the synthetic dataset.`);
}

main();
