// Private Vercel Blob persistent paper state; secrets never reach browser.
import {get,put} from '@vercel/blob';
const PATH='paper-trading/state-v1.json';
export async function loadPaper(){
 if(!process.env.BLOB_READ_WRITE_TOKEN)throw Error('BLOB_READ_WRITE_TOKEN missing');
 const blob=await get(PATH,{access:'private',useCache:false});
 if(!blob)return {trades:[],cursor:0,lastRun:null,checks:0};
 if(blob.statusCode!==200)throw Error('Blob read failed '+blob.statusCode);
 try{return JSON.parse(await new Response(blob.stream).text())}
 catch(_){throw Error('Paper blob corrupt: refusing overwrite')}
}
export async function savePaper(state){
 if(!process.env.BLOB_READ_WRITE_TOKEN)throw Error('BLOB_READ_WRITE_TOKEN missing');
 return put(PATH,JSON.stringify(state),{access:'private',overwrite:true,addRandomSuffix:false,contentType:'application/json'});
}
