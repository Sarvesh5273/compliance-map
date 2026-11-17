import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
for (const id of ['cafe','company']) {
 let manifest; try {manifest=JSON.parse(await readFile(`data/raw/${id}-manifest.json`,'utf8'));} catch {continue;}
 const response=await fetch(`https://agent.tinyfish.ai/v1/research-run/${manifest.researchRunId}`,{headers:{'X-API-Key':process.env.TINYFISH_API_KEY!},signal:AbortSignal.timeout(60000)});
 const body=await response.json();
 await writeFile(`data/raw/${id}-run.json`,JSON.stringify(body,null,2));
 console.log(JSON.stringify({id,status:body.status??body.data?.status,researchRunId:manifest.researchRunId,keys:Object.keys(body),reportLength:body.deep_result?.result?.length,evidenceCount:Array.isArray(body.evidence)?body.evidence.length:null,error:body.error}));
}
