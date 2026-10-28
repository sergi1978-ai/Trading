// LONG AI PROFIT v1.1 — PRE-REGISTERED pullback/reclaim hypothesis.
// Research only. One strategy, no optimization, no live orders.
// All higher-timeframe values must be closed BEFORE the current 1H candle opens.
import {pineEma,pineAtr} from './pine-v6627-parity.js';
const MS=Date.parse,H=3600000;
const max=(a,k)=>Math.max(...a.map(b=>b[k]));
const min=(a,k)=>Math.min(...a.map(b=>b[k]));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
export const PULLBACK_V11=Object.freeze({
  version:'1.1.0-research',dailyEma:50,fourEmaFast:20,fourEmaSlow:50,
  atrLength:14,contextBars:3,reclaimBars:4,relativeVolumeMin:1.2,
  rsiMin:52,rsiMax:70,breakEvenRoomR:2,
  maxEntryRiskPct:.10,stopBufferATR:.2,nearEMAATR:.25,
  maxChaseATR:.2,maxExtensionATR:1.5,validHours:3,
  costReservePct:.2
});
function checkBars(bars,label){
 if(!Array.isArray(bars)||!bars.length)throw new Error('Missing '+label+' candles');
 let prevEnd=-Infinity;
 for(const b of bars){
  const t=MS(b.t),e=MS(b.endExclusive);
  if(!Number.isFinite(t)||!Number.isFinite(e)||e<=t||t<prevEnd||
    ![b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)||b.o<=0||b.l<=0||b.v<0||
    b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h))
   throw new Error('Invalid '+label+' candle');
  prevEnd=e;
 }
}
function rsiWilder(values,n=14){
 if(values.length<n+1)return null;
 let gain=0,loss=0;
 for(let j=1;j<=n;j++){const x=values[j]-values[j-1];gain+=Math.max(0,x);loss+=Math.max(0,-x);}
 gain/=n;loss/=n;
 for(let j=n+1;j<values.length;j++){
  const x=values[j]-values[j-1];
  gain=(gain*(n-1)+Math.max(x,0))/n;
  loss=(loss*(n-1)+Math.max(-x,0))/n;
 }
 return loss===0?100:100-100/(1+gain/loss);
}
// Returns a trace on every fully closed H1 bar: deterministic, auditable gates.
// Does not silently substitute a partial higher-TF candle or a missing source bar.
export function trendPullbackV11({symbol,market='CRYPTO',hourly,fourHour,daily,
  tickSize=.01,volumeApproved=false}={}){
 if(!symbol||!['STOCK','CRYPTO'].includes(market)||!(tickSize>0)||!Number.isFinite(tickSize))throw Error('Bad parameters');
 checkBars(hourly,'1H');checkBars(fourHour,'4H');checkBars(daily,'1D');
 const signals=[],traces=[],frozen=PULLBACK_V11;
 if(!volumeApproved)return {signals,traces,blocked:'VOLUME_NOT_APPROVED',version:frozen.version};
 const D=daily,F=fourHour,Q=hourly;
 let jf=0,jd=0;
 for(let i=0;i<Q.length;i++){
  const bar=Q[i],anchor=MS(bar.t),closing=MS(bar.endExclusive);
  while(jf<F.length&&MS(F[jf].endExclusive)<=anchor)jf++;
  while(jd<D.length&&MS(D[jd].endExclusive)<=anchor)jd++;
  const trace={symbol,signalTime:bar.endExclusive,
    higherTimeframe:{fourEnd:jf?F[jf-1].endExclusive:null,dayEnd:jd?D[jd-1].endExclusive:null},
    gate:'HISTORY',reason:'',confirmed:false};
  if(i<50||jf<60||jd<70){traces.push(trace);continue;}
  const f=F.slice(0,jf),d=D.slice(0,jd),h=Q.slice(0,i+1);
  const last4=f.at(-1),lastD=d.at(-1),ATR=pineAtr(f,14);
  const E4=pineEma(f.map(x=>x.c),20),S4=pineEma(f.map(x=>x.c),50);
  const E4old=pineEma(f.slice(0,-3).map(x=>x.c),20);
  const D50=pineEma(d.map(x=>x.c),50);
  const D50old=pineEma(d.slice(0,-5).map(x=>x.c),50);
  const H20=pineEma(h.map(x=>x.c),20);
  const rsi=rsiWilder(h.map(x=>x.c));
  const volBase=mean(h.slice(-21,-1).map(x=>x.v));
  const rv=volBase>0?bar.v/volBase:null;
  const dTurn=mean(d.slice(-20).map(x=>x.c*x.v));
  if(!(ATR>0)||![E4,S4,E4old,D50,D50old,H20,rsi,rv,dTurn].every(Number.isFinite)){
    trace.gate='DATA';traces.push(trace);continue;
  }
  // Only a specific recent pullback within the last 3 CLOSED 4H candles is eligible.
  const last3=f.slice(-3),swingLow=min(last3,'l');
  const trend=lastD.c>D50&&D50>D50old&&last4.c>S4&&E4>S4&&E4>E4old;
  if(!trend){trace.gate='TREND';traces.push(trace);continue;}
  const zone=swingLow<=E4+frozen.nearEMAATR*ATR&&swingLow>=S4-.5*ATR;
  if(!zone){trace.gate='PULLBACK_ZONE';traces.push(trace);continue;}
  // Reclaim must follow actual dip in the previous 4 completed chart bars.
  const recent=Q.slice(Math.max(0,i-frozen.reclaimBars),i);
  const dipped=recent.some(b=>b.c<H20||b.l<H20);
  const reclaim=bar.c>H20&&bar.c>bar.o&&bar.c>Q[i-1].h&&dipped;
  if(!reclaim){trace.gate='RECLAIM';traces.push(trace);continue;}
  if(!(rsi>=frozen.rsiMin&&rsi<=frozen.rsiMax)){
    trace.gate='RSI';traces.push(trace);continue;
  }
  if(rv<frozen.relativeVolumeMin||dTurn<1000000){
    trace.gate='VOLUME';traces.push(trace);continue;
  }
  if(bar.c>E4+frozen.maxExtensionATR*ATR){
    trace.gate='EXTENSION';traces.push(trace);continue;
  }
  const entry=bar.h+tickSize,stop=Math.min(swingLow,min(recent,'l'),bar.l)-frozen.stopBufferATR*ATR;
  const risk=entry-stop,cost=entry*frozen.costReservePct/100;
  const overhead=max(d.slice(-60),'h');
  const roomR=overhead>entry+tickSize?(overhead-entry-cost)/(risk+cost):Infinity;
  if(!(stop>0&&risk>tickSize&&risk/entry<=frozen.maxEntryRiskPct&&roomR>=frozen.breakEvenRoomR)){
    trace.gate='STOP_OR_ROOM';traces.push(trace);continue;
  }
  const result={symbol,market,strategyId:'TREND_PULLBACK',strategyVersion:frozen.version,
    signalTime:bar.endExclusive,entryTrigger:entry,initialStop:stop,atr4h:ATR,
    validHours:frozen.validHours,maxEntryPrice:entry+frozen.maxChaseATR*ATR,
    closedContext:{fourEnd:F[jf-1].endExclusive,dayEnd:D[jd-1].endExclusive},
    diagnostic:{rvol:rv,rsi,roomR,ema4:E4,emaSlow4:S4,emaDaily50:D50}};
  trace.gate='SIGNAL';trace.confirmed=true;signals.push(result);traces.push(trace);
 }
 const gates=Object.fromEntries([...new Set(traces.map(x=>x.gate))].sort().map(g=>[g,traces.filter(x=>x.gate===g).length]));
 return {signals,traces,gates,version:frozen.version,blocked:null};
}
