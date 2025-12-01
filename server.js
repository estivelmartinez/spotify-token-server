const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());

// --- ROUTE 1: Home Page (REQUIRED for GetSongBPM Verification) ---
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>Music Data Project</title></head>
      <body>
        <h1>Music Data API</h1>
        <p>
           This educational project uses data provided by 
           <a href="https://getsongbpm.com">GetSongBPM</a>.
        </p>
      </body>
    </html>
  `);
});

// --- ROUTE 2: Spotify Token (For Popularity/Explicit Data) ---
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

// --- ROUTE 3: GetSongBPM Proxy (For BPM & Key) ---
app.get("/bpm", async (req, res) => {
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;

  if (!artist || !title) return res.status(400).json({ error: "Missing artist or title" });
  if (!apiKey) return res.status(500).json({ error: "Server missing API Key" });

  try {
    const searchUrl = `https://api.getsongbpm.com/search/`;
    const response = await axios.get(searchUrl, {
      params: {
        api_key: apiKey,
        type: 'both',
        lookup: `song:${title} artist:${artist}`
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
      res.json({ bpm: null, key: null, error: "Song not found" });
    }
  } catch (error) {
    console.error("GetSongBPM Error:", error.message);
    res.json({ bpm: null, key: null, error: "API Error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
