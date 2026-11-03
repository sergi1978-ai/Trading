// Phase 3 / deterministic candle reconstruction. Research only.
// Inputs must be completed, chronological 1H market bars; no Pine motor signals yet.
const tz='America/New_York';
function localParts(iso){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return {day:p.year+'-'+p.month+'-'+p.day,minute:Number(p.hour)*60+Number(p.minute)};
}
export function aggregateBars(input,{market='US_STOCKS',includePartial=false}={}){
 if(market!=='US_STOCKS')throw Error('Only US_STOCKS regular session supported');
 if(!Array.isArray(input))throw Error('Bars must be an array');
 const bars=[...input].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
 const seen=new Set(), buckets=new Map();
 for(const b of bars){
  const ms=Date.parse(b?.t);
  if(!Number.isFinite(ms)||!['o','h','l','c'].every(k=>Number.isFinite(b[k])&&b[k]>0)||!Number.isFinite(b.v)||b.v<0||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h))throw Error('Invalid OHLCV bar');
  if(seen.has(ms))throw Error('Duplicate timestamp');seen.add(ms);
  const {day,minute}=localParts(b.t);
  // US equities: regular session 09:30–16:00 NY, with 4H anchored at 09:30.
  if(minute<570||minute>=960)continue;
  const start=minute<810?570:810;
  const key=day+'|'+start;
  const prev=buckets.get(key);
  if(!prev)buckets.set(key,{t:b.t,day,sessionStartMinute:start,o:b.o,h:b.h,l:b.l,c:b.c,v:b.v,count:1,lastMinute:minute});
  else {if(minute<=prev.lastMinute)throw Error('Non-increasing timestamps within session');prev.h=Math.max(prev.h,b.h);prev.l=Math.min(prev.l,b.l);prev.c=b.c;prev.v+=b.v;prev.count++;prev.lastMinute=minute;}
 }
 const fourHour=[...buckets.values()].filter(x=>includePartial||x.count===(x.sessionStartMinute===570?4:3)).map(({lastMinute,...x})=>x);
 const dailyMap=new Map();
 for(const b of bars){
  const {day,minute}=localParts(b.t);if(minute<570||minute>=960)continue;
  const p=dailyMap.get(day);
  if(!p)dailyMap.set(day,{t:b.t,day,o:b.o,h:b.h,l:b.l,c:b.c,v:b.v,count:1,lastMinute:minute});
  else {p.h=Math.max(p.h,b.h);p.l=Math.min(p.l,b.l);p.c=b.c;p.v+=b.v;p.count++;p.lastMinute=minute;}
 }
 const daily=[...dailyMap.values()].filter(x=>includePartial||x.count===7).map(({lastMinute,...x})=>x);
 return {fourHour,daily,excludedPartial:!includePartial,timezone:tz,session:'09:30–16:00 New York',caveats:['4H uses 09:30 anchor and 4h+2.5h segments; does not necessarily match TradingView exchange bars','Input assumes 1h bars anchored 09:30,10:30,...,15:30 with last 30m','No signals, no orders, no walk-forward']};
}

// Alpaca 30Min bars -> NY-anchored 1H bars (last bar is a 30m session stub).
// We intentionally avoid Alpaca 1Hour bars: their hour boundaries may not
// coincide with the 09:30 US regular-session anchor.
export function fromThirtyMinuteBars(input){
 if(!Array.isArray(input))throw Error('Bars must be an array');
 const sorted=[...input].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
 const buckets=new Map(),seen=new Set();
 for(const b of sorted){
  const ms=Date.parse(b?.t);
  if(!Number.isFinite(ms)||!['o','h','l','c'].every(k=>Number.isFinite(b[k])&&b[k]>0)||!Number.isFinite(b.v)||b.v<0||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h))throw Error('Invalid OHLCV bar');
  if(seen.has(ms))throw Error('Duplicate timestamp');seen.add(ms);
  const {day,minute}=localParts(b.t);
  if(minute<570||minute>=960)continue;
  if((minute-570)%30!==0)throw Error('30m bar misaligned with 09:30 session');
  const hourSlot=Math.floor((minute-570)/60),start=570+hourSlot*60,key=day+'|'+start;
  const p=buckets.get(key);
  if(!p)buckets.set(key,{t:b.t,day,sessionStartMinute:start,o:b.o,h:b.h,l:b.l,c:b.c,v:b.v,count:1});
  else {p.h=Math.max(p.h,b.h);p.l=Math.min(p.l,b.l);p.c=b.c;p.v+=b.v;p.count++;}
 }
 const out=[];
 for(const p of buckets.values()){
  const expected=p.sessionStartMinute===930?1:2;
  if(p.count===expected)out.push({t:p.t,o:p.o,h:p.h,l:p.l,c:p.c,v:p.v});
 }
 return out;
}
