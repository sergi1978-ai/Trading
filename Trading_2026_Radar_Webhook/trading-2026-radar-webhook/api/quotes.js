export default async function handler(req, res) {
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_API_SECRET;
  if (!key || !secret) return res.status(500).json({error:'Falten ALPACA_API_KEY / ALPACA_API_SECRET'});
  const raw = String(req.query.symbols || '').trim();
  if (!raw) return res.status(400).json({error:'Falten symbols'});
  const symbols = raw.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean).slice(0,100);
  try {
    const url = 'https://data.alpaca.markets/v2/stocks/snapshots?symbols=' + encodeURIComponent(symbols.join(',')) + '&feed=iex';
    const r = await fetch(url,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret}});
    const body = await r.json();
    if (!r.ok) return res.status(r.status).json({error:body.message || 'Alpaca error'});
    const quotes = symbols.map(symbol=>{
      const s=body[symbol]; if(!s) return null;
      const price=s.latestTrade?.p ?? s.minuteBar?.c ?? s.dailyBar?.c ?? null;
      const prevClose=s.prevDailyBar?.c ?? null;
      const dayPct=price&&prevClose ? (price-prevClose)/prevClose*100 : null;
      return {symbol,price,prevClose,dayPct};
    }).filter(Boolean);
    res.setHeader('Cache-Control','s-maxage=15, stale-while-revalidate=15');
    return res.status(200).json({quotes,source:'Alpaca IEX',ts:new Date().toISOString()});
  } catch (e) { return res.status(500).json({error:e.message}); }
}
