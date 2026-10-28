// LONG AI PROFIT phase 2: locked multi-asset Coinbase replay.
// Historical public candles only. No execution credentials, no parameter search.
// Fixed asset universe selected BEFORE viewing outcomes, all failures reported.
import {generateProfitSignals} from '../lib/profit-signals.js';
import {trendPullbackV11} from '../lib/trend-pullback-v11.js';
import {simulateProfit,PROFIT_STRATEGIES} from '../lib/profit-simulator.js';
const H=3600000,DAY=24*H;
const FROM=process.env.PROFIT_FROM||'2026-07-01T00:00:00Z';
const THROUGH=process.env.PROFIT_TO||'2026-10-28T00:00:00Z';
const START=Date.parse(FROM),END=Date.parse(THROUGH);
if(!Number.isFinite(START)||!Number.isFinite(END)||START>=END||
   START%86400000!==0||END%86400000!==0||
   END-START>240*86400000||END>Date.parse('2026-10-29T00:00:00Z'))
 throw Error('Invalid UTC date window');
const UNIVERSE=['BTC-USD','ETH-USD','SOL-USD','LINK-USD','ADA-USD','AVAX-USD'];
const base='https://api.exchange.coinbase.com';
const headers={Accept:'application/json','User-Agent':'LONG-AI-PROFIT-Multimarket/1.0'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url){
 let r;
 for(let i=0;i<4;i++){
  r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});
  if(r.status!==429&&r.status<500)break;
  await sleep((i+1)*800);
 }
 if(!r.ok)throw Error('Coinbase HTTP '+r.status+' '+url.pathname);
 return r.json();
}
async function candles(symbol,period){
 const out=new Map(),window=period===3600?240*H:240*DAY;
 for(let t=START;t<END;t+=window){
  const u=new URL(base+'/products/'+symbol+'/candles');
  for(const [k,v] of Object.entries({start:new Date(t).toISOString(),
   end:new Date(Math.min(t+window,END)).toISOString(),granularity:String(period)}))u.searchParams.set(k,v);
  const data=await request(u);
  if(!Array.isArray(data))throw Error('Invalid candle response');
  for(const row of data){
   if(!Array.isArray(row)||row.length<6)throw Error('Malformed candle');
   const [unix,l,h,o,c,v]=row,ms=unix*1000;
   if(ms<t||ms>=Math.min(t+window,END))continue;
   if(out.has(ms))throw Error('Duplicate source bar');
   if(![l,h,o,c,v].every(Number.isFinite)||o<=0||l<=0||v<0||
       h<Math.max(o,c,l)||l>Math.min(o,c,h))throw Error('Invalid source OHLCV');
   out.set(ms,{t:new Date(ms).toISOString(),endExclusive:new Date(ms+period*1000).toISOString(),o,h,l,c,v});
  }
  await sleep(90);
 }
 return out;
}
async function fixSourceGaps(symbol,raw){
 const missing=[];
 for(let t=START;t<END;t+=H)if(!raw.has(t))missing.push(t);
 // Coinbase occasionally omits periods without executed trades.
 // Recover only a complete set of 12 genuine 5-minute bars. Never forward fill.
 for(const t of missing){
  const u=new URL(base+'/products/'+symbol+'/candles');
  for(const [k,v] of Object.entries({start:new Date(t).toISOString(),
    end:new Date(t+H).toISOString(),granularity:'300'}))u.searchParams.set(k,v);
  const rows=(await request(u)).filter(x=>Array.isArray(x)&&x[0]*1000>=t&&x[0]*1000<t+H)
   .sort((a,b)=>a[0]-b[0]);
  if(rows.length!==12||rows.some((x,i)=>x[0]*1000!==t+i*300000))continue;
  const [first,..._] =rows;
  raw.set(t,{t:new Date(t).toISOString(),endExclusive:new Date(t+H).toISOString(),
   o:first[3],h:Math.max(...rows.map(x=>x[2])),l:Math.min(...rows.map(x=>x[1])),
   c:rows.at(-1)[4],v:rows.reduce((s,x)=>s+x[5],0),provenance:'5MIN_RECON'});
  await sleep(75);
 }
 return {raw,missingFromNative:missing.length,recovered:missing.filter(t=>raw.has(t)).length,
  unresolved:missing.filter(t=>!raw.has(t)).map(t=>new Date(t).toISOString())};
}
function aggregate(rows){
 if(!rows.length)throw Error('Empty aggregation');
 return {t:rows[0].t,endExclusive:rows.at(-1).endExclusive,
  o:rows[0].o,h:Math.max(...rows.map(x=>x.h)),l:Math.min(...rows.map(x=>x.l)),
  c:rows.at(-1).c,v:rows.reduce((s,x)=>s+x.v,0)};
}
function group(hourly,n){
 const out=[];
 for(let i=0;i<hourly.length;i+=n){
  const window=hourly.slice(i,i+n);
  if(window.length!==n)throw Error('Partial period');
  out.push(aggregate(window));
 }
 return out;
}
function summary(x){return {signals:x.signals.length,filled:x.accepted.length,
 closed:x.summary.closedTrades,open:x.summary.openCount,
 returnPct:x.summary.totalReturnPct,drawdownPct:x.summary.markToMarketMaxDrawdownPct,
 profitFactor:x.summary.profitFactor,meanR:x.summary.meanR,
 rejections:x.rejected.reduce((a,b)=>(a[b.reason]=(a[b.reason]||0)+1,a),{})};}
