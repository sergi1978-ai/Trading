import test from 'node:test';
import assert from 'node:assert/strict';
import {commonMotor} from '../lib/learning-lab/common-motor.js';

const bars=(n,step,base=100)=>Array.from({length:n},(_,i)=>{const c=base+i*0.12+Math.sin(i/6);return {t:Date.UTC(2026,0,1)+i*step,o:c-.1,h:c+.5,l:c-.5,c,v:1000+i};});
test('both markets expose identical A/C/E/F motor contract',()=>{
 for(const market of ['stock','crypto']){
  const x=commonMotor({market,daily:bars(120,86400000),four:bars(120,14400000),hour:bars(120,3600000)});
  assert.deepEqual(Object.keys(x.motors).sort(),['A','C','E','F']);
  assert.equal(x.verifiedSignal,false);
  assert.equal(x.tradeAuthorized,false);
  assert.equal(x.parity,'NOT_VERIFIED');
  assert.equal(x.checks.volumeOK,false);
 }
});
test('insufficient history cannot produce a motor signal',()=>{
 const x=commonMotor({market:'stock',daily:[],four:[],hour:[]});
 assert.equal(x.status,'INSUFFICIENT_DATA');
 assert.equal(x.selectedMotor,null);
});
test('web-only market data never authorizes trades even if patterns appear',()=>{
 const x=commonMotor({market:'crypto',daily:bars(100,86400000),four:bars(100,14400000),hour:bars(100,3600000)});
 assert.equal(x.tradeAuthorized,false);
 assert.equal(x.verifiedSignal,false);
 assert.ok(x.missing.includes('consolidated_volume'));
});

test('unix-second timestamps produce same diagnostics as millisecond timestamps',()=>{
 const daily=bars(120,86400000),four=bars(120,14400000),hour=bars(120,3600000);
 const a=commonMotor({market:'crypto',daily,four,hour});
 const secs=rows=>rows.map(x=>({...x,t:x.t/1000}));
 const b=commonMotor({market:'crypto',daily:secs(daily),four:secs(four),hour:secs(hour)});
 assert.equal(a.status,b.status);
 assert.equal(a.checks.closed1H,b.checks.closed1H);
 assert.equal(a.checks.trend1D,b.checks.trend1D);
});
test('invalid OHLCV or duplicate candle timestamps block candidate selection',()=>{
 const daily=bars(120,86400000),four=bars(120,14400000),hour=bars(120,3600000);
 hour[2]={...hour[2],h:hour[2].l-1};
 const x=commonMotor({market:'stock',daily,four,hour});
 assert.equal(x.status,'INSUFFICIENT_DATA');
 assert.equal(x.selectedMotor,null);
});
