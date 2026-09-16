import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
  try {
    const symbols = String(req.query.symbols || '').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean).slice(0,100);
    const signals = [];
    for (const s of symbols) {
      const v = await redis.get(`signal:${s}`);
      if (v) signals.push(v);
    }
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ signals });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Signals error' });
  }
}
