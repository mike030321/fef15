require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { initDb, getLatestPrices, getPriceHistory, getAllHistory } = require('./db');
const { fetchAndStorePrices } = require('./fetcher');

const app = express();
const PORT = process.env.PORT || 3001;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || '';

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

// GET /api/prices — latest price for every symbol
app.get('/api/prices', (req, res) => {
  try {
    const data = getLatestPrices();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[api] /api/prices error:', err.message);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// GET /api/prices/history/:symbol?days=30
app.get('/api/prices/history/:symbol', (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const data = getPriceHistory(symbol, days);
    res.json({ success: true, symbol, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// GET /api/prices/history — all symbols for last N days
app.get('/api/history', (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const data = getAllHistory(days);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// POST /api/refresh — trigger manual fetch (protected)
app.post('/api/refresh', async (req, res) => {
  if (!REFRESH_TOKEN || req.headers['x-refresh-token'] !== REFRESH_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  res.json({ success: true, message: 'Refresh started' });
  await fetchAndStorePrices();
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ success: true, uptime: process.uptime() });
});

// Daily fetch at 06:00 UTC (after US pre-market, Forge updates overnight)
cron.schedule('0 6 * * *', () => {
  console.log('[cron] daily fetch triggered');
  fetchAndStorePrices();
});

// Start
initDb();
app.listen(PORT, () => {
  console.log(`[server] FEF15 backend listening on port ${PORT}`);
  // Fetch on startup so DB is never empty
  fetchAndStorePrices();
});
