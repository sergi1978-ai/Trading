import test from 'node:test';import assert from 'node:assert/strict';import {dmiSeries} from '../lib/learning-lab/dmi.js';
test('ADX is unavailable until DI and ADX warmup complete',()=>{const bars=Array.from({length:27},(_,i)=>({h:101+i,l:99+i,c:100+i}));const x=dmiSeries(bars);assert.equal(x[13].adx,null);assert.equal(x[26].adx,null);});
test('sustained uptrend produces stronger positive directional movement',()=>{const bars=Array.from({length:65},(_,i)=>({h:101+i,l:99+i,c:100+i}));const x=dmiSeries(bars).at(-1);assert.ok(x.diPlus>x.diMinus);assert.ok(x.adx>90);});
test('flat bars do not divide by zero',()=>{const bars=Array.from({length:50},()=>({h:100,l:100,c:100}));const x=dmiSeries(bars).at(-1);assert.equal(x.adx,0);});
