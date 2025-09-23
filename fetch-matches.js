// fetch-matches.js  (CommonJS) - football-data.org (improved: includes crests & league.code)
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

function getDateString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function normalizeMatchFootballData(m) {
  const fixtureDate = m.utcDate || null;
  const statusRaw = (m.status || "").toUpperCase();
  let short = "NS";
  if (statusRaw === "SCHEDULED" || statusRaw === "TIMED") short = "NS";
  else if (statusRaw === "IN_PLAY" || statusRaw === "LIVE") short = "1H";
  else if (statusRaw === "PAUSED") short = "HT";
  else if (statusRaw === "FINISHED") short = "FT";
  else short = statusRaw;

  const goalsHome = (m.score && m.score.fullTime && m.score.fullTime.home) != null ? m.score.fullTime.home : null;
  const goalsAway = (m.score && m.score.fullTime && m.score.fullTime.away) != null ? m.score.fullTime.away : null;

  const competition = m.competition || {};
  const compCode = competition.code || null;
  const compId = competition.id || null;

  const home = m.homeTeam || {};
  const away = m.awayTeam || {};

  // team crest service (football-data provides crests at crests.football-data.org/{id}.svg)
  const homeLogo = home.id ? `https://crests.football-data.org/${home.id}.svg` : (home.crest || "");
  const awayLogo = away.id ? `https://crests.football-data.org/${away.id}.svg` : (away.crest || "");
  // competition emblem if present (or fallback to crests endpoint by code)
  const leagueEmblem = competition.emblem || (compCode ? `https://crests.football-data.org/${compCode}.png` : "");

  return {
    fixture: {
      id: m.id || null,
      date: fixtureDate,
      status: {
        short,
        long: m.status || "",
        elapsed: m.minute || null
      }
    },
    league: {
      id: compId || compCode || null,
      code: compCode || null,
      name: competition.name || "",
      logo: leagueEmblem,
      country: (competition.area && competition.area.name) || ""
    },
    teams: {
      home: {
        id: home.id || null,
        name: home.name || "Home",
        logo: homeLogo
      },
      away: {
        id: away.id || null,
        name: away.name || "Away",
        logo: awayLogo
      }
    },
    goals: {
      home: goalsHome,
      away: goalsAway
    },
    raw: m
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
  return data.matches || [];
}

function dedupeAndSortRaw(matches) {
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
      }
    }
    const uniqueRaw = dedupeAndSortRaw(allRaw);
    const normalized = uniqueRaw.map(normalizeMatchFootballData);
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
