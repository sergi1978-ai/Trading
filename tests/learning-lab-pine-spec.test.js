import test from 'node:test';import assert from 'node:assert/strict';
import {pineSpec,selectConfirmedMotor,riskPlan,parityPrerequisites} from '../lib/learning-lab/pine-v5281-spec.js';
test('Pine v5.28.1 prioritizes E then F then C then A',()=>{
 assert.equal(selectConfirmedMotor({A:true,C:true,E:true,F:true}),'E');
 assert.equal(selectConfirmedMotor({A:true,C:true,E:true,F:true},{A:true,C:true,E:false,F:true}),'F');
 assert.equal(selectConfirmedMotor({A:false,C:false,E:false,F:false}),'');
});
test('Pine original risk is bounded by exposure and risk budgets',()=>{
 const p=riskPlan({close:100,atr:1,priorLow:99,capital:10000});
 assert.equal(p.stop,98.5);assert.equal(p.qty,25);assert.equal(p.stopPct,1.5);
 assert.equal(p.tp1,102.25);assert.equal(p.tp2,104.5);assert.equal(p.valid,true);
});
test('stock stop above 3 percent is rejected, not silently capped',()=>{
 const p=riskPlan({close:100,atr:3,priorLow:95});
 assert.equal(p.stopOK,false);assert.equal(p.valid,false);
});
test('execution contract includes close fills and two-sided commission',()=>{
 assert.equal(pineSpec.processOrdersOnClose,true);assert.equal(pineSpec.commissionPercentPerSide,0.1);
 assert.equal(pineSpec.slippageTicks,2);
});
test('no validated Pine signals without data and indicator parity',()=>{
 const x=parityPrerequisites();assert.equal(x.canValidateSignals,false);assert.equal(x.missing.length,5);
});
