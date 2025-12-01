// ... existing code ...

// NEW: Home page with the required Backlink
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>Music App</title></head>
      <body>
        <h1>My Music Project</h1>
        <p>
           This application uses data provided by 
           <a href="https://getsongbpm.com">GetSongBPM</a>
        </p>
      </body>
    </html>
  `);
});

// ... app.listen code ...
