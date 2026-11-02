import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate,compression,walkForward} from '../lib/radar-v530-lab.js';
import {evaluateRisk,earlyDiagnosis} from '../lib/radar-v529.js';
test('stop takes precedence if stop and target touched in same candle',()=>{
 const bars=[{o:100,h:101,l:99,c:100},{o:100,h:110,l:90,c:102}];
 const result=simulate(bars,[{index:0,stop:95,target:105}]);
 assert.equal(result.count,1);
 assert.equal(result.trades[0].reason,'STOP');
 assert.ok(result.trades[0].netReturn<0);
});
test('never enters on signal candle',()=>{
 const bars=[{o:90,h:101,l:88,c:100},{o:102,h:105,l:101,c:104}];
 const r=simulate(bars,[{index:0,stop:95,target:110}]);
 assert.equal(r.trades[0].entryIndex,1);
});
test('reject invalid stop plans',()=>{
 assert.equal(evaluateRisk({trigger:100,stop:105,tp1:120}).valid,false);
 assert.equal(evaluateRisk({trigger:100,stop:95,tp1:110}).valid,true);
});
test('no pattern without evidence',()=>{
 assert.equal(earlyDiagnosis({symbol:'X'}).early,false);
 assert.equal(compression([]),null);
});
test('walk-forward reports windows without claiming Pine validation',()=>{
 const bars=Array.from({length:180},(_,i)=>({o:100+i*.01,h:101+i*.01,l:99+i*.01,c:100+i*.01}));
 const result=walkForward(bars,()=>[],{train:100,test:40});
 assert.equal(result.windows.length,2);
 assert.equal(result.validatedPine,false);
});
