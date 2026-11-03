import {dmiSeries} from './dmi.js';
// Closed-bar indicators only. Wilder RSI/ATR, standard EMA and MACD (12,26,9).
// These are research primitives; Pine parity requires separate comparison.
export function emaSeries(values,length){
 if(!Number.isInteger(length)||length<1)throw Error('Invalid EMA length');
 const out=Array(values.length).fill(null);let ema=null;
 for(let i=length-1;i<values.length;i++){
  if(ema===null){const seed=values.slice(i-length+1,i+1);if(!seed.every(Number.isFinite))continue;ema=seed.reduce((a,b)=>a+b,0)/length;}
  else if(Number.isFinite(values[i]))ema+=(values[i]-ema)*2/(length+1);
  else {ema=null;continue;}
  out[i]=ema;
 }
 return out;
}
export function rsiSeries(closes,length=14){
 const out=Array(closes.length).fill(null);if(closes.length<=length)return out;
 let gain=0,loss=0;
 for(let i=1;i<=length;i++){const d=closes[i]-closes[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0);}
 gain/=length;loss/=length;
 const value=()=>loss===0?(gain===0?50:100):100-100/(1+gain/loss);
 out[length]=value();
 for(let i=length+1;i<closes.length;i++){
  const d=closes[i]-closes[i-1];gain=(gain*(length-1)+Math.max(d,0))/length;loss=(loss*(length-1)+Math.max(-d,0))/length;out[i]=value();
 }
 return out;
}
export function atrSeries(bars,length=14){
 const tr=bars.map((b,i)=>i===0?b.h-b.l:Math.max(b.h-b.l,Math.abs(b.h-bars[i-1].c),Math.abs(b.l-bars[i-1].c)));
 const out=Array(bars.length).fill(null);if(bars.length<length)return out;
 let value=tr.slice(0,length).reduce((a,b)=>a+b,0)/length;out[length-1]=value;
 for(let i=length;i<bars.length;i++){value=(value*(length-1)+tr[i])/length;out[i]=value;}
 return out;
}
export function macdSeries(closes){
 const fast=emaSeries(closes,12),slow=emaSeries(closes,26);
 const line=closes.map((_,i)=>fast[i]===null||slow[i]===null?null:fast[i]-slow[i]);
 const valid=line.filter(Number.isFinite),signals=emaSeries(valid,9);let j=0;
 return line.map(x=>{if(x===null)return {line:null,signal:null,histogram:null};const signal=signals[j++];return {line:x,signal,histogram:signal===null?null:x-signal};});
}

export function pineEmaSeries(values,length){
 if(!Number.isInteger(length)||length<1)throw Error('Invalid EMA length');
 const alpha=2/(length+1),out=[];let previous=null;
 for(const value of values){if(Number.isFinite(value))previous=previous===null?value:alpha*value+(1-alpha)*previous;out.push(previous);}
 return out;
}
export function pineMacdSeries(closes){
 const fast=pineEmaSeries(closes,12),slow=pineEmaSeries(closes,26);
 const line=closes.map((_,i)=>fast[i]===null||slow[i]===null?null:fast[i]-slow[i]);
 const signal=pineEmaSeries(line,9);
 return line.map((v,i)=>({line:v,signal:signal[i],histogram:v===null||signal[i]===null?null:v-signal[i]}));
}
export function indicatorSeries(bars){
 if(!Array.isArray(bars))return [];
 const closes=bars.map(b=>b.c),e20=pineEmaSeries(closes,20),e50=pineEmaSeries(closes,50),rs=rsiSeries(closes,14),at=atrSeries(bars,14),mac=pineMacdSeries(closes),dmi=dmiSeries(bars,14,14);
 return bars.map((b,i)=>({t:b.t,ema20:e20[i],ema50:e50[i],rsi14:rs[i],atr14:at[i],macdHistogram:mac[i].histogram,macdLine:mac[i].line,macdSignal:mac[i].signal,...dmi[i]}));
}
export function indicatorSnapshot(bars){
 if(!Array.isArray(bars)||!bars.length)return null;
 const closes=bars.map(b=>b.c),last=bars.length-1,macd=macdSeries(closes),dmi=dmiSeries(bars)[last];
 return {t:bars[last].t,close:closes[last],ema20:emaSeries(closes,20)[last],ema50:emaSeries(closes,50)[last],
  rsi14:rsiSeries(closes,14)[last],atr14:atrSeries(bars,14)[last],macd:macd[last],
  diPlus:dmi.diPlus,diMinus:dmi.diMinus,adx14:dmi.adx,
  completeBars:bars.length,volumeSignalEnabled:false,tradeSignalsEnabled:false};
}
