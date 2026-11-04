import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/backtest.js';

function invoke(method, body, query={}) {
  return new Promise((resolve,reject)=>{
    const req={method,body,query};
    const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},
      status(n){this.statusCode=n;return this;},json(data){resolve({status:this.statusCode,data});return this;}};
    Promise.resolve(handler(req,res)).catch(reject);
  });
}
test('POST: calculates aggregate and per-motor results',async()=>{
  const {status,data}=await invoke('POST',{source:'test',trades:[
    {motor:'A',returnPct:2},{motor:'A',returnPct:-1},{motor:'C',returnPct:3}]});
  assert.equal(status,200);assert.equal(data.total.count,3);
  assert.equal(data.total.winRatePct,66.67);
  assert.equal(data.byMotor.A.count,2);assert.equal(data.byMotor.C.count,1);
  assert.equal(data.total.profitFactor,5);
});
test('POST: empty sample returns null win rate',async()=>{
  const {status,data}=await invoke('POST',{trades:[]});
  assert.equal(status,200);assert.equal(data.total.count,0);
  assert.equal(data.total.winRatePct,null);
  assert.equal(data.total.insufficientSample,true);
});
test('POST: invalid input rejected',async()=>{
  for(const body of [{trades:[{returnPct:'5'}]},{trades:[{returnPct:Infinity}]},{trades:'wrong'}]){
    const {status}=await invoke('POST',body);assert.equal(status,400);
  }
});
test('GET: existing backtest route remains available',async()=>{
  const {status}=await invoke('GET',null,{symbol:'INVALID!!!'});
  assert.ok([400,503].includes(status));
});
