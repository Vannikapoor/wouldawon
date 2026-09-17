/**
 * admin-update-results.js — Netlify serverless Function.
 *
 * Receives new draw results or jackpot figures from admin.html, checks the
 * password server-side (never trust a check done in the browser), then
 * commits the update directly to official-results.json in your GitHub repo
 * using the GitHub Contents API. That commit is what triggers Netlify's
 * automatic redeploy — same as if you'd edited the file and pushed yourself.
 *
 * REQUIRED Netlify environment variables (set in Site configuration ->
 * Environment variables — never commit these to the repo):
 *   ADMIN_PASSWORD   — the password you'll type into admin.html
 *   GITHUB_TOKEN      — a GitHub Personal Access Token, scoped to this repo only
 *   GITHUB_OWNER      — your GitHub username
 *   GITHUB_REPO       — the repo name (e.g. "wouldawon")
 *
 * See README.md for exactly how to generate and set these safely.
 */

// The GitHub API works on real repo paths — it knows nothing about Netlify's
// "Base directory" build setting. If your files live inside a subfolder in
// the repo (e.g. WouldaWon/official-results.json, not just official-results.json
// at the root), set GITHUB_FILE_PATH in Netlify env vars to that full path.
// Defaults to root level if not set.
const FILE_PATH = process.env.GITHUB_FILE_PATH || 'official-results.json';

exports.handler = async function (event) {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  // ---- Password check happens here, server-side, never in the browser ----
  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Incorrect password' }) };
  }

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server is missing GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO — set these in Netlify environment variables.' }) };
  }

  const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const ghHeaders = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'WouldaWon-Admin'
  };

  try {
    // 1. Fetch the current file (need its SHA to update it safely)
    const getRes = await fetch(apiBase, { headers: ghHeaders });
    if (!getRes.ok) throw new Error(`Could not read current file from GitHub (${getRes.status})`);
    const getData = await getRes.json();
    const currentContent = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf-8'));

    // 2. Apply the update
    if (body.action === 'addDraw') {
      const { date, main, bonus, pb, strike } = body.payload;
      if (!date || !Array.isArray(main) || main.length !== 6) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'A draw needs a date and exactly 6 main numbers.' }) };
      }
      currentContent.draws[date] = {
        main, bonus,
        pb: pb === undefined || pb === '' ? null : Number(pb),
        strike: (Array.isArray(strike) && strike.length === 4) ? strike : null
      };
    } else if (body.action === 'updateJackpots') {
      const { powerballAmount, strikeAmount, asOf } = body.payload;
      if (powerballAmount) currentContent.upcomingJackpots.powerball = { amount: Number(powerballAmount), asOf };
      if (strikeAmount) currentContent.upcomingJackpots.strike = { amount: Number(strikeAmount), asOf };
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action.' }) };
    }

    // 3. Commit the updated file back to GitHub
    const newContentBase64 = Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64');
    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: body.action === 'addDraw'
          ? `Add draw result for ${body.payload.date}`
          : 'Update upcoming jackpot figures',
        content: newContentBase64,
        sha: getData.sha
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`GitHub commit failed (${putRes.status}): ${errText}`);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Committed. Netlify will redeploy automatically within a minute or two.' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
