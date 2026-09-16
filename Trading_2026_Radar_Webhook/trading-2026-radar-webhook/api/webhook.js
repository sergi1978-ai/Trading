import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

function parseLegacy(bodyText) {
  const parts = String(bodyText || '').trim().split('|');
  if (parts[0] !== 'LONG_AI' || parts.length < 3) return null;
  const map = {};
  for (let i = 3; i < parts.length; i++) {
    const p = parts[i];
    const eq = p.indexOf('=');
    if (eq > 0) map[p.slice(0, eq)] = p.slice(eq + 1);
  }
  const rawState = parts[1];
  const state = rawState === 'A_PLUS' ? 'A+' : rawState === 'A_ENTRY' ? 'A' : rawState === 'PRE_READY' ? 'PRE' : rawState === 'HARD_EXIT' ? 'INVALIDAT' : rawState;
  return {
    ticker: parts[2], state,
    entryQ: map.entryScore != null ? Number(map.entryScore) : null,
    trendScore: map.trendScore != null ? Number(map.trendScore) : null,
    trigger: map.trigger != null ? Number(map.trigger) : null,
    stop: map.stop != null ? Number(map.stop) : null,
    rr: map.rr != null ? Number(map.rr) : null,
    age: map.age != null ? Number(map.age) : null,
    close: map.close != null ? Number(map.close) : null,
    source: 'TradingView',
    updatedAt: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const expected = process.env.TRADINGVIEW_WEBHOOK_SECRET;
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = parseLegacy(payload); }
    }
    if (!payload || !payload.ticker) return res.status(400).json({ error: 'Payload invalid' });
    if (expected && payload.secret !== expected) return res.status(401).json({ error: 'Secret invalid' });

    const clean = {
      ticker: String(payload.ticker).toUpperCase(),
      state: String(payload.state || payload.status || 'WATCH').toUpperCase(),
      entryQ: payload.entryQ == null ? null : Number(payload.entryQ),
      trendScore: payload.trendScore == null ? null : Number(payload.trendScore),
      trigger: payload.trigger == null ? null : Number(payload.trigger),
      stop: payload.stop == null ? null : Number(payload.stop),
      rr: payload.rr == null ? null : Number(payload.rr),
      age: payload.age == null ? null : Number(payload.age),
      close: payload.close == null ? null : Number(payload.close),
      source: 'TradingView',
      updatedAt: new Date().toISOString()
    };
    await redis.set(`signal:${clean.ticker}`, clean);
    return res.status(200).json({ ok: true, signal: clean });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Webhook error' });
  }
}
