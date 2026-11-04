import test from 'node:test';import assert from 'node:assert/strict';
import {assessSourceQuality} from '../lib/learning-lab/source-quality.js';
const sample=(price,volume)=>({status:'compared',difference:{o:price,h:price,l:price,c:price,v:volume}});
test('IEX volume blocks motor parity even when OHLC prices agree',()=>{
 const q=assessSourceQuality({provider:'Alpaca IEX',independent:{compared:Array.from({length:6},()=>sample(0.1,-97))}});
 assert.equal(q.priceComparison.status,'provisional_pass');
 assert.equal(q.volumeComparison.status,'blocked');
 assert.equal(q.motorValidation.A,'blocked');
 assert.equal(q.volumeComparison.medianAbsoluteDifferencePct,97);
});
test('missing secondary data never passes price validation',()=>{
 const q=assessSourceQuality({provider:'Alpaca IEX',independent:{status:'unavailable'}});
 assert.equal(q.priceComparison.status,'needs_review');
 assert.equal(q.volumeComparison.status,'blocked');
});
test('large OHLC mismatch requires review',()=>{
 const q=assessSourceQuality({provider:'Alpaca IEX',independent:{compared:Array.from({length:6},()=>sample(0.8,-97))}});
 assert.equal(q.priceComparison.status,'needs_review');
});
