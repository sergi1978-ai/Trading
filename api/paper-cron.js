import {loadPaper,savePaper,kv} from './_paper-store.js';
const STOCKS=['UBER','CRM','NOW','ABBV','MU','ANET','SNOW','FTNT','PANW','VLO','LLY','NFLX'];
const COINS=['BTC','ETH','SOL','NEAR','LINK','ONDO','AAVE','RENDER','TAO','FIL','SUI','INJ'];
const json=async(res)=>{const data=await res.json();if(!res.ok)throw Error(data.error||'Provider '+res.status);return data};
async function getResults(origin,path){const r=await fetch(origin+path,{cache:'no-store',headers:{'X-Paper-Internal':process.env.PAPER_INTERNAL_SECRET||''}});return json(r)}
const n=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
function cryptoCandidate(r){
 const price=n(r.price),entry=n(r.pineReferenceEntry),stop=n(r.pineReferenceStop),valid=r.pineSignalCandidate===true&&r.operationalDecision==='REVISAR ENTRADA'&&r.planAvailable===true&&r.criticalBlocks?.length===0;
 return {market:'crypto',symbol:r.symbol,price,entry,stop,ready:valid,stamp:r.quoteTime,reason:r.primaryBlocker||r.operationalDecision};
}
function stockCandidate(r,q){
 const price=n(q?.extendedPrice),entry=n(r.pineReferenceEntry),stop=n(r.pineReferenceStop),age=n(q?.extendedAgeMinutes);
 const coherent=price>0&&n(r.technicalPrice)>0&&Math.abs(price/r.technicalPrice-1)<=.05&&r.priceBasis==='SPLIT_ADJUSTED';
 const valid=!!(r.pineEntryConfirmed&&r.pinePlanValid&&r.entryDataReliable&&coherent&&q?.priceStale===false&&age!==null&&age>=-2&&age<=15);
 return {market:'stocks',symbol:r.symbol,price,entry,stop,ready:valid,stamp:q?.extendedTimestamp,reason:r.pineBlockedReason||'Pine not confirmed'};
}
function update(state,candidates){
 const now=Date.now(),history=state.trades||[];
 for(const c of candidates){
  if(!(c.price>0))continue;
  const key=c.market+':'+c.symbol,stamp=Date.parse(c.stamp||'');
  if(!Number.isFinite(stamp)||now-stamp>20*60000||stamp>now+120000)continue;
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
 if(!process.env.PAPER_REDIS_REST_URL||!process.env.PAPER_REDIS_REST_TOKEN||!process.env.PAPER_BASE_URL)return res.status(503).json({error:'Paper server setup incomplete'});
 // Redis lock prevents concurrent scheduled requests from overwriting each other.
 let locked=false;
 try{
  const lock=await kv(['SET','trading2026:paper:lock','1','EX','850','NX']);
  if(lock!=='OK')return res.status(409).json({error:'Run already active'});
  locked=true;
  const state=await loadPaper(),idx=state.cursor||0,coin=COINS.slice(idx%COINS.length,(idx%COINS.length)+3),stock=STOCKS.slice(idx%STOCKS.length,(idx%STOCKS.length)+4);
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
   for(const r of results[1].value.results||[])candidates.push(stockCandidate(r,quotes[r.symbol]));
  }else issues.push('stock/quote feed unavailable');
  update(state,candidates);state.cursor=(idx+3)%132;state.lastRun=new Date().toISOString();state.checks=(state.checks||0)+1;state.issues=issues.slice(0,12);
  await savePaper(state);
  return res.status(200).json({ok:true,checked:candidates.length,open:state.trades.filter(t=>t.state==='OPEN').length,closed:state.trades.filter(t=>t.state==='CLOSED').length,issues:state.issues});
 }catch(e){return res.status(500).json({error:String(e.message||e)})}
 finally{if(locked)try{await kv(['DEL','trading2026:paper:lock'])}catch(_){}}
}
