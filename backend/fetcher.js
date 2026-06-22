const { upsertPrice } = require('./db');

// Server-side fetch — no CORS proxy needed
const STOCKS = [
  { name: 'OpenAI',     sym: 'OPAI', ticker: 'OPAI.PVT', ipoBase: null },
  { name: 'Anthropic',  sym: 'ANTH', ticker: 'ANTH.PVT', ipoBase: null },
  { name: 'SpaceX',     sym: 'SPAX', ticker: 'SPCX',     ipoBase: 135  }, // IPO Jun 12 2026 at $135
  { name: 'Kalshi',     sym: 'KLSH', ticker: 'KLSH.PVT', ipoBase: null },
  { name: 'Polymarket', sym: 'POLA', ticker: 'POLA.PVT', ipoBase: null },
  { name: 'Neuralink',  sym: 'NEUR', ticker: 'NEUR.PVT', ipoBase: null },
  { name: 'Skild AI',   sym: 'SKIA', ticker: 'SKIA.PVT', ipoBase: null },
  { name: 'Stripe',     sym: 'STRP', ticker: 'STRI.PVT', ipoBase: null },
  { name: 'xAI',        sym: 'XAI',  ticker: null,        ipoBase: null }, // not on Yahoo Finance
  { name: 'Waymo',      sym: 'WAYM', ticker: null,        ipoBase: null }, // not on Yahoo Finance
  { name: 'Databricks', sym: 'DBRK', ticker: 'DATB.PVT', ipoBase: null },
  { name: 'Perplexity', sym: 'PRPL', ticker: 'PEAI.PVT', ipoBase: null },
];

// Fallback prices used when Yahoo Finance is unavailable
// Source: finance.yahoo.com/markets/private-companies/highest-valuation/ — Jun 18 2026
const FALLBACKS = {
  OPAI: { price: 733.54, wk52: 120.93 },
  ANTH: { price: 589.01, wk52: 950.12 },
  SPAX: { price: 191.82, wk52:  42.09 },
  KLSH: { price: 653.25, wk52: 1878.95 },
  POLA: { price: 135.91, wk52: 1508.40 },
  NEUR: { price:  75.62, wk52:   28.43 },
  SKIA: { price:  65.35, wk52:  161.19 },
  STRP: { price:  72.01, wk52:  100.31 },
  XAI:  { price:  31.18, wk52:   54.7  },
  WAYM: { price:  27.84, wk52:   21.3  },
  DBRK: { price: 242.04, wk52:  114.67 },
  PRPL: { price:  65.00, wk52:   18.83 },
};

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

async function fetchYFMeta(ticker) {
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) return meta;
    } catch (_) {}
  }
  return null;
}

async function fetchAndStorePrices() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[fetcher] ${today} — starting`);

  await Promise.allSettled(STOCKS.map(async (s) => {
    let price = null, wk52pct = null, live = false;

    if (s.ticker) {
      const meta = await fetchYFMeta(s.ticker);
      if (meta) {
        price = meta.regularMarketPrice;
        const baseline = s.ipoBase ?? meta.chartPreviousClose;
        if (baseline) wk52pct = ((price - baseline) / baseline) * 100;
        live = true;
      }
    }

    if (!price) {
      const fb = FALLBACKS[s.sym];
      if (fb) { price = fb.price; wk52pct = fb.wk52; }
    }

    if (price !== null) {
      upsertPrice({ symbol: s.sym, date: today, name: s.name, price, wk52pct, live, ticker: s.ticker });
      console.log(`[fetcher]  ${s.sym.padEnd(4)} $${price.toFixed(2).padStart(8)}  ${live ? 'live' : 'fallback'}`);
    }
  }));

  console.log('[fetcher] done');
}

module.exports = { fetchAndStorePrices };
