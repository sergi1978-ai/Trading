// Experimental BTC-USD phase-2 feasibility replay. NO order placement or parameter tuning.
// COINBASE_FROM=2026-05-01T00:00:00Z COINBASE_TO=2026-10-28T00:00:00Z node scripts/run-profit-lab.mjs
import {generateProfitSignals} from '../lib/profit-signals.js';
import {simulateProfit,PROFIT_STRATEGIES} from '../lib/profit-simulator.js';
const symbol='BTC-USD',from=process.env.COINBASE_FROM||'2026-07-01T00:00:00Z';
const to=process.env.COINBASE_TO||'2026-10-28T00:00:00Z';
const start=Date.parse(from),end=Date.parse(to),H=3600000;
if(!Number.isFinite(start)||!Number.isFinite(end)||start%H!==0||end%H!==0||
 end<=start||end-start>240*86400000)throw Error('Invalid date range');
async function download() {
 const output=new Map(),interval=250*H;
 for(let t=start;t<end;t+=interval){
  const u=new URL('https://api.exchange.coinbase.com/products/BTC-USD/candles');
  u.searchParams.set('start',new Date(t).toISOString());
  u.searchParams.set('end',new Date(Math.min(t+interval,end)).toISOString());
  u.searchParams.set('granularity','3600');
  let response;
  for(let attempt=0;attempt<4;attempt++){
   response=await fetch(u,{headers:{Accept:'application/json','User-Agent':'LONG-AI-PROFIT-Lab/1.0'},signal:AbortSignal.timeout(30000)});
   if(response.status!==429 && response.status<500)break;
   await new Promise(ok=>setTimeout(ok,1000*(attempt+1)));
  }
  if(!response.ok)throw Error('Coinbase HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data))throw Error('Invalid Coinbase response');
  for(const x of data){
   if(!Array.isArray(x)||x.length<6)throw Error('Invalid Coinbase candle');
   const [unix,l,h,o,c,v]=x,ms=unix*1000;
   if(ms<t||ms>=Math.min(t+interval,end))continue;
   if(output.has(ms))throw Error('Duplicate Coinbase candle '+new Date(ms).toISOString());
   output.set(ms,{t:new Date(ms).toISOString(),endExclusive:new Date(ms+H).toISOString(),o,h,l,c,v});
  }
  await new Promise(ok=>setTimeout(ok,120));
 }
 const sorted=[...output.values()].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
 const missing=[];
 for(let t=start;t<end;t+=H)if(!output.has(t))missing.push(t);
 // Requery missing hourly intervals once from the SAME exchange; never synthesize candles.
 for(const t of missing){
  const u=new URL('https://api.exchange.coinbase.com/products/BTC-USD/candles');
  u.searchParams.set('start',new Date(t).toISOString());
  u.searchParams.set('end',new Date(t+H).toISOString());
  u.searchParams.set('granularity','3600');
  const response=await fetch(u,{headers:{Accept:'application/json','User-Agent':'LONG-AI-PROFIT-Lab/1.0'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Coinbase gap retry HTTP '+response.status);
  const result=await response.json();
  if(!Array.isArray(result))throw Error('Malformed gap response');
  const bar=result.find(x=>Array.isArray(x)&&x[0]*1000===t);
  if(bar){
   const [,l,h,o,c,v]=bar;
   if(![l,h,o,c,v].every(Number.isFinite)||l>Math.min(o,c)||h<Math.max(o,c,l))throw Error('Bad retry OHLCV');
   output.set(t,{t:new Date(t).toISOString(),endExclusive:new Date(t+H).toISOString(),o,h,l,c,v});
  }
  if(!output.has(t)){
   // Recover only from 12 genuine Coinbase 5Min OHLCV candles, same exchange.
   // This is aggregation of historical trades, never an invented/fill-forward hour.
   const five=new URL('https://api.exchange.coinbase.com/products/BTC-USD/candles');
   five.searchParams.set('start',new Date(t).toISOString());
   five.searchParams.set('end',new Date(t+H).toISOString());
   five.searchParams.set('granularity','300');
   const detail=await fetch(five,{headers:{Accept:'application/json','User-Agent':'LONG-AI-PROFIT-Lab/1.0'},signal:AbortSignal.timeout(30000)});
   if(!detail.ok)throw Error('Coinbase 5Min repair HTTP '+detail.status);
   const rows=(await detail.json()).filter(x=>Array.isArray(x)&&x[0]*1000>=t&&x[0]*1000<t+H)
     .sort((a,b)=>a[0]-b[0]);
   if(rows.length===12&&rows.every((x,i)=>x[0]*1000===t+i*300000)){
    output.set(t,{t:new Date(t).toISOString(),endExclusive:new Date(t+H).toISOString(),
      o:rows[0][3],h:Math.max(...rows.map(x=>x[2])),l:Math.min(...rows.map(x=>x[1])),
      c:rows[11][4],v:rows.reduce((a,x)=>a+x[5],0),provenance:'COINBASE_5MIN_AGGREGATED'});
   }
  }
  await new Promise(ok=>setTimeout(ok,120));
 }
 const unresolved=missing.filter(t=>!output.has(t));
 if(unresolved.length)throw Error('Incomplete Coinbase 1H: '+unresolved.length+' missing hours '+unresolved.slice(0,12).map(x=>new Date(x).toISOString()).join(', ')+' — fail closed');
 console.log(JSON.stringify({audit:'Source hourly holes',missingFromNative:missing.length,correctedWithReal5Min:sorted.filter(x=>x.provenance==='COINBASE_5MIN_AGGREGATED').length}));
 return sorted;
}
function agg(b){
 return {t:b[0].t,endExclusive:b.at(-1).endExclusive,o:b[0].o,
  h:Math.max(...b.map(x=>x.h)),l:Math.min(...b.map(x=>x.l)),c:b.at(-1).c,
  v:b.reduce((s,x)=>s+x.v,0)};
}
function bundle(hourly,count){
 const result=[];
 for(let i=0;i<hourly.length;i+=count){
  const portion=hourly.slice(i,i+count);
  if(portion.length===count)result.push(agg(portion));
 }
 return result;
}
const hourly=await download();
if(hourly.length%24!==0)throw Error('The replay must contain complete UTC days');
const fourHour=bundle(hourly,4),daily=bundle(hourly,24);
const info=generateProfitSignals({symbol,market:'CRYPTO',hourly,fourHour,daily,volumeApproved:true,tickSize:.01});
const results=Object.fromEntries(PROFIT_STRATEGIES.map(k=>{
 const signals=info.signals.filter(s=>s.strategyId===k);
 const r=simulateProfit({barsBySymbol:{[symbol]:hourly},signals,
  initialCapital:10000,riskPct:.005,maxPortfolioRiskPct:.015,maxPositions:3});
 return [k,{signals:signals.length,accepted:r.accepted.length,rejected:r.rejected.length,
   ...r.summary,unrealized:r.openPositions.map(p=>({symbol:p.symbol,pnl:p.unrealizedPnL}))}];
}));
const combo=simulateProfit({barsBySymbol:{[symbol]:hourly},signals:info.signals,
 initialCapital:10000,riskPct:.005,maxPortfolioRiskPct:.015,maxPositions:3});
console.log(JSON.stringify({source:'Coinbase Exchange public BTC-USD (single market)',
 from,to,hours:hourly.length,fourHour:fourHour.length,days:daily.length,
 config:'Locked 0.5% risk, 1.5R/3R, 7 day exit; in-sample feasibility only',
 caveat:'NOT walk-forward or out-of-sample, NOT TradingView/Pine execution parity',
 diagnostics:info.diagnostics,signalsByEngine:info.counts,independent:results,
 combined:{...combo.summary,accepted:combo.accepted.length,rejected:combo.rejected.length}},null,2));
