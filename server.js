const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());

// --- HELPERS ---

// 1. Remove features: "Drake feat. Future" -> "Drake"
function cleanArtist(artist) {
  if (!artist) return "";
  return artist.split(/\s+(feat\.?|featuring|&|x|with|vs\.?)\s+/i)[0].trim();
}

// 2. Remove extra info: "Song (Live)" -> "Song"
function cleanTitle(title) {
  if (!title) return "";
  return title.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
}

// 3. Remove punctuation: "P!nk" -> "Pnk", "S.O.S." -> "SOS"
function stripPunctuation(str) {
  return str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").replace(/\s{2,}/g," ");
}

// Check if two strings match loosely (ignoring case/punctuation)
function isFuzzyMatch(str1, str2) {
  const s1 = stripPunctuation(str1.toLowerCase());
  const s2 = stripPunctuation(str2.toLowerCase());
  return s1.includes(s2) || s2.includes(s1);
}

// --- ROUTES ---

app.get("/", (req, res) => {
  res.send('<h1>Music Data API</h1><p>Powered by <a href="https://getsongbpm.com">GetSongBPM</a></p>');
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

// --- SMART BPM SEARCH ---
app.get("/bpm", async (req, res) => {
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;

  if (!artist || !title) return res.status(400).json({ error: "Missing artist or title" });
  if (!apiKey) return res.status(500).json({ error: "Server missing API Key" });

  try {
    const baseUrl = `https://api.getsong.co/search/`;
    
    // Clean inputs
    const simpleTitle = cleanTitle(title);
    const simpleArtist = cleanArtist(artist);
    
    // Log for debugging
    console.log(`🔍 Searching: Title="${simpleTitle}" | Artist="${simpleArtist}"`);

    // STRATEGY 1: Strict Search (Best Accuracy)
    let response = await axios.get(baseUrl, {
      params: { 
        api_key: apiKey.trim(), 
        type: 'both', 
        lookup: `song:${simpleTitle} artist:${simpleArtist}` 
      },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    let results = response.data.search;

    // STRATEGY 2: Fallback (Title Search + Fuzzy Artist Check)
    if (!results || results.length === 0) {
      console.log(`   ⚠️ Strict match failed. Trying Title-only search...`);
      
      response = await axios.get(baseUrl, {
        params: { 
            api_key: apiKey.trim(), 
            type: 'song', 
            lookup: simpleTitle 
        },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      
      const potentialMatches = response.data.search;
      
      if (potentialMatches && potentialMatches.length > 0) {
        // Find first result where artist name looks similar
        const bestMatch = potentialMatches.find(track => 
          isFuzzyMatch(track.artist.name, simpleArtist)
        );
        
        if (bestMatch) {
            console.log(`   ✅ Fuzzy Match Found: "${bestMatch.song_title}" by "${bestMatch.artist.name}"`);
            results = [bestMatch];
        }
      }
    }

    // Return Result
    if (results && results.length > 0) {
      const topMatch = results[0];
      res.json({
        bpm: topMatch.tempo,
        key: topMatch.key_of,
        title: topMatch.song_title,
        artist: topMatch.artist.name
      });
    } else {
      console.log(`   ❌ Failed to find song in database.`);
      res.json({ bpm: null, key: null, error: "Song not found" });
    }

  } catch (error) {
    console.error("API Error:", error.message);
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
