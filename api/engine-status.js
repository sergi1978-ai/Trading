import {pineSpec,parityPrerequisites} from '../lib/learning-lab/pine-v5281-spec.js';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const readiness=parityPrerequisites();
 return res.status(200).json({version:pineSpec.version,entryPriority:pineSpec.entryPriority,scoreMinimum:pineSpec.scoreMinimum,riskPct:pineSpec.riskPct,maxExposurePct:pineSpec.maxExposurePct,stopStockATR:pineSpec.stopStockATR,maxStopStockPct:pineSpec.maxStopStockPct,commissionPercentPerSide:pineSpec.commissionPercentPerSide,slippageTicks:pineSpec.slippageTicks,canValidateSignals:readiness.canValidateSignals,missing:readiness.missing,engine:'specification_only',note:'Shared Pine v5.28.1 spec. Radar legacy scans remain independent and cannot authorize entries.'});
}
