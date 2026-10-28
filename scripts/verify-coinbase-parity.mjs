// Diagnostic only: verify Coinbase Exchange BTC-USD 1H-derived 4H/1D against
// the SAME exchange's native 1D candles. No API key or order capability.
// node scripts/verify-coinbase-parity.mjs
// Public endpoint returns [time, low, high, open, close, volume], reverse order.
const product='BTC-USD';
const from=process.env.COINBASE_FROM||'2026-10-23T00:00:00Z';
const to=process.env.COINBASE_TO||'2026-10-28T00:00:00Z';
const t0=Date.parse(from),t1=Date.parse(to);
if(!Number.isFinite(t0)||!Number.isFinite(t1)||t1<=t0||
  (t1-t0)>12*86400000||t0%86400000!==0||t1%86400000!==0)
 throw Error('Use <=12 whole UTC days; example 2026-10-23T00:00:00Z');
async function exchangeCandles(granularity) {
 const out=new Map(),windowMs=granularity*1000*250;
 for(let start=t0;start<t1;start+=windowMs){
  const end=Math.min(start+windowMs,t1);
  const u=new URL('https://api.exchange.coinbase.com/products/'+product+'/candles');
  u.searchParams.set('start',new Date(start).toISOString());
  u.searchParams.set('end',new Date(end).toISOString());
  u.searchParams.set('granularity',String(granularity));
  let response;
  for(let attempt=0;attempt<3;attempt++){
   response=await fetch(u,{headers:{'Accept':'application/json','User-Agent':'LONG-AI-Parity-Audit/1.0'},signal:AbortSignal.timeout(20000)});
   if(response.status!==429&&response.status<500)break;
   await new Promise(resolve=>setTimeout(resolve,800*(attempt+1)));
  }
  if(!response.ok)throw Error('Coinbase Exchange HTTP '+response.status+': '+(await response.text()).slice(0,160));
  const raw=await response.json();
  if(!Array.isArray(raw))throw Error('Unexpected Coinbase format');
  for(const x of raw){
   if(!Array.isArray(x)||x.length<6)throw Error('Malformed candle');
   const [timestamp,l,h,o,c,v]=x;
   const t=timestamp*1000;
   if(t<start||t>=end)continue;
   if(out.has(t))throw Error('Duplicate Coinbase candle timestamp');
   if(![l,h,o,c,v].every(Number.isFinite)||l>Math.min(o,c)||h<Math.max(o,c,l))throw Error('Invalid OHLCV');
   out.set(t,{t,o,h,l,c,v});
  }
 }
 return [...out.values()].sort((a,b)=>a.t-b.t);
}
const aggregate=bars=>bars.length?{o:bars[0].o,h:Math.max(...bars.map(x=>x.h)),l:Math.min(...bars.map(x=>x.l)),c:bars.at(-1).c,v:bars.reduce((sum,b)=>sum+b.v,0)}:null;
const [hours,days]=await Promise.all([exchangeCandles(3600),exchangeCandles(86400)]);
const byHour=new Map(hours.map(x=>[x.t,x])),byDay=new Map(days.map(x=>[x.t,x]));
const report=[];
for(let day=t0;day<t1;day+=86400000){
 const hourBars=Array.from({length:24},(_,i)=>byHour.get(day+i*3600000));
 const fourHour=Array.from({length:6},(_,i)=>{
  const block=hourBars.slice(i*4,i*4+4).filter(Boolean);
  const p=block.length===4?aggregate(block):null;
  return {start:new Date(day+i*14400000).toISOString(),complete:block.length===4,...p};
 });
 const current=hourBars.filter(Boolean),rec=current.length===24?aggregate(current):null;
 const native=byDay.get(day);
 const diffs=rec&&native?Object.fromEntries(['o','h','l','c','v'].map(k=>[k,rec[k]-native[k]])):null;
 const pricesMatch=diffs!==null&&['o','h','l','c'].every(k=>Math.abs(diffs[k])<1e-7);
 report.push({date:new Date(day).toISOString().slice(0,10),source:'Coinbase Exchange BTC-USD',
  candles1H:current.length,blocks4H:fourHour.filter(x=>x.complete).length,
  reconstructedDaily:rec,nativeDaily:native||null,diffs,pricesMatch,volumeDifferencePct:diffs&&native.v?100*diffs.v/native.v:null,
  fourHourAnchorsUTC:fourHour.map(x=>x.start.slice(11,16))});
}
console.log(JSON.stringify({product,from,to,source:'Coinbase Exchange public candles',
  warning:'4H candles are derived from 1H, not an independently verified TradingView 4H feed.',
  report},null,2));
if(report.some(r=>r.candles1H!==24||r.blocks4H!==6||!r.nativeDaily)){
 console.error('Missing source candles: do not infer indicator parity');
 process.exitCode=2;
}
