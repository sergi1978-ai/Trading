// Latest trade quotes, independent from closed-candle signal calculations.
export default async function handler(req,res){
 const symbols=[...new Set(String(req.query.symbols||'').toUpperCase().split(',').filter(x=>/^[A-Z0-9]{2,12}$/.test(x)))].slice(0,15);
 const fetchPrice=async symbol=>{
  for(const quote of ['USD','USDC']){
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),4000);
   try{
    const url='https://api.exchange.coinbase.com/products/'+encodeURIComponent(symbol+'-'+quote)+'/ticker';
    const r=await fetch(url,{signal:ctl.signal,headers:{Accept:'application/json'}});
    if(!r.ok)continue;
    const j=await r.json(),price=Number(j.price),time=Date.parse(j.time);
    if(!(price>0)||!Number.isFinite(time)||Date.now()-time>90000)continue;
    return {symbol,price,quote,source:'Coinbase',time:new Date(time).toISOString()};
   }catch(_){}finally{clearTimeout(timer)}
  }
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),4500);
  try{
   const pair=(symbol==='BTC'?'XBT':symbol)+'USD';
   const r=await fetch('https://api.kraken.com/0/public/Ticker?pair='+encodeURIComponent(pair),{signal:ctl.signal});
   if(!r.ok)return null;
   const data=await r.json();
   if(data.error?.length)return null;
   const market=Object.values(data.result||{})[0],price=Number(market?.c?.[0]);
   if(price>0)return {symbol,price,source:'Kraken',time:new Date().toISOString(),approximateTime:true};
  }catch(_){}finally{clearTimeout(timer)}
  return null;
 };
 const results=(await Promise.all(symbols.map(fetchPrice))).filter(Boolean);
 res.setHeader('Cache-Control','no-store, max-age=0');
 return res.status(200).json({results,requested:symbols.length,received:results.length,generatedAt:new Date().toISOString()});
}
