const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());

// 1. Home Page (Required for GetSongBPM Verification)
app.get("/", (req, res) => {
  res.send('<h1>Music Data API</h1><p>Powered by <a href="https://getsongbpm.com">GetSongBPM</a></p>');
});

// 2. Spotify Token Endpoint
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

// ... (Previous code remains the same)

// 3. GetSongBPM Endpoint
app.get("/bpm", async (req, res) => {
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;

  if (!artist || !title) return res.status(400).json({ error: "Missing artist or title" });
  if (!apiKey) return res.status(500).json({ error: "Server missing API Key" });

  try {
    // 1. URL from your dashboard screenshot
    const searchUrl = `https://api.getsong.co/search/`; 
    
    // 2. Manually format the lookup string to ensure correct encoding
    const lookupQuery = `song:${title} artist:${artist}`;

    const response = await axios.get(searchUrl, {
      params: {
        api_key: apiKey.trim(), // Remove accidental spaces
        type: 'both',
        lookup: lookupQuery
      },
      headers: {
        // Pretend to be a browser to avoid being blocked
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const searchResults = response.data.search;
    
    if (searchResults && searchResults.length > 0) {
      const topMatch = searchResults[0];
      res.json({
        bpm: topMatch.tempo,
        key: topMatch.key_of,
        title: topMatch.song_title,
        artist: topMatch.artist.name
      });
    } else {
      res.json({ bpm: null, key: null, error: "Song not found in database" });
    }

  } catch (error) {
    console.error("GetSongBPM Error:", error.message);
    // Log the full error to Render logs so you can debug
    if (error.response) {
      console.error("Response Body:", JSON.stringify(error.response.data));
      res.json({ bpm: null, key: null, error: `API Error: ${error.response.status}` });
    } else {
      res.json({ bpm: null, key: null, error: "Network Error" });
    }
  }
});
