require('dotenv').config();
const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./logger'); // Winston importálása

// Initialize Express app and cache
const app = express();

app.set('trust proxy', true);

app.use(cors({ origin: '*' })); // Enable CORS for all routes
app.use(helmet());
app.use(compression());

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 perc
  max: 60, // Max 60 kérés per IP per perc
});
app.use(limiter);

// Parse CACHE_TTL and set default if necessary
const cacheTTL = parseInt(process.env.CACHE_TTL, 10) || 300; // Default TTL 300 seconds
const cache = new NodeCache({ stdTTL: cacheTTL, checkperiod: cacheTTL / 2 });

// Log cache expiration events
cache.on('expired', (key, value) => {
  logger.info(`Cache entry ${key} expired`);
});



// Validate environment variables
function validateEnvVariables() {
  const requiredVars = ['CHANNEL_ID', 'API_KEY', 'CACHE_TTL'];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error(`Missing environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
}

validateEnvVariables();

// Get environment variables
const channelId = process.env.CHANNEL_ID;
const apiKey = process.env.API_KEY;

const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;

const MAX_RETRIES = 3;

async function fetchYouTubeData(retries = 0) {
  try {
    const response = await axios.get(youtubeUrl);
    return response.data;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      logger.warn(`Retrying YouTube API request (${retries + 1}/${MAX_RETRIES})`);
      return fetchYouTubeData(retries + 1);
    } else {
      throw error;
    }
  }
}

// Health check route
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Route to get cached data or fetch if not cached
app.get('/youtube-live', async (req, res, next) => {
  try {
    const cacheKey = `youtube_live_data_${channelId}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      logger.info('Serving data from cache');
      res.set('Cache-Control', 'no-store');
      return res.json(cachedData);
    }

    // If not cached, fetch from YouTube API
    const data = await fetchYouTubeData();

    if (data && data.items) {
      // Cache the response data
      cache.set(cacheKey, data);
      logger.info(`${cacheKey} cached`);
      res.set('Cache-Control', 'no-store');
      res.json(data);
    } else {
      logger.warn('Invalid response from YouTube API');
      res.status(502).json({ error: 'Invalid response from YouTube API' });
    }
  } catch (error) {
    logger.error('Error fetching YouTube data:', error);
    res.status(500).json({ error: 'Error fetching YouTube data' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start the server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Cache TTL ${cacheTTL}`);
  logger.info(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

function shutDown() {
  server.close(() => {
    logger.info('Closed out remaining connections');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forcing shutdown');
    process.exit(1);
  }, 10000);
}
