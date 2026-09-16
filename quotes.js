
export default async function handler(req,res){
  try{
    const symbols=(req.query.symbols||'PLTR,CRM').toUpperCase().split(',').map(s=>s.trim()).filter(Boolean).slice(0,60);
    if(!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) return res.status(500).json({error:'Falten credencials Alpaca'});
    const url='https://data.alpaca.markets/v2/stocks/snapshots?symbols='+encodeURIComponent(symbols.join(','))+'&feed=iex';
    const r=await fetch(url,{headers:{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY,'APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET}});
    const text=await r.text();
    if(!r.ok) return res.status(r.status).send(text);
    res.setHeader('Cache-Control','no-store');
    res.status(200).send(text);
  }catch(e){res.status(500).json({error:e.message||String(e)});}
}
