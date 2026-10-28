import test from 'node:test';
import assert from 'node:assert/strict';
import {auditHourlyBars,reconstructClosedTimeframes} from '../lib/ohlcv-audit.js';
const candle=t=>({t,o:100,h:102,l:99,c:101,v:1000});
const crypto=Array.from({length:24},(_,h)=>candle(`2026-10-20T${String(h).padStart(2,'0')}:00:00Z`));
test('crypto UTC: 24 bars -> 6 four-hour candles and 1 daily',()=>{
 const r=reconstructClosedTimeframes(crypto,{market:'CRYPTO'});
 assert.equal(r.safeForSignals,true);
 assert.equal(r.hourly.length,24);assert.equal(r.fourHour.length,6);assert.equal(r.daily.length,1);
});
test('missing crypto hour blocks signals rather than synthesizing data',()=>{
 const a=auditHourlyBars(crypto.slice(1),{market:'CRYPTO'});
 assert.equal(a.valid,false);assert.equal(a.incompleteSessions[0].missingMinutes[0],0);
 assert.equal(reconstructClosedTimeframes(crypto.slice(1)).safeForSignals,false);
});
test('duplicate and malformed OHLCV are rejected',()=>{
 assert.equal(auditHourlyBars([...crypto,crypto[0]]).valid,false);
 assert.equal(auditHourlyBars([...crypto.slice(1),{...crypto[0],h:98}]).valid,false);
});
test('no future bars at earlier asOf timestamp',()=>{
 const r=reconstructClosedTimeframes(crypto,{market:'CRYPTO',asOf:'2026-10-20T12:00:00Z'});
 assert.equal(r.daily.length,0);assert.equal(r.fourHour.length,3);assert.equal(r.hourly.length,12);
});
test('New York regular session aggregation handles 16:00 close (EDT)',()=>{
 const start=Date.parse('2026-10-20T13:30:00Z');
 const bars=Array.from({length:7},(_,i)=>candle(new Date(start+i*3600000).toISOString()));
 const r=reconstructClosedTimeframes(bars,{market:'STOCK',asOf:'2026-10-20T20:00:00Z'});
 assert.equal(r.safeForSignals,true);
 assert.equal(r.daily.length,1);assert.equal(r.fourHour.length,2);assert.equal(r.hourly.length,7);
 assert.equal(r.daily[0].endExclusive,Date.parse('2026-10-20T20:00:00Z'));
 assert.equal(r.fourHour[1].endExclusive,Date.parse('2026-10-20T20:00:00Z'));
});

test('New York regular session follows standard-time UTC offset',()=>{
 const start=Date.parse('2026-11-03T14:30:00Z');
 const bars=Array.from({length:7},(_,i)=>candle(new Date(start+i*3600000).toISOString()));
 const r=reconstructClosedTimeframes(bars,{market:'STOCK',asOf:'2026-11-03T21:00:00Z'});
 assert.equal(r.safeForSignals,true);
 assert.equal(r.daily.length,1);
 assert.equal(r.daily[0].endExclusive,Date.parse('2026-11-03T21:00:00Z'));
});
test('partial NY trading session is rejected until exchange calendar is supported',()=>{
 const start=Date.parse('2026-11-27T14:30:00Z');
 const bars=Array.from({length:4},(_,i)=>candle(new Date(start+i*3600000).toISOString()));
 assert.equal(reconstructClosedTimeframes(bars,{market:'STOCK'}).safeForSignals,false);
});
