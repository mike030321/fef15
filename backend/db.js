const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'fef15.db');
let db;

function initDb() {
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_prices (
      symbol      TEXT NOT NULL,
      date        TEXT NOT NULL,
      name        TEXT NOT NULL,
      price       REAL,
      wk52_pct    REAL,
      live        INTEGER DEFAULT 0,
      ticker      TEXT,
      updated_at  TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (symbol, date)
    );

    CREATE INDEX IF NOT EXISTS idx_dp_date ON daily_prices(date);
    CREATE INDEX IF NOT EXISTS idx_dp_symbol ON daily_prices(symbol);
  `);
  console.log('[db] ready:', DB_PATH);
}

function getDb() {
  if (!db) initDb();
  return db;
}

function upsertPrice({ symbol, date, name, price, wk52pct, live, ticker }) {
  getDb().prepare(`
    INSERT INTO daily_prices (symbol, date, name, price, wk52_pct, live, ticker, updated_at)
    VALUES (@symbol, @date, @name, @price, @wk52pct, @live, @ticker, datetime('now'))
    ON CONFLICT(symbol, date) DO UPDATE SET
      price      = excluded.price,
      wk52_pct   = excluded.wk52_pct,
      live       = excluded.live,
      updated_at = excluded.updated_at
  `).run({ symbol, date, name, price, wk52pct, live: live ? 1 : 0, ticker: ticker ?? null });
}

function getLatestPrices() {
  return getDb().prepare(`
    SELECT symbol, name, price, wk52_pct AS wk52pct, live, ticker, date, updated_at
    FROM daily_prices
    WHERE date = (SELECT MAX(date) FROM daily_prices)
    ORDER BY symbol
  `).all();
}

function getPriceHistory(symbol, days = 30) {
  return getDb().prepare(`
    SELECT date, price, wk52_pct AS wk52pct, live
    FROM daily_prices
    WHERE symbol = ?
    ORDER BY date DESC
    LIMIT ?
  `).all(symbol, days);
}

function getAllHistory(days = 30) {
  return getDb().prepare(`
    SELECT symbol, name, date, price, wk52_pct AS wk52pct, live
    FROM daily_prices
    WHERE date >= date('now', '-' || ? || ' days')
    ORDER BY symbol, date DESC
  `).all(days);
}

module.exports = { initDb, upsertPrice, getLatestPrices, getPriceHistory, getAllHistory };
