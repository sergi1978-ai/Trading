// LONG AI PROFIT phase 1: clock-safe OHLCV aggregation from executed 1-minute bars.
// Pure offline functions. No network, no changes to the production signal engine.
const zone = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const slots = ms => Object.fromEntries(zone.formatToParts(new Date(ms)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
function parseWall(value) {
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if(!match)throw new Error('Bad Alpaca calendar wall time: '+value);
  const [_,y,m,d,h,min]=match; const base=Date.UTC(+y,+m-1,+d,+h,+min);
  for(const hours of [4,5]) {
    const ms=base+hours*3600000, p=slots(ms);
    if(p.year===+y&&p.month===+m&&p.day===+d&&p.hour===+h&&p.minute===+min)return ms;
  }
  throw new Error('NYSE wall time cannot be resolved: '+value);
}
export function normalizeAlpacaCalendar(calendar) {
  if(!Array.isArray(calendar))throw new Error('Calendar array required');
  return calendar.map(c=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||!c.open?.startsWith(c.date+'T')||!c.close?.startsWith(c.date+'T'))throw new Error('Invalid calendar date');
    const start=parseWall(c.open),end=parseWall(c.close);
    if(end<=start || (end-start)%60000)throw new Error('Invalid session span');
    return {date:c.date,start,end};
  });
}
function aggregate(bars,start,end) {
  if(!bars.length)return null;
  return {t:new Date(start).toISOString(),endExclusive:new Date(end).toISOString(),durationMinutes:(end-start)/60000,
    o:bars[0].o,h:Math.max(...bars.map(x=>x.h)),l:Math.min(...bars.map(x=>x.l)),c:bars.at(-1).c,v:bars.reduce((a,x)=>a+x.v,0),observedMinutes:bars.length};
}
function checkCoverage(bars,start,end,minCoverage) {
  const expected=(end-start)/60000, observed=bars.length;
  return {expectedMinutes:expected,observedMinutes:observed,missingMinutes:expected-observed,coverage:observed/expected,valid:observed/expected>=minCoverage};
}
// Stock: calendar-backed NYSE RTH, with 60m and 240m blocks anchored at 09:30 ET.
// Crypto: UTC 00:00–24:00, 60m and 240m blocks.
export function reconstructFromMinuteBars(raw,{market='STOCK',calendar=[],asOf=Infinity,minCoverage=.97}={}){
  if(!['STOCK','CRYPTO'].includes(market))throw new Error('Invalid market');
  if(!Array.isArray(raw)||!(minCoverage>0&&minCoverage<=1))throw new Error('Invalid input');
  const cutoff=asOf===Infinity?Infinity:Date.parse(asOf);
  if(Number.isNaN(cutoff))throw new Error('Invalid asOf');
  const errors=[],byTimestamp=new Map();
  for(const [index,b] of raw.entries()){
    const t=Date.parse(b?.t);
    if(!Number.isFinite(t)||t%60000!==0){errors.push({code:'INVALID_TIME',index});continue}
    if(byTimestamp.has(t)){errors.push({code:'DUPLICATE',t:b.t});continue}
    if(![b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)||b.o<=0||b.l<=0||b.v<0||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h)){
      errors.push({code:'INVALID_OHLCV',t:b.t});continue;
    }
    byTimestamp.set(t,{...b,t});
  }
  const rows=[...byTimestamp.values()].sort((a,b)=>a.t-b.t);
  let sessions;
  if(market==='STOCK')sessions=normalizeAlpacaCalendar(calendar);
  else {
    const dates=[...new Set(rows.map(x=>new Date(x.t).toISOString().slice(0,10)))];
    sessions=dates.map(date=>({date,start:Date.parse(date+'T00:00:00Z'),end:Date.parse(date+'T00:00:00Z')+86400000}));
  }
  const seen=new Set(),hourly=[],fourHour=[],daily=[],diagnostics=[];
  for(const session of sessions){
    if(seen.has(session.date)){errors.push({code:'DUPLICATE_SESSION',date:session.date});continue}
    seen.add(session.date);
    const source=rows.filter(x=>x.t>=session.start&&x.t<session.end&&x.t+60000<=cutoff);
    const complete=session.end<=cutoff;
    const cov=checkCoverage(source,session.start,session.end,minCoverage);
    diagnostics.push({date:session.date,...cov,fullyElapsed:complete});
    if(complete&&!cov.valid)errors.push({code:'INSUFFICIENT_COVERAGE',date:session.date,coverage:cov.coverage});
    const buckets=(width,out)=>{
      for(let start=session.start;start<session.end;start+=width){
        const end=Math.min(start+width,session.end);
        if(end>cutoff)continue;
        const members=source.filter(b=>b.t>=start&&b.t<end);
        // Sparse IEX data can omit no-trade minutes; reject material holes, never forward-fill.
        const bucketCov=checkCoverage(members,start,end,Math.min(minCoverage,.95));
        if(!bucketCov.valid){errors.push({code:'INCOMPLETE_BUCKET',date:session.date,start:new Date(start).toISOString()});continue}
        out.push(aggregate(members,start,end));
      }
    };
    buckets(3600000,hourly);
    buckets(14400000,fourHour);
    if(complete&&cov.valid)daily.push(aggregate(source,session.start,session.end));
  }
  // Off-session prints are not allowed to contaminate an RTH candle.
  const outside=rows.filter(x=>!sessions.some(s=>x.t>=s.start&&x.t<s.end));
  return {safeForSignals:errors.length===0,errors,diagnostics,
    excludedOutsideSession:outside.length,hourly,fourHour,daily};
}
export function compareDaily(reconstructed,native,{priceTolerance=.001,volumeTolerance=.005}={}){
  if(!reconstructed||!native)return {valid:false,reason:'MISSING'};
  const errors={};
  for(const key of ['o','h','l','c'])if(Math.abs(reconstructed[key]-native[key])>priceTolerance)errors[key]=reconstructed[key]-native[key];
  const volumeDelta=reconstructed.v-native.v,volumeDeltaPct=native.v?100*volumeDelta/native.v:null;
  return {valid:Object.keys(errors).length===0&&volumeDeltaPct!==null&&Math.abs(volumeDeltaPct)<=volumeTolerance*100,
    errors,volumeDelta,volumeDeltaPct};
}
