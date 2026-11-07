// LONG AI SWING v5.29.1 parity engine (closed bars only).
// Bars: ascending [{o,h,l,c,v,t}], with d/h4/h1 all COMPLETED.
// No TradingView guarantee: feeds and EMA/ATR initialization may differ.
const ema=(a,n)=>{if(a.length<n)return [];const out=[];let v=a[0],k=2/(n+1);for(const x of a){v=x*k+v*(1-k);out.push(v)}return out};
const sma=(a,n)=>a.length>=n?a.slice(-n).reduce((s,v)=>s+v,0)/n:null;
const rsi=(a,n=14)=>{if(a.length<n+2)return [];let g=0,l=0;const out=Array(a.length).fill(null);for(let i=1;i<=n;i++){const d=a[i]-a[i-1];g+=Math.max(d,0);l+=Math.max(-d,0)}g/=n;l/=n;for(let i=n;i<a.length;i++){if(i>n){const d=a[i]-a[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n}out[i]=l===0?100:100-100/(1+g/l)}return out};
const atr=(b,n=14)=>{const tr=b.map((x,i)=>i?Math.max(x.h-x.l,Math.abs(x.h-b[i-1].c),Math.abs(x.l-b[i-1].c)):x.h-x.l);let v=tr[0];return tr.map((x,i)=>{v=i?(v*(n-1)+x)/n:v;return i>=n-1?v:null})};
const macdHist=a=>{const e12=ema(a,12),e26=ema(a,26),m=a.map((_,i)=>e12[i]-e26[i]),s=ema(m,9);return m.map((x,i)=>x-s[i])};
const dmi=(b,n=14)=>{let tr=0,p=0,m=0,adx=null;const dx=[];for(let i=1;i<b.length;i++){const x=b[i],z=b[i-1],up=x.h-z.h,dn=z.l-x.l;const t=Math.max(x.h-x.l,Math.abs(x.h-z.c),Math.abs(x.l-z.c));tr=i===1?t:(tr*(n-1)+t)/n;p=i===1?(up>dn&&up>0?up:0):(p*(n-1)+(up>dn&&up>0?up:0))/n;m=i===1?(dn>up&&dn>0?dn:0):(m*(n-1)+(dn>up&&dn>0?dn:0))/n;const dp=tr?100*p/tr:0,dm=tr?100*m/tr:0,d=dp+dm?100*Math.abs(dp-dm)/(dp+dm):0;dx.push(d);if(dx.length===n)adx=dx.reduce((s,y)=>s+y,0)/n;else if(dx.length>n)adx=(adx*(n-1)+d)/n;if(i===b.length-1)return {adx,diPlus:dp,diMinus:dm}}return {adx:null,diPlus:null,diMinus:null}};
const last=a=>a.at(-1);
const prev=a=>a.at(-2);
const ctx=b=>{if(b.length<55)return null;const a=b.map(x=>x.c),e20=ema(a,20),e50=ema(a,50),r=rsi(a);return {c:last(a),e20:last(e20),e20prev:prev(e20),e50:last(e50),rsi:last(r)}};
const ret=b=>b?.length>=22?100*(b.at(-1).c/b.at(-21).c-1):null;
const round=(v,n=2)=>Number.isFinite(v)?Math.round(v*10**n)/10**n:null;
const block=(name)=>({engine:'LONG AI SWING v5.29.1',status:'SENSE DADES',decision:'SENSE DADES',reason:name,readyA:false,readyB:false});
export function evaluate5291({daily=[],four=[],hour=[],marketDaily={},crypto=false,capitalEUR=15000,eurToQuote=null,marketEnabled=true,volumeMode='ADAPTATIU'}={}){
 if(hour.length<80||daily.length<55||four.length<55)return block('Històric insuficient 1H/4H/1D');
 const d=ctx(daily),h=ctx(four),f=ctx(hour),a=hour.map(x=>x.c),e20=ema(a,20),e50=ema(a,50),rs=rsi(a),hist=macdHist(a),ats=atr(hour),dm=dmi(hour),b=last(hour),p=prev(hour),n=a.length-1;
 if(!d||!h||!f||!Number.isFinite(last(ats))||!Number.isFinite(last(rs)))return block('Indicadors incomplets');
 const E=last(e20),ATR=last(ats),R=last(rs),H=last(hist),rv=sma(hour.slice(-20).map(x=>x.v),20),volumeOK=Number.isFinite(b.v)&&rv>0,relVol=volumeOK?b.v/rv:null;
 const dStrong=d.c>d.e20&&d.e20>d.e50,dRecover=d.c>d.e20&&d.rsi>=47&&d.e20>=d.e20prev,dOK=dStrong||dRecover;
 const hStrong=h.c>h.e20&&h.e20>h.e50,hRecover=h.c>h.e20&&h.e20>=h.e20prev,hOK=hStrong||hRecover;
 const benchmark=crypto?marketDaily.btc:marketDaily.qqq,spy=marketDaily.spy,qqq=marketDaily.qqq,btc=marketDaily.btc;
 const mStrong=crypto?!!btc&&btc.c>btc.e50:!!spy&&!!qqq&&spy.c>spy.e50&&qqq.c>qqq.e50;
 const mFlexible=crypto?!!btc&&btc.c>btc.e50*.97:!!spy&&!!qqq&&(spy.c>spy.e50||qqq.c>qqq.e50);
 const relativeStrength=benchmark&&Number.isFinite(benchmark.ret)&&Number.isFinite(ret(daily))?ret(daily)-benchmark.ret:null;
 const exceptionalRS=relativeStrength>=5&&hStrong&&dStrong;
 const recovery=!!btc&&btc.c>=btc.e50*.97&&exceptionalRS;
 const marketAOK=!marketEnabled||(crypto?(mStrong||recovery):(mStrong||exceptionalRS));
 const marketBOK=!marketEnabled||(crypto?(mFlexible):mFlexible);
 const strongCandle=b.c>b.o&&b.h>b.l&&(b.c-b.l)/(b.h-b.l)>=.65;
 const momentum=H>prev(hist)&&R>prev(rs);
 const safe=ATR>0&&(b.h-b.l)<=ATR*(crypto?3:2.2);
 const trend=E>last(e50)&&E>e20[n-3],slope=E>e20[n-1]&&e20[n-1]>=e20[n-2];
 const resistance=Math.max(...hour.slice(-11,-1).map(x=>x.h));
 const priorResistance=Math.max(...hour.slice(-12,-2).map(x=>x.h));
 const breakout=b.c>resistance&&p.c<=priorResistance;
 let lastBreak=-1,breakLevel=null;
 for(let i=n-1;i>=Math.max(11,n-7);i--){const lev=Math.max(...hour.slice(i-10,i).map(x=>x.h)),prevLev=Math.max(...hour.slice(i-11,i-1).map(x=>x.h));if(hour[i].c>lev&&hour[i-1].c<=prevLev){lastBreak=i;breakLevel=lev;break}}
 const retest=lastBreak>=0&&n-lastBreak>=1&&n-lastBreak<=6&&b.l<=breakLevel+ATR*.25&&b.c>breakLevel&&b.c>b.o;
 const pullback=Math.min(...hour.slice(-5).map((x,i)=>x.l-e20[n-4+i]))<=ATR*.3;
 const resume=b.c>p.h&&b.c>E&&strongCandle;
 const continuation=trend&&hStrong&&pullback&&resume&&momentum;
 const reclaim=b.c>E&&p.c<=e20[n-1]&&p.c<e20[n-1];
 const recoveryRSI=R>50&&prev(rs)<=50&&b.c>E;
 const earlyRecovery=reclaim||recoveryRSI||(slope&&pullback&&resume);
 const range8=arr=>Math.max(...arr.map(x=>x.h))-Math.min(...arr.map(x=>x.l));
 const ranges=hour.slice(-28).map((_,i)=>range8(hour.slice(hour.length-28+i-7,hour.length-28+i+1))).filter(Number.isFinite);
 const meanRange=ranges.length?sma(ranges,20):null;
 const compressed=last(ats)<sma(ats.slice(-20).filter(Number.isFinite),20)*.90||(meanRange>0&&range8(hour.slice(-8))<meanRange*.75);
 const earlyCompression=compressed&&b.c>E&&H>prev(hist)&&R>=48;
 const A=breakout||retest||continuation,B=earlyRecovery||earlyCompression;
 const altA=strongCandle&&momentum&&dm.adx>=19&&dm.diPlus>dm.diMinus&&R>=50&&b.c>E;
 const altB=strongCandle&&momentum&&dm.adx>=19&&dm.diPlus>dm.diMinus&&R>=48&&b.c>E;
 const volA=crypto?(volumeMode==='PREU I MOMENTUM'?altA:volumeMode==='ESTRICTE'?volumeOK&&relVol>=1:volumeOK?relVol>=1:altA):volumeOK&&relVol>=1;
 const volB=crypto?(volumeMode==='PREU I MOMENTUM'?altB:volumeMode==='ESTRICTE'?volumeOK&&relVol>=.75:volumeOK?relVol>=.75:altB):volumeOK&&relVol>=.75;
 const scoreA=(dStrong?15:dOK?8:0)+(hStrong?20:hOK?10:0)+(marketAOK?10:0)+(trend?10:0)+(R>=48&&R<=68?10:0)+(momentum?10:0)+(volA?10:0)+(A?10:0)+(dm.adx>=18&&dm.diPlus>dm.diMinus?5:0);
 const scoreB=(dOK?10:0)+(hOK?15:h.rsi>=45?8:0)+(marketBOK?10:0)+(R>=45&&R<=65?15:0)+(momentum?15:0)+(volB?10:0)+(B?15:0)+(b.c>E&&slope?10:0);
 const stop=Math.min(b.c-ATR*(crypto?2:1.5),Math.min(...hour.slice(-6,-1).map(x=>x.l))-ATR*.15);
 const stopPct=100*(b.c-stop)/b.c,stopOK=stop<b.c&&stopPct<=(crypto?7:3),stretch=(b.c-E)/ATR;
 const baseA=A&&hOK&&dOK&&marketAOK&&scoreA>=75&&volA&&R<=76&&safe&&b.c>E&&stretch>=0&&stretch<=1.6;
 const baseB=B&&(hOK||h.rsi>=45)&&dOK&&marketBOK&&scoreB>=65&&volB&&R<=70&&safe&&b.c>E&&stretch>=0&&stretch<=1;
 // Require verified FX conversion; do not silently assume EUR equals USD.
 const fx=Number.isFinite(eurToQuote)&&eurToQuote>0?eurToQuote:null;
 const risk=b.c-stop,pointValue=1,step=crypto?.000001:1;
 const qualityA=scoreA>=90?1:scoreA>=82?.85:.7,qualityB=scoreB>=85?1:scoreB>=75?.85:.7;
 const qtyFor=(pct,q)=>fx&&risk>0?Math.floor(Math.min(capitalEUR*fx*pct/100*q/risk,capitalEUR*fx*.25/b.c)/step)*step:0;
 const qtyA=qtyFor(.5,qualityA),qtyB=qtyFor(.25,qualityB);
 const readyA=baseA&&stopOK&&qtyA>=step,readyB=!readyA&&baseB&&stopOK&&qtyB>=step;
 const reason=!fx?'Falta canvi EUR/divisa':!dOK?'Context 1D feble':!hOK&&h.rsi<45?'Context 4H feble':!marketAOK&&!marketBOK?'Mercat desfavorable':!volA&&!volB?(volumeOK?'Volum insuficient':'Momentum sense volum insuficient'):!safe?'Espelma excessiva':!stopOK?'Stop supera limit':!A&&!B?'Falta patro':'Esperar confirmacio';
 const decision=readyA?'READY A':readyB?'READY B':baseA||baseB?'PRE-READY':(A&&scoreA>=60)||(B&&scoreB>=50)?'WATCH':'ESPERAR';
 const qty=readyA?qtyA:readyB?qtyB:0;
 return {engine:'LONG AI SWING v5.29.1',decision,status:decision,reason:readyA?'Entrada confirmada':readyB?'Entrada anticipada':reason,readyA,readyB,scoreA,scoreB,pattern:breakout?'RUPTURA':retest?'RETEST':continuation?'CONTINUACIO':earlyRecovery?'RECUPERACIO':earlyCompression?'COMPRESSIO':'--',price:b.c,entry:readyA||readyB?b.c:null,stop:readyA||readyB?round(stop,8):null,tp1:readyA||readyB?round(b.c+1.5*risk,8):null,tp2:readyA||readyB?round(b.c+3*risk,8):null,stopPct:round(stopPct),rvol:round(relVol),rsi:round(R),marketAOK,marketBOK,dailyOK:dOK,fourOK:hOK,volumeStatus:volumeOK?'VOLUM '+round(relVol)+'x':crypto?'SENSE VOLUM · ALTERNATIU':'SENSE VOLUM',quantity:qty,investmentEUR:fx?round(qty*b.c/fx):null,riskEUR:fx?round(qty*risk/fx):null,relativeStrength:round(relativeStrength),dataStatus:'DADES OK',barTime:b.t,verifiedAgainstTradingView:false};
}
export function benchmark5291(bars){const c=ctx(bars);return c?{...c,ret:ret(bars)}:null}
