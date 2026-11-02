// v5.30 laboratory. Closed-candle backtest only; NOT verified Pine parity.
// Signals are supplied by the caller, never inferred from future bars.
const valid=n=>typeof n==='number'&&Number.isFinite(n);
export function compression(bars,period=20){
 if(!Array.isArray(bars)||bars.length<period+2)return null;
 const slice=bars.slice(-period),ranges=slice.map(b=>b.h-b.l);
 if(!ranges.every(valid))return null;
 const recent=ranges.slice(-5).reduce((a,b)=>a+b,0)/5;
 const prior=ranges.slice(0,-5).reduce((a,b)=>a+b,0)/(period-5);
 return prior>0?{ratio:recent/prior,compressed:recent/prior<.65,method:'mean candle range proxy; not Bollinger bandwidth'}:null;
}
export function simulate(bars,signals,{feePct=.001,slippagePct=.0005}={}){
 if(!Array.isArray(bars)||!Array.isArray(signals))throw Error('Bars and signals required');
 const trades=[];
 for(const signal of signals){
  const i=signal.index;
  if(!Number.isInteger(i)||i<0||i>=bars.length-1)continue;
  const next=bars[i+1],stop=signal.stop,target=signal.target;
  if(!valid(next.o)||!(stop>0&&target>stop&&stop<next.o))continue;
  const entry=next.o*(1+slippagePct);
  let exit=null,exitIndex=null,reason='';
  for(let j=i+1;j<bars.length;j++){
   const b=bars[j];
   // Conservative if both stop and target touched: stop wins.
   if(b.l<=stop){exit=stop*(1-slippagePct);exitIndex=j;reason='STOP';break}
   if(b.h>=target){exit=target*(1-slippagePct);exitIndex=j;reason='TARGET';break}
  }
  if(exit===null){exit=bars.at(-1).c*(1-slippagePct);exitIndex=bars.length-1;reason='END'}
  const netReturn=exit/entry-1-2*feePct;
  trades.push({signalIndex:i,entryIndex:i+1,exitIndex,entry,exit,reason,netReturn});
 }
 const wins=trades.filter(t=>t.netReturn>0).length;
 return {trades,count:trades.length,winRate:trades.length?wins/trades.length:null,meanReturn:trades.length?trades.reduce((a,t)=>a+t.netReturn,0)/trades.length:null,limitations:'No spreads, partial fills, liquidity or market impact; overlapping trades are not portfolio-simulated'};
}
export function walkForward(bars,signalFactory,{train=120,test=40}={}){
 if(typeof signalFactory!=='function'||train<30||test<10)throw Error('Invalid walk-forward configuration');
 const windows=[];
 for(let start=0;start+train+test<=bars.length;start+=test){
  const training=bars.slice(start,start+train),testing=bars.slice(start+train,start+train+test);
  const signals=signalFactory(training,testing);
  // Signals must be indexed in test data; first test candle cannot use future training data.
  const result=simulate(testing,signals);
  windows.push({start,train,test,trades:result.count,winRate:result.winRate,meanReturn:result.meanReturn});
 }
 return {windows,validatedPine:false,note:'Out-of-sample only if signalFactory does not access future bars; no guarantee against overfitting'};
}
