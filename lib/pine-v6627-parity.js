// Reproduce the CORE confirmed-entry gates of LONG AI ASSISTANT v6.6.27.
// On a 1H chart, request.security(HTF, expr[1], lookahead_on) exposes only
// the previous HTF candle at the OPEN of the 1H bar, even when evaluated
// at the 1H close. No trading orders or production dependencies.
// Inputs: sorted, closed OHLCV bars with t AND endExclusive (ISO strings).
const ms = value => Date.parse(value);
function sortedBars(bars, label) {
 if(!Array.isArray(bars))throw Error(label+' must be an array');
 const x=[...bars].sort((a,b)=>ms(a.t)-ms(b.t));
 for(let i=0;i<x.length;i++){
  const b=x[i];
  if(!Number.isFinite(ms(b.t))||!Number.isFinite(ms(b.endExclusive))||ms(b.endExclusive)<=ms(b.t)||
    ![b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)||b.o<=0||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h)||b.v<0||
    (i>0&&ms(x[i-1].endExclusive)>ms(b.t)))throw Error('Invalid '+label+' OHLCV/timestamp');
 }
 return x;
}
const last=x=>x.at(-1);
const max=(a,key)=>a.length?Math.max(...a.map(key)):null;
const min=(a,key)=>a.length?Math.min(...a.map(key)):null;
// Pine ta.ema: seed with first non-na observation (not SMA of first N).
export function pineEma(values,length){
 if(!Number.isInteger(length)||length<1)throw Error('Invalid EMA length');
 let e=null,n=0;
 for(const value of values){
  if(!Number.isFinite(value))continue;
  e=e===null?value:(value-e)*(2/(length+1))+e;
  n++;
 }
 return n>=length?e:null;
}
export function pineAtr(bars,length=14){
 const tr=bars.map((b,i)=>i===0?b.h-b.l:Math.max(b.h-b.l,Math.abs(b.h-bars[i-1].c),Math.abs(b.l-bars[i-1].c)));
 if(tr.length<length)return null;
 // Pine ta.rma (ta.atr) seeds with SMA of the first length TR values.
 let a=tr.slice(0,length).reduce((x,y)=>x+y,0)/length;
 for(let i=length;i<tr.length;i++)a=(a*(length-1)+tr[i])/length;
 return a;
}
function plan(entry,stop,ceilingContext,tick,{costReserve,targetR,minRR,maxStopPct,maxExtATR}){
 const {resistance,atr1,e4,atr4}=ceilingContext;
 if(![entry,stop,atr1,e4,atr4].every(Number.isFinite)||!(entry>stop&&stop>0&&tick>0))return {valid:false,rr:null,reason:'DATA'};
 const risk=entry-stop,cost=entry*costReserve/100;
 const overhead=resistance>entry+tick?resistance:null;
 const goal=overhead===null?entry+targetR*risk:Math.min(entry+targetR*risk,overhead);
 const rr=(goal-entry-cost)/(risk+cost);
 const ceilingRR=(goal+minRR*stop)/(1+minRR+(1+minRR)*costReserve/100);
 const ceiling=Math.min(ceilingRR,entry+atr1*.15,e4+maxExtATR*atr4);
 return {valid:risk>tick&&risk/entry*100<=maxStopPct&&rr>=minRR&&ceiling>=entry,rr,goal,ceiling,entry,stop};
}
export function pineV6627Core({hourly,fourHour,daily,hourOpen,tickSize=0.01,options={}}){
 const h=sortedBars(hourly,'1H'),f=sortedBars(fourHour,'4H'),d=sortedBars(daily,'1D');
 const open=ms(hourOpen);
 if(!Number.isFinite(open))throw Error('Invalid hourOpen');
 const idx=h.findIndex(b=>ms(b.t)===open);
 if(idx<0)throw Error('Missing confirmed 1H candle');
 const active=h[idx];
 const hourContext=h.slice(0,idx+1);
 const fourContext=f.filter(b=>ms(b.endExclusive)<=open);
 const dayContext=d.filter(b=>ms(b.endExclusive)<=open);
 // HTF bar closing at current 1H close remains excluded until NEXT 1H opens.
 const at={hourOpen:active.t,hourEnd:active.endExclusive,
   fourLast:fourContext.at(-1)?.t||null,dayLast:dayContext.at(-1)?.t||null,
   fourEnd:fourContext.at(-1)?.endExclusive||null,dayEnd:dayContext.at(-1)?.endExclusive||null};
 const c={baseBars:8,baseMaxATR:4,breakRVOL:1.1,pullRVOL:.8,maxExtATR:2,
  stopBuffer:.2,minRR:2,targetR:2.5,maxStopPct:10,minTurnover:1000000,costReserve:.4,...options};
 const pending=reason=>({ready:false,buyBreak:false,buyPull:false,hasPlan:false,reason,at});
 if(hourContext.length<21||fourContext.length<60||dayContext.length<62)return pending('INSUFFICIENT_HISTORY');
 const x=last(hourContext),prev=hourContext.at(-2),F=last(fourContext),D=last(dayContext);
 const a4=pineAtr(fourContext),a1=pineAtr(hourContext),e4=pineEma(fourContext.map(b=>b.c),20);
 const slow4=pineEma(fourContext.map(b=>b.c),50);
 const de50=pineEma(dayContext.map(b=>b.c),50),de50prev=pineEma(dayContext.slice(0,-1).map(b=>b.c),50);
 const turnover=dayContext.slice(-20).reduce((sum,b)=>sum+b.c*b.v,0)/20;
 const resistance=max(dayContext.slice(-60),b=>b.h);
 const base=fourContext.slice(-c.baseBars),wide=fourContext.slice(-c.baseBars*3);
 const baseHigh=max(base,b=>b.h),baseLow=min(base,b=>b.l);
 const wideRange=max(wide,b=>b.h)-min(wide,b=>b.l);
 const baseOK=baseHigh-baseLow<=c.baseMaxATR*a4&&baseHigh-baseLow<=wideRange*.75;
 const avgVol=hourContext.slice(-21,-1).reduce((sum,b)=>sum+b.v,0)/20;
 const rvol=avgVol>0?x.v/avgVol:null;
 const recentLow=min(hourContext.slice(-3),b=>b.l);
 const low3=min(fourContext.slice(-3),b=>b.l),low6=min(fourContext.slice(-6),b=>b.l);
 const trendDaily=D.c>de50&&de50>=de50prev,trendFour=F.c>slow4&&e4>slow4;
 const liquidOK=turnover>=c.minTurnover,extensionOK=x.c<=e4+c.maxExtATR*a4;
 const ctxOK=trendDaily&&trendFour&&liquidOK&&extensionOK;
 const breakTrigger=baseHigh+tickSize,pullTrigger=Math.max(prev.h+tickSize,e4);
 const breakStop=low6-a4*c.stopBuffer,pullStop=Math.min(low3,recentLow)-a4*c.stopBuffer;
 const pullLocation=recentLow<=e4+a4*.25&&recentLow>=slow4-a4*.5;
 const context={resistance,atr1:a1,e4,atr4:a4};
 const breakPending=plan(breakTrigger,breakStop,context,tickSize,c);
 const pullPending=plan(pullTrigger,pullStop,context,tickSize,c);
 const breakAtClose=plan(x.c,breakStop,context,tickSize,c);
 const pullAtClose=plan(x.c,pullStop,context,tickSize,c);
 const breakEvent=baseOK&&x.c>breakTrigger&&prev.c<=breakTrigger&&x.c>x.o;
 const pullEvent=pullLocation&&x.c>pullTrigger&&x.c>x.o;
 // Pine buyBreak/buyPull use CLOSE-priced plans, not pending-trigger plans.
 const buyBreak=ctxOK&&breakEvent&&rvol!==null&&rvol>=c.breakRVOL&&breakAtClose.valid;
 const buyPull=ctxOK&&pullEvent&&rvol!==null&&rvol>=c.pullRVOL&&pullAtClose.valid;
 const breakReady=ctxOK&&baseOK&&breakPending.valid;
 const pullReady=ctxOK&&pullLocation&&pullPending.valid;
 return {at,ready:buyBreak||buyPull,buyBreak,buyPull,hasPlan:breakReady||pullReady,
  checks:{trendDaily,trendFour,liquidOK,extensionOK,baseOK,pullLocation,breakEvent,pullEvent},
  rvol,trendData:{dClose:D.c,dEma50:de50,c4:F.c,e4,slow4,atr4:a4},
  plans:{breakPending,pullPending,breakAtClose,pullAtClose},
  triggers:{breakTrigger,pullTrigger},stops:{breakStop,pullStop},reason:buyBreak||buyPull?'READY_CONFIRMED':'NOT_CONFIRMED'};
}
