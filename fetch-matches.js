// fetch-matches.js (CommonJS) - football-data.org (FIXED: Correct status normalization)
const fetch = require("node-fetch");
const fs = require("fs");

const API_KEY = process.env.API_FOOTBALLDATA_KEY;
if (!API_KEY) {
  console.error("❌ API key not found. Set API_FOOTBALLDATA_KEY secret in GitHub repository.");
  process.exit(1);
}

const MAJOR_LEAGUES = [
  'WC', 'CL', 'EC', 'PL', 'PD', 'BL1', 'SA', 'FL1', 'PPL', 'DED'
].join(',');

const headers = { "X-Auth-Token": API_KEY, "Accept": "application/json" };

function getDateString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

// -->> تم إصلاح هذه الدالة واسترجاع المنطق الصحيح للحالة
function normalizeMatchFootballData(m) {
  const fixtureDate = m.utcDate || null;
  const statusRaw = (m.status || "").toUpperCase();
  let short = "NS"; // Not Started
  if (statusRaw === "SCHEDULED" || statusRaw === "TIMED" || statusRaw === "POSTPONED") short = "NS";
  else if (statusRaw === "IN_PLAY") short = "LIVE";
  else if (statusRaw === "PAUSED") short = "HT"; // Half-Time
  else if (statusRaw === "FINISHED") short = "FT"; // Full-Time
  else if (statusRaw === "AWARDED") short = "AET"; // Awarded after extra time
  else if (statusRaw === "CANCELLED") short = "CANC";
  else short = statusRaw;

  const goalsHome = (m.score && m.score.fullTime && m.score.fullTime.home) != null ? m.score.fullTime.home : null;
  const goalsAway = (m.score && m.score.fullTime && m.score.fullTime.away) != null ? m.score.fullTime.away : null;
  
  const competition = m.competition || {};
  const home = m.homeTeam || {};
  const away = m.awayTeam || {};

  return {
    fixture: {
      id: m.id || null,
      date: fixtureDate,
      venue: m.venue || null,
      status: { short, long: m.status || "", elapsed: m.minute || null }
    },
    league: {
      id: competition.id || null, code: competition.code || null, name: competition.name || "",
      logo: competition.emblem || "", country: (competition.area && competition.area.name) || ""
    },
    teams: {
      home: { id: home.id || null, name: home.name || "Home", logo: `https://crests.football-data.org/${home.id}.svg` },
      away: { id: away.id || null, name: away.name || "Away", logo: `https://crests.football-data.org/${away.id}.svg` }
    },
    goals: {
      home: goalsHome,
      away: goalsAway
    }
  };
}

async function fetchMatchesForDateRange(dateFrom, dateTo) {
  const url = `https://api.football-data.org/v4/matches?competitions=${MAJOR_LEAGUES}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
  console.log(`⤷ Requesting: ${url}`);
  const res = await fetch(url, { headers });
  console.log("⤷ HTTP status:", res.status);
  const data = await res.json();
  if (!res.ok) {
    console.error("❌ HTTP error:", res.status, data);
    throw new Error(`HTTP ${res.status}`);
  }
  return data.matches || [];
}

(async () => {
  try {
    console.log("🔄 Start fetching matches...");
    const yesterday = getDateString(-1);
    const dayAfterTomorrow = getDateString(2); // Fetch until 2 days from now
    const allRaw = await fetchMatchesForDateRange(yesterday, dayAfterTomorrow);
    allRaw.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    const normalized = allRaw.map(normalizeMatchFootballData);
    console.log(`✅ Total matches gathered: ${normalized.length}`);
    const out = {
      generated_at: new Date().toISOString(),
      source: "football-data.org",
      response: normalized
    };
    fs.writeFileSync("matches.json", JSON.stringify(out, null, 2));
    console.log("✅ matches.json written.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    process.exit(1);
  }
})();
