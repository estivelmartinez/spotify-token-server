const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());

// Helper function to clean artist names
// Turns "Morgan Wallen Featuring Tate McRae" -> "Morgan Wallen"
function cleanArtist(artist) {
  return artist.split(" Featuring")[0]
               .split(" Feat")[0]
               .split(" &")[0]
               .split(" X ")[0]
               .split(" x ")[0]
               .split(" /")[0]
               .trim();
}

// 1. Home Page
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

// 3. GetSongBPM Endpoint (SMART SEARCH)
app.get("/bpm", async (req, res) => {
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;

  if (!artist || !title) return res.status(400).json({ error: "Missing artist or title" });
  if (!apiKey) return res.status(500).json({ error: "Server missing API Key" });

  try {
    const baseUrl = `https://api.getsong.co/search/`;
    const simpleArtist = cleanArtist(artist);
    
    // ATTEMPT 1: Specific Search (Title + Clean Artist)
    // We use the cleaned artist to increase chances of a match
    let response = await axios.get(baseUrl, {
      params: {
        api_key: apiKey.trim(),
        type: 'both',
        lookup: `song:${title} artist:${simpleArtist}`
      },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    let results = response.data.search;

    // ATTEMPT 2: Fallback (Title Only)
    // If strict search failed, search JUST the song title
    if (!results || results.length === 0) {
      console.log(`Strict search failed for ${title}. Trying title only...`);
      response = await axios.get(baseUrl, {
        params: {
          api_key: apiKey.trim(),
          type: 'song',  // Only search songs
          lookup: title  // Just the title
        },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      results = response.data.search;
    }

    // Return the best result
    if (results && results.length > 0) {
      const topMatch = results[0];
      res.json({
        bpm: topMatch.tempo,
        key: topMatch.key_of,
        title: topMatch.song_title,
        artist: topMatch.artist.name,
        note: "Success"
      });
    } else {
      res.json({ bpm: null, key: null, error: "Song not found in database" });
    }

  } catch (error) {
    console.error("GetSongBPM Error:", error.message);
    if (error.response) {
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
