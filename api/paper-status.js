import {loadPaper} from './_paper-store.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!process.env.PAPER_READ_TOKEN||req.headers.authorization!=='Bearer '+process.env.PAPER_READ_TOKEN)return res.status(401).json({error:'Read access denied'});
 try{const state=await loadPaper();return res.status(200).json({trades:state.trades||[],lastRun:state.lastRun||null,checks:state.checks||0,issues:state.issues||[]})}
 catch(e){return res.status(503).json({error:String(e.message||e)})}
}
