import test from 'node:test';
import assert from 'node:assert/strict';
import {reconstructFromMinuteBars, compareDaily} from '../lib/minute-parity.js';

const oneMinute = t => ({t:new Date(t).toISOString(),o:80000,h:80010,l:79990,c:80003,v:0});
const cryptoDay = (day='2026-10-24') => {
 const start=Date.parse(day+'T00:00:00Z');
 return Array.from({length:1440},(_,i)=>oneMinute(start+i*60000));
};

test('BTC: one complete UTC day builds exactly 24 x 1H, 6 x 4H and 1 x 1D',()=>{
 const r=reconstructFromMinuteBars(cryptoDay(),{market:'CRYPTO'});
 assert.equal(r.safeForSignals,true);
 assert.deepEqual([r.hourly.length,r.fourHour.length,r.daily.length],[24,6,1]);
 assert.deepEqual(r.fourHour.map(x=>x.durationMinutes),[240,240,240,240,240,240]);
 assert.deepEqual(r.fourHour.map(x=>x.t.slice(11,16)),['00:00','04:00','08:00','12:00','16:00','20:00']);
});
test('BTC: a legitimate zero-trade candle is not silently deleted or filled',()=>{
 const r=reconstructFromMinuteBars(cryptoDay(),{market:'CRYPTO'});
 assert.equal(r.safeForSignals,true);
 assert.equal(r.daily[0].v,0);
 assert.equal(r.daily[0].observedMinutes,1440);
});
test('BTC: seven missing minute timestamps remain auditable without inventing prices',()=>{
 const input=cryptoDay().filter((_,i)=>![20,21,250,560,845,1000,1430].includes(i));
 const r=reconstructFromMinuteBars(input,{market:'CRYPTO'});
 assert.equal(r.safeForSignals,true);
 assert.equal(r.diagnostics[0].observedMinutes,1433);
 assert.equal(r.diagnostics[0].missingMinutes,7);
});
test('BTC: reject material missing 1m data',()=>{
 const r=reconstructFromMinuteBars(cryptoDay().slice(0,1300),{market:'CRYPTO'});
 assert.equal(r.safeForSignals,false);
 assert.equal(r.daily.length,0);
});
test('BTC: avoid 1D lookahead at 23:59 UTC and accept at 00:00 next day',()=>{
 const bars=cryptoDay();
 const before=reconstructFromMinuteBars(bars,{market:'CRYPTO',asOf:'2026-10-24T23:59:00Z'});
 assert.equal(before.daily.length,0);
 assert.equal(before.fourHour.length,5);
 const after=reconstructFromMinuteBars(bars,{market:'CRYPTO',asOf:'2026-10-25T00:00:00Z'});
 assert.equal(after.daily.length,1);
 assert.equal(after.fourHour.length,6);
});
test('BTC: source 1D close mismatch on 2026-10-26 must fail strict comparison',()=>{
 const source={o:80047.745,h:80707.00795,l:79270.729270729,c:80007.24,v:1.295915362};
 const minuteRebuilt={...source,c:80011.435};
 const comparison=compareDaily(minuteRebuilt,source);
 assert.equal(comparison.valid,false);
 assert.ok(Math.abs(comparison.errors.c-4.195)<1e-8);
});
