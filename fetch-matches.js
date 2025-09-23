// fetch-matches.js  (CommonJS)
const fetch = require("node-fetch");
const fs = require("fs");

const API_KEY = process.env.API_FOOTBALL_KEY; // لا تضع المفتاح هنا، سنخزنه كـ Secret
if (!API_KEY) {
  console.error("❌ API key not found. Set API_FOOTBALL_KEY secret in GitHub repository.");
  process.exit(1);
}

const url = "https://v3.football.api-sports.io/fixtures?next=100"; // نأخذ المباريات القادمة (يمكن تعديل)
const headers = {
  "x-apisports-key": API_KEY,
  "x-rapidapi-host": "v3.football.api-sports.io"
};

async function fetchMatches() {
  console.log("🔄 Start fetching from API...");
  try {
    const res = await fetch(url, { headers });
    console.log("⤷ HTTP status:", res.status);
    const data = await res.json();

    // لو response فيها خطأ من الـ API، نطبعها
    if (data && data.errors) {
      console.error("❌ API returned errors:", JSON.stringify(data.errors, null, 2));
      process.exit(1);
    }

    fs.writeFileSync("matches.json", JSON.stringify(data, null, 2));
    console.log("✅ matches.json written. Matches count (response.length or response):", (data && data.response) ? data.response.length : "unknown");
  } catch (err) {
    console.error("❌ Fetch failed:", err && err.message ? err.message : err);
    process.exit(1);
  }
}

fetchMatches();
