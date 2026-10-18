import {loadPaper,savePaper} from './_paper-store.js';
const STOCKS=['UBER','CRM','NOW','ABBV','MU','ANET','SNOW','FTNT','PANW','VLO','LLY','NFLX','PLTR','MRVL','FSLR','CF','INTU','COHR','CEG','OKLO','EME'];
const COINS=['BTC','ETH','SOL','NEAR','LINK','ONDO','AAVE','RENDER','TAO','FIL','SUI','INJ','HYPE','PYTH','HBAR','XRP','FET','STX','JASMY','ENA','MORPHO','AKT','TIA','BNB'];
const STOCK_BATCH=6, CRYPTO_BATCH=6;
function rotatingBatch(items,cursor,size){return Array.from({length:Math.min(items.length,size)},(_,i)=>items[(cursor+i)%items.length]);}
const json=async(res)=>{const data=await res.json();if(!res.ok)throw Error(data.error||'Provider '+res.status);return data};
async function getResults(origin,path){const r=await fetch(origin+path,{cache:'no-store',headers:{'X-Paper-Internal':process.env.PAPER_INTERNAL_SECRET||''}});return json(r)}
const n=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
function cryptoCandidate(r){
 const price=n(r.price),entry=n(r.pineReferenceEntry),stop=n(r.pineReferenceStop),valid=r.pineSignalCandidate===true&&r.operationalDecision==='REVISAR ENTRADA'&&r.planAvailable===true&&r.criticalBlocks?.length===0;
 return {market:'crypto',symbol:r.symbol,price,entry,stop,ready:valid,stamp:r.quoteTime,phase:r.pineState||r.status||'SENSE DADES',potential:n(r.anticipationScore),quality:n(r.operationalQuality),reason:r.primaryBlocker||r.operationalDecision};
}
function stockCandidate(r,q){
 const price=n(q?.extendedPrice),entry=n(r.trigger),stop=n(r.stop),age=n(q?.extendedAgeMinutes);
 const coherent=price>0&&n(r.technicalPrice)>0&&Math.abs(price/r.technicalPrice-1)<=.05&&r.priceBasis==='SPLIT_ADJUSTED';
 const valid=!!(r.pineEntryConfirmed&&r.pinePlanValid&&r.entryDataReliable!==false&&coherent&&q?.priceStale===false&&q?.extendedRecent===true&&q?.priceKind==='TRADE IEX'&&age!==null&&age>=-2&&age<=15);
 return {market:'stocks',symbol:r.ticker||r.symbol,price,entry,stop,ready:valid,stamp:q?.extendedTimestamp,phase:r.status||'SENSE DADES',potential:n(r.earlyScore),quality:n(r.entryQuality),reason:r.pineBlockedReason||'Pine not confirmed'};
}
function update(state,candidates){
 const now=Date.now(),history=state.trades||[];
 for(const c of candidates){
  if(!(c.price>0))continue;
  const key=c.market+':'+c.symbol,stamp=Date.parse(c.stamp||'');
  const allowedAge=c.market==='crypto'?100*60000:20*60000; // Crypto uses last closed 1H candle, not a live tradable quote.
  if(!Number.isFinite(stamp)||now-stamp>allowedAge||stamp>now+120000)continue;
  const open=history.find(t=>t.key===key&&t.state==='OPEN');
  if(open&&stamp>open.sampleTime){
   open.lastPrice=c.price;open.sampleTime=stamp;
   // Observed price, NOT guaranteed OHLC or true first-touch fill.
   if(c.price<=open.stop||c.price>=open.target){
    open.exit=c.price;open.exitTime=new Date(stamp).toISOString();open.state='CLOSED';
    open.reason=c.price<=open.stop?'STOP_OBSERVED':'TARGET_OBSERVED';
    open.netPct=Math.round(((c.price/open.entry)-1-.0024)*10000)/100;
   }
  }else if(!open&&c.ready&&c.price>=c.entry&&c.price<=c.entry*1.01&&c.stop<c.price){
   const last=[...history].reverse().find(t=>t.key===key);
   if(last&&now-Date.parse(last.entryTime)<7*86400000)continue;
   const risk=c.price-c.stop;
   if(risk/c.price<.005||risk/c.price>.08)continue;
   history.push({key,market:c.market,symbol:c.symbol,state:'OPEN',entry:c.price,stop:c.stop,target:c.price+2*risk,lastPrice:c.price,sampleTime:stamp,entryTime:new Date(stamp).toISOString(),reason:'CONFIRMED_WEB',netPct:null});
  }
 }
 state.trades=history.slice(-500);return state;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(401).json({error:'Unauthorized'});
 if(!process.env.BLOB_READ_WRITE_TOKEN||!process.env.PAPER_BASE_URL)return res.status(503).json({error:'Paper server setup incomplete'});
 // Intended for one daily scheduled run; Blob updates are not transactionally locked.
 try{
  const state=await loadPaper();
  if(state.lastRun&&Date.now()-Date.parse(state.lastRun)<40*60000)return res.status(200).json({ok:true,skipped:'recent run',lastRun:state.lastRun});
  const coinCursor=state.cryptoCursor||0,stockCursor=state.stockCursor||0;
  const coin=rotatingBatch(COINS,coinCursor,CRYPTO_BATCH),stock=rotatingBatch(STOCKS,stockCursor,STOCK_BATCH);
  const origin=process.env.PAPER_BASE_URL.replace(/\/$/,'');
  const candidates=[],issues=[];
  const results=await Promise.allSettled([
   getResults(origin,'/api/crypto-scan?symbols='+coin.join(',')),
   getResults(origin,'/api/scan?symbols='+stock.join(',')),
   getResults(origin,'/api/extended?symbols='+stock.join(','))
  ]);
  if(results[0].status==='fulfilled'){
   for(const c of results[0].value.results||[])candidates.push(cryptoCandidate(c));
   issues.push(...(results[0].value.errors||[]).map(e=>e.symbol+': '+e.message));
  }else issues.push('crypto: '+String(results[0].reason));
  if(results[1].status==='fulfilled'&&results[2].status==='fulfilled'){
   const quotes=results[2].value.results||{};
   for(const r of results[1].value.results||[]){const symbol=r.ticker||r.symbol;candidates.push(stockCandidate(r,quotes[symbol]));}
  }else issues.push('stock/quote feed unavailable');
  // Keep a transparent audit sample even for candidates rejected by the safety gates.
  const evaluatedAt=new Date().toISOString();
  state.observations=[...(state.observations||[]),...candidates.map(c=>({
   at:evaluatedAt,market:c.market,symbol:c.symbol,price:c.price,
   signalApproved:c.ready,entry:c.entry,stop:c.stop,phase:c.phase,potential:c.potential,quality:c.quality,reason:c.reason,
   dataAgeMin:Number.isFinite(Date.parse(c.stamp||''))?Math.round((Date.now()-Date.parse(c.stamp))/60000):null
  }))].slice(-2000);
  update(state,candidates);
  // Advance only feeds that succeeded so temporarily failed batches are retried.
  if(results[0].status==='fulfilled')state.cryptoCursor=(coinCursor+coin.length)%COINS.length;
  if(results[1].status==='fulfilled'&&results[2].status==='fulfilled')state.stockCursor=(stockCursor+stock.length)%STOCKS.length;
  state.lastRun=new Date().toISOString();state.checks=(state.checks||0)+1;state.issues=issues.slice(0,12);
  await savePaper(state);
  return res.status(200).json({ok:true,checked:candidates.length,coverage:{crypto:coin,stocks:stock},open:state.trades.filter(t=>t.state==='OPEN').length,closed:state.trades.filter(t=>t.state==='CLOSED').length,observations:state.observations.length,issues:state.issues});
 }catch(e){return res.status(500).json({error:String(e.message||e)})}

}
