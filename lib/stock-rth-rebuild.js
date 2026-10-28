// Research-only RTH stock session candle contract.
// IEX raw 1H/4H candles may include 08:00 premarket and 16:00 after-hours.
// Rebuild from timestamped 1-minute trades and an explicit market-calendar day.
// No missing minute interpolation; an incomplete day is rejected. No orders.
const MIN=60000;
const formatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',year:'numeric',month:'2-digit',day:'2-digit',hourCycle:'h23'});
export function newYorkClock(ms) {
 const parts=Object.fromEntries(formatter.formatToParts(ms).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return {date:`${parts.year}-${parts.month}-${parts.day}`,minutes:Number(parts.hour)*60+Number(parts.minute)};
}
const clock=s=>{
 const m=/^(\d{2}):(\d{2})$/.exec(s??'');
 if(!m)throw Error('Calendar needs HH:MM');
 const v=Number(m[1])*60+Number(m[2]);
 if(v>=1440)throw Error('Invalid session hour');
 return v;
};
function aggregate(bars) {
 if(!bars.length)throw Error('Empty candle');
 return {t:bars[0].t,endExclusive:bars.at(-1).endExclusive,
  o:bars[0].o,h:Math.max(...bars.map(x=>x.h)),l:Math.min(...bars.map(x=>x.l)),
  c:bars.at(-1).c,v:bars.reduce((s,x)=>s+x.v,0)};
}
export function rebuildRthSession({symbol,minuteBars,calendarDay}={}) {
 if(!symbol||!calendarDay?.date||!Array.isArray(minuteBars))throw Error('Explicit stock symbol/calendar and minute feed required');
 const open=clock(calendarDay.open),close=clock(calendarDay.close);
 if(!(open>=0&&close>open&&close<=1440))throw Error('Invalid calendar session');
 let prior=-Infinity,byClock=new Map();
 for(const b of minuteBars){
  const t=Date.parse(b.t),end=Date.parse(b.endExclusive);
  if(!Number.isFinite(t)||end!==t+MIN||t<=prior||
     ![b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)||
     b.o<=0||b.l<=0||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h)||b.v<0)throw Error('Bad minute candle');
  prior=t;
  const ny=newYorkClock(t);
  if(ny.date===calendarDay.date&&ny.minutes>=open&&ny.minutes<close){
   if(byClock.has(ny.minutes))throw Error('Duplicate market minute');
   byClock.set(ny.minutes,b);
  }
 }
 const minutes=[];
 for(let m=open;m<close;m++){
  const candle=byClock.get(m);
  if(!candle)throw Error(`MISSING_RTH_MINUTE ${symbol} ${calendarDay.date} ${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`);
  minutes.push(candle);
 }
 const oneHour=[],fourHour=[];
 // Anchor both 1H and 4H to the exact RTH session open, with final partial bar.
 for(let i=0;i<minutes.length;i+=60)oneHour.push(aggregate(minutes.slice(i,i+60)));
 for(let i=0;i<minutes.length;i+=240)fourHour.push(aggregate(minutes.slice(i,i+240)));
 const day=aggregate(minutes);
 return {symbol,date:calendarDay.date,session:{open:calendarDay.open,close:calendarDay.close},
  source:'MARKET_CALENDAR_RTH_1MIN',oneHour,fourHour,day,parity:{
    expectedMinutes:close-open,observedMinutes:minutes.length,
    dailyVolume:day.v,sum1HVolume:oneHour.reduce((s,b)=>s+b.v,0),
    sum4HVolume:fourHour.reduce((s,b)=>s+b.v,0),
    // TradingView/Pine comparison is NOT proven by this self-consistency test.
    verifiedAgainstPine:false
  }};
}
