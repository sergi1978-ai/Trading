// Independent gate for research -> paper trading (NOT for live orders).
// Missing evidence is a blocker, never an implicit pass.
export function assessProfitReadiness(evidence={}){
 const blockers=[];
 const requireFlag=(key,reason)=>{if(evidence[key]!==true)blockers.push(reason)};
 requireFlag('dataParityVerified','DATA_PARITY_UNVERIFIED');
 requireFlag('pineCompiledAndCompared','PINE_PARITY_UNVERIFIED');
 requireFlag('noLookaheadAuditPassed','LOOKAHEAD_AUDIT_MISSING');
 requireFlag('sameSymbolCostStressPassed','COST_STRESS_MISSING');
 const checks=[
  ['outOfSampleClosedTrades',100,(v)=>Number.isInteger(v)&&v>=100,'OOS_TRADES_BELOW_100'],
  ['outOfSampleProfitFactor',1.2,(v)=>Number.isFinite(v)&&v>=1.2,'NET_PROFIT_FACTOR_BELOW_1_2'],
  ['outOfSampleMeanR',0,(v)=>Number.isFinite(v)&&v>0,'NONPOSITIVE_EXPECTANCY'],
  ['positiveWalkForwardFraction',.6,(v)=>Number.isFinite(v)&&v>=.6&&v<=1,'WALK_FORWARD_NOT_STABLE'],
  ['maxObservedDrawdownPct',15,(v)=>Number.isFinite(v)&&v>=0&&v<=15,'DRAWDOWN_ABOVE_15_OR_MISSING']
 ];
 for(const [field,_,passes,code] of checks)if(!passes(evidence[field]))blockers.push(code);
 return {stage:blockers.length?'LAB_ONLY':'PAPER_ELIGIBLE',
   paperTradingEligible:blockers.length===0,liveOrdersEligible:false,
   blockers,criteria:'No live order authorization; paper trial only after independent evidence'};
}
