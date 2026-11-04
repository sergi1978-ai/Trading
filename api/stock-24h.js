// Price display only. Do not use these quotes to construct closed 1D/4H/1H signal candles.
const BASE='https://data.alpaca.markets/v2/stocks/trades/latest';
const feeds=['overnight','iex','delayed_sip'];
const valid=s=>/^[A-Z][A-Z0-9.]{0,9}$/.test(s);
async function getFeed(symbols,feed){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),6500);
 try{
  const url=BASE+'?symbols='+encodeURIComponent(symbols.join(','))+'&feed='+feed;
  const r=await fetch(url,{signal:ctl.signal,headers:{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY||'','APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET||''}});
  if(!r.ok)return {error:feed+': HTTP '+r.status,trades:{}};
  const j=await r.json();return {trades:j.trades||{}};
 }catch(e){return {error:feed+': '+(e.name==='AbortError'?'timeout':'unavailable'),trades:{}}}
 finally{clearTimeout(timer)}
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const symbols=[...new Set(String(req.query.symbols||'').toUpperCase().split(',').map(s=>s.trim()).filter(valid))].slice(0,20);
 if(!symbols.length)return res.status(400).json({error:'No valid symbols'});
 if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return res.status(503).json({error:'Alpaca credentials not configured'});
 const outputs=await Promise.all(feeds.map(f=>getFeed(symbols,f)));
 const results={};const now=Date.now();
 for(const symbol of symbols){
  const choices=feeds.map((feed,i)=>{const t=outputs[i].trades[symbol];const price=Number(t?.p),time=Date.parse(t?.t||'');return Number.isFinite(price)&&price>0&&Number.isFinite(time)&&time<=now+60000?{price,time:new Date(time).toISOString(),feed,ageMinutes:Math.round((now-time)/60000),delayed:feed==='overnight'||feed==='delayed_sip'}:null}).filter(Boolean).sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
  if(choices.length)results[symbol]=choices[0];
 }
 return res.status(200).json({results,requested:symbols.length,received:Object.keys(results).length,errors:outputs.map(x=>x.error).filter(Boolean),note:'Overnight on free plan is indicative/delayed. Prices are display-only, not Pine signal inputs.',generatedAt:new Date().toISOString()});
}
