// Run manually: ALPACA_API_KEY=... ALPACA_API_SECRET=... node scripts/verify-live-ohlcv.mjs
// Read-only audit. Does not send orders, modify the radar, or publish raw vendor data.
import {reconstructFromMinuteBars,compareDaily} from '../lib/minute-parity.js';
const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
if(!key||!secret)throw new Error('Missing ALPACA_API_KEY or ALPACA_API_SECRET');
const symbol=String(process.env.AUDIT_SYMBOL||'UBER').toUpperCase();
const start=String(process.env.AUDIT_FROM||'2026-10-20');
const end=String(process.env.AUDIT_TO||'2026-10-23');
if(!/^[A-Z.]{1,8}$/.test(symbol)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))throw new Error('Invalid symbol or audit dates');
const headers={'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret};
async function request(url){
 const response=await fetch(url,{headers});
 if(!response.ok)throw new Error('Alpaca '+response.status+': '+(await response.text()).slice(0,150));
 return response.json();
}
function nextDate(s){const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)}
async function bars(tf,from,to){
 const out=[];let token=null;
 for(let page=0;page<20;page++){
  const u=new URL('https://data.alpaca.markets/v2/stocks/bars');
  const params={symbols:symbol,timeframe:tf,start:from+'T00:00:00Z',end:nextDate(to)+'T00:00:00Z',sort:'asc',limit:'10000',feed:'iex',adjustment:'split'};
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  if(token)u.searchParams.set('page_token',token);
  const data=await request(u);
  out.push(...(data.bars?.[symbol]||[]));
  token=data.next_page_token;
  if(!token)return out;
 }
 throw new Error('Pagination limit exceeded; data not complete');
}
async function calendar(){
 const base=process.env.ALPACA_CALENDAR_API_URL||'https://paper-api.alpaca.markets/v2/calendar';
 const u=new URL(base);u.searchParams.set('start',start);u.searchParams.set('end',end);
 const response=await request(u);
 return response.map(c=>({date:c.date,open:c.open.includes('T')?c.open:c.date+'T'+c.open+(c.open.length===5?':00':''),
   close:c.close.includes('T')?c.close:c.date+'T'+c.close+(c.close.length===5?':00':'')}));
}
const [minute,daily,cal]=await Promise.all([bars('1Min',start,end),bars('1Day',start,end),calendar()]);
const audit=reconstructFromMinuteBars(minute.map(b=>({...b,t:b.t})),{market:'STOCK',calendar:cal,asOf:nextDate(end)+'T00:00:00Z'});
const results=audit.daily.map(r=>{
 const date=r.t.slice(0,10);
 // A native daily stock bar timestamp is local midnight; in DST it can be 04:00 UTC.
 const native=daily.find(b=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(b.t))===date);
 return {date,observedMinutes:r.observedMinutes,...compareDaily(r,native)};
});
console.log(JSON.stringify({symbol,feed:'iex',from:start,to:end,safeForSignals:audit.safeForSignals,
  diagnostics:audit.diagnostics,excludedOutsideSession:audit.excludedOutsideSession,
  errors:audit.errors,results},null,2));
if(!audit.safeForSignals||!results.length||results.some(r=>!r.valid))process.exitCode=1;
