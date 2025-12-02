const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());

// --- HELPERS to clean messy Billboard data ---
function cleanArtist(artist) {
  if (!artist) return "";
  // Removes "feat.", "featuring", "&", "with"
  return artist.split(/\s+(feat\.?|featuring|&|x|with|vs\.?)\s+/i)[0].trim();
}

function cleanTitle(title) {
  if (!title) return "";
  // Removes text in parentheses/brackets like "(Taylor's Version)"
  return title.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
}

// 1. Home Page (Required for GetSongBPM Verification)
app.get("/", (req, res) => {
  res.send('<h1>Music Data API</h1><p>Powered by <a href="https://getsongbpm.com">GetSongBPM</a></p>');
});

// 2. The BPM Endpoint
app.get("/bpm", async (req, res) => {
  const { artist, title } = req.query;
  const apiKey = process.env.GETSONGBPM_KEY;

  if (!artist || !title) return res.status(400).json({ error: "Missing artist or title" });
  if (!apiKey) return res.status(500).json({ error: "Server missing API Key" });

  // Clean the inputs
  const simpleTitle = cleanTitle(title);
  const simpleArtist = cleanArtist(artist);

  try {
    // Use the URL from your dashboard
    const searchUrl = `https://api.getsong.co/search/`;
    
    // Config for the request
    const config = {
      params: {
        type: 'both',
        lookup: `song:${simpleTitle} artist:${simpleArtist}`
      },
      headers: {
        'x-api-key': apiKey.trim(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };

    console.log(`Searching for: ${simpleTitle} by ${simpleArtist}`);
    
    // 1. Try Exact Search
    let response = await axios.get(searchUrl, config);
    let results = response.data.search;

    // 2. Fallback: If not found, try searching JUST the title
    if (!results || results.length === 0) {
      console.log("   Strict search failed. Trying title only...");
      config.params.type = 'song';
      config.params.lookup = simpleTitle;
      
      response = await axios.get(searchUrl, config);
      const potentialMatches = response.data.search;

      // Filter results to find a matching artist (fuzzy match)
      if (potentialMatches && potentialMatches.length > 0) {
        const match = potentialMatches.find(t => 
          t.artist.name.toLowerCase().includes(simpleArtist.toLowerCase())
        );
        if (match) results = [match];
      }
    }

    // Return the Data
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
