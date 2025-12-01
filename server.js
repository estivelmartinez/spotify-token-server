const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const app = express();

app.use(cors());

// 1. Keep your existing Token Endpoint
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

// 2. NEW: Scraper Endpoint for BPM & Key
app.get("/scrape", async (req, res) => {
  const { artist, title } = req.query;
  if (!artist || !title) return res.status(400).json({ error: "Missing artist or title" });

  try {
    // Search MusicStax
    const query = encodeURIComponent(`${artist} ${title}`);
    const searchUrl = `https://musicstax.com/search?q=${query}`;
    
    const { data: html } = await axios.get(searchUrl, {
      headers: { 
        // Pretend to be a real browser to avoid being blocked
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
      }
    });

    const $ = cheerio.load(html);

    // Select the first result's BPM and Key (these classes are specific to MusicStax)
    // Note: These selectors might change if the website updates!
    const firstResult = $(".search-result-track").first();
    const bpm = firstResult.find(".bpm-text").text().trim();
    const key = firstResult.find(".key-text").text().trim();

    if (bpm && key) {
      res.json({ bpm: parseInt(bpm), key: key });
    } else {
      res.json({ bpm: null, key: null, error: "Not found" });
    }
  } catch (error) {
    console.error("Scrape failed:", error.message);
    res.status(500).json({ bpm: null, key: null, error: "Scraping failed" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