const data={},excluded=[],diagnostics=[],events=[],candidateEvents=[],candidateDiagnostics=[];
for(const symbol of UNIVERSE){
 try{
  const product=await request(new URL(base+'/products/'+symbol));
  const tick=Number(product.quote_increment);
  if(!Number.isFinite(tick)||tick<=0)throw Error('Missing quote_increment');
  const minuteRaw=await candles(symbol,3600);
  const source=await fixSourceGaps(symbol,minuteRaw);
  if(source.unresolved.length){
   excluded.push({symbol,reason:'UNRESOLVED_1H_SOURCE_GAPS',hours:source.unresolved.slice(0,10),count:source.unresolved.length});
   continue;
  }
  const hourly=[...source.raw.values()].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  if(hourly.length!==(END-START)/H)throw Error('Unexpected 1H bar count');
  const daily=group(hourly,24),fourHour=group(hourly,4);
  // Native Coinbase 1D parity check on the same exchange:
  const native=await candles(symbol,86400);
  const mismatches=[];
  for(const b of daily){
   const t=Date.parse(b.t),d=native.get(t);
   if(!d){mismatches.push({day:b.t,reason:'MISSING_NATIVE_DAILY'});continue;}
   const p=['o','h','l','c'].every(k=>Math.abs(b[k]-d[k])<=tick*.51);
   const volume= d.v>0?Math.abs(b.v-d.v)/d.v:1;
   if(!p||volume>.01)mismatches.push({day:b.t,reason:!p?'PRICE_PARITY':'VOLUME_GT_1_PERCENT',volumeDeltaPct:100*volume});
  }
  if(mismatches.length){
   excluded.push({symbol,reason:'SOURCE_PARITY_FAILED',count:mismatches.length,
    examples:mismatches.slice(0,5)});continue;
  }
  const generated=generateProfitSignals({symbol,market:'CRYPTO',hourly,fourHour,daily,
   tickSize:tick,volumeApproved:true});
  // Parallel reference with identical candles and costs. NEVER replace v1.0 events.
  const v11=trendPullbackV11({symbol,market:'CRYPTO',hourly,fourHour,daily,
   tickSize:tick,volumeApproved:true});
  candidateEvents.push(...v11.signals);
  candidateDiagnostics.push({symbol,signals:v11.signals.length,gates:v11.gates,
    version:v11.version,blocked:v11.blocked});
  data[symbol]=hourly;
  diagnostics.push({symbol,dayCount:daily.length,hourCount:hourly.length,
   nativeGaps:source.missingFromNative,repairedFrom5m:source.recovered,
   parityErrors:0,tick,signalCounts:generated.counts,
   filtering:generated.diagnostics});
  events.push(...generated.signals);
 }catch(e){excluded.push({symbol,reason:'ERROR',message:String(e?.message||e)});}
}
const perSymbol={},perStrategy={};
for(const d of diagnostics){
 const list=events.filter(x=>x.symbol===d.symbol);
 const r=simulateProfit({barsBySymbol:{[d.symbol]:data[d.symbol]},signals:list});
 perSymbol[d.symbol]=summary({...r,signals:list});
}
for(const strategy of PROFIT_STRATEGIES){
 const list=events.filter(x=>x.strategyId===strategy);
 if(!Object.keys(data).length)break;
 const r=simulateProfit({barsBySymbol:data,signals:list});
 perStrategy[strategy]=summary({...r,signals:list});
}
let combined=null,executionCostStress={},candidateA11=null;
if(Object.keys(data).length){
 const baseA=events.filter(s=>s.strategyId==='TREND_PULLBACK');
 candidateA11={};
 for(const [key,commissionBps,slippageBps] of [
    ['5bps_each',5,5],['10bps_each',10,10],['20bps_each',20,20]]){
  const candidate=simulateProfit({barsBySymbol:data,signals:candidateEvents,commissionBps,slippageBps});
  const reference=simulateProfit({barsBySymbol:data,signals:baseA,commissionBps,slippageBps});
  candidateA11[key]={v11:summary({...candidate,signals:candidateEvents}),
    v10A:summary({...reference,signals:baseA})};
 }
}

if(Object.keys(data).length){
 const r=simulateProfit({barsBySymbol:data,signals:events});
 combined=summary({...r,signals:events});
 // Prespecified cost shocks; not entry-threshold optimization.
 for(const [label,bps] of [['base_5bps_each',5],['double_10bps_each',10],['severe_20bps_each',20]]){
   const all=simulateProfit({barsBySymbol:data,signals:events,
      commissionBps:bps,slippageBps:bps});
   const aSignals=events.filter(x=>x.strategyId==='TREND_PULLBACK');
   const a=simulateProfit({barsBySymbol:data,signals:aSignals,
      commissionBps:bps,slippageBps:bps});
   executionCostStress[label]={combinedReturnPct:all.summary.totalReturnPct,
     combinedClosedTrades:all.summary.closedTrades,
     trendPullbackReturnPct:a.summary.totalReturnPct,
     trendPullbackClosedTrades:a.summary.closedTrades};
 }
}
console.log('MULTI_ASSET_AUDIT_JSON '+JSON.stringify({
 date:'2026-10-28',window:[FROM,THROUGH],intendedUniverse:UNIVERSE,
 acceptedUniverse:diagnostics.map(x=>x.symbol),excluded,
 preliminary:true,notWalkForward:true,
 notes:['Fixed configs, no optimized selection','Coinbase USD spot crypto only, no US equities',
 '119 days total including 65+ days indicator warmup','Per-symbol simulations independent; combined uses shared cash and 3 position limit'],
 diagnostics,perSymbol,perStrategy,combined,executionCostStress,candidateA11,candidateDiagnostics
}));
if(excluded.length)console.error('NOT A COMPLETE UNIVERSE: '+excluded.length+' Coinbase markets excluded due to source failures');
if(!Object.keys(data).length)process.exitCode=2;
