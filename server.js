const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const app = express();

app.use(cors());

// 1. Existing Token Endpoint (Keep this!)
app.get("/token", async (request, response) => {
  const authString = Buffer.from(process.env.SPOTIFY_ID + ":" + process.env.SPOTIFY_SECRET).toString("base64");
  try {
    const spotifyResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + authString,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    const data = await spotifyResponse.json();
    response.json(data);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

// 2. NEW: Scraper Endpoint
app.get("/scrape", async (req, res) => {
  const { title, artist } = req.query;
  
  if (!title || !artist) {
    return res.status(400).json({ error: "Missing title or artist" });
  }

  try {
    // A. Construct the Search URL for GetSongBPM
    const query = `${title} ${artist}`.replace(/ /g, "+").replace(/[^\w\+]/g, "");
    const searchUrl = `https://getsongbpm.com/search?q=${query}`;

    // B. Fetch the HTML
    const { data: html } = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });

    // C. Parse with Cheerio
    const $ = cheerio.load(html);
    
    // D. Extract the first result's BPM and Key
    // (Note: These selectors are specific to GetSongBPM's current layout)
    const bpmText = $(".bpm").first().text().trim().replace(" BPM", "");
    const keyText = $(".key").first().text().trim();

    // Check if we found data
    if (bpmText && keyText) {
      res.json({ bpm: parseInt(bpmText), key: keyText });
    } else {
      res.json({ bpm: null, key: null, note: "Not found on GetSongBPM" });
    }

  } catch (error) {
    console.error("Scrape Error:", error.message);
    res.json({ bpm: null, key: null, error: "Scraping failed" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
