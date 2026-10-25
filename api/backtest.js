// Trading 2026 backtesting pilot. DAILY proxy only, NOT a replay of Pine 1D/4H/1H.
// Signals use only previously CLOSED candles and are entered at the next daily open.
const ALPACA='https://data.alpaca.markets/v2/stocks/bars';
function ema(values,n){if(values.length<n)return null;let a=values.slice(0,n).reduce((x,y)=>x+y,0)/n;for(let i=n;i<values.length;i++)a+=(values[i]-a)*2/(n+1);return a}
function rsi(v,n=14){if(v.length<n+1)return null;let gain=0,loss=0;for(let i=v.length-n;i<v.length;i++){const d=v[i]-v[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0)}return loss===0?100:100-100/(1+gain/loss)}
function atr(bars,n=14){if(bars.length<n+1)return null;const x=bars.slice(-n-1);return x.slice(1).reduce((sum,b,i)=>sum+Math.max(b.h-b.l,Math.abs(b.h-x[i].c),Math.abs(b.l-x[i].c)),0)/n}
function run(bars,mode,costBps=12){
 let trades=[],equity=1,peak=1,maxDD=0,pos=null;
 const funnel={barsChecked:0,trendPassed:0,patternPassed:0,volumePassed:0,riskPassed:0,entries:0};
 for(let i=65;i<bars.length-1;i++){
  const known=bars.slice(0,i+1),b=bars[i],next=bars[i+1],close=known.map(x=>x.c);
  if(pos){
   let exit=null,reason='';
   // Gap-aware, stop first if both target and stop are crossed in same bar.
   if(next.o<=pos.stop){exit=next.o;reason='Stop amb gap'}
   else if(next.o>=pos.target){exit=next.o;reason='Objectiu amb gap'}
   else if(next.l<=pos.stop){exit=pos.stop;reason='Stop'}
   else if(next.h>=pos.target){exit=pos.target;reason='Objectiu'}
   else if(i-pos.signalIndex>=10){exit=next.c;reason='Temps màxim'}
   if(exit!==null){
    const ret=(exit/pos.entry-1)-2*costBps/10000;
    equity*=Math.max(0,1+ret);peak=Math.max(peak,equity);maxDD=Math.max(maxDD,(peak-equity)/peak);
    trades.push({date:next.t,entryDate:pos.date,entry:pos.entry,stop:pos.stop,target:pos.target,exit,reason,returnPct:Math.round(ret*10000)/100});
    pos=null;
   }
  }
  if(pos)continue;
  const e20=ema(close,20),e50=ema(close,50),a=atr(known);
  if(!(a>0))continue;
  const previousRsi=rsi(close.slice(0,-1)),currentRsi=rsi(close);
  const recovery=previousRsi!==null&&currentRsi!==null&&previousRsi<35&&currentRsi>=35&&b.c>b.o&&b.c>e20;
  if(mode.startsWith('v4_'))funnel.barsChecked++;
  const vPrior=bars.slice(i-20,i).map(z=>z.v).filter(Number.isFinite);
  const vMean=vPrior.length===20?vPrior.reduce((x,y)=>x+y,0)/20:0;
  const rvol=vMean>0?b.v/vMean:0;
  const e200=ema(close,200);
  const prevClose=bars[i-1].c;
  const advancedTrend=e200!==null&&e20>e50&&e50>e200&&b.c>e20;
  if(mode.startsWith('v4_')&&advancedTrend)funnel.trendPassed++;
  const advancedBreakout=advancedTrend&&rvol>=1.2&&b.c>b.o&&b.c>Math.max(...bars.slice(i-20,i).map(z=>z.h))&&(b.c-e20)/a<2.5;
  const advancedRetest=advancedTrend&&rvol>=0.85&&bars[i-1].l<=ema(close.slice(0,-1),20)&&prevClose>e50&&b.c>bars[i-1].h&&b.c>b.o;
  const advancedRecovery=advancedTrend&&recovery&&rvol>=1.0;
  const advancedPattern=mode==='v4_breakout'?breakout:mode==='v4_retest'?(bars[i-1].l<=ema(close.slice(0,-1),20)&&prevClose>e50&&b.c>bars[i-1].h&&b.c>b.o):recovery;
  const advancedVolume=mode==='v4_breakout'?rvol>=1.2:mode==='v4_retest'?rvol>=0.85:rvol>=1;
  if(mode.startsWith('v4_')&&advancedTrend&&advancedPattern)funnel.patternPassed++;
  if(mode.startsWith('v4_')&&advancedTrend&&advancedPattern&&advancedVolume)funnel.volumePassed++;
  if(!mode.startsWith('v4_')&&mode!=='recovery'&&!(e20>e50&&b.c>e20))continue;
  const prev=bars.slice(i-20,i),high=Math.max(...prev.map(x=>x.h));
  const breakout=b.c>high&&b.c>b.o;
  const retest=b.l<=e20&&b.c>e20&&b.c>b.o;
  if(!(mode==='v4_breakout'?advancedBreakout:mode==='v4_retest'?advancedRetest:mode==='v4_recovery'?advancedRecovery:mode==='recovery'?recovery:mode==='breakout'?breakout:mode==='retest'?retest:(breakout||retest)))continue;
  const entry=next.o,stop=Math.min(b.l,entry-1.5*a),risk=entry-stop;
  if(!(entry>0&&risk>0&&risk/entry<=.08&&risk/entry>=.005))continue;
  if(mode.startsWith('v4_')){funnel.riskPassed++;funnel.entries++;}
  pos={entry,stop,target:entry+(mode.startsWith('v4_')?2.5:2)*risk,date:next.t,signalIndex:i};
  // Evaluate the actual entry-day bar as well, conservatively assigning stop
  // if both boundaries are touched during the same OHLC candle.
  const sameDayExit=next.l<=pos.stop?pos.stop:next.h>=pos.target?pos.target:null;
  if(sameDayExit!==null){
   const ret=(sameDayExit/pos.entry-1)-2*costBps/10000;
   equity*=Math.max(0,1+ret);peak=Math.max(peak,equity);maxDD=Math.max(maxDD,(peak-equity)/peak);
   trades.push({date:next.t,entryDate:pos.date,entry:pos.entry,stop:pos.stop,target:pos.target,exit:sameDayExit,reason:next.l<=pos.stop?'Stop dia entrada':'Objectiu dia entrada',returnPct:Math.round(ret*10000)/100});
   pos=null;
  }
 }
 const wins=trades.filter(t=>t.returnPct>0).length;
 const positives=trades.filter(t=>t.returnPct>0),negatives=trades.filter(t=>t.returnPct<=0);
 const avg=a=>a.length?Math.round(a.reduce((n,t)=>n+t.returnPct,0)/a.length*100)/100:null;
 const barIndex=new Map(bars.map((b,i)=>[b.t,i]));
 const duration=trades.map(t=>(barIndex.get(t.date)??0)-(barIndex.get(t.entryDate)??0)).filter(n=>n>=0);
 const averageSessions=duration.length?Math.round(duration.reduce((a,b)=>a+b,0)/duration.length*10)/10:null;
 return {funnel:mode.startsWith('v4_')?funnel:null,avgWinPct:avg(positives),avgLossPct:avg(negatives),averageSessions,trades:trades.slice(-250),total:trades.length,winRate:trades.length?Math.round(wins/trades.length*1000)/10:null,totalReturnPct:Math.round((equity-1)*10000)/100,maxDrawdownPct:Math.round(maxDD*10000)/100,assumptions:'Proxy 1D EMA20/50 + ruptura màxim 20 dies, retest EMA20 o recovery RSI14 (<35 → >=35); entrada obertura següent sessió; stop ATR; objectiu 2R; màx 10 sessions; stop prioritzat en barra amb toc simultani; 12 punts bàsics per costat. No replica Pine 1D/4H/1H.'};
}
async function getBars(symbol){
 const start=new Date(Date.now()-2*366*86400000).toISOString();
 const url=new URL(ALPACA);
 for(const [k,v] of Object.entries({symbols:symbol,timeframe:'1Day',start,limit:'10000',sort:'asc',adjustment:'split',feed:'iex'}))url.searchParams.set(k,v);
 const r=await fetch(url,{headers:{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY,'APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET}});
 if(!r.ok)throw Error('Alpaca HTTP '+r.status);
 const obj=await r.json();const bars=obj.bars?.[symbol]||[];
 if(obj.next_page_token)throw Error('Històric incomplet: paginació pendent');
 return bars.filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite)).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Mètode no permès'});
 if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return res.status(503).json({error:'Alpaca no configurat'});
 const symbol=String(req.query.symbol||'').trim().toUpperCase(),mode=String(req.query.mode||'both');
 if(!/^[A-Z][A-Z0-9.]{0,8}$/.test(symbol)||!['both','breakout','retest','recovery','v4_breakout','v4_retest','v4_recovery','compare'].includes(mode))return res.status(400).json({error:'Ticker o estratègia invàlids'});
 try{const bars=await getBars(symbol);if(bars.length<130)return res.status(422).json({error:'Històric insuficient: '+bars.length+' sessions'});
 const common={symbol,mode,firstBar:bars[0].t,lastBar:bars.at(-1).t,barCount:bars.length};
 if(mode==='compare')return res.status(200).json({...common,comparisons:['both','breakout','retest','recovery','v4_breakout','v4_retest','v4_recovery'].map(m=>({mode:m,...run(bars,m)}))});
 const result=run(bars,mode);
 return res.status(200).json({...common,...result});
 }catch(e){return res.status(502).json({error:String(e.message||e)})}
}
