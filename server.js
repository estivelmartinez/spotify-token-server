const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const app = express();

// Enable CORS so Observable can talk to this server
app.use(cors());

app.get("/token", async (request, response) => {
  // Securely encode your Client ID and Secret
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

// Render sets the PORT environment variable automatically
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Token server running on port " + port);
});
