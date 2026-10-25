// Crypto 1H exploratory backtest, separate from LIVE/READY.
const average=a=>a.reduce((s,v)=>s+v,0)/a.length;
function replay(bars,mode){
 const trades=[];let i=55;
 while(i<bars.length-13){
  const b=bars[i],prior=bars.slice(i-20,i),meanVol=average(prior.map(x=>x.v)),rvol=meanVol?b.v/meanVol:0;
  const base=average(prior.map(x=>x.c)),high=Math.max(...prior.map(x=>x.h));
  const obv=x=>x.slice(1).reduce((s,c,j)=>s+(c.c>x[j].c?c.v:c.c<x[j].c?-c.v:0),0);
  const accum=b.c>base&&rvol>=.35&&rvol<1.8&&obv(bars.slice(i-5,i+1))>Math.max(0,obv(bars.slice(i-11,i-5)));
  const breakout=b.c>high&&b.c>b.o&&rvol>=1.3,retest=b.c>base&&b.l<=base&&b.c>b.o&&rvol>=.9;
  const slowBase=average(bars.slice(i-50,i).map(x=>x.c));
  const v4Trend=base>slowBase&&b.c>base&&bars[i-1].c>slowBase;
  const v4Breakout=v4Trend&&breakout&&rvol>=1.5&&(b.c-base)/Math.max(0.00000001,average(prior.map(x=>x.h-x.l)))<3;
  const v4Retest=v4Trend&&retest&&b.c>bars[i-1].h&&rvol>=1.1;
  const signal=mode==='v4_breakout'?v4Breakout:mode==='v4_retest'?v4Retest:mode==='early'?accum:mode==='balanced'?((breakout||retest)&&rvol>=1.1):breakout&&rvol>=1.8;
  if(!signal){i++;continue;}
  const entry=bars[i+1].o,atr=average(prior.map(x=>x.h-x.l)),stop=entry-1.5*atr,target=entry+3*atr;
  if(!(entry>0&&atr>0&&1.5*atr/entry>=.005&&1.5*atr/entry<=.08)){i++;continue;}
  let exit=null,exitIndex=i+1,reason='TEMPS';
  for(let j=i+1;j<=Math.min(i+12,bars.length-1);j++){
   const x=bars[j];exitIndex=j;
   if(x.o<=stop){exit=x.o;reason='STOP GAP';break;}
   if(x.o>=target){exit=x.o;reason='TARGET GAP';break;}
   if(x.l<=stop){exit=stop;reason='STOP';break;}
   if(x.h>=target){exit=target;reason='TARGET';break;}
   exit=x.c;
  }
  const netPct=100*(exit/entry-1)-.4;
  trades.push({entryTime:new Date(bars[i+1].t*1000).toISOString(),exitTime:new Date(bars[exitIndex].t*1000).toISOString(),entry,exit,reason,netPct:+netPct.toFixed(2)});
  i=exitIndex+1;
 }
 const winners=trades.filter(t=>t.netPct>0),losers=trades.filter(t=>t.netPct<0),sum=x=>x.reduce((s,t)=>s+t.netPct,0);
 let equity=1,peak=1,maxDD=0;for(const t of trades){equity*=Math.max(0,1+t.netPct/100);peak=Math.max(peak,equity);maxDD=Math.max(maxDD,1-equity/peak)}
 return {mode,count:trades.length,winRatePct:trades.length?+(100*winners.length/trades.length).toFixed(1):null,averageNetPct:trades.length?+(sum(trades)/trades.length).toFixed(2):null,profitFactor:losers.length?+(sum(winners)/-sum(losers)).toFixed(2):null,returnPct:+(100*(equity-1)).toFixed(2),maxDrawdownPct:+(100*maxDD).toFixed(2),trades:trades.slice(-60)};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Només GET'});
 const symbol=String(req.query.symbol||'BTC').toUpperCase().trim();
 if(!/^[A-Z0-9]{2,12}$/.test(symbol))return res.status(400).json({error:'Símbol incorrecte'});
 try{
  const pair=symbol==='BTC'?'XBTUSD':symbol+'USD';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  let data;try{const r=await fetch('https://api.kraken.com/0/public/OHLC?pair='+encodeURIComponent(pair)+'&interval=60',{signal:controller.signal});if(!r.ok)throw Error('Kraken '+r.status);data=await r.json()}finally{clearTimeout(timer)}
  if(data.error?.length)throw Error(data.error.join(', '));
  const key=Object.keys(data.result||{}).find(k=>k!=='last'),now=Date.now();
  const bars=(data.result?.[key]||[]).map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[6]})).filter(x=>(x.t+3600)*1000<=now&&[x.o,x.h,x.l,x.c,x.v].every(Number.isFinite)&&x.c>0).sort((a,b)=>a.t-b.t);
  const timestamps=new Set(bars.map(x=>x.t));const duplicateCount=bars.length-timestamps.size;
  const gaps=bars.slice(1).filter((x,i)=>x.t-bars[i].t!==3600).length;
  const invalidOHLC=bars.filter(x=>!(x.o>0&&x.h>=Math.max(x.o,x.c,x.l)&&x.l<=Math.min(x.o,x.c))).length;
  if(duplicateCount||invalidOHLC)return res.status(422).json({error:'Espelmes duplicades o OHLC invàlid',duplicateCount,invalidOHLC});
  if(bars.length<125)return res.status(422).json({error:'Mostra insuficient',bars:bars.length});
  return res.status(200).json({symbol,source:'Kraken OHLC 1H',dataQuality:{source:'Kraken',timeframe:'1H',bars:bars.length,gaps,duplicateCount,invalidOHLC,coverageDays:Math.round((bars.at(-1).t-bars[0].t)/86400*10)/10,limitedHistory:true},bars:bars.length,firstBar:new Date(bars[0].t*1000).toISOString(),lastBar:new Date(bars.at(-1).t*1000).toISOString(),modes:['early','balanced','strict','v4_breakout','v4_retest'].map(x=>replay(bars,x)),warning:'Estudi exploratori 1H: NO equival al Pine 1D/4H/1H ni valida READY. Estima 0,4% costos per operació, stop primer quan stop/objectiu coincideixen. No inclou validació fora de mostra.'});
 }catch(e){return res.status(502).json({error:String(e.message||e)})}
}