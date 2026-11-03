// LONG AI v5.28.1 experimental pattern evaluation on CLOSED 1H candles.
// This module does not authorize orders: HTF, benchmark and consolidated volume
// parity are still required. Never treat these pattern flags as live signals.
function highest(bars,key,start,end){return Math.max(...bars.slice(start,end).map(b=>b[key]));}
function lowest(bars,key,start,end){return Math.min(...bars.slice(start,end).map(b=>b[key]));}
function crossedAbove(a,prevA,b,prevB){return [a,prevA,b,prevB].every(Number.isFinite)&&a>b&&prevA<=prevB;}
export function evaluatePatterns(bars,indicators,{breakBars=10,compressionFactor=0.9,compressionWindow=12}={}){
 if(!Array.isArray(bars)||bars.length<40||!Array.isArray(indicators)||indicators.length!==bars.length)
  return {status:'insufficient_history',motors:{A:null,C:null,E:null,F:null}};
 const i=bars.length-1,b=bars[i],prev=bars[i-1],v=indicators[i],p=indicators[i-1];
 const required=['ema20','ema50','rsi14','atr14','macdHistogram'];
 if(!required.every(k=>Number.isFinite(v[k]))||!Number.isFinite(p.rsi14)||!Number.isFinite(p.ema20))
  return {status:'insufficient_indicators',motors:{A:null,C:null,E:null,F:null}};
 const resistance=highest(bars,'h',i-breakBars,i);
 const prevResistance=highest(bars,'h',i-breakBars-1,i-1);
 const breakA=b.c>resistance&&prev.c<=prevResistance;
 const rsiRecovery=crossedAbove(v.rsi14,p.rsi14,50,50)&&b.c>v.ema20;
 const crossEMA=crossedAbove(b.c,prev.c,v.ema20,p.ema20);
 const belowEMA=[1,2,3].filter(n=>bars[i-n].c<indicators[i-n]?.ema20).length;
 const reclaimEMA=crossEMA&&belowEMA>=2;
 // Historical breakout/retest requires a stateful barssince/valuewhen replay.
 // It is deliberately unresolved rather than approximated from the last bar.
 const high5=highest(bars,'h',i-5,i),prevHigh5=highest(bars,'h',i-6,i-1);
 const breakE=b.c>high5&&prev.c<=prevHigh5;
 const strongCandle=b.c>b.o&&b.h>b.l&&(b.c-b.l)/(b.h-b.l)>=0.65;
 const momentumUp=Number.isFinite(p.macdHistogram)&&v.macdHistogram>p.macdHistogram&&v.rsi14>p.rsi14;
 const trendLocal=v.ema20>v.ema50&&v.ema20>indicators[i-3]?.ema20;
 const pullbackRecent=bars.slice(i-4,i+1).some((x,j)=>Number.isFinite(indicators[i-4+j]?.ema20)&&x.l-indicators[i-4+j].ema20<=v.atr14*0.30);
 const resumeTrend=b.c>prev.h&&b.c>v.ema20&&strongCandle;
 const atrHistory=indicators.slice(i-19,i+1).map(x=>x.atr14);
 const atrMean=atrHistory.every(Number.isFinite)?atrHistory.reduce((a,x)=>a+x,0)/20:null;
 const range8=highest(bars,'h',i-7,i+1)-lowest(bars,'l',i-7,i+1);
 const ranges=Array.from({length:20},(_,j)=>{const end=i-19+j+1;return highest(bars,'h',end-8,end)-lowest(bars,'l',end-8,end);});
 const rangeMean=ranges.reduce((a,x)=>a+x,0)/20;
 const compression=(atrMean!==null&&v.atr14<atrMean*compressionFactor)||(rangeMean>0&&range8<rangeMean*0.75);
 return {status:'partial_patterns_only',motors:{
 A:{breakout:breakA,rsiRecovery,pattern:breakA||rsiRecovery},
 C:{reclaimEMA,retest:null,pattern:reclaimEMA?true:null},
 E:{breakout:breakE,compressionNow:compression,recentCompression:null,volumeQualified:null,pattern:null},
 F:{trendLocal,pullbackRecent,resumeTrend,momentumUp,h4Strong:null,volumeQualified:null,pattern:null}},
 diagnostics:{strongCandle,momentumUp,resistanceA:resistance,high5,compressionNow:compression},
 warnings:['C retest requires replayed breakout state','E requires historical compression and consolidated RVOL','F requires confirmed 4H and consolidated RVOL','No scores, signals or orders']};
}
