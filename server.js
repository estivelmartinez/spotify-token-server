const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());

// 1. Home Page (Required for Verification)
app.get("/", (req, res) => {
  res.send('<h1>Music Data API</h1><p>Powered by <a href="https://getsongbpm.com">GetSongBPM</a></p>');
});

// 2. Spotify Token Endpoint (Keep this!)
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

// 3. GetSongBPM Endpoint (UPDATED WITH CORRECT URL)
app.get("/bpm", async (req, res) => {
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;

  if (!artist || !title) return res.status(400).json({ error: "Missing artist or title" });
  if (!apiKey) return res.status(500).json({ error: "Server missing API Key" });

  try {
    // ✅ FIX 1: Use the correct Base URL from your dashboard
    const searchUrl = `https://api.getsong.co/search/`; 
    
    // ✅ FIX 2: Manually format the lookup string
    const lookupQuery = `song:${title} artist:${artist}`;

    const response = await axios.get(searchUrl, {
      params: {
        api_key: apiKey.trim(),
        type: 'both',
        lookup: lookupQuery
      },
      headers: {
        // ✅ FIX 3: Add a User-Agent so they don't block us as a "bot"
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
    
    // Forward the actual error from their API to your logs
    if (error.response) {
      console.error("Response Data:", JSON.stringify(error.response.data));
      res.json({ bpm: null, key: null, error: `API Error: ${error.response.status}` });
    } else {
      res.json({ bpm: null, key: null, error: "Network Error" });
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
