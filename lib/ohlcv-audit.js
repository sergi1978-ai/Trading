// LONG AI PROFIT phase 1: strict, non-mutating OHLCV data audit.
// Input: 1H candles with opening timestamps, sorted or unsorted. No forward-fill.
// Does NOT replace the production backtest; upstream feed/session semantics must be verified.
const ny = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
function nyParts(ms) {
  const p = Object.fromEntries(ny.formatToParts(new Date(ms)).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
  return { date: `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`, minutes:p.hour*60+p.minute };
}
function utcParts(ms) {
  const d=new Date(ms);
  return {date:d.toISOString().slice(0,10),minutes:d.getUTCHours()*60+d.getUTCMinutes()};
}
const invalid = (code, detail) => ({code,detail});
export function auditHourlyBars(raw, {market='CRYPTO', earlyCloseDates=[]}={}) {
  if(!['STOCK','CRYPTO'].includes(market)) throw new Error('market must be STOCK or CRYPTO');
  if(!Array.isArray(raw)) throw new TypeError('bars must be an array');
  const errors=[],barMap=new Map();
  const earlyClose=new Set(earlyCloseDates);
  for(let i=0;i<raw.length;i++){
    const b=raw[i], ms=Date.parse(b?.t);
    if(!Number.isFinite(ms)){errors.push(invalid('BAD_TIMESTAMP',i));continue}
    if(barMap.has(ms)){errors.push(invalid('DUPLICATE_TIMESTAMP',b.t));continue}
    if(![b.o,b.h,b.l,b.c,b.v].every(x=>typeof x==='number'&&Number.isFinite(x)) ||
       b.o<=0||b.h<=0||b.l<=0||b.c<=0||b.v<0 ||
       b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h)){
      errors.push(invalid('BAD_OHLCV',b.t));continue
    }
    if(ms%60000!==0){errors.push(invalid('MISALIGNED_TIMESTAMP',b.t));continue}
    const session=market==='STOCK'?nyParts(ms):utcParts(ms);
    if(market==='STOCK' && ![570,630,690,750,810,870,930].includes(session.minutes)){
      errors.push(invalid('OUTSIDE_REGULAR_STOCK_SESSION',b.t));continue;
    }
    if(market==='CRYPTO' && session.minutes%60!==0){
      errors.push(invalid('MISALIGNED_HOUR',b.t));continue;
    }
    barMap.set(ms,{...b,t:new Date(ms).toISOString(),ms,date:session.date,minute:session.minutes});
  }
  const bars=[...barMap.values()].sort((a,b)=>a.ms-b.ms), days=new Map();
  for(const b of bars){
    if(!days.has(b.date))days.set(b.date,[]);
    days.get(b.date).push(b);
  }
  const complete=[],incomplete=[];
  for(const [date,day] of days){
    const expected=market==='STOCK'?(earlyClose.has(date)?[570,630,690,750]:[570,630,690,750,810,870,930]):Array.from({length:24},(_,i)=>i*60);
    const got=new Set(day.map(b=>b.minute));
    const missing=expected.filter(m=>!got.has(m));
    const extra=[...got].filter(m=>!expected.includes(m));
    // Early close sessions require an explicit calendar; deliberately reject rather than guess.
    if(missing.length||extra.length){incomplete.push({date,missingMinutes:missing,unexpectedMinutes:extra});continue}
    complete.push({date,bars:day});
  }
  return {market,valid:errors.length===0&&incomplete.length===0,
    errors,incompleteSessions:incomplete,completeSessionCount:complete.length,
    acceptedBars:bars.length,sessionBars:complete};
}
function aggregate(bars){
  return {t:bars[0].t,o:bars[0].o,h:Math.max(...bars.map(b=>b.h)),
    l:Math.min(...bars.map(b=>b.l)),c:bars.at(-1).c,
    v:bars.reduce((n,b)=>n+b.v,0),endExclusive:bars.at(-1).ms+3600000};
}
// Only emit COMPLETED sessions. 4H for stocks means 4h + 2.5h RTH session buckets.
// 4H for crypto means UTC 00/04/08/12/16/20.
export function reconstructClosedTimeframes(raw,{market='CRYPTO',asOf=Infinity,earlyCloseDates=[]}={}){
  const audit=auditHourlyBars(raw,{market,earlyCloseDates});
  const cutoff=asOf===Infinity?Infinity:Date.parse(asOf);
  if(Number.isNaN(cutoff))throw new Error('Invalid asOf');
  // Atomic fail-closed: invalid sessions or source errors prevent all signal generation.
  if(!audit.valid)return {audit,daily:[],fourHour:[],hourly:[],safeForSignals:false};
  const daily=[],fourHour=[],hourly=[];
  for(const session of audit.sessionBars){
    const x=session.bars;
    const groups=market==='STOCK'?(x.length===4?[x]:[x.slice(0,4),x.slice(4,7)]):
      Array.from({length:6},(_,i)=>x.slice(i*4,(i+1)*4));
    for(const b of x)if(b.ms+(market==='STOCK' && (b.minute===930 || (x.length===4 && b===x.at(-1)))?1800000:3600000)<=cutoff)hourly.push(b);
    for(const g of groups){
      const end=g.at(-1).ms+(market==='STOCK' && (g.at(-1).minute===930 || (g.length===4&&earlyCloseDates.includes(session.date)))?1800000:3600000);
      if(end<=cutoff)fourHour.push({...aggregate(g),endExclusive:end});
    }
    // End 16:00 NY for stocks; the last RTH hourly candle is a half-hour.
    const end=x.at(-1).ms+(market==='STOCK'?1800000:3600000);
    if(end<=cutoff)daily.push({...aggregate(x),endExclusive:end});
  }
  return {audit,daily,fourHour,hourly,safeForSignals:true};
}
