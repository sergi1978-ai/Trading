import {momentumDiagnostic} from './_momentum.js';
// Trading 2026 v2.8 - crypto technical screening; closed candles only.
// Coinbase Exchange public candles (300 max/request), Kraken OHLC fallback.
const TIMEOUT=9000;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const responseCache=new Map();
async function json(url){
 const cached=responseCache.get(url);
 if(cached&&Date.now()-cached.time<60000)return cached.data;
 let lastError;
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT);
  try{
   const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
   if(r.status===429){lastError=Error('LIMIT D’API (429)');}
   else if(!r.ok)throw Error('HTTP '+r.status);
   else{const data=await r.json();responseCache.set(url,{time:Date.now(),data});if(responseCache.size>100)responseCache.clear();return data}
  }catch(e){lastError=e;if(!String(e.message).includes('429')&&attempt===0)break}
  finally{clearTimeout(timer)}
  if(attempt===0)await wait(800);
 }
 throw lastError||Error('Proveïdor no disponible');
}
function normalizeCoinbase(raw,sec){const now=Date.now();return (Array.isArray(raw)?raw:[]).map(x=>({t:x[0]*1000,l:x[1],h:x[2],o:x[3],c:x[4],v:x[5]})).filter(x=>x.t+sec*1000<=now&&[x.o,x.h,x.l,x.c,x.v].every(Number.isFinite)&&x.c>0).sort((a,b)=>a.t-b.t)}
async function getCoinbase(pair,seconds){const end=new Date(),start=new Date(end.getTime()-seconds*1000*285);const url='https://api.exchange.coinbase.com/products/'+encodeURIComponent(pair)+'/candles?granularity='+seconds+'&start='+encodeURIComponent(start.toISOString())+'&end='+encodeURIComponent(end.toISOString());const rows=normalizeCoinbase(await json(url),seconds);if(rows.length<45)throw Error('Coinbase: espelmes insuficients');return rows}
async function getKraken(base,min){const pair=base==='BTC'?'XBTUSD':base+'USD';const r=await json('https://api.kraken.com/0/public/OHLC?pair='+encodeURIComponent(pair)+'&interval='+min);if(r.error?.length)throw Error(r.error.join(' | '));const key=Object.keys(r.result||{}).find(k=>k!=='last');if(!key)throw Error('Kraken: parell sense dades');const now=Date.now();return (r.result[key]||[]).map(x=>({t:Number(x[0])*1000,o:Number(x[1]),h:Number(x[2]),l:Number(x[3]),c:Number(x[4]),v:Number(x[6])})).filter(x=>x.t+min*60000<=now&&[x.o,x.h,x.l,x.c,x.v].every(Number.isFinite)&&x.c>0).sort((a,b)=>a.t-b.t)}
async function candles(symbol,sec){
 // Kraken supports 240m for 4H, whereas Coinbase candles support 6H but not 4H.
 const errors=[];
 const krakenMinutes=sec===21600?240:sec/60;
 // Prefer one provider with consistent OHLCV; fallback only on failure.
 try{
  const rows=await getKraken(symbol,krakenMinutes);
  if(rows.length>=55)return {rows,source:'Kraken',pair:symbol+'/USD'};
  errors.push('Kraken: espelmes insuficients');
 }catch(e){errors.push('Kraken: '+e.message)}
 // Coinbase does not provide 4H granularity. Generate true 4H OHLCV from hourly candles.
 for(const q of [symbol+'-USD',symbol+'-USDC']){
  try{
   const oneHour=sec===21600;
   const raw=await getCoinbase(q,oneHour?3600:sec);
   if(!oneHour)return {rows:raw,source:'Coinbase',pair:q};
   const groups=new Map();
   for(const bar of raw){
    const bucket=Math.floor(bar.t/14400000)*14400000;
    const g=groups.get(bucket);
    if(!g)groups.set(bucket,{t:bucket,o:bar.o,h:bar.h,l:bar.l,c:bar.c,v:bar.v,count:1});
    else{g.h=Math.max(g.h,bar.h);g.l=Math.min(g.l,bar.l);g.c=bar.c;g.v+=bar.v;g.count++}
   }
   const rows=[...groups.values()].filter(x=>x.count===4).sort((a,b)=>a.t-b.t);
   if(rows.length>=55)return {rows,source:'Coinbase 1H→4H',pair:q};
   errors.push('Coinbase '+q+': menys de 55 espelmes completes 4H');
  }catch(e){errors.push('Coinbase '+q+': '+e.message)}
 }
 throw Error(errors.join('; '));
}
function ema(a,n){if(a.length<n)return null;let e=a.slice(0,n).reduce((s,x)=>s+x,0)/n;for(let i=n;i<a.length;i++)e+=2/(n+1)*(a[i]-e);return e}
function rsi(a,n=14){if(a.length<n+1)return null;const dif=a.slice(-n-1).map((x,i)=>i?x-a[a.length-n-2+i]:null).slice(1);const gain=dif.reduce((s,x)=>s+Math.max(x,0),0)/n,loss=dif.reduce((s,x)=>s+Math.max(-x,0),0)/n;return loss===0?100:100-100/(1+gain/loss)}
function atr(a,n=14){if(a.length<n+1)return null;const q=a.slice(-n-1),z=q.slice(1).map((x,i)=>Math.max(x.h-x.l,Math.abs(x.h-q[i].c),Math.abs(x.l-q[i].c)));return z.reduce((s,x)=>s+x,0)/n}
function calc(a){const c=a.at(-1),cl=a.map(x=>x.c),vol=a.slice(-21,-1),avgVol=vol.length===20?vol.reduce((s,x)=>s+x.v,0)/20:null;return {c:c.c,ema20:ema(cl,20),ema50:ema(cl,50),rsi:rsi(cl),atr:atr(a),rvol:avgVol>0?c.v/avgVol:null}}
function sessionVwap(bars){const recent=bars.slice(-24);const volume=recent.reduce((v,b)=>v+b.v,0);return volume>0?recent.reduce((v,b)=>v+((b.h+b.l+b.c)/3)*b.v,0)/volume:null}
function pctChange(bars,n=24){return bars.length>n&&bars.at(-n-1).c>0?100*(bars.at(-1).c/bars.at(-n-1).c-1):null}
function historicalAccumulationStudy(bars){
 // Research-only: previous 1H candle is the signal; assess the following 6 COMPLETE candles.
 // The live signal is never trained or authorized from this statistic.
 const events=[];
 for(let i=22;i+6<bars.length;i++){
  const window=bars.slice(i-20,i),b=bars[i],avg=window.reduce((v,x)=>v+x.v,0)/20;
  const earlier=bars.slice(i-10,i-5),recent=bars.slice(i-5,i+1);
  const signed=x=>x.slice(1).reduce((v,z,j)=>v+(z.c>x[j].c?z.v:z.c<x[j].c?-z.v:0),0);
  const signal=avg>0&&b.v/avg>=.35&&b.v/avg<1.8&&signed(recent)>0&&signed(recent)>signed(earlier);
  if(signal)events.push({at:new Date(b.t).toISOString(),forward6hPct:Math.round(10000*(bars[i+6].c/b.c-1))/100});
 }
 const mean=events.length?events.reduce((a,x)=>a+x.forward6hPct,0)/events.length:null;
 return {events:events.length,positive:events.filter(x=>x.forward6hPct>0).length,avgForward6hPct:mean===null?null:Math.round(mean*100)/100,lookaheadHours:6,method:'Estudi preliminar OHLCV amb espelmes tancades; no és backtest executiu ni prova fora de mostra'};
}
function scanOne(symbol,pack){
 const {daily:D,four:H,hour:F,half:M}=pack;const d=D.rows,h=H.rows,f=F.rows,m=M.rows;
 const momentum={day:momentumDiagnostic(d,'crypto'),four:momentumDiagnostic(h,'crypto'),hour:momentumDiagnostic(f,'crypto')};
 if([d,h,f,m].some(x=>x.length<55))throw Error('Històric insuficient 1D/4H/1H/30m');
 const tfDetails=[['1D',d,86400000],['4H',h,14400000],['1H',f,3600000],['30m',m,1800000]];
 const tfQuality={};
 const now=Date.now();
 for(const [name,bars,period] of tfDetails){
  const lastBar=bars.at(-1),age=now-lastBar.t;
  const previous=bars.slice(-30);
  let gaps=0;
  for(let i=1;i<previous.length;i++){
   if(previous[i].t-previous[i-1].t>period*1.6)gaps++;
  }
  const maxAge=name==='1D'?72*3600000:period*4;
  tfQuality[name]={count:bars.length,lastClose:new Date(lastBar.t+period).toISOString(),ageHours:Math.round(age/3600000*10)/10,gaps30:gaps,stale:age>maxAge};
 }
 const staleFrames=Object.entries(tfQuality).filter(([,q])=>q.stale).map(([k])=>k);
 if(staleFrames.length)throw Error('Dades antigues: '+staleFrames.join(', ')+'; revisa el proveïdor');
 const a=calc(d),b=calc(h),c=calc(f),z=calc(m),last=f.at(-1),prior=f.slice(-13,-1),hi=Math.max(...prior.map(x=>x.h)),lo=Math.min(...prior.map(x=>x.l));
 const vwap24h=sessionVwap(f);
 const priceAboveVwap=Number.isFinite(vwap24h)?last.c>vwap24h:null;
 const btcReturn24h=Array.isArray(pack.btcHour)?pctChange(pack.btcHour):null;
 const assetReturn24h=pctChange(f);
 const relativeStrengthBTC=Number.isFinite(btcReturn24h)&&Number.isFinite(assetReturn24h)?Math.round((assetReturn24h-btcReturn24h)*100)/100:null;
 const historicalAccumulation=historicalAccumulationStudy(f);
 const providerConsistency=F.source===H.source&&H.source===D.source&&D.source===M.source?'UNIFORME':'MIXTA';
 const historicalStudyCaution='Estudi exploratori amb les dades OHLCV del proveïdor; no modifica READY';
 const dailyTrend=a.c>a.ema20&&a.ema20>a.ema50,fourTrend=b.c>b.ema20&&b.ema20>b.ema50;
 const breakUp=last.c>hi&&last.c>last.o,retest=last.l<=c.ema20*1.008&&last.c>c.ema20&&last.c>last.o;
 const near=hi>0&&last.c<=hi&&last.c>=hi*.988;
 const pattern=breakUp?'RUPTURA':retest?'RETEST EMA20':near?'RUPTURA PENDENT':'SENSE PATRÓ';
 const trigger=breakUp?last.c:retest?last.h:near?hi:null;
 const stop=trigger!==null?Math.min(lo,last.l)-.18*c.atr:null,risk=stop!==null?trigger-stop:null;
 const target=trigger!==null&&risk>0?trigger+2*risk:null,tp2=trigger!==null&&risk>0?trigger+3*risk:null;
 const stopPct=risk>0?100*risk/trigger:null;
 const extended=b.atr>0&&(last.c-b.ema20)/b.atr>2||c.atr>0&&(last.c-c.ema20)/c.atr>1.5;
 const bearish=c.rvol>=1.2&&last.c<last.o&&last.c<f.at(-2).c;
 const dist=trigger>0?100*(trigger-last.c)/trigger:null;
 const weak=dist!==null&&(dist>=3.75||dist>=2.5&&last.c<c.ema20&&bearish);
 const dollarVolumeDay=d.slice(-20).reduce((sum,x)=>sum+x.c*x.v,0)/20;
 const liquidityTier=dollarVolumeDay>=50000000?'GRAN':dollarVolumeDay>=5000000?'MITJANA':'PETITA';
 const watchRvolThreshold=liquidityTier==='GRAN'?1.3:liquidityTier==='MITJANA'?1.5:1.8;
 const rvol4h=b.rvol;
 const obvNet=bars=>bars.slice(1).reduce((v,bar,i)=>v+(bar.c>bars[i].c?bar.v:bar.c<bars[i].c?-bar.v:0),0);
 const obvRecent=obvNet(f.slice(-11)),obvPrevious=obvNet(f.slice(-21,-10));
 const accumulationWatch=Number.isFinite(c.rvol)&&c.rvol>=0.35&&c.rvol<watchRvolThreshold&&obvRecent>0&&obvRecent>obvPrevious&&last.c>=c.ema20*.985&&!bearish;
 const strongVolumeWatch=Number.isFinite(c.rvol)&&c.rvol>=watchRvolThreshold&&Number.isFinite(rvol4h)&&rvol4h>=1.15&&!bearish;
 const momentum=c.rsi>=48&&c.rsi<=72,trend=dailyTrend&&fourTrend,volumeOk=c.rvol>=1.05&&!bearish,liquid=dollarVolumeDay>=1000000;
 const canPlan=trigger!==null&&risk>0&&stopPct<=10;
 let status='WATCH',reason='Sense configuració de compra validada';
 if(extended||stopPct>10){status='NO PERSEGUIR';reason='Sobreextensió o stop massa distant'}
 else if(weak){status='PRE-SETUP DEBILITAT';reason='Allunyament del trigger i debilitat'}
 else if(trend&&momentum&&volumeOk&&liquid&&canPlan&&(breakUp||retest||near)){
 status=breakUp||retest&&c.rvol>=1.35?'PRE-READY':'PRE-SETUP';
 reason='Configuració orientativa: pendent confirmació al Pine';
 }
 const historicalHigh=Math.max(...h.slice(-35,-1).map(x=>x.h));
 const support4h=Math.min(...h.slice(-18,-1).map(x=>x.l));
 const supportAtrDistance=b.atr>0?Math.abs(h.at(-1).l-support4h)/b.atr:null;
 const volumeSupport4H=Number.isFinite(supportAtrDistance)&&supportAtrDistance<=0.6&&h.at(-1).c>support4h&&h.at(-1).c>=h.at(-1).o&&b.rvol>=1.15;
 const mLast=m.at(-1),mPrior=m.at(-2);
 const thirtyConfirm=!!(mLast&&mPrior&&mLast.c>mLast.o&&mLast.c>z.ema20&&z.rvol>=1.05&&mLast.c>=mPrior.c);
 const thirtyRvol=z.rvol;
 const roomPct=historicalHigh>trigger&&trigger>0?100*(historicalHigh-trigger)/trigger:0;
 const atrPct=c.atr>0?100*c.atr/last.c:null;
 const feasibleRisk=stopPct!==null&&stopPct>=0.7&&stopPct<=7;
 const acceptableLiquidity=liquid&&c.rvol!==null;
 const riskRewardToResistance=trigger>stop&&historicalHigh>trigger?(historicalHigh-trigger)/(trigger-stop):null;
 const successFactors=[
  {name:'Tendència diària i 4H',pass:trend},
  {name:'Volum i absència de venda agressiva',pass:volumeOk},
  {name:'Liquiditat',pass:acceptableLiquidity},
  {name:'Stop raonable (0,7–7%)',pass:feasibleRisk},
  {name:'No sobreextesa',pass:!extended},
  {name:'Moment RSI',pass:momentum},
  {name:'Espai fins resistència (R:R ≥ 1,5)',pass:riskRewardToResistance===null||riskRewardToResistance>=1.5}
 ];
 const hardFail=!acceptableLiquidity||!feasibleRisk||extended||bearish||(riskRewardToResistance!==null&&riskRewardToResistance<1.5);
 if(hardFail){status='NO PERSEGUIR';reason=!acceptableLiquidity?'Liquiditat o volum insuficients':!feasibleRisk?'Stop fora del rang de risc':extended?'Sobreextensió':bearish?'Venda agressiva': 'Resistència massa propera per al risc assumit';}
 const originalScore=Math.round(Math.min(100,(dailyTrend?20:0)+(fourTrend?20:0)+(momentum?15:0)+(volumeOk?15:0)+(liquid?10:0)+(canPlan?10:0)+((breakUp||retest||near)?10:0)-(extended?20:0)));
 const score=Math.max(0,Math.min(100,originalScore-(hardFail?20:0)+(thirtyConfirm?5:0)+(volumeSupport4H?5:0)));
 const confidenceGrade=successFactors.filter(x=>x.pass).length;

 // Pine v6.6.18 reference: 8-bar 4H base, ATR compression, confirmed 30m/1H,
 // minimum net R:R 2.0 after 0.4% estimated round-trip costs.
 const base4=h.slice(-9,-1),baseHigh=Math.max(...base4.map(x=>x.h)),baseLow=Math.min(...base4.map(x=>x.l));
 const baseWidth=baseHigh-baseLow,baseOK=b.atr>0&&baseWidth<=4*b.atr;
 const dailyPineOK=a.c>a.ema50;
 const trendPineOK=b.c>b.ema50&&b.ema20>b.ema50;
 const extensionPineOK=b.atr>0&&last.c<=b.ema20+2*b.atr;
 const pineBreakTrigger=baseHigh+Math.max(last.c*.00001,.00000001);
 const pineBreakStop=Math.min(...h.slice(-7,-1).map(x=>x.l))-.2*b.atr;
 const pineBreakEvent=last.c>pineBreakTrigger&&f.at(-2).c<=pineBreakTrigger&&last.c>last.o;
 const pineBreakVolume=Number.isFinite(c.rvol)&&c.rvol>=1.1;
 const pinePullLocation=mLast.l<=b.ema20+.25*b.atr&&mLast.l>=b.ema50-.5*b.atr;
 const pinePullTrigger=Math.max(mPrior.h+Math.max(last.c*.00001,.00000001),b.ema20);
 const pinePullStop=Math.min(...h.slice(-4).map(x=>x.l))-.2*b.atr;
 const pinePullEvent=last.c>pinePullTrigger&&last.c>last.o&&Number.isFinite(c.rvol)&&c.rvol>=.8;
 const pineCosts=entry=>entry*.004;
 const pinePlan=(entry,sl)=>{
  const risk=entry-sl,cost=pineCosts(entry),dailyResistance=Math.max(...d.slice(-61,-1).map(x=>x.h));
  const goal=risk>0?Math.min(entry+2.5*risk,dailyResistance>entry?dailyResistance:Infinity):null;
  const netRR=risk>0&&Number.isFinite(goal)?(goal-entry-cost)/(risk+cost):null;
  return {entry,stop:sl,goal,netRR,valid:risk>0&&sl>0&&100*risk/entry<=10&&netRR>=2};
 };
 const pineBreakPlan=pinePlan(pineBreakTrigger,pineBreakStop),pinePullPlan=pinePlan(pinePullTrigger,pinePullStop);
 const pineContextOK=dailyPineOK&&trendPineOK&&extensionPineOK&&liquid;
 const pineBreakReady=pineContextOK&&baseOK&&pineBreakPlan.valid;
 const pinePullReady=pineContextOK&&pinePullLocation&&pinePullPlan.valid;
 const pineSignalCandidate=(pineBreakReady&&pineBreakEvent&&pineBreakVolume)?'RUPTURA':(pinePullReady&&pinePullEvent)?'RETROCES':null;
 const pineReferenceState=pineSignalCandidate?'CANDIDAT CONFIRMAT':pineBreakReady||pinePullReady?'PLA PREPARAT':'SENSE PLA VALID';
 const pineReferenceRoute=pineSignalCandidate||(pineBreakReady?'RUPTURA':pinePullReady?'RETROCES':'—');
 const pineReferencePlan=pineReferenceRoute==='RUPTURA'?pineBreakPlan:pineReferenceRoute==='RETROCES'?pinePullPlan:null;
 // Separate Pine v6.6.18-inspired EXP monitoring from executable trade status.
 // Compression is measured on completed 4H candles (without the most recent 4H bar).
 const closed4=h.slice(0,-1),close4=closed4.map(x=>x.c);
 const smaArr=(arr,n)=>arr.length>=n?arr.slice(-n).reduce((v,x)=>v+x,0)/n:null;
 const stdev=(arr,n)=>{const avg=smaArr(arr,n);return avg?Math.sqrt(arr.slice(-n).reduce((sum,x)=>sum+(x-avg)**2,0)/n):null};
 const bbAt=end=>{const seg=close4.slice(0,end);const avg=smaArr(seg,20),dev=stdev(seg,20);return avg>0?4*dev/avg:null};
 const bbNow=bbAt(close4.length);
 const bbValues=[];for(let idx=20;idx<=close4.length;idx++){const v=bbAt(idx);if(Number.isFinite(v))bbValues.push(v)}
 const bbAvg=smaArr(bbValues,40);
 const earlyCompression=Number.isFinite(bbNow)&&Number.isFinite(bbAvg)&&bbNow<=bbAvg*1.00;
 const earlyHigh=Math.max(...closed4.slice(-12).map(x=>x.h));
 const earlyTrigger=earlyHigh+Math.max(last.c*.00001,.00000001);
 const earlyDistance=b.atr>0?(earlyTrigger-last.c)/b.atr:null;
 const earlyNear=Number.isFinite(earlyDistance)&&earlyDistance>=0&&earlyDistance<=1.00;
 const earlyTrend=a.c>a.ema50*.94&&b.c>b.ema50*.97&&b.ema20>=b.ema50*.98;
 const earlyVolume=Number.isFinite(c.rvol)&&c.rvol>=0.90;
 const earlyFirstImpulse=last.c>earlyTrigger&&f.at(-2).c<=earlyTrigger&&last.c>last.o&&earlyVolume;
 // Independent directional early-watch: bearish monitoring is not a SHORT signal.
 const bearTrend=a.c<a.ema50&&b.c<b.ema50;
 const bearBaseLow=Math.min(...closed4.slice(-12).map(x=>x.l));
 const bearNear=last.c>=bearBaseLow&&b.atr>0&&(last.c-bearBaseLow)/b.atr<=.65;
 const bearBreak=last.c<bearBaseLow&&last.c<last.o;
 const bearVolume=Number.isFinite(c.rvol)&&c.rvol>=1.05&&last.c<last.o;
 const bearishWatchScore=[earlyCompression,bearNear||bearBreak,bearVolume,bearTrend,liquid].filter(Boolean).length;
 const bullishWatchScore=[earlyCompression,earlyNear||earlyFirstImpulse,earlyVolume,earlyTrend,!extended&&liquid].filter(Boolean).length;
 const explosiveDirection=bearishWatchScore>=3&&bearishWatchScore>bullishWatchScore?'BAIXISTA':bullishWatchScore>=3?'ALCISTA':'NEUTRAL';
 const explosiveWatchScore=explosiveDirection==='BAIXISTA'?bearishWatchScore:bullishWatchScore;
 const earlyScore=bullishWatchScore;
 const earlyEligible=earlyTrend&&liquid&&!extended&&(earlyCompression||earlyNear||earlyFirstImpulse)&&earlyScore>=3;
 const earlyStage=earlyEligible?(earlyFirstImpulse?'EXP · PRIMER IMPULS':earlyNear?'EXP · PROP RUPTURA':'EXP · PREPARACIÓ'):earlyScore>=2?'EXPLOSIVE WATCH':'SENSE EXP';
 // "READY" must never be inferred from a plan with no confirmation.
 // PRE-READY requires a truly valid executable candidate plan; EXP remains a separate watch phase.
 const pineState=pineSignalCandidate?'CANDIDAT CONFIRMAT · WEB':pineReferenceState==='PLA PREPARAT'?'PRE-READY':earlyEligible?earlyStage:status==='NO PERSEGUIR'?'NO PERSEGUIR':status==='WATCH'?'WATCH':'SENSE SETUP';
 const watchLevel=Number.isFinite(earlyTrigger)&&earlyTrigger>0?earlyTrigger:Number.isFinite(hi)&&hi>0?hi:null;
 const watchSupport=Number.isFinite(support4h)&&support4h>0?support4h:null;
 const watchDistance=watchLevel>0?100*(watchLevel-last.c)/last.c:null;
 const setupQuality=score;
 // Continuous diagnostic within each EXP score band; never a probability of return.
 const volumeStrength=Number.isFinite(c.rvol)?Math.min(1,Math.max(0,c.rvol/1.5)):0;
 const trendStrength=(dailyTrend?1:0)+(fourTrend?1:0);
 const nearStrength=Number.isFinite(watchDistance)?Math.max(0,1-Math.abs(watchDistance)/8):0;
 const anticipationScore=Math.max(0,Math.min(100,Math.round(bullishWatchScore*14+volumeStrength*12+nearStrength*10+trendStrength*4)));
 const primaryBlocker=!dailyTrend||!fourTrend?'Tendència 1D/4H desfavorable':!Number.isFinite(c.rvol)||c.rvol<1.05?'Volum 1H insuficient':!pineReferencePlan?.valid?'R:R inferior a 2 o pla no vàlid':!pineSignalCandidate?'Falta confirmació 1H/30m':'Validar senyal al Pine';
 const volumeTimeframe='1H tancada';
 const patternPhase=earlyFirstImpulse?'Primer impuls':earlyNear?'Prop de ruptura':earlyCompression?'Compressió / preparació':earlyEligible?'Preparació EXP':'Sense patró anticipat';
 const tradeDecision=status==='NO PERSEGUIR'||extended?'NO PERSEGUIR':pineSignalCandidate&&pineReferencePlan?.valid&&pineContextOK?'REVISAR ENTRADA':pineReferenceState==='PLA PREPARAT'?'ESPERAR CONFIRMACIÓ':'VIGILAR / ESPERAR';
 const volumeText=Number.isFinite(c.rvol)?Math.round(c.rvol*100)/100:null;
 const candleMovePct=last.o>0?(last.c/last.o-1)*100:null;
 const volumeCandleDirection=!Number.isFinite(candleMovePct)||Math.abs(candleMovePct)<0.10?'NEUTRA':candleMovePct>0?'ALCISTA':'BAIXISTA';
 const criticalBlocks=[
  ...(!dailyTrend||!fourTrend?['Tendència 1D/4H']:[]),
  ...(!Number.isFinite(c.rvol)||c.rvol<0.8?['Volum 1H baix']:[]),
  ...(volumeCandleDirection==='BAIXISTA'&&c.rvol>=1.3?['Volum baixista fort 1H']:[]),
  ...(!pineReferencePlan?.valid?['Pla R:R mínim 2 no vàlid']:[]),
  ...(!liquid?['Liquiditat insuficient']:[])
 ];
 const operationalQuality=criticalBlocks.length?Math.min(score,49):score;
 const operationalDecision=extended||status==='NO PERSEGUIR'?'NO PERSEGUIR':pineSignalCandidate&&criticalBlocks.length===0?'REVISAR ENTRADA':criticalBlocks.length?'ESPERAR':'ESPERAR CONFIRMACIÓ';
 const planAvailable=!!(pineReferencePlan?.valid&&pineContextOK);
 const setupLabel=planAvailable?'PLA TÈCNIC PREPARAT':earlyEligible?'VIGILÀNCIA EXP · SENSE PLA':'SENSE PLA EXECUTABLE';
 const executionState=pineSignalCandidate?'REVISAR CONFIRMACIÓ AL PINE':'SENSE PLA EXECUTABLE';
 const estimatedSuccessProbability=null; // requires out-of-sample event-based backtesting, not an invented likelihood
 return {symbol,type:'cripto',status,reason,momentum,vwap24h,priceAboveVwap,btcReturn24h,assetReturn24h,relativeStrengthBTC,historicalAccumulation,providerConsistency,historicalStudyCaution,liquidityTier,dollarVolumeDay,rvol4h,watchRvolThreshold,accumulationWatch,strongVolumeWatch,obvRecent,obvPrevious,source:[D,H,F,M].map(x=>x.source).join('/'),pair:F.pair,price:last.c,quoteTime:new Date(last.t).toISOString(),timeframe:'1H tancada',pattern,score,setupQuality,operationalQuality,operationalDecision,criticalBlocks,anticipationScore,primaryBlocker,volumeTimeframe,volumeText,volumeCandleDirection,candleMovePct,patternPhase,tradeDecision,watchLevel,watchSupport,watchDistance,planAvailable,setupLabel,trigger,stop,tp1:target,tp2,riskPct:stopPct,rr:target&&risk>0?(target-trigger)/risk:null,rvol:c.rvol,volumeDirection:bearish?'BAIXISTA FORT':last.c<last.o?'BAIXISTA':'ALCISTA',rsi:c.rsi,ema20:c.ema20,trend1D:dailyTrend,trend4H:fourTrend,liquid,extended,coverage:{day:d.length,four:h.length,hour:f.length,half:m.length},dataQuality:tfQuality,confidenceGrade,confidenceChecks:successFactors,thirtyConfirm,thirtyRvol,volumeSupport4H,support4h,estimatedSuccessProbability,roomPct,atrPct,riskRewardToResistance,eligibleForEntry:!hardFail&&trend&&volumeOk&&canPlan,pineState,executionState,explosiveDirection,explosiveWatchScore,bearishWatchScore,bullishWatchScore,earlyScore,earlyStage,earlyCompression,earlyNear,earlyVolume,earlyTrend,pineReferenceVersion:'6.6.20',scannerReferenceVersion:'2.6',signalEngine:'WEB-INDEPENDENT',volumeBarClosedAt:new Date(last.t+3600000).toISOString(),pineReferenceState,pineReferenceRoute,pineReferenceEntry:pineReferencePlan?.entry??null,pineReferenceStop:pineReferencePlan?.stop??null,pineReferenceTarget:pineReferencePlan?.goal??null,pineReferenceNetRR:pineReferencePlan?.netRR??null,verifiedSignal:false,warning:'Motor web independent, referències Pine Assistant 6.6.19 i Scanner 2.5; comparar mateixa espelma i exchange. Els TP no són resistències validades.'}
}
async function single(s,btcHour){const [daily,four,hour,half]=await Promise.all([candles(s,86400),candles(s,21600),candles(s,3600),candles(s,1800)]);return scanOne(s,{daily,four,hour,half,btcHour:s==='BTC'?hour.rows:btcHour})}
export default async function handler(req,res){const syms=String(req.query.symbols||'BTC,ETH,SOL,ONDO,LINK,RENDER,HYPE,AAVE,NEAR,SUI').toUpperCase().split(',').map(x=>x.trim()).filter(x=>/^[A-Z0-9]{2,12}$/.test(x)).slice(0,10);const result=[],errors=[];let btcHour=null;try{btcHour=(await candles('BTC',3600)).rows}catch(_){}for(let i=0;i<syms.length;i++){const symbol=syms[i];try{result.push(await single(symbol,btcHour))}catch(e){errors.push({symbol,message:String(e.message||e)})}if(i<syms.length-1)await wait(250)}res.setHeader('Cache-Control','no-store');return res.status(200).json({results:result,errors,generatedAt:new Date().toISOString(),warning:'Dades de tancaments; revisa a TradingView abans de cap ordre.'})}
