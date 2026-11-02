import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCandidate,evaluateOpportunity} from '../lib/long-ai-515-candidates.js';
test('crypto with boolean trends and score yields exploratory motors',()=>{
 const x={symbol:'SOL',type:'cripto',status:'PRE-SETUP',operationalDecision:'ESPERAR',score:58,operationalQuality:40,anticipationScore:72,rvol:1.7,trend1D:true,trend4H:true,price:140,ema20:138};
 const r=classifyCandidate(x);
 for(const k of ['A','C','E','F'])assert.equal(typeof r.motors[k],'number');
 assert.equal(r.verifiedPine,false);
});
test('no chase keeps exploratory scores but does not authorize entry',()=>{
 const x={symbol:'ONDO',status:'NO PERSEGUIR',operationalDecision:'NO PERSEGUIR',score:52,anticipationScore:65,rvol:2};
 const r=classifyCandidate(x);
 assert.equal(typeof r.motors.A,'number');
 assert.equal(r.preImpulse,false);
 assert.equal(r.initialBreak,false);
});
test('missing quality remains missing, not zero or fake',()=>{
 const r=evaluateOpportunity({symbol:'EMPTY',price:1});
 assert.equal(r.motors.A,null);
 assert.equal(r.entryScore,null);
});
