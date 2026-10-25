// Experimental 1D/4H/1H chronological replay; not Pine parity.
// Every signal is based on prior completed daily candles and completed 1H bars.
// Four-hour candles are built from four contiguous completed NY-session hourly candles.
const NY='America/New_York';
const fmt=new Intl.DateTimeFormat('en-US',{timeZone:NY,year:'numeric',month:'2-digit',day:'2-digit'});
export const day=t=>{const p=Object.fromEntries(fmt.formatToParts(new Date(t)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day};
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const ema=(a,n)=>{if(a.length<n)return null;let x=avg(a.slice(0,n));for(const v of a.slice(n))x+=(v-x)*2/(n+1);return x};
const atr=(a,n=14)=>a.length<n+1?null:avg(a.slice(-n).map((b,i)=>{const p=a[a.length-n+i-1];return Math.max(b.h-b.l,Math.abs(b.h-p.c),Math.abs(b.l-p.c))}));
async function bars(symbol,timeframe,start,feed){
 const out=[],seen=new Set();let page=null;
 for(let i=0;i<8;i++){
  const url=new URL('https://data.alpaca.markets/v2/stocks/bars');
  Object.entries({symbols:symbol,timeframe,start,limit:10000,adjustment:'split',feed,sort:'asc'}).forEach(([k,v])=>url.searchParams.set(k,v));
  if(page)url.searchParams.set('page_token',page);
  const r=await fetch(url,{headers:{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY,'APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET}});
  if(!r.ok)throw Error('Alpaca '+timeframe+' '+feed+': HTTP '+r.status);
  const j=await r.json();
  for(const b of j.bars?.[symbol]||[]){
   const t=Date.parse(b.t);
   if(!Number.isFinite(t)||seen.has(t)||![b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)||b.l>Math.min(b.o,b.c)||b.h<Math.max(b.o,b.c)||b.v<0)continue;
   seen.add(t);out.push({t,o:b.o,h:b.h,l:b.l,c:b.c,v:b.v});
  }
  if(!j.next_page_token){out.sort((a,b)=>a.t-b.t);return out}
  page=j.next_page_token;
 }
 throw Error('Historial paginat incomplet: límit de pàgines');
}
export function fourHour(hourly){
 const out=[],groups=new Map();
 for(const x of hourly){const d=day(x.t);if(!groups.has(d))groups.set(d,[]);groups.get(d).push(x)}
 for(const group of groups.values()){
  for(let i=0;i+4<=group.length;i+=4){
   const x=group.slice(i,i+4);
   if(x.some((b,j)=>j&&b.t-x[j-1].t!==3600000))continue;
   out.push({t:x[0].t,end:x[3].t+3600000,o:x[0].o,h:Math.max(...x.map(z=>z.h)),l:Math.min(...x.map(z=>z.l)),c:x[3].c,v:x.reduce((n,z)=>n+z.v,0)});
  }
 }
 return out;
}
export function replay(daily,hourly,window={}){
 const fours=fourHour(hourly),trades=[],rejections={warmup:0,daily:0,fourHour:0,confirm:0,volume:0,risk:0};
 let j=0,k=0,pos=null,equity=1,peak=1,maxDD=0;
 const cost=.0024,riskBudget=.01;
 for(let i=1;i<hourly.length-1;i++){
  const bar=hourly[i],next=hourly[i+1],d=day(bar.t);
  while(j<daily.length&&day(daily[j].t)<d)j++;
  // A 4H bar ending during this 1H bar cannot be consulted at its opening.
  while(k<fours.length&&fours[k].end<=bar.t)k++;
  // Resolve an existing trade on this completed hourly candle, before any new signal.
  if(pos){
   let exit=null,why='';
   if(bar.o<=pos.stop){exit=bar.o;why='STOP GAP'}
   else if(bar.o>=pos.target){exit=bar.o;why='TARGET GAP'}
   else if(bar.l<=pos.stop){exit=pos.stop;why='STOP'}
   else if(bar.h>=pos.target){exit=pos.target;why='TARGET'}
   else if(i-pos.enterIndex>=30){exit=bar.c;why='TIME'}
   const lowEquity=equity*(1+pos.fraction*(bar.l/pos.entry-1-cost));
   if(Number.isFinite(lowEquity))maxDD=Math.max(maxDD,Math.max(0,(peak-lowEquity)/peak));
   if(exit!==null){
    const ret=(exit/pos.entry-1-cost)*pos.fraction;
    equity*=Math.max(0,1+ret);peak=Math.max(peak,equity);maxDD=Math.max(maxDD,(peak-equity)/peak);
    trades.push({entryTime:new Date(pos.time).toISOString(),exitTime:new Date(bar.t).toISOString(),entry:pos.entry,stop:pos.stop,target:pos.target,exit,why,capitalReturnPct:+(ret*100).toFixed(2)});
    pos=null;continue;
   }
   continue;
  }
  if(i<(window.startIndex??0)||i>(window.endIndex??hourly.length-2))continue;
  const ds=daily.slice(0,j),fs=fours.slice(0,k),hs=hourly.slice(0,i+1);
  if(ds.length<55||fs.length<22||hs.length<21){rejections.warmup++;continue}
  const dc=ds.map(x=>x.c),fc=fs.map(x=>x.c);
  if(!(ema(dc,20)>ema(dc,50)&&ds.at(-1).c>ema(dc,20))){rejections.daily++;continue}
  const f20=ema(fc,20),prior=fs.slice(-11,-1),last=fs.at(-1),prev4=fs.at(-2);
  if(!(last.c>f20&&(last.c>Math.max(...prior.map(x=>x.h))||last.l<=f20&&last.c>prev4.c))){rejections.fourHour++;continue}
  if(!(bar.c>bar.o&&bar.c>hourly[i-1].h)){rejections.confirm++;continue}
  const volume=hs.slice(-21,-1).map(x=>x.v),rv=bar.v/avg(volume);
  if(!(rv>=1.1)){rejections.volume++;continue}
  // Pending next-hour-open entry, one trade at a time. Never fill using a past price.
  if(next.t<bar.t+3600000||next.t-bar.t>3*86400000)continue;
  const entry=next.o,vol=atr(hs),stop=Math.min(last.l,entry-1.5*(vol||0)),risk=entry-stop;
  if(!(entry>0&&risk/entry>=.005&&risk/entry<=.08)){rejections.risk++;continue}
  const fraction=Math.min(1,riskBudget/(risk/entry));
  pos={entry,stop,target:entry+2*risk,fraction,time:next.t,enterIndex:i+1};
 }
 return {source:'SIP 1D and 1H, reconstructed 4H',parity:'EXPERIMENTAL_NOT_EXACT_PINE',timeframes:['1D prior closed','4H four contiguous completed 1H','1H closed confirmation'],counts:{daily:daily.length,hourly:hourly.length,fourHour:fours.length},rejections,trades:trades.slice(-100),closed:trades.length,openAtEnd:pos?{entry:pos.entry,stop:pos.stop}:null,totalReturnPct:+((equity-1)*100).toFixed(2),maxDrawdownPct:+(maxDD*100).toFixed(2)};
}
export async function multiTimeframeHandler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 const symbol=String(req.query.symbol||'CRM').trim().toUpperCase();
 if(!/^[A-Z][A-Z0-9.]{0,8}$/.test(symbol))return res.status(400).json({error:'Invalid symbol'});
 if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return res.status(503).json({error:'Alpaca credentials missing'});
 try{
  const start=new Date(Date.now()-180*86400000).toISOString();
  const [daily,hourly]=await Promise.all([bars(symbol,'1Day',start,'sip'),bars(symbol,'1Hour',start,'sip')]);
  if(daily.length<55||hourly.length<150)return res.status(422).json({error:'Insufficient historical coverage',daily:daily.length,hourly:hourly.length});
  const full=replay(daily,hourly),split=Math.floor(hourly.length*.7);
  const folds=[];for(const [a,b] of [[.55,.70],[.70,.85],[.85,1]]){const startIndex=Math.floor(hourly.length*a),endIndex=Math.min(hourly.length-2,Math.floor(hourly.length*b)-1);folds.push({start:new Date(hourly[startIndex].t).toISOString(),end:new Date(hourly[endIndex].t).toISOString(),...replay(daily,hourly,{startIndex,endIndex})})}
  return res.status(200).json({symbol,...full,walkForward:{method:'three chronological nonoverlapping evaluation windows; no optimisation',folds},parityComparison:{status:'PINE_EXPORT_REQUIRED',reason:'No historical Pine signal timestamps supplied; automatic bar-to-bar comparison cannot be verified',radarSignals:full.closed,pineSignals:null}});
 }catch(e){return res.status(502).json({error:String(e.message||e)})}
}
