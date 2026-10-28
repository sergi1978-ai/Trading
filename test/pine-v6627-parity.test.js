import test from 'node:test';
import assert from 'node:assert/strict';
import {pineEma,pineAtr,pineV6627Core} from '../lib/pine-v6627-parity.js';
const base=Date.parse('2026-10-30T00:00:00Z');
function fixture(hoursCount=120,fourCount=120,daysCount=150){
 const mk=(step,count,finish)=>{
  const t0=finish-step*count;
  return Array.from({length:count},(_,i)=>{
    const t=t0+i*step,price=100+i*.05;
    return {t:new Date(t).toISOString(),endExclusive:new Date(t+step).toISOString(),o:price,h:price+1,l:price-1,c:price+.25,v:20000};
  });
 };
 return {hourly:mk(3600000,hoursCount,base+86400000),fourHour:mk(14400000,fourCount,base+86400000),
   daily:mk(86400000,daysCount,base+86400000)};
}
test('Pine EMA seeds from first non-na sample, not SMA of first N samples',()=>{
 const actual=pineEma([10,11,12],2);
 assert.ok(Math.abs(actual-11.555555555555555)<1e-9);
});
test('Pine ATR uses Wilder RMA after SMA seed',()=>{
 const b=[{o:1,h:3,l:1,c:2},{o:2,h:4,l:2,c:3},{o:3,h:5,l:3,c:4},{o:4,h:7,l:4,c:5}];
 assert.ok(Math.abs(pineAtr(b,3)-(2*(2/3)+3/3))<1e-10);
});
test('Pine [1]+lookahead_on keeps 4H candle ending at 04:00 excluded on 1H candle starting 03:00',()=>{
 const d=fixture();
 const a=pineV6627Core({...d,hourOpen:'2026-10-30T03:00:00Z'});
 const b=pineV6627Core({...d,hourOpen:'2026-10-30T04:00:00Z'});
 assert.equal(a.at.fourEnd,'2026-10-30T00:00:00.000Z');
 assert.equal(b.at.fourEnd,'2026-10-30T04:00:00.000Z');
});
test('daily candle ending at midnight is not visible before midnight on chart',()=>{
 const d=fixture();
 const before=pineV6627Core({...d,hourOpen:'2026-10-29T23:00:00Z'});
 const after=pineV6627Core({...d,hourOpen:'2026-10-30T00:00:00Z'});
 assert.equal(before.at.dayEnd,'2026-10-29T00:00:00.000Z');
 assert.equal(after.at.dayEnd,'2026-10-30T00:00:00.000Z');
});
test('current 1H bar must exist exactly: cannot substitute future 1H',()=>{
 const d=fixture();
 assert.throws(()=>pineV6627Core({...d,hourOpen:'2026-11-01T07:00:00Z'}),/Missing confirmed/);
});
test('4H and 1D history withheld until enough complete candles available',()=>{
 const d=fixture(120,20,150);
 const result=pineV6627Core({...d,hourOpen:'2026-10-30T04:00:00Z'});
 assert.equal(result.ready,false);assert.equal(result.reason,'INSUFFICIENT_HISTORY');
});

test('Pine READY gate refuses an open 1H candle at screenshot time',()=>{
 const d=fixture();
 assert.throws(()=>pineV6627Core({...d,hourOpen:'2026-10-30T03:00:00Z',asOf:'2026-10-30T03:39:00Z'}),/not confirmed/);
 const closed=pineV6627Core({...d,hourOpen:'2026-10-30T03:00:00Z',asOf:'2026-10-30T04:00:00Z'});
 assert.ok(closed.at.fourEnd==='2026-10-30T00:00:00.000Z');
});
