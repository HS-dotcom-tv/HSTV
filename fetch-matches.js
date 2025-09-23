// fetch-matches.js  (CommonJS - for GitHub Actions)
const fetch = require("node-fetch");
const fs = require("fs");

const API_KEY = process.env.API_FOOTBALL_KEY; // ضع المفتاح في GitHub Secrets باسم API_FOOTBALL_KEY
if (!API_KEY) {
  console.error("❌ API key not found. Set API_FOOTBALL_KEY secret in GitHub repository.");
  process.exit(1);
}

const headers = {
  "x-apisports-key": API_KEY
};

// Helper: build date string YYYY-MM-DD with offset in days
function getDateString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Fetch fixtures for a given date, return array (or empty array)
async function fetchForDate(dateStr) {
  const url = `https://v3.football.api-sports.io/fixtures?date=${dateStr}`;
  console.log(`⤷ Requesting: ${url}`);
  const res = await fetch(url, { headers });
  console.log("⤷ HTTP status:", res.status);
  const data = await res.json();
  if (!res.ok) {
    console.error("❌ HTTP error:", res.status, data);
    throw new Error(`HTTP ${res.status}`);
  }
  if (data && data.errors) {
    console.error("❌ API returned errors:", JSON.stringify(data.errors, null, 2));
    throw new Error("API returned errors: " + JSON.stringify(data.errors));
  }
  if (!data.response) return [];
  return data.response;
}

// Remove duplicate matches (by fixture.id), and return sorted by date asc
function dedupeAndSortMatches(matches) {
  const map = new Map();
  for (const m of matches) {
    const id = m.fixture && m.fixture.id ? m.fixture.id : JSON.stringify([m.league?.id, m.teams?.home?.id, m.teams?.away?.id, m.fixture?.date]);
    map.set(id, m); // last occurrence wins (ok)
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
  return arr;
}

(async () => {
  try {
    console.log("🔄 Start fetching matches for Yesterday / Today / Tomorrow...");

    const offsets = [-1, 0, 1]; // أمس, اليوم, غد
    let allMatches = [];

    for (const offset of offsets) {
      const dateStr = getDateString(offset);
      try {
        const matches = await fetchForDate(dateStr);
        console.log(`⤷ ${matches.length} matches on ${dateStr}`);
        allMatches.push(...matches);
      } catch (err) {
        console.error(`⚠️ Failed to fetch date ${dateStr}:`, err.message || err);
        // do not exit immediately — continue to try other dates
      }
    }

    // Deduplicate + sort
    const finalMatches = dedupeAndSortMatches(allMatches);
    console.log(`✅ Total unique matches gathered: ${finalMatches.length}`);

    // Prepare output object in same shape the client code expects: { response: [...] }
    const out = {
      generated_at: new Date().toISOString(),
      source: "api-football (dates: yesterday,today,tomorrow)",
      response: finalMatches
    };

    fs.writeFileSync("matches.json", JSON.stringify(out, null, 2));
    console.log("✅ matches.json written to repo root.");

    // Exit 0 -> Action will continue to commit/push
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error:", err && err.message ? err.message : err);
    process.exit(1);
  }
})();
