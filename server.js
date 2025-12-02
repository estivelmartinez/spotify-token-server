const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio"); // We need this for Wikipedia
const app = express();

app.use(cors());

// --- HELPERS ---
function cleanText(str) {
  if (!str) return "";
  // Remove quotes, references like [1], and trim
  return str.replace(/["']/g, "").replace(/\[.*?\]/g, "").trim();
}

// 1. Home Page
app.get("/", (req, res) => {
  res.send('<h1>Music Data API</h1><p>Powered by GetSongBPM & Wikipedia</p>');
});

// 2. Spotify Token (Keep this!)
app.get("/token", async (req, res) => {
  const authString = Buffer.from(process.env.SPOTIFY_ID + ":" + process.env.SPOTIFY_SECRET).toString("base64");
  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + authString,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. GetSongBPM Endpoint (Keep this!)
app.get("/bpm", async (req, res) => {
  // ... (Paste your existing /bpm logic here from the previous step) ...
  // (For brevity, I'm assuming you keep the Smart Search logic we built previously)
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing API Key" });

  try {
    const searchUrl = `https://api.getsong.co/search/`;
    const response = await axios.get(searchUrl, {
      params: { api_key: apiKey.trim(), type: 'both', lookup: `song:${title} artist:${artist}` },
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const results = response.data.search;
    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.json({ error: "Not found" });
    }
  } catch (e) {
    res.json({ error: "API Error" });
  }
});

// 4. NEW: Wikipedia Year-End Scraper
app.get("/year-end", async (req, res) => {
  const year = req.query.year || "2024";
  const url = `https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_${year}`;

  try {
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const $ = cheerio.load(html);
    const chartData = [];

    // Find the standard wikitable
    $(".wikitable tr").each((i, row) => {
      if (i === 0) return; // Skip header row

      const cols = $(row).find("td");
      if (cols.length >= 2) {
        // Wikipedia columns are usually: [Rank] [Title] [Artist]
        let rank = $(row).find("th").text().trim() || $(cols[0]).text().trim();
        let title = $(cols[0]).text().trim(); // Sometimes Rank is a 'th', sometimes 'td'
        let artist = $(cols[1]).text().trim();

        // If rank was in 'th', shift title/artist
        if ($(row).find("th").length > 0) {
           title = $(cols[0]).text().trim();
           artist = $(cols[1]).text().trim();
        } else {
           // If no 'th', Rank is col 0, Title is col 1, Artist is col 2
           rank = $(cols[0]).text().trim();
           title = $(cols[1]).text().trim();
           artist = $(cols[2]).text().trim();
        }

        if (title && artist) {
          chartData.push({
            rank: parseInt(cleanText(rank)),
            title: cleanText(title),
            artist: cleanText(artist),
            weeks_on_chart: 52 // Year-end charts don't track weeks, so we use a placeholder
          });
        }
      }
    });

    res.json({ year: year, data: chartData });

  } catch (error) {
    res.status(500).json({ error: "Failed to scrape Wikipedia", details: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
