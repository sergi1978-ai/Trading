import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAlpacaCalendar,reconstructFromMinuteBars,compareDaily} from '../lib/minute-parity.js';
const candle=t=>({t:new Date(t).toISOString(),o:100,h:101,l:99,c:100.5,v:10});
function session(date,start,end){return [{date,open:`${date}T${start}:00`,close:`${date}T${end}:00`}];}
function data(start,count){return Array.from({length:count},(_,i)=>candle(start+i*60000));}
test('UTC NY DST and early close conversion',()=>{
 assert.equal(normalizeAlpacaCalendar(session('2026-10-20','09:30','16:00'))[0].start,Date.parse('2026-10-20T13:30Z'));
 assert.equal(normalizeAlpacaCalendar(session('2026-11-03','09:30','16:00'))[0].start,Date.parse('2026-11-03T14:30Z'));
 assert.equal(normalizeAlpacaCalendar(session('2026-11-27','09:30','13:00'))[0].end,Date.parse('2026-11-27T18:00Z'));
});
test('regular 390m session -> 7 hourly and 2 4h RTH blocks',()=>{
 const r=reconstructFromMinuteBars(data(Date.parse('2026-10-20T13:30Z'),390),{calendar:session('2026-10-20','09:30','16:00')});
 assert.equal(r.safeForSignals,true);assert.equal(r.hourly.length,7);assert.equal(r.fourHour.length,2);assert.equal(r.daily.length,1);
 assert.deepEqual(r.fourHour.map(b=>b.durationMinutes),[240,150]);
 assert.equal(r.hourly.at(-1).durationMinutes,30);
});
test('NYSE early close 210m session -> 4 hourly and one shortened 4h block',()=>{
 const r=reconstructFromMinuteBars(data(Date.parse('2026-11-27T14:30Z'),210),{calendar:session('2026-11-27','09:30','13:00')});
 assert.equal(r.safeForSignals,true);assert.deepEqual(r.fourHour.map(x=>x.durationMinutes),[210]);
 assert.deepEqual(r.hourly.map(x=>x.durationMinutes),[60,60,60,30]);
});
test('sparse IEX minutes allowed without filling invented prices',()=>{
 const bars=data(Date.parse('2026-10-20T13:30Z'),390).filter((_,i)=>![5,16,70,125,345].includes(i));
 const r=reconstructFromMinuteBars(bars,{calendar:session('2026-10-20','09:30','16:00')});
 assert.equal(r.safeForSignals,true);assert.equal(r.diagnostics[0].missingMinutes,5);
 assert.equal(r.daily[0].observedMinutes,385);
});
test('reject unexpectedly incomplete source rather than pretend it is complete',()=>{
 const r=reconstructFromMinuteBars(data(Date.parse('2026-10-20T13:30Z'),150),{calendar:session('2026-10-20','09:30','16:00')});
 assert.equal(r.safeForSignals,false);assert.equal(r.daily.length,0);
});
test('no future daily/4H candle prior to close',()=>{
 const r=reconstructFromMinuteBars(data(Date.parse('2026-10-20T13:30Z'),390),{calendar:session('2026-10-20','09:30','16:00'),asOf:'2026-10-20T17:00Z'});
 assert.equal(r.daily.length,0);assert.equal(r.fourHour.length,0);
});
test('premarket cannot alter regular session and is reported excluded',()=>{
 const t=Date.parse('2026-10-20T13:30Z');const all=[candle(t-60000),...data(t,390)];
 const r=reconstructFromMinuteBars(all,{calendar:session('2026-10-20','09:30','16:00')});
 assert.equal(r.excludedOutsideSession,1);assert.equal(r.daily[0].o,100);
});
test('daily comparison requires matching prices and volume tolerance',()=>{
 const x={o:100,h:102,l:99,c:101,v:10000};
 assert.equal(compareDaily(x,{...x,v:10020}).valid,true);
 assert.equal(compareDaily(x,{...x,o:101}).valid,false);
});
