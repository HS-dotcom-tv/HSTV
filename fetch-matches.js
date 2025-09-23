// fetch-matches.js  (CommonJS) - for football-data.org
const fetch = require("node-fetch");
const fs = require("fs");

const API_KEY = process.env.API_FOOTBALLDATA_KEY;
if (!API_KEY) {
  console.error("❌ API key not found. Set API_FOOTBALLDATA_KEY secret in GitHub repository.");
  process.exit(1);
}

const headers = {
  "X-Auth-Token": API_KEY,
  "Accept": "application/json"
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

// Map football-data.org match -> normalized shape used by your front-end
function normalizeMatch(m) {
  // football-data fields: id, utcDate, status, score{fullTime}, homeTeam{name,id}, awayTeam{name,id}, competition{ id, name, area{name} }
  const fixtureDate = m.utcDate || m.date || null;
  const statusRaw = (m.status || "").toUpperCase(); // e.g. SCHEDULED, FINISHED, IN_PLAY
  // map status to short codes used before (simple mapping)
  let short = "NS";
  if (statusRaw === "SCHEDULED") short = "NS";
  else if (statusRaw === "IN_PLAY" || statusRaw === "LIVE") short = "1H";
  else if (statusRaw === "PAUSED") short = "HT";
  else if (statusRaw === "FINISHED") short = "FT";
  else short = statusRaw;

  const goalsHome = (m.score && m.score.fullTime && m.score.fullTime.home) != null ? m.score.fullTime.home : null;
  const goalsAway = (m.score && m.score.fullTime && m.score.fullTime.away) != null ? m.score.fullTime.away : null;

  return {
    fixture: {
      id: m.id || null,
      date: fixtureDate,
      status: {
        short,
        long: m.status || "",
        elapsed: (m.minute !== undefined && m.minute !== null) ? m.minute : null
      }
    },
    league: {
      id: (m.competition && (m.competition.id || m.competition.code)) || null,
      name: (m.competition && m.competition.name) || (m.competition && m.competition.area && m.competition.area.name) || "Unknown",
      logo: "",         // football-data.org does not provide logos in free response — leave empty
      country: (m.competition && m.competition.area && m.competition.area.name) || ""
    },
    teams: {
      home: {
        id: (m.homeTeam && m.homeTeam.id) || null,
        name: (m.homeTeam && m.homeTeam.name) || "Home",
        logo: ""        // no logo available here
      },
      away: {
        id: (m.awayTeam && m.awayTeam.id) || null,
        name: (m.awayTeam && m.awayTeam.name) || "Away",
        logo: ""
      }
    },
    goals: {
      home: goalsHome,
      away: goalsAway
    },
    raw: m // keep original in case you need more fields later
  };
}

async function fetchForDate(dateStr) {
  const url = `https://api.football-data.org/v4/matches?date=${dateStr}`;
  console.log(`⤷ Requesting: ${url}`);
  const res = await fetch(url, { headers });
  console.log("⤷ HTTP status:", res.status);
  const data = await res.json();
  if (!res.ok) {
    console.error("❌ HTTP error:", res.status, data);
    throw new Error(`HTTP ${res.status}`);
  }
  if (data && data.error) {
    console.error("❌ API returned error:", data);
    throw new Error("API error: " + JSON.stringify(data));
  }
  // data.matches is list per docs
  const arr = data.matches || data.match || [];
  return arr;
}

function dedupeAndSortMatches(matches) {
  const map = new Map();
  for (const m of matches) {
    const id = m.id || JSON.stringify([m.competition && (m.competition.id || m.competition.code), m.homeTeam && m.homeTeam.id, m.awayTeam && m.awayTeam.id, m.utcDate]);
    map.set(id, m);
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  return arr;
}

(async () => {
  try {
    console.log("🔄 Start fetching matches for Yesterday / Today / Tomorrow (football-data.org) ...");
    const offsets = [-1, 0, 1];
    let allRaw = [];

    for (const offset of offsets) {
      const dateStr = getDateString(offset);
      try {
        const matches = await fetchForDate(dateStr);
        console.log(`⤷ ${matches.length} matches on ${dateStr}`);
        allRaw.push(...matches);
      } catch (err) {
        console.error(`⚠️ Failed to fetch ${dateStr}:`, err.message || err);
        // continue with other dates
      }
    }

    // dedupe raw (by id/unique key) and sort
    const uniqueRaw = dedupeAndSortMatches(allRaw);

    // normalize
    const normalized = uniqueRaw.map(normalizeMatch);

    console.log(`✅ Total unique matches gathered: ${normalized.length}`);

    const out = {
      generated_at: new Date().toISOString(),
      source: "football-data.org (dates: yesterday,today,tomorrow)",
      response: normalized
    };

    fs.writeFileSync("matches.json", JSON.stringify(out, null, 2));
    console.log("✅ matches.json written to repo root.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error:", err && err.message ? err.message : err);
    process.exit(1);
  }
})();
