// LONG AI v1.5.1: discovery with partial results, controlled concurrency and transparent errors.
const STOCKS=['UBER','GTLB','OXY','SNOW','CRM','ABBV','PEP','CVX','RTX','HAE','NVDA','MU','ANET','COHR','PLTR','FROG','RKLB','APLD','PANW','CRWD','MSFT','GOOGL','AMZN','META','AAPL','AMD','AVGO','TSM','ASML','AMAT','LRCX','KLAC','MRVL','SMCI','ORCL','NET','DDOG','SHOP','NOW','INTU','RBRK','ZS','FTNT','OKTA','PATH','MDB','HUBS','TWLO','HOOD','COIN','MSTR','SQ','PYPL','SOFI','AFRM','IBKR','GS','JPM','BAC','C','XOM','SLB','HAL','KOS','COP','EOG','MPC','VLO','GEV','ETN','PWR','VST','CEG','BE','OKLO','CCJ','NEE','DUK','GE','CAT','DE','URI','BA','LMT','NOC','KTOS','HIMS','TEM','UNH','LLY','MRK','PFE','GILD','REGN','TMO','ISRG','DXCM','ROST','COST','WMT','TGT','HD','LOW','CMG','MCD','SBUX','NFLX','DIS','SPOT','ROKU','TTD','ABNB','BKNG','RCL','CCL','DAL','UAL','TSLA','RIVN','LCID','NIO','F','GM'];
const TIMEOUT=6500;
async function get(url){const c=new AbortController();const timer=setTimeout(()=>c.abort(),TIMEOUT);try{const r=await fetch(url,{signal:c.signal,headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'}});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timer)}}
function iso(t){let n=Number(t);if(n>1e12)n/=1000;return Number.isFinite(n)&&n>1e9&&n<5e9?new Date(n*1000).toISOString():null}
async function stock(s){let reason='proveïdor sense dades';for(const host of ['query1','query2']){try{const x=(await get(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=7d`))?.chart?.result?.[0];if(!x){reason='resposta sense dades';continue}const m=x.meta||{},q=x.indicators?.quote?.[0]||{},close=(q.close||[]).filter(v=>Number.isFinite(v)),vol=(q.volume||[]).filter(v=>Number.isFinite(v));const p=Number(m.regularMarketPrice)||close.at(-1),prev=Number(m.chartPreviousClose||m.previousClose)||close.at(-2),volume=vol.at(-1)||0;if(!(p>0&&prev>0)){reason='preu anterior o actual absent';continue}return {symbol:s,type:'acció',price:p,changePct:100*(p/prev-1),dollarVolume:p*volume,quoteTime:iso(m.regularMarketTime)||iso(x.timestamp?.at(-1)),source:'Yahoo Finance',status:'WATCH',verifiedSignal:false}}catch(e){reason=e.message||'error desconegut'}}throw Error(s+': '+reason)}
async function coingecko(){
 const d=await get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h');
 if(!Array.isArray(d))throw Error('coingecko_invalid');
 return d.filter(x=>x.symbol&&x.current_price>0&&x.total_volume>1000000&&x.id!=='bitcoin'&&!/(USD|USDT|USDC|DAI|FDUSD|TUSD|USDE|EURC|PYUSD)$/i.test(x.symbol))
 .map(x=>({symbol:x.symbol.toUpperCase(),type:'cripto',name:x.name,coinId:x.id,price:x.current_price,changePct:x.price_change_percentage_24h,dollarVolume:x.total_volume,quoteTime:x.last_updated,source:'CoinGecko · només preselecció',status:'WATCH',verifiedSignal:false}));
}
async function coinbaseMarket(x, pair){
 const [tick,stats]=await Promise.all([
  get('https://api.exchange.coinbase.com/products/'+encodeURIComponent(pair)+'/ticker'),
  get('https://api.exchange.coinbase.com/products/'+encodeURIComponent(pair)+'/stats')
 ]);
 const price=Number(tick.price),open=Number(stats.open),volume=Number(stats.volume),ms=Date.parse(tick.time||'');
 if(!(price>0)||!Number.isFinite(ms)||Date.now()-ms>2*3600000||ms>Date.now()+60000)throw Error('coinbase_stale');
 return {...x,price,changePct:open>0?100*(price/open-1):null,dollarVolume:volume>0?volume*price:x.dollarVolume,quoteTime:tick.time,source:'Coinbase Exchange '+pair,pair};
}
async function coinbaseCandidates(pref,pairs){
 const eligible=pref.filter(x=>pairs.has(x.symbol)),pool=[];
 const seen=new Set();
 for(const x of eligible){if(seen.has(x.symbol))continue;seen.add(x.symbol);pool.push(x)}
 const ranked=pool.sort((a,b)=>rank(b)-rank(a)).slice(0,32);
 const accepted=[],errors=[];
 for(let i=0;i<ranked.length;i+=8){
  const group=ranked.slice(i,i+8);
  const rows=await Promise.allSettled(group.map(x=>coinbaseMarket(x,pairs.get(x.symbol))));
  rows.forEach((r,j)=>r.status==='fulfilled'?accepted.push(r.value):errors.push(group[j].symbol+': '+String(r.reason?.message||r.reason)));
 }
 return {accepted,errors,eligible:pool.length};
}
async function coinbasePairs(){
 const rows=await get('https://api.exchange.coinbase.com/products');
 if(!Array.isArray(rows))throw Error('Coinbase pair list unavailable');
 const symbols=new Map();
 for(const x of rows){
  if(!['USD','USDC'].includes(x.quote_currency))continue;
  if(x.status&&x.status!=='online')continue;
  if(x.trading_disabled===true)continue;
  if(typeof x.base_currency==='string')if(!symbols.has(x.base_currency.toUpperCase())||x.quote_currency==='USD')symbols.set(x.base_currency.toUpperCase(),x.id);
 }
 return symbols;
}

// Fallback independendent de CoinGecko: descoberta entre actius negociables a Coinbase.
async function fallbackCrypto(pairs){
 const preferred=['SOL','ETH','SUI','LINK','AVAX','ONDO','RENDER','RNDR','HNT','NEAR','INJ','AAVE','HYPE','TAO','FET','ENA','SEI','ARB','JUP','UNI','BONK','PENDLE','MORPHO','TIA','HBAR','XRP','WLD','MET','PEPE','DOGE'];
 const pool=preferred.filter(s=>pairs.has(s)).map(symbol=>({symbol,type:'cripto',name:symbol,price:0,changePct:null,dollarVolume:0,status:'WATCH',verifiedSignal:false}));
 const accepted=[],errors=[];
 for(let i=0;i<pool.length;i+=6){const batch=pool.slice(i,i+6);const r=await Promise.allSettled(batch.map(x=>coinbaseMarket(x,pairs.get(x.symbol))));r.forEach((v,j)=>v.status==='fulfilled'?accepted.push(v.value):errors.push(batch[j].symbol+': '+String(v.reason?.message||v.reason)));if(accepted.length>=12)break;}
 return {accepted,errors,eligible:pool.length};
}
function rank(a){
  // Discovery ranking, NOT an entry signal. Avoid automatically favoring pumped assets.
  const change=Number(a.changePct),dv=Number(a.dollarVolume);
  if(!Number.isFinite(dv)||dv<=0)return -100;
  const liquidity=Math.min(25,Math.log10(Math.max(1,dv))*2.7);
  const momentum=Number.isFinite(change)?Math.max(-8,Math.min(8,change))*0.8:0;
  const overheated=Number.isFinite(change)&&change>12?(change-12)*1.3:0;
  const sharpDrop=Number.isFinite(change)&&change< -10?Math.abs(change+10):0;
  return liquidity+momentum-overheated-sharpDrop;
}
async function stockBatch(symbols){const out=[],errors=[];for(let i=0;i<symbols.length;i+=5){const settled=await Promise.allSettled(symbols.slice(i,i+5).map(stock));settled.forEach((r,j)=>r.status==='fulfilled'?out.push(r.value):errors.push(String(r.reason?.message||r.reason)))}return {out,errors}}
export default async function handler(req,res){res.setHeader('Cache-Control','public,s-maxage=60,stale-while-revalidate=120');if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});const offset=Math.max(0,parseInt(req.query?.offset||'0',10)||0)%STOCKS.length;const count=Math.min(20,Math.max(5,parseInt(req.query?.count||'15',10)||15));const sample=Array.from({length:count},(_,i)=>STOCKS[(offset+i)%STOCKS.length]);const [equity,market,listing]=await Promise.allSettled([stockBatch(sample),coingecko(),coinbasePairs()]);
 const stocks=equity.status==='fulfilled'?equity.value.out:[],errors=[...(equity.status==='fulfilled'?equity.value.errors:[String(equity.reason)])];
 if(market.status==='rejected')errors.push('Preselecció cripto: '+String(market.reason?.message||market.reason));
 if(listing.status==='rejected')errors.push('Llistat Coinbase: '+String(listing.reason?.message||listing.reason));
 let cryptoResult=market.status==='fulfilled'&&listing.status==='fulfilled'?await coinbaseCandidates(market.value,listing.value):{accepted:[],errors:[],eligible:0};
 if(listing.status==='fulfilled' && cryptoResult.accepted.length<10){const fallback=await fallbackCrypto(listing.value);const have=new Set(cryptoResult.accepted.map(x=>x.symbol));cryptoResult={accepted:[...cryptoResult.accepted,...fallback.accepted.filter(x=>!have.has(x.symbol))],errors:[...cryptoResult.errors,...fallback.errors],eligible:Math.max(cryptoResult.eligible,fallback.eligible)};}
 errors.push(...cryptoResult.errors.slice(0,4));
 const now=Date.now(),fresh=x=>{const t=Date.parse(x.quoteTime||'');return Number.isFinite(t)&&t<=now+60000&&now-t<(x.type==='acció'?5*86400000:2*3600000)};
 const result={stocks:stocks.filter(fresh).sort((a,b)=>rank(b)-rank(a)).slice(0,15),crypto:cryptoResult.accepted.filter(fresh).sort((a,b)=>rank(b)-rank(a)).slice(0,20),coverage:{stockCandidates:sample.length,stockQuotes:stocks.length,cryptoQuotes:cryptoResult.accepted.length,cryptoUniverse:250,cryptoCoinbaseEligible:cryptoResult.eligible,stockUniverse:STOCKS.length,offset},errors:errors.slice(0,12),updatedAt:new Date().toISOString(),rotation:'Rotació de '+count+' accions per consulta',warning:'Cripto seleccionada entre 250 monedes per volum, cotitzacions finals verificades a Coinbase USD/USDC. WATCH no es senyal de compra.'};
 if(!result.stocks.length&&!result.crypto.length)return res.status(503).json({...result,error:'No hi ha dades recents disponibles en cap proveïdor.'});
 return res.status(200).json(result)}
