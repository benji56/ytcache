require('dotenv').config();
const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');

// Initialize Express app and cache
const app = express();
const cache = new NodeCache({ stdTTL: 300 }); // Cache TTL is set to 300 seconds (5 minutes)

// Get environment variables
const channelId = process.env.CHANNEL_ID;
const apiKey = process.env.API_KEY;

if (!channelId || !apiKey) {
  console.error('Error: CHANNEL_ID and API_KEY must be set in environment variables.');
  process.exit(1);
}

const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;

// Route to get cached data or fetch if not cached
app.get('/youtube-live', async (req, res) => {
  try {
    const cacheKey = 'youtube_live_data';
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // If not cached, fetch from YouTube API
    const response = await axios.get(youtubeUrl);
    const data = response.data;

    // Cache the response data
    cache.set(cacheKey, data);

    res.json(data);
  } catch (error) {
    console.error('Error fetching YouTube data:', error);
    res.status(500).json({ error: 'Error fetching YouTube data' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
