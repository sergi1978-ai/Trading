import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {ema,rma,rsi,atr,macd,dmi,snapshot,validateBars,compare} from '../lib/long-ai-515-parity.js';
test('EMA starts at SMA and is constant for constant inputs',()=>{const a=ema(Array(60).fill(100),20);assert.equal(a[18],null);assert.equal(a[19],100);assert.equal(a[59],100)});
test('Wilder RMA seeds after n numeric values',()=>{const a=rma([null,2,2,2,2],3);assert.equal(a[2],null);assert.equal(a[3],2);assert.equal(a[4],2)});
test('RSI of steadily increasing closes is 100',()=>{const a=rsi(Array.from({length:70},(_,i)=>100+i));assert.equal(a.at(-1),100)});
test('constant candle range produces stable ATR',()=>{const bars=Array.from({length:70},(_,i)=>({t:i+1,o:100,h:101,l:99,c:100,v:100}));assert.equal(atr(bars).at(-1),2);assert.equal(dmi(bars).adx.at(-1),null);assert.equal(snapshot(bars).ok,false)});
test('invalid or duplicate candles are rejected',()=>{const bars=[{t:1,o:2,h:3,l:1,c:2,v:10},{t:1,o:2,h:3,l:1,c:2,v:10}];assert.ok(validateBars(bars))});
test('MACD is zero on constant close',()=>{const m=macd(Array(80).fill(50));assert.equal(m.line.at(-1),0);assert.equal(m.hist.at(-1),0)});
test('comparison never verifies missing values',()=>{const x=compare({close:1},{close:1});assert.equal(x.verified,false)});

import {aggregateCrypto} from '../lib/long-ai-515-timeframes.js';
test('UTC crypto 4H and daily candles require complete groups',()=>{
 const bars=Array.from({length:49},(_,i)=>({t:i*3600000,o:100,h:102,l:99,c:101,v:10}));
 const x=aggregateCrypto(bars,49*3600000);
 assert.equal(x.four.length,12);
 assert.equal(x.daily.length,2);
 assert.equal(x.four[0].v,40);
 assert.equal(x.daily[0].v,240);
});
test('unfinished UTC group is excluded',()=>{
 const bars=Array.from({length:7},(_,i)=>({t:i*3600000,o:100,h:102,l:99,c:101,v:10}));
 assert.equal(aggregateCrypto(bars,7*3600000).four.length,1);
});
