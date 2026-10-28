import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProfitReadiness} from '../lib/profit-readiness.js';
test('missing evidence never promotes an experimental strategy',()=>{
 const r=assessProfitReadiness();
 assert.equal(r.stage,'LAB_ONLY');
 assert.equal(r.paperTradingEligible,false);
 assert.equal(r.liveOrdersEligible,false);
 assert.ok(r.blockers.includes('OOS_TRADES_BELOW_100'));
});
test('in-sample positive returns without 100 independent closed trades are blocked',()=>{
 const r=assessProfitReadiness({dataParityVerified:true,pineCompiledAndCompared:true,
 noLookaheadAuditPassed:true,sameSymbolCostStressPassed:true,
 outOfSampleClosedTrades:14,outOfSampleProfitFactor:1.7,outOfSampleMeanR:.1,
 positiveWalkForwardFraction:.8,maxObservedDrawdownPct:5});
 assert.equal(r.paperTradingEligible,false);
});
test('full evidence unlocks paper eligibility only, never live trading',()=>{
 const r=assessProfitReadiness({dataParityVerified:true,pineCompiledAndCompared:true,
 noLookaheadAuditPassed:true,sameSymbolCostStressPassed:true,
 outOfSampleClosedTrades:120,outOfSampleProfitFactor:1.25,outOfSampleMeanR:.15,
 positiveWalkForwardFraction:.7,maxObservedDrawdownPct:10});
 assert.equal(r.stage,'PAPER_ELIGIBLE');
 assert.equal(r.liveOrdersEligible,false);
});
