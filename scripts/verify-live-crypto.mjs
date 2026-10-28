// Read-only Alpaca BTC/USD data parity audit. No orders, no production changes.
// ALPACA_API_KEY=... ALPACA_API_SECRET=... node scripts/verify-live-crypto.mjs
import {reconstructFromMinuteBars,compareDaily} from '../lib/minute-parity.js';
const apiKey=process.env.ALPACA_API_KEY,apiSecret=process.env.ALPACA_API_SECRET;
if(!apiKey||!apiSecret)throw new Error('Alpaca API credentials are required');
const symbol=process.env.CRYPTO_AUDIT_SYMBOL||'BTC/USD';
const from=process.env.CRYPTO_AUDIT_FROM||'2026-10-23';
const through=process.env.CRYPTO_AUDIT_TO||'2026-10-26';
if(!/^[A-Z0-9]+\/[A-Z0-9]+$/.test(symbol)||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(through)||from>through)throw new Error('Invalid symbol or dates');
const dateNext=d=>new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10);
const until=dateNext(through);
async function fetchBars(timeframe){
 const all=[];let page=null;
 for(let n=0;n<100;n++){
  const u=new URL('https://data.alpaca.markets/v1beta3/crypto/us/bars');
  for(const [k,v] of Object.entries({symbols:symbol,timeframe,start:from+'T00:00:00Z',end:until+'T00:00:00Z',limit:'10000',sort:'asc'}))u.searchParams.set(k,v);
  if(page)u.searchParams.set('page_token',page);
  const response=await fetch(u,{headers:{'APCA-API-KEY-ID':apiKey,'APCA-API-SECRET-KEY':apiSecret}});
  if(!response.ok)throw new Error('Alpaca '+response.status+': '+(await response.text()).slice(0,150));
  const data=await response.json();
  all.push(...(data.bars?.[symbol]||[]));
  page=data.next_page_token||null;
  if(!page)return all;
 }
 throw new Error('Incomplete pages');
}
const [minutes,hours,fourHours,days]=await Promise.all(['1Min','1Hour','4Hour','1Day'].map(fetchBars));
const ms=x=>Date.parse(x.t);
const trim=(bars,day)=>bars.filter(b=>b.t.slice(0,10)===day).sort((a,b)=>ms(a)-ms(b));
function comparable(reconstructed,native,{priceTol=1e-6,volumeTol=1e-6}={}){
 if(!reconstructed||!native)return {match:false,reason:'MISSING'};
 const differences=Object.fromEntries(['o','h','l','c'].map(k=>[k,reconstructed[k]-native[k]]));
 return {match:Object.values(differences).every(d=>Math.abs(d)<=priceTol)&&Math.abs(reconstructed.v-native.v)<=Math.max(volumeTol,volumeTol*Math.abs(native.v)),differences,volumeDelta:reconstructed.v-native.v};
}
const reports=[];
for(let day=from;day<=through;day=dateNext(day)){
 const m=trim(minutes,day),h=trim(hours,day),f=trim(fourHours,day),d=trim(days,day);
 const converted=m.map(x=>({t:x.t,o:x.o,h:x.h,l:x.l,c:x.c,v:x.v}));
 const rebuilt=reconstructFromMinuteBars(converted,{market:'CRYPTO',asOf:dateNext(day)+'T00:00:00Z'});
 const hByTime=new Map(h.map(x=>[x.t,x]));const fByTime=new Map(f.map(x=>[x.t,x]));
 const hourComparisons=rebuilt.hourly.map(x=>comparable(x,hByTime.get(x.t)));
 const fourComparisons=rebuilt.fourHour.map(x=>comparable(x,fByTime.get(x.t)));
 const dailyComparison=compareDaily(rebuilt.daily[0],d[0],{priceTolerance:0.001,volumeTolerance:0.005});
 reports.push({day,count1Min:m.length,count1H:h.length,count4H:f.length,count1D:d.length,
  zeroVolumeMinutes:m.filter(x=>x.v===0).length,
  safeForPriceSignals:rebuilt.safeForSignals,
  completeHourMatches:hourComparisons.filter(x=>x.match).length,completeFourHourMatches:fourComparisons.filter(x=>x.match).length,
  dailyComparison,errors:rebuilt.errors});
}
const summary={symbol,source:'Alpaca crypto/us (single source)',timezone:'UTC',from,through,reports,
  note:'Price parity on Alpaca alone; not equivalent to Coinbase, Kraken, or TradingView. Alpaca US volume is not global BTC volume.'};
console.log(JSON.stringify(summary,null,2));
if(reports.some(r=>!r.safeForPriceSignals||r.completeHourMatches!==24||r.completeFourHourMatches!==6||!r.dailyComparison.valid))process.exitCode=1;
