// Independent daily OHLCV comparison; Yahoo Finance chart is NOT TradingView.
export function compareDaily(primary,secondary){
 const byDay=new Map(secondary.map(b=>[b.day,b]));
 return primary.map(a=>{
  const b=byDay.get(a.day);
  if(!b)return {day:a.day,status:'missing',alpaca:a};
  const difference=Object.fromEntries(['o','h','l','c','v'].map(k=>[k,Number(((a[k]-b[k])/b[k]*100).toFixed(3))]));
  return {day:a.day,status:'compared',alpaca:a,secondary:b,difference,
   flagged:['o','h','l','c'].some(k=>Math.abs(difference[k])>0.5)};
 });
}
export function parseYahooDaily(data){
 const result=data?.chart?.result?.[0];
 const quote=result?.indicators?.quote?.[0];
 if(!result||!quote||!Array.isArray(result.timestamp))throw Error('Yahoo returned no valid daily data');
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
 return result.timestamp.map((ts,i)=>({day:fmt.format(new Date(ts*1000)),o:quote.open?.[i],h:quote.high?.[i],l:quote.low?.[i],c:quote.close?.[i],v:quote.volume?.[i]}))
 .filter(b=>['o','h','l','c','v'].every(k=>Number.isFinite(b[k])));
}
