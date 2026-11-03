// Pine ta.dmi(14,14) research implementation, on closed OHLC bars.
// Wilder RMA seeds from the first 14 valid DM/TR samples (bar 1 onward).
export function dmiSeries(bars,diLength=14,adxLength=14){
 const out=bars.map(()=>({diPlus:null,diMinus:null,adx:null}));
 if(!Array.isArray(bars)||bars.length<=diLength)return out;
 let trSum=0,plusSum=0,minusSum=0,adxSum=0,adxCount=0,adx=null;
 for(let i=1;i<bars.length;i++){
  const b=bars[i],p=bars[i-1],up=b.h-p.h,down=p.l-b.l;
  const tr=Math.max(b.h-b.l,Math.abs(b.h-p.c),Math.abs(b.l-p.c));
  const plus=up>down&&up>0?up:0,minus=down>up&&down>0?down:0;
  if(i<=diLength){trSum+=tr;plusSum+=plus;minusSum+=minus;}
  else {trSum=trSum-trSum/diLength+tr;plusSum=plusSum-plusSum/diLength+plus;minusSum=minusSum-minusSum/diLength+minus;}
  if(i<diLength)continue;
  const diPlus=trSum>0?100*plusSum/trSum:0,diMinus=trSum>0?100*minusSum/trSum:0;
  const dx=diPlus+diMinus>0?100*Math.abs(diPlus-diMinus)/(diPlus+diMinus):0;
  if(adxCount<adxLength){adxSum+=dx;adxCount++;if(adxCount===adxLength)adx=adxSum/adxLength;}
  else adx=(adx*(adxLength-1)+dx)/adxLength;
  out[i]={diPlus,diMinus,adx};
 }
 return out;
}
