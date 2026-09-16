
function nyParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    year: Number(obj.year), month: Number(obj.month), day: Number(obj.day),
    weekday: obj.weekday,
    hour: Number(obj.hour), minute: Number(obj.minute), second: Number(obj.second)
  };
}

function currentSession() {
  const p = nyParts();
  const mins = p.hour * 60 + p.minute;
  const weekend = p.weekday === 'Sat' || p.weekday === 'Sun';

  if (weekend) return { session: 'TANCAT', extended: false };

  // US equities typical windows in ET:
  // premarket 04:00–09:30, regular 09:30–16:00, after-hours 16:00–20:00.
  // Overnight availability depends on feed/broker, so we label it separately.
  if (mins >= 4*60 && mins < 9*60+30) return { session: 'PREMARKET', extended: true };
  if (mins >= 9*60+30 && mins < 16*60) return { session: 'OBERT', extended: false };
  if (mins >= 16*60 && mins < 20*60) return { session: 'AFTER HOURS', extended: true };
  return { session: 'OVERNIGHT / TANCAT', extended: true };
}

async function alpacaJson(url) {
  const r = await fetch(url, {
    headers: {
      'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
      'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET || ''
    }
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Alpaca ${r.status}: ${txt.slice(0,250)}`);
  return JSON.parse(txt);
}

function isoAgeMinutes(ts) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 60000;
}

export default async function handler(req, res) {
  try {
    if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) {
      return res.status(500).json({ error: 'Falten credencials Alpaca' });
    }

    const symbols = (req.query.symbols || '')
      .toUpperCase().split(',').map(s => s.trim()).filter(Boolean).slice(0,60);

    if (!symbols.length) {
      return res.status(400).json({ error: 'Cal indicar ?symbols=ANET,MU,...' });
    }

    const joined = encodeURIComponent(symbols.join(','));
    const sess = currentSession();

    // Latest IEX trades. These can include activity outside the regular session.
    const latest = await alpacaJson(
      `https://data.alpaca.markets/v2/stocks/trades/latest?symbols=${joined}&feed=iex`
    );

    // Previous daily bar used as reference close.
    const start = new Date(Date.now() - 7*24*3600*1000).toISOString();
    const daily = await alpacaJson(
      `https://data.alpaca.markets/v2/stocks/bars?symbols=${joined}&timeframe=1Day&start=${encodeURIComponent(start)}&limit=1000&adjustment=raw&feed=iex&sort=asc`
    );

    // Overnight is optional. If the account/feed does not support it, fail softly.
    let overnight = {};
    try {
      const ov = await alpacaJson(
        `https://data.alpaca.markets/v2/stocks/trades/latest?symbols=${joined}&feed=overnight`
      );
      overnight = ov.trades || {};
    } catch (_) {}

    const out = {};
    for (const s of symbols) {
      const tr = latest.trades?.[s];
      const ov = overnight?.[s];
      const bars = daily.bars?.[s] || [];
      const prev = bars.length >= 2 ? bars[bars.length - 2] : (bars[0] || null);
      const regularLast = bars.length ? bars[bars.length - 1] : null;

      const candidates = [tr, ov].filter(Boolean);
      candidates.sort((a,b) => new Date(b.t || 0) - new Date(a.t || 0));
      const best = candidates[0] || null;

      const px = best?.p ?? tr?.p ?? regularLast?.c ?? null;
      const refClose = prev?.c ?? regularLast?.c ?? null;
      const changePct = Number.isFinite(px) && Number.isFinite(refClose) && refClose !== 0
        ? ((px / refClose) - 1) * 100
        : null;

      const ageMin = isoAgeMinutes(best?.t);
      const recent = Number.isFinite(ageMin) ? ageMin <= 45 : false;

      out[s] = {
        session: sess.session,
        extendedSession: sess.extended,
        extendedPrice: px,
        extendedChangePct: changePct,
        extendedTimestamp: best?.t || null,
        extendedRecent: recent,
        extendedAgeMinutes: ageMin,
        activity: recent ? 'ACTIVA' : (best ? 'SENSE ACTIVITAT RECENT' : 'SENSE DADES'),
        feed: ov && best === ov ? 'overnight' : 'iex',
        note: sess.session === 'OBERT'
          ? 'Sessió regular'
          : 'La negociació real depèn del broker i del tipus d’ordre'
      };
    }

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      marketSession: sess.session,
      results: out
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
