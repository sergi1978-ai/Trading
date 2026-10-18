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
 const macdTone=hist>0&&macdCross!=='BAIXISTA'?'positive':hist<0?'negative':'neutral';
 return {available:true,candles:count,market,ema20:last(e20),ema50:last(e50),ema200:last(e200),ema200Available:count>=200,emaAligned:count>=200?aligned:null,emaCross5:emaCross,macd,macdSignal:signal,macdHistogram:hist,macdCross,rsi14:rsi,rsiTone,macdTone,interpretation:market==='crypto'?'24/7 · amplitud de RSI més alta':'Sessions de borsa · gaps i volum IEX parcial',diagnosticOnly:true};
}