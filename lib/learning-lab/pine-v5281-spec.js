// LONG AI SWING v5.28.1: frozen specification of defaults, execution assumptions
// and exact, source-derived entry priority. Not a trading engine.
export const pineSpec=Object.freeze({
 version:'5.28.1',timeframe:'1H',higherTimeframes:['4H','1D'],
 processOrdersOnClose:true,commissionPercentPerSide:0.10,slippageTicks:2,
 initialCapital:10000,riskPct:0.5,maxExposurePct:25,
 stopStockATR:1.5,stopCryptoATR:2,maxStopStockPct:3,maxStopCryptoPct:7,
 tp1R:1.5,tp2R:3,partialPct:50,breakEvenAtR:1.5,trailingAtR:2,trailingATR:2,
 maxHoldBars:120,cooldownBars:3,scoreMinimum:70,
 entryPriority:['E','F','C','A'],dailyUsesLastConfirmed:true,fourHourUsesLastConfirmed:true,
 requireVolume:true,marketBenchmarks:['SPY','QQQ','BTCUSD'],
 trainSplit:'2026-01-01',modes:['ESTRICTE','PROVA PATRONS']
});
export function selectConfirmedMotor(ready,allowed={A:true,C:true,E:true,F:true}){
 for(const motor of pineSpec.entryPriority)if(allowed[motor]&&ready[motor]===true)return motor;
 return '';
}
export function riskPlan({close,atr,priorLow,isCrypto=false,capital=10000,pointValue=1,tick=0.01}){
 if(![close,atr,priorLow,capital,pointValue,tick].every(x=>Number.isFinite(x)&&x>0))return {valid:false,reason:'invalid_inputs'};
 const atrMultiple=isCrypto?pineSpec.stopCryptoATR:pineSpec.stopStockATR;
 const maxStopPct=isCrypto?pineSpec.maxStopCryptoPct:pineSpec.maxStopStockPct;
 const stop=Math.min(close-atr*atrMultiple,priorLow-atr*0.15);
 const distance=close-stop,stopPct=100*distance/close,step=isCrypto?0.000001:1;
 const riskBudget=capital*pineSpec.riskPct/100,exposureBudget=capital*pineSpec.maxExposurePct/100;
 const qty=Math.floor(Math.max(0,Math.min(riskBudget/(distance*pointValue),exposureBudget/(close*pointValue)))/step)*step;
 return {valid:distance>tick&&stopPct<=maxStopPct&&qty>=step,entry:close,stop,riskDistance:distance,stopPct,
  qty,tp1:close+distance*pineSpec.tp1R,tp2:close+distance*pineSpec.tp2R,
  stopOK:distance>tick&&stopPct<=maxStopPct,qtyOK:qty>=step};
}
export function parityPrerequisites({sourceVolumeConsolidated=false,hasBenchmarks=false,hasConfirmed4H=false,hasConfirmed1D=false,hasIndicatorParity=false}={}){
 const missing=[];
 if(!sourceVolumeConsolidated)missing.push('consolidated_volume');
 if(!hasBenchmarks)missing.push('SPY_QQQ_BTC_market_context');
 if(!hasConfirmed4H)missing.push('confirmed_4H_alignment');
 if(!hasConfirmed1D)missing.push('confirmed_1D_alignment');
 if(!hasIndicatorParity)missing.push('indicator_parity');
 return {canValidateSignals:missing.length===0,missing};
}
