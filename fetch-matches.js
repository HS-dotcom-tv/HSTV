// fetch-matches.js (CommonJS) - football-data.org (FIXED: uses valid league codes)
const fetch = require("node-fetch");
const fs = require("fs");

const API_KEY = process.env.API_FOOTBALLDATA_KEY;
if (!API_KEY) {
  console.error("❌ API key not found. Set API_FOOTBALLDATA_KEY secret in GitHub repository.");
  process.exit(1);
}

// قائمة الدوريات الكبرى برموزها الصحيحة والمعتمدة
const MAJOR_LEAGUES = [
  'WC',  // World Cup
  'CL',  // Champions League
  'EC',  // European Championship
  'PL',  // Premier League (England)
  'PD',  // La Liga (Spain)
  'BL1', // Bundesliga (Germany)
  'SA',  // Serie A (Italy)
  'FL1', // Ligue 1 (France)
  'PPL', // Primeira Liga (Portugal)
  'DED', // Eredivisie (Netherlands)
].join(',');

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

  const homeLogo = home.id ? `https://crests.football-data.org/${home.id}.svg` : (home.crest || "");
  const awayLogo = away.id ? `https://crests.football-data.org/${away.id}.svg` : (away.crest || "");
  const leagueEmblem = competition.emblem || (compCode ? `https://crests.football-data.org/${compCode}.png` : "");

  return {
    fixture: {
      id: m.id || null,
      date: fixtureDate,
      venue: m.venue || null,
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
  if (data && data.error) {
    console.error("❌ API returned error:", data);
    throw new Error("API error: " + JSON.stringify(data));
  }
  return data.matches || [];
}

(async () => {
  try {
    console.log("🔄 Start fetching matches for Yesterday / Today / Tomorrow (football-data.org) ...");
    
    const yesterday = getDateString(-1);
    const tomorrow = getDateString(1);

    const allRaw = await fetchMatchesForDateRange(yesterday, tomorrow);
    
    allRaw.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    const normalized = allRaw.map(normalizeMatchFootballData);

    console.log(`✅ Total unique matches gathered: ${normalized.length}`);
    const out = {
      generated_at: new Date().toISOString(),
      source: "football-data.org (filtered by major leagues)",
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
