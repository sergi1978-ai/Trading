// LONG AI PROFIT v1.0 — experimental A/B/C closed-candle signal generator.
// Fixed parameters, separate strategies and fixed stops. NO tuning on test data.
import {pineEma,pineAtr} from './pine-v6627-parity.js';
import {PROFIT_STRATEGIES} from './profit-simulator.js';
const last=a=>a.at(-1);
const highest=(a,k='h')=>a.length?Math.max(...a.map(x=>x[k])):null;
const lowest=(a,k='l')=>a.length?Math.min(...a.map(x=>x[k])):null;
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function rsi(close,len=14){
 if(close.length<len+1)return null;
 let gains=0,losses=0;
 for(let i=1;i<=len;i++){const change=close[i]-close[i-1];gains+=Math.max(change,0);losses+=Math.max(-change,0);}
 let up=gains/len,down=losses/len;
 for(let i=len+1;i<close.length;i++){const d=close[i]-close[i-1];up=(up*(len-1)+Math.max(d,0))/len;down=(down*(len-1)+Math.max(-d,0))/len;}
 return down===0?100:100-100/(1+up/down);
}
function percentile(a,percent){
 if(!a.length)return null;
 const x=[...a].sort((l,r)=>l-r);
 return x[Math.max(0,Math.ceil(percent/100*x.length)-1)];
}
function bollingerWidth(bars){
 const x=bars.slice(-20).map(b=>b.c);
 if(x.length<20)return null;
 const mean=avg(x),dev=Math.sqrt(avg(x.map(z=>(z-mean)**2)));
 return mean>0?4*dev/mean:null;
}
const ms=x=>Date.parse(x);
function validated(bars,label){
 if(!Array.isArray(bars)||!bars.length)throw Error(label+' OHLCV required');
 let end=-Infinity;
 for(const b of bars){
  const t=ms(b.t),e=ms(b.endExclusive);
  if(!Number.isFinite(t)||!Number.isFinite(e)||e<=t||t<end||
     ![b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)||
     b.o<=0||b.l<=0||b.v<0||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h))
   throw Error('Invalid closed candles: '+label);
  end=e;
 }
 return bars;
}
export function generateProfitSignals({symbol,market='CRYPTO',hourly,fourHour,daily,
 tickSize=.01,volumeApproved=false}={}){
 if(!symbol||!['STOCK','CRYPTO'].includes(market)||!Number.isFinite(tickSize)||tickSize<=0)throw Error('Invalid market config');
 const hour=validated(hourly,'1H'),four=validated(fourHour,'4H'),day=validated(daily,'1D');
 if(!volumeApproved)return {signals:[],diagnostics:{symbol,approved:false,reason:'VOLUME_FEED_UNVERIFIED'},counts:Object.fromEntries(PROFIT_STRATEGIES.map(s=>[s,0]))};
 const signals=[],rejections={insufficientHistory:0,liquidity:0,noSetup:0};
 // Diagnostic funnel counts 1H evaluation bars, NOT independent trades.
 const breakoutFunnel={eligibleHourBars:0,hasBreakoutInPrevious6FourHour:0,
  favorableDailyAndFourHour:0,retestZoneTouched:0,
  bullishHourAndVolume:0,invalidStopOrRisk:0,blockedByDailyResistance:0,riskQualifiedSignals:0};
 for(let i=0;i<hour.length;i++){
  const chart=hour[i],anchor=ms(chart.t);
  // Pine higher-TF security(expr[1],lookahead_on): only HTF closed by 1H OPEN.
  const f=four.filter(b=>ms(b.endExclusive)<=anchor);
  const d=day.filter(b=>ms(b.endExclusive)<=anchor);
  if(i<50||f.length<160||d.length<65){rejections.insufficientHistory++;continue;}
  const h=hour.slice(0,i+1),hClose=h.map(b=>b.c),fClose=f.map(b=>b.c),dClose=d.map(b=>b.c);
  const f4=last(f),di=last(d),prior=hour[i-1],a4=pineAtr(f);
  const e20four=pineEma(fClose,20),e50four=pineEma(fClose,50);
  const d50=pineEma(dClose,50),d20=pineEma(dClose,20),d50old=pineEma(dClose.slice(0,-5),50);
  const h20=pineEma(hClose,20),rsi1=rsi(hClose);
  const rvolBase=avg(h.slice(-21,-1).map(b=>b.v)),rv=rvolBase>0?chart.v/rvolBase:null;
  const avgDollars=avg(d.slice(-20).map(b=>b.c*b.v));
  if(!(a4>0)||!Number.isFinite(rsi1)||!Number.isFinite(rv)||!(avgDollars>=1e6)){
   rejections.liquidity++;continue;
  }
  const dailyUp=di.c>d50&&d20>d50&&d50>d50old;
  const fourUp=f4.c>e50four&&e20four>e50four;
  const noChase=chart.c<=e20four+2*a4;
  if(!noChase){rejections.noSetup++;continue;}
  breakoutFunnel.eligibleHourBars++;
  const context=market==='CRYPTO'?{baseline:'COINBASE_BTCUSD'}:{baseline:'NYSE_RTH'};
  function signal(strategy,trigger,stop,limitR=2){
   const risk=trigger-stop;
   if(!(stop>0&&risk>tickSize&&risk/trigger<=.10))return 'STOP_INVALID';
   // Target modeled in simulator at 3R; require >=2R room if previous D resistance overhead.
   const overhead=highest(d.slice(-60));
   if(overhead>trigger+tickSize&& (overhead-trigger-trigger*.002)/(risk+trigger*.002)<limitR)return 'RR_BLOCKED';
   signals.push({strategyId:strategy,symbol,market,signalTime:chart.endExclusive,
     entryTrigger:trigger,initialStop:stop,atr4h:a4,
     validHours:3,maxEntryPrice:trigger+.2*a4,
     source:context.baseline,closedContext:{dayEnd:last(d).endExclusive,fourEnd:last(f).endExclusive}});
   return 'ACCEPTED';
  }
  const six=f.slice(-6),min6=lowest(six);
  const zone=min6<=e20four+.25*a4&&min6>=e50four-.5*a4;
  if(dailyUp&&fourUp&&zone&&chart.c>h20&&chart.c>prior.h&&rsi1>50&&rv>=1.1)
   signal('TREND_PULLBACK',chart.h+tickSize,Math.min(min6,chart.l)-.2*a4);
  // Breakout must already be confirmed on a closed 4H, followed by 1H retest.
  let breakLevel=null;
  for(let k=Math.max(20,f.length-6);k<f.length;k++){
   const res=highest(f.slice(k-20,k));
   const meanVol=avg(f.slice(k-20,k).map(b=>b.v));
   if(f[k].c>res&&meanVol>0&&f[k].v/meanVol>=1.3)breakLevel=res;
  }
  if(breakLevel!==null){
   breakoutFunnel.hasBreakoutInPrevious6FourHour++;
   if(di.c>d50&&fourUp){
    breakoutFunnel.favorableDailyAndFourHour++;
    if(chart.l<=breakLevel+.35*a4&&chart.l>=breakLevel-.35*a4){
     breakoutFunnel.retestZoneTouched++;
     if(chart.c>breakLevel&&chart.c>chart.o&&chart.c>prior.h&&rv>=1.1){
      breakoutFunnel.bullishHourAndVolume++;
      const gate=signal('BREAKOUT_RETEST',chart.h+tickSize,
         Math.min(chart.l,lowest(f.slice(-6)))-.2*a4);
      if(gate==='ACCEPTED')breakoutFunnel.riskQualifiedSignals++;
      else if(gate==='STOP_INVALID')breakoutFunnel.invalidStopOrRisk++;
      else if(gate==='RR_BLOCKED')breakoutFunnel.blockedByDailyResistance++;
     }
    }
   }
  }
  // 4H volatility squeeze: 20th-percentile of last 120 closed 4H widths.
  const widths=[];
  for(let j=f.length-120;j<f.length;j++){
   const width=bollingerWidth(f.slice(j-19,j+1));
   if(Number.isFinite(width))widths.push(width);
  }
  const currentWidth=widths.at(-1),threshold=percentile(widths,20);
  const lowRecent=lowest(f.slice(-6)),lowPrevious=lowest(f.slice(-12,-6));
  const compression=widths.length===120&&currentWidth<threshold&&lowRecent>=lowPrevious;
  const firstImpulse=chart.c>highest(h.slice(-9,-1))&&chart.c>chart.o&&rsi1>=50&&rsi1<=72&&rv>=1.5;
  if(compression&&firstImpulse&&di.c>d50*.94&&f4.c>e50four*.97)
   signal('EARLY_EXPANSION',chart.h+tickSize,Math.min(lowRecent,lowest(h.slice(-8)))-.2*a4);
 }
 const counts=Object.fromEntries(PROFIT_STRATEGIES.map(s=>[s,signals.filter(x=>x.strategyId===s).length]));
 return {signals,counts,diagnostics:{symbol,market,approved:true,...rejections,
   breakoutFunnel,note:'Signal timestamps are 1H CLOSE; higher timeframes are from the 1H OPEN, not later.'}};
}
