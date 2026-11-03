// Guardrails for volume-sensitive LONG AI signals.
// IEX volume is not a consolidated-market substitute.
export function assessSourceQuality({provider,independent}){
 const rows=(independent?.compared||[]).filter(x=>x.status==='compared');
 const priceDeltas=rows.flatMap(x=>['o','h','l','c'].map(k=>Math.abs(x.difference?.[k])).filter(Number.isFinite));
 const volumeDeltas=rows.map(x=>Math.abs(x.difference?.v)).filter(Number.isFinite);
 const maxPriceDifferencePct=priceDeltas.length?Math.max(...priceDeltas):null;
 const medianVolumeDifferencePct=volumeDeltas.length?[...volumeDeltas].sort((a,b)=>a-b)[Math.floor(volumeDeltas.length/2)]:null;
 const volumeCompatible=provider!=='Alpaca IEX'&&medianVolumeDifferencePct!==null&&medianVolumeDifferencePct<=10;
 return {priceComparison:{sessions:rows.length,maxDifferencePct:maxPriceDifferencePct,
   status:rows.length>=5&&maxPriceDifferencePct<=0.5?'provisional_pass':'needs_review'},
   volumeComparison:{medianAbsoluteDifferencePct:medianVolumeDifferencePct,status:volumeCompatible?'provisional_pass':'blocked',
    reason:'IEX does not represent consolidated US market volume; do not transfer TradingView RVOL thresholds.'},
   motorValidation:{A:'blocked',C:'blocked',E:'blocked',F:'blocked',
    reason:'Pine parity, 1H/4H alignment, volume source and signal rules are not yet validated.'}};
}
