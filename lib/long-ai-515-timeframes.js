// Experimental: UTC crypto only. Never treat NY stock sessions as UTC crypto bars.
export function aggregateCrypto(hourly, now=Date.now()) {
 const bars=[...hourly].sort((a,b)=>a.t-b.t).filter(b=>Number.isFinite(b.t)&&b.t+3600000<=now);
 function bucket(period,count) {
  const map=new Map();
  for(const b of bars) {
   const t=Math.floor(b.t/period)*period;
   let g=map.get(t);
   if(!g){g={t,o:b.o,h:b.h,l:b.l,c:b.c,v:b.v,n:1,last:b.t};map.set(t,g)}
   else {g.h=Math.max(g.h,b.h);g.l=Math.min(g.l,b.l);g.c=b.c;g.v+=b.v;g.n++;g.last=b.t}
  }
  return [...map.values()].filter(g=>g.n===count&&g.last===g.t+(count-1)*3600000&&g.t+period<=now).map(({n,last,...g})=>g).sort((a,b)=>a.t-b.t);
 }
 return {hour:bars,four:bucket(14400000,4),daily:bucket(86400000,24),source:'UTC 1H',warning:'Confirmar la mateixa font i alineació a TradingView'};
}
