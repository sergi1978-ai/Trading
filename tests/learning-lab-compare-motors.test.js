import test from 'node:test';import assert from 'node:assert/strict';
import {compareMotorDiagnostics} from '../lib/learning-lab/compare-motors.js';
test('comparisons are explicitly not TradingView verified',()=>{
 const x=compareMotorDiagnostics({pineReferenceEntry:100,pineReferenceStop:98,pineReferenceTarget:105},{version:'5.28.1',selectedMotor:'A',risk:{entry:100,stop:97,tp1:104,tp2:107}});
 assert.equal(x.verifiedTradingView,false);
 assert.ok(x.discrepancies.includes('Stop'));
 assert.ok(x.checks.find(c=>c.name==='Entrada').matches);
});
test('missing data never yields agreement',()=>{assert.equal(compareMotorDiagnostics(null,null).status,'MISSING_DATA')});
