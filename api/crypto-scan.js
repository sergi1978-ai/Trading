// Trading 2026 v2.8 - crypto technical screening; closed candles only.
// Coinbase Exchange public candles (300 max/request), Kraken OHLC fallback.
const TIMEOUT=8500;
async function json(url){const a=new AbortController(),t=setTimeout(()=>a.abort(),TIMEOUT);try{const r=await fetch(url,{signal:a.signal,headers:{Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
function normalizeCoinbase(raw,sec){const now=Date.now();return (Array.isArray(raw)?raw:[]).map(x=>({t:x[0]*1000,l:x[1],h:x[2],o:x[3],c:x[4],v:x[5]})).filter(x=>x.t+sec*1000<=now&&[x.o,x.h,x.l,x.c,x.v].every(Number.isFinite)&&x.c>0).sort((a,b)=>a.t-b.t)}
async function getCoinbase(pair,seconds){const end=new Date(),start=new Date(end.getTime()-seconds*1000*285);const url='https://api.exchange.coinbase.com/products/'+encodeURIComponent(pair)+'/candles?granularity='+seconds+'&start='+encodeURIComponent(start.toISOString())+'&end='+encodeURIComponent(end.toISOString());const rows=normalizeCoinbase(await json(url),seconds);if(rows.length<45)throw Error('Coinbase: espelmes insuficients');return rows}
async function getKraken(base,min){const pair=base==='BTC'?'XBTUSD':base+'USD';const r=await json('https://api.kraken.com/0/public/OHLC?pair='+encodeURIComponent(pair)+'&interval='+min);if(r.error?.length)throw Error(r.error.join(' | '));const key=Object.keys(r.result||{}).find(k=>k!=='last');if(!key)throw Error('Kraken: parell sense dades');const now=Date.now();return (r.result[key]||[]).map(x=>({t:Number(x[0])*1000,o:Number(x[1]),h:Number(x[2]),l:Number(x[3]),c:Number(x[4]),v:Number(x[6])})).filter(x=>x.t+min*60000<=now&&[x.o,x.h,x.l,x.c,x.v].every(Number.isFinite)&&x.c>0).sort((a,b)=>a.t-b.t)}
async function candles(symbol,sec){let errors=[];for(const q of [symbol+'-USD',symbol+'-USDC']){try{return {rows:await getCoinbase(q,sec),source:'Coinbase',pair:q}}catch(e){errors.push(e.message)}}try{return {rows:await getKraken(symbol,sec/60),source:'Kraken',pair:symbol+'/USD'}}catch(e){throw Error(errors.join('; ')+'; '+e.message)}}
function ema(a,n){if(a.length<n)return null;let e=a.slice(0,n).reduce((s,x)=>s+x,0)/n;for(let i=n;i<a.length;i++)e+=2/(n+1)*(a[i]-e);return e}
function rsi(a,n=14){if(a.length<n+1)return null;const dif=a.slice(-n-1).map((x,i)=>i?x-a[a.length-n-2+i]:null).slice(1);const gain=dif.reduce((s,x)=>s+Math.max(x,0),0)/n,loss=dif.reduce((s,x)=>s+Math.max(-x,0),0)/n;return loss===0?100:100-100/(1+gain/loss)}
function atr(a,n=14){if(a.length<n+1)return null;const q=a.slice(-n-1),z=q.slice(1).map((x,i)=>Math.max(x.h-x.l,Math.abs(x.h-q[i].c),Math.abs(x.l-q[i].c)));return z.reduce((s,x)=>s+x,0)/n}
function calc(a){const c=a.at(-1),cl=a.map(x=>x.c),vol=a.slice(-21,-1),avgVol=vol.length===20?vol.reduce((s,x)=>s+x.v,0)/20:null;return {c:c.c,ema20:ema(cl,20),ema50:ema(cl,50),rsi:rsi(cl),atr:atr(a),rvol:avgVol>0?c.v/avgVol:null}}
function scanOne(symbol,pack){
 const {daily:D,four:H,hour:F,half:M}=pack;const d=D.rows,h=H.rows,f=F.rows,m=M.rows;
 if([d,h,f,m].some(x=>x.length<55))throw Error('Històric insuficient 1D/4H/1H/30m');
 const a=calc(d),b=calc(h),c=calc(f),z=calc(m),last=f.at(-1),prior=f.slice(-13,-1),hi=Math.max(...prior.map(x=>x.h)),lo=Math.min(...prior.map(x=>x.l));
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
 const momentum=c.rsi>=48&&c.rsi<=72,trend=dailyTrend&&fourTrend,volumeOk=c.rvol>=1.05&&!bearish,liquid=d.slice(-20).reduce((sum,x)=>sum+x.c*x.v,0)/20>=1000000;
 const canPlan=trigger!==null&&risk>0&&stopPct<=10;
 let status='WATCH',reason='Sense configuració de compra validada';
 if(extended||stopPct>10){status='NO PERSEGUIR';reason='Sobreextensió o stop massa distant'}
 else if(weak){status='PRE-SETUP DEBILITAT';reason='Allunyament del trigger i debilitat'}
 else if(trend&&momentum&&volumeOk&&liquid&&canPlan&&(breakUp||retest||near)){
 status=breakUp||retest&&c.rvol>=1.35?'PRE-READY':'PRE-SETUP';
 reason='Configuració orientativa: pendent confirmació al Pine';
 }
 const score=Math.round(Math.min(100,(dailyTrend?20:0)+(fourTrend?20:0)+(momentum?15:0)+(volumeOk?15:0)+(liquid?10:0)+(canPlan?10:0)+((breakUp||retest||near)?10:0)-(extended?20:0)));
 return {symbol,type:'cripto',status,reason,source:[D,H,F,M].map(x=>x.source).join('/'),pair:F.pair,price:last.c,quoteTime:new Date(last.t).toISOString(),timeframe:'1H tancada',pattern,score,trigger,stop,tp1:target,tp2,riskPct:stopPct,rr:target&&risk>0?(target-trigger)/risk:null,rvol:c.rvol,volumeDirection:bearish?'BAIXISTA FORT':last.c<last.o?'BAIXISTA':'ALCISTA',rsi:c.rsi,ema20:c.ema20,trend1D:dailyTrend,trend4H:fourTrend,liquid,extended,coverage:{day:d.length,four:h.length,hour:f.length,half:m.length},verifiedSignal:false,warning:'Senyal web orientatiu; no equivalent al Pine. TP són projeccions R/R, no resistències validades.'}
}
async function single(s){const [daily,four,hour,half]=await Promise.all([candles(s,86400),candles(s,21600),candles(s,3600),candles(s,1800)]);return scanOne(s,{daily,four,hour,half})}
export default async function handler(req,res){const syms=String(req.query.symbols||'BTC,ETH,SOL,ONDO,LINK,RENDER,HYPE,AAVE,NEAR,SUI').toUpperCase().split(',').map(x=>x.trim()).filter(x=>/^[A-Z0-9]{2,12}$/.test(x)).slice(0,10);const result=[],errors=[];for(let i=0;i<syms.length;i+=2){await Promise.all(syms.slice(i,i+2).map(async s=>{try{result.push(await single(s))}catch(e){errors.push({symbol:s,message:e.message})}}))}res.setHeader('Cache-Control','no-store');return res.status(200).json({results:result,errors,generatedAt:new Date().toISOString(),warning:'Dades de tancaments; revisa a TradingView abans de cap ordre.'})}
