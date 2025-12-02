const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());

// --- HELPERS ---
function cleanArtist(artist) {
  if (!artist) return "";
  return artist.split(/\s+(feat\.?|featuring|&|x|with|vs\.?)\s+/i)[0].trim();
}

function cleanTitle(title) {
  if (!title) return "";
  return title.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
}

app.get("/", (req, res) => {
  res.send('<h1>Music Data API</h1><p>Powered by <a href="https://getsongbpm.com">GetSongBPM</a></p>');
});

// --- THE BPM ENDPOINT ---
app.get("/bpm", async (req, res) => {
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;

  if (!artist || !title) return res.status(400).json({ error: "Missing artist or title" });
  if (!apiKey) return res.status(500).json({ error: "Server missing API Key" });

  const simpleTitle = cleanTitle(title);
  const simpleArtist = cleanArtist(artist);

  try {
    const searchUrl = `https://api.getsong.co/search/`;
    
    // ✅ FIX: Send api_key in 'params' (URL) instead of 'headers'
    const response = await axios.get(searchUrl, {
      params: {
        api_key: apiKey.trim(), 
        type: 'both',
        lookup: `song:${simpleTitle} artist:${simpleArtist}`
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const results = response.data.search;
    
    // Fallback: Title Only Search
    if (!results || results.length === 0) {
      console.log("Strict search failed. Trying title only...");
      const fallbackResponse = await axios.get(searchUrl, {
        params: {
          api_key: apiKey.trim(),
          type: 'song',
          lookup: simpleTitle
        },
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      const potentialMatches = fallbackResponse.data.search;
      if (potentialMatches && potentialMatches.length > 0) {
         // Simple fuzzy match check
         const match = potentialMatches.find(t => 
           t.artist.name.toLowerCase().includes(simpleArtist.toLowerCase())
         );
         if (match) {
             return res.json({
               bpm: match.tempo,
               key: match.key_of,
               title: match.song_title,
               artist: match.artist.name
             });
         }
      }
    }

    if (results && results.length > 0) {
      const track = results[0];
      res.json({
        bpm: track.tempo,
        key: track.key_of,
        title: track.song_title,
        artist: track.artist.name
      });
    } else {
      res.json({ bpm: null, key: null, error: "Not found" });
    }

  } catch (error) {
    console.error("API Error:", error.message);
    if (error.response) {
       // Pass the exact error code back to you
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
