// Canonical UTC Binance Spot OHLCV tools. Pure functions; no network or trading.
export const HOUR_MS = 3600000;
export const FOUR_H_MS = 4*HOUR_MS;
export const DAY_MS = 24*HOUR_MS;
export const DURATION = {"1h":HOUR_MS,"4h":FOUR_H_MS,"1d":DAY_MS};

export function toBar(b) {
  if (!Array.isArray(b) || b.length < 7) throw new Error("Invalid Binance kline array");
  return {
    t: Number(b[0]), o: Number(b[1]), h: Number(b[2]), l: Number(b[3]),
    c: Number(b[4]), v: Number(b[5]), closeTime: Number(b[6])
  };
}
export function isCompleted(b, asOf = Date.now()) {
  return b.closeTime < asOf;
}
export function auditBars(raw, tf, {start, end} = {}) {
  if (!DURATION[tf]) throw new Error("Unsupported timeframe");
  const dur=DURATION[tf];
  const bars=raw.map(x=>Array.isArray(x)?toBar(x):x);
  let gaps=0, duplicates=0, invalid=0, misplaced=0, outOfRange=0, incomplete=0;
  let firstGap=null;
  const times=new Set();
  for(let i=0;i<bars.length;i++){
    const b=bars[i];
    if(![b.t,b.o,b.h,b.l,b.c,b.v,b.closeTime].every(Number.isFinite)) invalid++;
    if(!(b.h>=Math.max(b.o,b.c,b.l) && b.l<=Math.min(b.o,b.c,b.h) && b.l>0 && b.v>=0)) invalid++;
    if(b.t%dur!==0) misplaced++;
    if(b.closeTime!==b.t+dur-1) incomplete++;
    if((start!==undefined && b.t<start)||(end!==undefined && b.t>=end)) outOfRange++;
    if(times.has(b.t)) duplicates++;
    times.add(b.t);
    if(i>0 && b.t-bars[i-1].t!==dur){
      gaps++;
      if(firstGap===null) firstGap=[bars[i-1].t,b.t];
    }
  }
  return {
    interval:tf,count:bars.length,first:bars[0]?.t??null,last:bars.at(-1)?.t??null,
    gaps,firstGap,duplicates,invalid,misplaced,outOfRange,incomplete,
    ok:bars.length>0 && gaps===0 && duplicates===0 && invalid===0 && misplaced===0 && outOfRange===0 && incomplete===0
  };
}
export function aggregateHourly(hourly, tf) {
  const dur=DURATION[tf], per=dur/HOUR_MS;
  if(!Number.isInteger(per)) throw new Error("Only aggregate 1h to 4h or 1d");
  if(!["4h","1d"].includes(tf)) throw new Error("Target must be 4h or 1d");
  const b=hourly.map(x=>Array.isArray(x)?toBar(x):x), result=[];
  let grouped=new Map();
  for(const x of b){
    const k=Math.floor(x.t/dur)*dur;
    if(!grouped.has(k))grouped.set(k,[]);
    grouped.get(k).push(x);
  }
  for(const [k,group] of [...grouped.entries()].sort((a,b)=>a[0]-b[0])){
    if(group.length!==per || group[0].t!==k || group.at(-1).t!==k+dur-HOUR_MS) continue;
    if(group.some((x,i)=>i>0 && x.t-group[i-1].t!==HOUR_MS)) continue;
    result.push({
      t:k,o:group[0].o,h:Math.max(...group.map(x=>x.h)),
      l:Math.min(...group.map(x=>x.l)),c:group.at(-1).c,
      v:group.reduce((n,x)=>n+x.v,0),closeTime:k+dur-1
    });
  }
  return result;
}
export function compareNative(derived,native,priceTolerance=1e-7,volumeRelativeTolerance=1e-9){
  const known=new Map(native.map(x=>{const b=Array.isArray(x)?toBar(x):x;return [b.t,b];}));
  let compared=0, missingNative=0, mismatches=0, largestPriceError=0, largestVolumeRelativeError=0;
  const examples=[];
  for(const b of derived){
    const x=known.get(b.t);
    if(!x){missingNative++;continue;}
    compared++;
    const err=Math.max(Math.abs(b.o-x.o),Math.abs(b.h-x.h),Math.abs(b.l-x.l),Math.abs(b.c-x.c));
    const verr=Math.abs(b.v-x.v)/Math.max(b.v,1e-12);
    largestPriceError=Math.max(largestPriceError,err);
    largestVolumeRelativeError=Math.max(largestVolumeRelativeError,verr);
    if(err>priceTolerance || verr>volumeRelativeTolerance){
      mismatches++;
      if(examples.length<5)examples.push({t:b.t,priceError:err,volumeRelativeError:verr});
    }
  }
  return {compared,missingNative,mismatches,largestPriceError,largestVolumeRelativeError,examples,ok:compared>0 && mismatches===0 && missingNative===0};
}
export function toCsv(bars){
  return "time,open,high,low,close,volume\n"+bars.map(b=>[
    new Date(b.t).toISOString(),b.o,b.h,b.l,b.c,Number(b.v.toFixed(8))
  ].join(",")).join("\n")+"\n";
}
