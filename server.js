const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const app = express();

app.use(cors());

// --- HELPERS ---
function cleanArtist(artist) {
  if (!artist) return "";
  // Remove features and extra noise
  return artist.split(/\s+(feat\.?|featuring|&|x|with|vs\.?)\s+/i)[0].trim();
}

function cleanTitle(title) {
  if (!title) return "";
  // Remove (Live), [Remastered], etc.
  return title.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
}

function isFuzzyMatch(str1, str2) {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, "");
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, "");
  return s1.includes(s2) || s2.includes(s1);
}

// --- ROUTES ---
app.get("/", (req, res) => {
  res.send('<h1>Music Data API</h1><p>Powered by GetSongBPM & MusicStax</p>');
});

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

// --- THE ULTIMATE BPM ENDPOINT ---
app.get("/bpm", async (req, res) => {
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;

  if (!artist || !title) return res.status(400).json({ error: "Missing artist or title" });

  const simpleTitle = cleanTitle(title);
  const simpleArtist = cleanArtist(artist);
  console.log(`Searching: "${simpleTitle}" by "${simpleArtist}"`);

  // --- STRATEGY 1: GETSONGBPM API ---
  if (apiKey) {
    try {
      const baseUrl = `https://api.getsong.co/search/`;
      let response = await axios.get(baseUrl, {
        params: { api_key: apiKey.trim(), type: 'both', lookup: `song:${simpleTitle} artist:${simpleArtist}` },
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      let results = response.data.search;

      // Fallback: Title Only
      if (!results || results.length === 0) {
        response = await axios.get(baseUrl, {
          params: { api_key: apiKey.trim(), type: 'song', lookup: simpleTitle },
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const potential = response.data.search;
        if (potential && potential.length > 0) {
          const match = potential.find(t => isFuzzyMatch(t.artist.name, simpleArtist));
          if (match) results = [match];
        }
      }

      if (results && results.length > 0) {
        return res.json({
          bpm: results[0].tempo,
          key: results[0].key_of,
          source: "GetSongBPM API"
        });
      }
    } catch (error) {
      console.log("API failed, switching to scraper...");
    }
  }

  // --- STRATEGY 2: MUSICSTAX SCRAPER (Fallback) ---
  try {
    console.log("Attempting MusicStax Scrape...");
    const query = encodeURIComponent(`${simpleArtist} ${simpleTitle}`);
    const searchUrl = `https://musicstax.com/search?q=${query}`;
    
    const { data: html } = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const $ = cheerio.load(html);
    const firstResult = $(".search-result-track").first();
    const bpm = firstResult.find(".bpm-text").text().trim();
    const key = firstResult.find(".key-text").text().trim();

    if (bpm && key) {
      return res.json({
        bpm: parseInt(bpm),
        key: key,
        source: "MusicStax Scraper"
      });
    }
  } catch (error) {
    console.error("Scraper failed:", error.message);
  }

  // If both failed
  res.json({ bpm: null, key: null, error: "Not found in any database" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
