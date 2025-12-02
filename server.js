const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const app = express();

app.use(cors());

// --- HELPERS ---

// 1. Clean Artist: "Drake feat. Future" -> "Drake"
function cleanArtist(artist) {
  if (!artist) return "";
  return artist.split(/\s+(feat\.?|featuring|&|x|with|vs\.?)\s+/i)[0].trim();
}

// 2. Clean Title: "Song (Live)" -> "Song"
function cleanTitle(title) {
  if (!title) return "";
  return title.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
}

// 3. Clean Wikipedia Text: Remove quotes and [1] refs
function cleanWikiText(str) {
  if (!str) return "";
  return str.replace(/["']/g, "").replace(/\[.*?\]/g, "").trim();
}

// 4. Fuzzy Match: Check if strings are similar
function isFuzzyMatch(str1, str2) {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, "");
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, "");
  return s1.includes(s2) || s2.includes(s1);
}

// --- ROUTES ---

// 1. Home Page
app.get("/", (req, res) => {
  res.send('<h1>Music Data API</h1><p>Powered by <a href="https://getsongbpm.com">GetSongBPM</a> & Wikipedia</p>');
});

// 2. Spotify Token
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

// 3. Wikipedia Year-End Scraper
app.get("/year-end", async (req, res) => {
  const year = req.query.year || "2024";
  const url = `https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_${year}`;

  try {
    const { data: html } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(html);
    const chartData = [];

    $(".wikitable tr").each((i, row) => {
      if (i === 0) return;
      const cols = $(row).find("td");
      if (cols.length >= 2) {
        let rank = $(row).find("th").text().trim() || $(cols[0]).text().trim();
        let title = $(cols[0]).text().trim();
        let artist = $(cols[1]).text().trim();

        if ($(row).find("th").length > 0) {
           title = $(cols[0]).text().trim();
           artist = $(cols[1]).text().trim();
        } else {
           rank = $(cols[0]).text().trim();
           title = $(cols[1]).text().trim();
           artist = $(cols[2]).text().trim();
        }

        if (title && artist) {
          chartData.push({
            rank: parseInt(cleanWikiText(rank)),
            title: cleanWikiText(title),
            artist: cleanWikiText(artist),
            weeks_on_chart: 52 
          });
        }
      }
    });
    res.json({ year: year, data: chartData });
  } catch (error) {
    res.status(500).json({ error: "Failed to scrape Wikipedia", details: error.message });
  }
});

// 4. SMART BPM Endpoint
app.get("/bpm", async (req, res) => {
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server missing API Key" });

  try {
    const baseUrl = `https://api.getsong.co/search/`;
    const simpleTitle = cleanTitle(title);
    const simpleArtist = cleanArtist(artist);
    
    console.log(`Searching: "${simpleTitle}" by "${simpleArtist}"`);

    // STRATEGY 1: Strict Search
    let response = await axios.get(baseUrl, {
      params: { api_key: apiKey.trim(), type: 'both', lookup: `song:${simpleTitle} artist:${simpleArtist}` },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    let results = response.data.search;

    // STRATEGY 2: Fallback to Title Only
    if (!results || results.length === 0) {
      console.log(`Fallback search for: "${simpleTitle}"`);
      response = await axios.get(baseUrl, {
        params: { api_key: apiKey.trim(), type: 'song', lookup: simpleTitle },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      
      const potentialMatches = response.data.search;
      if (potentialMatches && potentialMatches.length > 0) {
        const bestMatch = potentialMatches.find(track => isFuzzyMatch(track.artist.name, simpleArtist));
        if (bestMatch) results = [bestMatch];
      }
    }

    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.json({ error: "Not found" });
    }
  } catch (error) {
    console.error("API Error:", error.message);
    res.json({ error: "API Error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
