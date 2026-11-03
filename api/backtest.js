import {compareDaily,parseYahooDaily} from '../lib/learning-lab/compare-sources.js';
import {aggregateBars,fromThirtyMinuteBars} from '../lib/learning-lab/candles.js';
// Trading 2026 backtesting pilot. DAILY proxy only, NOT a replay of Pine 1D/4H/1H.
// Signals use only previously CLOSED candles and are entered at the next daily open.
const ALPACA='https://data.alpaca.markets/v2/stocks/bars';
function ema(values,n){if(values.length<n)return null;let a=values.slice(0,n).reduce((x,y)=>x+y,0)/n;for(let i=n;i<values.length;i++)a+=(values[i]-a)*2/(n+1);return a}
function rsi(v,n=14){if(v.length<n+1)return null;let gain=0,loss=0;for(let i=v.length-n;i<v.length;i++){const d=v[i]-v[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0)}return loss===0?100:100-100/(1+gain/loss)}
function atr(bars,n=14){if(bars.length<n+1)return null;const x=bars.slice(-n-1);return x.slice(1).reduce((sum,b,i)=>sum+Math.max(b.h-b.l,Math.abs(b.h-x[i].c),Math.abs(b.l-x[i].c)),0)/n}
function run(bars,mode,costBps=12){
 let trades=[],equity=1,peak=1,maxDD=0,pos=null;
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
  if(mode!=='recovery'&&!(e20>e50&&b.c>e20))continue;
  const prev=bars.slice(i-20,i),high=Math.max(...prev.map(x=>x.h));
  const breakout=b.c>high&&b.c>b.o;
  const retest=b.l<=e20&&b.c>e20&&b.c>b.o;
  if(!(mode==='recovery'?recovery:mode==='breakout'?breakout:mode==='retest'?retest:(breakout||retest)))continue;
  const entry=next.o,stop=Math.min(b.l,entry-1.5*a),risk=entry-stop;
  if(!(entry>0&&risk>0&&risk/entry<=.08&&risk/entry>=.005))continue;
  pos={entry,stop,target:entry+2*risk,date:next.t,signalIndex:i};
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
 return {avgWinPct:avg(positives),avgLossPct:avg(negatives),averageSessions,trades:trades.slice(-250),total:trades.length,winRate:trades.length?Math.round(wins/trades.length*1000)/10:null,totalReturnPct:Math.round((equity-1)*10000)/100,maxDrawdownPct:Math.round(maxDD*10000)/100,assumptions:'Proxy 1D EMA20/50 + ruptura màxim 20 dies, retest EMA20 o recovery RSI14 (<35 → >=35); entrada obertura següent sessió; stop ATR; objectiu 2R; màx 10 sessions; stop prioritzat en barra amb toc simultani; 12 punts bàsics per costat. No replica Pine 1D/4H/1H.'};
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
async function independentDaily(symbol,days){
 const start=Math.floor((Date.now()-(days+7)*86400000)/1000);
 const end=Math.floor(Date.now()/1000);
 const u=new URL('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol));
 for(const [k,v] of Object.entries({period1:start,period2:end,interval:'1d',events:'div,splits'}))u.searchParams.set(k,v);
 const response=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (compatible; LearningLab/0.2)','Accept':'application/json'},signal:AbortSignal.timeout(7000)});
 if(!response.ok)throw Error('Yahoo Finance HTTP '+response.status);
 return parseYahooDaily(await response.json());
}
async function candlePreview(req,res,symbol){
 const days=Math.min(30,Math.max(5,Number(req.query.days)||14));
 if(!Number.isInteger(days))return res.status(400).json({error:'Dies invàlids'});
 const start=new Date(Date.now()-days*86400000).toISOString();
 const end=new Date(Date.now()-20*60000).toISOString(); // do not use still-forming bars
 const url=new URL(ALPACA);
 for(const [k,v] of Object.entries({symbols:symbol,timeframe:'30Min',start,end,limit:'10000',sort:'asc',adjustment:'split',feed:'iex'}))url.searchParams.set(k,v);
 const response=await fetch(url,{headers:{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY,'APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET}});
 if(!response.ok)throw Error('Alpaca HTTP '+response.status);
 const payload=await response.json();
 if(payload.next_page_token)throw Error('Dades incompletes: paginació Alpaca pendent');
 const source=payload.bars?.[symbol]||[];
 const hourly=fromThirtyMinuteBars(source);
 const aggregated=aggregateBars(hourly);
 let independent={status:'not_requested'};
 if(req.query.verify==='1'){
  try{
   const secondary=await independentDaily(symbol,days);
   const compared=compareDaily(aggregated.daily.slice(-10),secondary);
   independent={status:'ok',provider:'Yahoo Finance chart (no és TradingView)',compared,
     matched:compared.filter(x=>x.status==='compared').length,flagged:compared.filter(x=>x.flagged).length};
  }catch(e){independent={status:'unavailable',reason:String(e.message||e)};}
 }
 return res.status(200).json({symbol,mode:'candles',provider:'Alpaca IEX',sourceTimeframe:'30Min',rangeDays:days,
  independent,sourceBars:source.length,hourlyBars:hourly.length,fourHourBars:aggregated.fourHour.length,dailyBars:aggregated.daily.length,
  timezone:aggregated.timezone,session:aggregated.session,
  samples:{hourly:hourly.slice(-8),fourHour:aggregated.fourHour.slice(-8),daily:aggregated.daily.slice(-8)},
  warnings:['Mostra de dades, no equivalència amb TradingView','Feed IEX pot diferir del feed consolidat','Sessions escurçades i dades incompletes es poden excloure','No hi ha motors A/C/E/F ni operacions']});
}
async function backtestHandler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Mètode no permès'});
 if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return res.status(503).json({error:'Alpaca no configurat'});
 const symbol=String(req.query.symbol||'').trim().toUpperCase(),mode=String(req.query.mode||'both');
 if(!/^[A-Z][A-Z0-9.]{0,8}$/.test(symbol)||!['both','breakout','retest','recovery','compare','candles'].includes(mode))return res.status(400).json({error:'Ticker o estratègia invàlids'});
 try{if(mode==='candles')return await candlePreview(req,res,symbol);
 const bars=await getBars(symbol);if(bars.length<130)return res.status(422).json({error:'Històric insuficient: '+bars.length+' sessions'});
 const common={symbol,mode,firstBar:bars[0].t,lastBar:bars.at(-1).t,barCount:bars.length};
 if(mode==='compare')return res.status(200).json({...common,comparisons:['both','breakout','retest','recovery'].map(m=>({mode:m,...run(bars,m)}))});
 const result=run(bars,mode);
 return res.status(200).json({...common,...result});
 }catch(e){return res.status(502).json({error:String(e.message||e)})}
}

// Learning Lab v0.1 — descriptive analysis only; no parameter optimisation or live orders.
const finite = n => typeof n === 'number' && Number.isFinite(n);
const round = (n,d=2) => n == null ? null : Number(n.toFixed(d));
function analyse(trades) {
  const valid = trades.filter(t => finite(t.returnPct));
  const returns = valid.map(t=>t.returnPct);
  const wins = returns.filter(n=>n>0), losses=returns.filter(n=>n<0);
  const total = returns.reduce((a,b)=>a+b,0);
  const grossWin=wins.reduce((a,b)=>a+b,0), grossLoss=-losses.reduce((a,b)=>a+b,0);
  let equity=1, peak=1, drawdown=0;
  for(const r of returns){ equity*=Math.max(0,1+r/100); peak=Math.max(peak,equity); drawdown=Math.max(drawdown,1-equity/peak); }
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const expectancy=returns.length?total/returns.length:null;
  return {count:returns.length,winRatePct:returns.length?round(100*wins.length/returns.length):null,
    expectancyPct:round(expectancy),averageWinPct:round(mean(wins)),averageLossPct:round(mean(losses)),
    profitFactor:grossLoss?round(grossWin/grossLoss):grossWin>0?null:0,
    compoundedReturnPct:round((equity-1)*100),maxDrawdownPct:round(drawdown*100),
    insufficientSample:returns.length<30};
}
async function learningHandler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Use POST'});
  try {
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body || !Array.isArray(body.trades) || body.trades.length>5000) return res.status(400).json({error:'Cal una llista trades de màxim 5000 operacions'});
    if(body.trades.some(t=>!t || !finite(t.returnPct) || Math.abs(t.returnPct)>1000 || (t.motor!=null && typeof t.motor!=='string'))) return res.status(400).json({error:'Operacions invàlides: returnPct ha de ser numèric'});
    const trades=body.trades;
    const motors=['A','C','E','F','TACTICA','PROVA','SENSE_MOTOR'];
    const groups=Object.fromEntries(motors.map(m=>[m,analyse(trades.filter(t=>(t.motor||'SENSE_MOTOR').toUpperCase()===m))]));
    const unknown=[...new Set(trades.map(t=>(t.motor||'SENSE_MOTOR').toUpperCase()).filter(m=>!motors.includes(m)))];
    for(const m of unknown.slice(0,30))groups[m]=analyse(trades.filter(t=>(t.motor||'SENSE_MOTOR').toUpperCase()===m));
    return res.status(200).json({version:'learning-lab-v0.1',source:body.source||'manual',total:analyse(trades),byMotor:groups,
      warnings:['Anàlisi descriptiva; no aprenentatge automàtic','Sense validació fora de mostra ni ajust per selecció de paràmetres','Les rendibilitats es calculen amb returnPct subministrat; comprovar comissions, exposició i ordre temporal','El drawdown pressuposa operacions seqüencials i sense solapament'],
      next:'Integrar replay 1D/4H/1H i registrar indicadors en el moment de cada entrada'});
  } catch(e){return res.status(400).json({error:'JSON invàlid o dades incorrectes'});}
}
export default async function handler(req,res){
 if(req.method==='POST')return learningHandler(req,res);
 return backtestHandler(req,res);
}
