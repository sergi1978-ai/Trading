// Diagnostic-only momentum module. No change to execution authorization.
// EMA200 requires at least 200 fully closed candles; MACD requires >=35.
function emaSeries(v,n){if(v.length<n)return [];const out=[];let e=v.slice(0,n).reduce((a,b)=>a+b,0)/n;for(let i=n-1;i<v.length;i++){if(i>n-1)e+=(v[i]-e)*2/(n+1);out.push(e)}return out}
function last(x){return x.length?x[x.length-1]:null}
export function momentumDiagnostic(bars,market='crypto'){
 const prices=bars.map(x=>x.c).filter(Number.isFinite),count=prices.length;
 if(count<55)return {available:false,candles:count,reason:'Menys de 55 espelmes tancades'};
 const e20=emaSeries(prices,20),e50=emaSeries(prices,50),e200=emaSeries(prices,200);
 const aligned=count>=200&&last(e20)>last(e50)&&last(e50)>last(e200);
 const emaCross=(()=>{const offset20=count-e20.length,offset50=count-e50.length;for(let i=count-1;i>=Math.max(50,count-5);i--){const a=e20[i-offset20],b=e50[i-offset50],ap=e20[i-1-offset20],bp=e50[i-1-offset50];if([a,b,ap,bp].every(Number.isFinite)&&ap<=bp&&a>b)return 'ALCISTA';if([a,b,ap,bp].every(Number.isFinite)&&ap>=bp&&a<b)return 'BAIXISTA'}return 'CAP RECENT'})()
 const e12=emaSeries(prices,12),e26=emaSeries(prices,26);let macd=null,signal=null,hist=null,macdCross='SENSE DADES';
 if(count>=35){const line=[];for(let i=25;i<count;i++)line.push(e12[i-11]-e26[i-25]);const sig=emaSeries(line,9);macd=last(line);signal=last(sig);hist=macd-signal;if(sig.length>1){const prevHist=line.at(-2)-sig.at(-2);macdCross=prevHist<=0&&hist>0?'ALCISTA':prevHist>=0&&hist<0?'BAIXISTA':'CAP RECENT'}}
 const changes=prices.slice(-15).map((v,i,a)=>i?v-a[i-1]:0).slice(1),up=changes.reduce((a,v)=>a+Math.max(v,0),0)/14,down=changes.reduce((a,v)=>a+Math.max(-v,0),0)/14;
 const rsi=down===0?100:100-100/(1+up/down);
 // Interpretation bands differ by market, but do not affect READY.
 const rsiTone=market==='crypto'?(rsi>=55&&rsi<=75?'positive':rsi<40?'negative':'neutral'):(rsi>=50&&rsi<=70?'positive':rsi<45?'negative':'neutral');
 const histPrevious=count>=35&&emaSeries( prices,12).length>0?(()=>{const line=[];for(let i=25;i<count;i++)line.push(e12[i-11]-e26[i-25]);const sig=emaSeries(line,9);return sig.length>1?line.at(-2)-sig.at(-2):null})():null;
 const macdTone=hist>0&&macdCross!=='BAIXISTA'?'positive':hist<0?'negative':'neutral';
 return {available:true,candles:count,market,lastClose:last(prices),histPrevious,ema20:last(e20),ema50:last(e50),ema200:last(e200),ema200Available:count>=200,emaAligned:count>=200?aligned:null,emaCross5:emaCross,macd,macdSignal:signal,macdHistogram:hist,macdCross,rsi14:rsi,rsiTone,macdTone,interpretation:market==='crypto'?'24/7 · amplitud de RSI més alta':'Sessions de borsa · gaps i volum IEX parcial',diagnosticOnly:true};
}
export function momentumPhase(m){
 if(!m?.available||![m.macd,m.macdHistogram,m.ema20,m.ema50,m.lastClose].every(Number.isFinite))return 'SENSE DADES';
 if(m.macd>0&&m.macdHistogram>0&&m.lastClose>m.ema20)return 'IMPULS ALCISTA';
 if(m.macd<0&&m.macdHistogram>0&&m.histPrevious!==null&&m.macdHistogram>m.histPrevious&&m.lastClose>m.ema20)return 'RECUPERACIO INICIAL';
 if(m.macd>0&&m.histPrevious!==null&&m.macdHistogram<m.histPrevious)return 'PERDUA IMPULS';
 if(m.macd<0&&m.macdHistogram<0&&m.lastClose<m.ema20&&m.lastClose<m.ema50)return 'DEBILITAT BAIXISTA';
 return 'TRANSICIO / MIXT';
}
export function momentumContext(m){
 const w=m?.week,d=m?.day,f=m?.four,h=m?.hour;
 if(w?.weeklyTrend==='ALCISTA'&&d?.macdHistogram<0&&f?.macdHistogram<0)return 'CORRECCIO / DETERIORAMENT';
 if(w?.weeklyTrend==='BAIXISTA'&&h?.macdHistogram>0)return 'REBOT CONTRA TENDENCIA';
 if(d?.macdHistogram<0&&f?.macdHistogram<0)return 'DEBILITAT MULTITEMPORAL';
 return 'SENSE CONFLICTE CLAR';
}
export function earlyMomentumTurn(m,market='stock'){
 const d=m?.day,f=m?.four;
 return Boolean(d?.available&&f?.available&&Number.isFinite(d.histPrevious)&&Number.isFinite(f.histPrevious)&&d.macdHistogram>d.histPrevious&&f.macdHistogram>f.histPrevious&&d.rsi14>(market==='crypto'?48:46)&&d.lastClose>d.ema20);
}

export function weeklyDiagnostic(dailyBars,market='stock'){
 const weeks=new Map();
 for(const b of dailyBars){
  const d=new Date(typeof b.t==='number'?(b.t<1e11?b.t*1000:b.t):b.t);
  if(!Number.isFinite(d.getTime())||!Number.isFinite(b.c))continue;
  const day=d.getUTCDay(),monday=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(day+6)%7));
  const key=monday.toISOString().slice(0,10);
  weeks.set(key,{c:b.c,t:key});
 }
 // Exclude the current incomplete calendar week. Conservative for stock/crypto.
 const now=new Date(),wd=now.getUTCDay(),currentMonday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-(wd+6)%7)).toISOString().slice(0,10);
 const closed=[...weeks].filter(([k])=>k<currentMonday).sort((a,b)=>a[0].localeCompare(b[0])).map(([,b])=>b);
 if(closed.length<55)return {available:false,candles:closed.length,reason:'Menys de 55 setmanes completes',diagnosticOnly:true};
 const info=momentumDiagnostic(closed,market),lastClose=closed.at(-1).c;
 return {...info,timeframe:'1W',lastClose,weeklyTrend:lastClose>info.ema20&&info.ema20>info.ema50?'ALCISTA':lastClose<info.ema20&&info.ema20<info.ema50?'BAIXISTA':'MIXTA',diagnosticOnly:true};
}
