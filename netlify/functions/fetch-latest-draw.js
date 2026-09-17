/**
 * fetch-latest-draw.js — Netlify serverless Function.
 *
 * Runs server-side (not in the browser), so it isn't blocked by CORS the way
 * a direct fetch() from the app would be. It scrapes businesslist.nz's Lotto,
 * Powerball and Strike results pages — a third-party site, NOT the official
 * Lotto NZ site, chosen because unlike mylotto.co.nz it renders plain HTML
 * instead of a JavaScript app, which makes it actually scrapeable.
 *
 * IMPORTANT — this has not been tested against a live deployment (this was
 * built in a sandbox with no internet access to Netlify itself). The parsing
 * patterns below are based on real fetched content, so they should work, but
 * if a field comes back null after you deploy, that's the signal a pattern
 * needs a small tweak — send me the raw output and I can fix it fast.
 *
 * Called on demand from the app's "Check for real results" button via:
 *   fetch('/.netlify/functions/fetch-latest-draw')
 */

exports.handler = async function (event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const [lottoResult, strikeResult, jackpots] = await Promise.all([
      fetchAndParseLottoPowerball(),
      fetchAndParseStrike(),
      fetchNextJackpots()
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        fetchedAt: new Date().toISOString(),
        lotto: lottoResult,
        strike: strikeResult,
        jackpots // { powerball: {amount, rollover}, strike: {amount, rollover} } — real, but same-draw dividend
                 // breakdowns are NOT included: Lotto NZ doesn't verify/publish those until the
                 // Sunday after each draw, so there's nothing accurate to scrape same-night.
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};

async function fetchNextJackpots() {
  try {
    const html = await fetchHtml('https://www.lotto.net/new-zealand-powerball/results/checker');
    const text = stripTags(html);
    // Expect something like: "Next Jackpot NZ$18 Million · Next Draw on Saturday"
    // IMPORTANT: this page lists jackpots for multiple countries' lotteries side by
    // side (confirmed by seeing an unrelated "$800 Million" figure on the same page).
    // NZ$ must be required, not optional, or this can silently grab the wrong country's number.
    const match = text.match(/Next Jackpot\s*NZ\$([\d,.]+)\s*(Million|Thousand)?/i);
    if(!match) return { error: 'Could not parse next-jackpot figure — page layout may have changed.' };

    const rawNum = parseFloat(match[1].replace(/,/g, ''));
    const unit = match[2] ? match[2].toLowerCase() : null;
    let amount = rawNum;
    if(unit === 'million') amount = rawNum * 1000000;
    else if(unit === 'thousand') amount = rawNum * 1000;

    return {
      powerball: {
        amount: Math.round(amount), // real number, usable directly in dividend math
        display: unit ? `$${match[1]} ${match[2]}` : `$${match[1]}`
      }
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WouldaWonBot/1.0)' }
  });
  if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status}`);
  return await res.text();
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// The Powerball page includes the full Lotto draw (same 6 numbers + bonus)
// plus the Powerball number, so one page gets us both.
async function fetchAndParseLottoPowerball() {
  const html = await fetchHtml('https://www.businesslist.nz/lottery/result/powerball');
  const text = stripTags(html);

  // Expect something like:
  // "Powerball Winning Numbers Draw 2614 03 14 20 22 37 40 12Bonus 05Powerball"
  const match = text.match(
    /Powerball Winning Numbers Draw\s*(\d+)((?:\s*\d{1,2}){6})\s*(\d{1,2})\s*Bonus\s*(\d{1,2})\s*Powerball/i
  );

  if (!match) return { error: 'Could not parse Lotto/Powerball page — pattern may need updating.' };

  const [, drawNumber, numbersBlock, bonus, powerball] = match;
  const main = numbersBlock.trim().split(/\s+/).map(Number);

  // Draw date appears just above, formatted like "22 August, 2026 - Saturday"
  const dateMatch = text.match(/(\d{1,2} \w+, \d{4}) - \w+\s*Powerball Winning Numbers Draw/i);

  return {
    drawNumber,
    date: dateMatch ? dateMatch[1] : null,
    main,
    bonus: Number(bonus),
    powerball: Number(powerball)
  };
}

async function fetchAndParseStrike() {
  const html = await fetchHtml('https://www.businesslist.nz/lottery/result/strike');
  const text = stripTags(html);

  // Expect something like:
  // "Lotto Strike Winning Numbers Draw 2614 03 14 20 22 Lotto Strike Winners"
  const match = text.match(
    /Lotto Strike Winning Numbers Draw\s*(\d+)((?:\s*\d{1,2}){4})\s*Lotto Strike Winners/i
  );

  if (!match) return { error: 'Could not parse Strike page — pattern may need updating, or this page may be cached/stale (seen during testing).' };

  const [, drawNumber, numbersBlock] = match;
  const order = numbersBlock.trim().split(/\s+/).map(Number);

  const dateMatch = text.match(/(\d{1,2} \w+, \d{4}) - \w+\s*Lotto Strike Winning Numbers Draw/i);

  return {
    drawNumber,
    date: dateMatch ? dateMatch[1] : null,
    order
  };
}
