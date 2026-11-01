import {snapshot} from '../lib/long-ai-515-parity.js';
import {parityFetchBars,parityChooseFeed} from './scan.js';
import {parityCandles} from './crypto-scan.js';
const period={ '1H':3600000,'4H':14400000,'1D':86400000 };
const tf={ '1H':'1Hour','4H':'4Hour','1D':'1Day' };
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const kind=String(req.query.kind||'crypto'),symbol=String(req.query.symbol||'').toUpperCase(),frame=String(req.query.tf||'1H').toUpperCase();
 if(!['stocks','crypto'].includes(kind)||!/^[A-Z0-9]{2,12}$/.test(symbol)||!period[frame])return res.status(400).json({error:'Paràmetres invàlids'});
 try{
  let bars,source,warning;
  if(kind==='crypto'){
   const pack=await parityCandles(symbol,period[frame]/1000);
   bars=pack.rows;source=pack.source+' · '+pack.pair;
   warning='El feed i l’alineació poden ser diferents de TradingView. No és paritat certificada.';
  }else{
   const feed=await parityChooseFeed();
   const days=frame==='1D'?400:70;
   const start=new Date(Date.now()-days*86400000).toISOString();
   const found=await parityFetchBars([symbol],tf[frame],start,10000,feed.feed,feed.cutoff);
   bars=found[symbol]||[];source='Alpaca '+feed.feed;
   warning='Accions: sessions, ajustaments i horaris ampliats poden diferir de TradingView.';
  }
  const now=Date.now(),duration=period[frame];
  const closed=bars.map(b=>({...b,t:typeof b.t==='number'?b.t:Date.parse(b.t)})).filter(b=>Number.isFinite(b.t)&&b.t+duration<=now).sort((a,b)=>a.t-b.t);
  const data=snapshot(closed);
  return res.status(200).json({symbol,kind,frame,source,warning,barCount:closed.length,barTime:closed.at(-1)?.t??null,diagnostics:data,verifiedPine:false});
 }catch(e){return res.status(502).json({error:String(e.message||e).slice(0,200),verifiedPine:false})}
}
