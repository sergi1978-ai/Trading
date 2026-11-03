import test from 'node:test';import assert from 'node:assert/strict';
import {emaSeries,rsiSeries,atrSeries,macdSeries,indicatorSnapshot} from '../lib/learning-lab/indicators.js';
test('EMA seeds from SMA and never uses future values',()=>{
 const x=Array.from({length:60},(_,i)=>100+i);
 const a=emaSeries(x,20);assert.equal(a[18],null);assert.equal(a[19],109.5);
 assert.equal(a[30],emaSeries(x.slice(0,31),20).at(-1));
});
test('Wilder RSI on constant and increasing closes',()=>{
 assert.equal(rsiSeries(Array(30).fill(100))[14],50);
 assert.equal(rsiSeries(Array.from({length:30},(_,i)=>100+i))[14],100);
});
test('ATR true range and no lookahead',()=>{
 const bars=Array.from({length:30},(_,i)=>({t:String(i),o:100,h:102,l:98,c:100,v:10}));
 assert.equal(atrSeries(bars,14)[13],4);
 assert.equal(atrSeries(bars.slice(0,20),14).at(-1),atrSeries(bars,14)[19]);
});
test('MACD signal waits for sufficient history',()=>{
 const m=macdSeries(Array.from({length:60},(_,i)=>100+i));
 assert.equal(m[24].line,null);assert.equal(m[25].signal,null);
 assert.ok(Number.isFinite(m[33].signal));
});
test('snapshot disables trade signals and volume-derived confirmations',()=>{
 const bars=Array.from({length:70},(_,i)=>({t:String(i),o:100+i,h:102+i,l:99+i,c:101+i,v:100}));
 const s=indicatorSnapshot(bars);assert.equal(s.tradeSignalsEnabled,false);assert.equal(s.volumeSignalEnabled,false);
 assert.ok(Number.isFinite(s.ema50));assert.ok(Number.isFinite(s.rsi14));
});
