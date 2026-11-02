import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateOpportunity,appendObservation} from '../lib/long-ai-515-candidates.js';
test('potential and entry quality remain distinct',()=>{
 const x={symbol:'TEST',price:100,operationalQuality:35,anticipationScore:90,radarScore:80,rvol:1.5};
 const v=evaluateOpportunity(x);
 assert.equal(typeof v.entryScore,'number');
 assert.equal(typeof v.potentialScore,'number');
 assert.notEqual(v.entryScore,v.potentialScore);
 assert.equal(v.potentialIsForecast,false);
});
test('missing metrics are not silently called confirmed trades',()=>{
 const v=evaluateOpportunity({symbol:'EMPTY',price:100});
 assert.equal(v.entryScore,null);
 assert.equal(v.potentialScore,null);
 assert.equal(v.verifiedPine,false);
});
test('observations deduplicate by closed bar and symbol',()=>{
 const x={symbol:'TEST',analysisPrice:100,technicalBarTime:'2026-11-02T15:00:00Z',operationalQuality:80};
 const first=appendObservation([],'stocks',x,'2026-11-02T16:00:00Z');
 assert.equal(first.length,1);
 assert.equal(appendObservation(first,'stocks',x,'2026-11-02T16:05:00Z').length,1);
});
test('reject future bars and invalid prices',()=>{
 const x={symbol:'TEST',analysisPrice:100,technicalBarTime:'2026-11-03T15:00:00Z'};
 assert.equal(appendObservation([],'stocks',x,'2026-11-02T16:00:00Z').length,0);
});
