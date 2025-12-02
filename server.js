const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());

// --- HELPER 1: Remove "feat.", "&", "with" from Artist ---
// Input: "Drake feat. 21 Savage" -> Output: "Drake"
function cleanArtist(artist) {
  if (!artist) return "";
  return artist.split(/\s+(feat\.?|featuring|&|x|with|vs\.?)\s+/i)[0].trim();
}

// --- HELPER 2: Remove "(...)" and "[...]" from Title ---
// Input: "All Too Well (10 Minute Version)" -> Output: "All Too Well"
function cleanTitle(title) {
  if (!title) return "";
  // Removes text in parentheses or brackets
  return title.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
}

// 1. Home Page
app.get("/", (req, res) => {
  res.send('<h1>Smart Music API</h1><p>Powered by <a href="https://getsongbpm.com">GetSongBPM</a></p>');
});

// 2. Spotify Token Endpoint (Keep this)
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

// 3. GetSongBPM Endpoint (UPDATED WITH SMART LOGIC)
app.get("/bpm", async (req, res) => {
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;

  if (!artist || !title) return res.status(400).json({ error: "Missing artist or title" });
  if (!apiKey) return res.status(500).json({ error: "Server missing API Key" });

  try {
    const baseUrl = `https://api.getsong.co/search/`;
    
    // 🧠 STRATEGY 1: Try Clean Title + Clean Artist
    const simpleTitle = cleanTitle(title);
    const simpleArtist = cleanArtist(artist);
    
    // Log what we are actually searching for (check Render logs to see this!)
    console.log(`Searching: "${simpleTitle}" by "${simpleArtist}"`);

    const lookupQuery = `song:${simpleTitle} artist:${simpleArtist}`;

    let response = await axios.get(baseUrl, {
      params: { api_key: apiKey.trim(), type: 'both', lookup: lookupQuery },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    let results = response.data.search;

    // 🧠 STRATEGY 2: Fallback (Title Only)
    // If exact match failed, search JUST the title and look for the artist manually
    if (!results || results.length === 0) {
      console.log(`Strict search failed. Trying title only: "${simpleTitle}"`);
      
      response = await axios.get(baseUrl, {
        params: { api_key: apiKey.trim(), type: 'song', lookup: simpleTitle },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      
      const potentialMatches = response.data.search;
      
      if (potentialMatches && potentialMatches.length > 0) {
        // Filter results to find one where the artist matches loosely
        // e.g. If we found "Cruel Summer" by "Bananarama" and "Taylor Swift", pick Taylor.
        const bestMatch = potentialMatches.find(track => 
          track.artist.name.toLowerCase().includes(simpleArtist.toLowerCase()) ||
          simpleArtist.toLowerCase().includes(track.artist.name.toLowerCase())
        );
        
        if (bestMatch) results = [bestMatch];
      }
    }

    // Return the result
    if (results && results.length > 0) {
      const topMatch = results[0];
      res.json({
        bpm: topMatch.tempo,
        key: topMatch.key_of,
        title: topMatch.song_title,
        artist: topMatch.artist.name,
        original_query: `${title} by ${artist}`,
        found_as: `${topMatch.song_title} by ${topMatch.artist.name}`
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
