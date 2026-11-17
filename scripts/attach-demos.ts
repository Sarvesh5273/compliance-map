import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { saveJob, getSavedJob, writeJson } from '../server/storage';
import type { ComparisonJob } from '../shared/types';

for(const id of ['cafe','company']){
 const manifest=JSON.parse(await readFile(`data/raw/${id}-manifest.json`,'utf8'));
 const jobId=`live-${id}`;
 const existing=await getSavedJob(jobId);
 if(!existing){
  const now=new Date().toISOString();
  const job:ComparisonJob={id:jobId,status:'researching',input:manifest.input,createdAt:manifest.startedAt,updatedAt:now,researchRunId:manifest.researchRunId,progress:{label:'Continuing the existing live TinyResearch demonstration'}};
  await saveJob(job);
  const discovery=JSON.parse(await readFile(`data/evidence/${id}-discovery.json`,'utf8'));
  await writeJson(`raw/${jobId}-discovery.json`,discovery.flatMap((record:any)=>record.sources));
 }
 const response=await fetch(`http://127.0.0.1:3001/api/comparisons/${jobId}/resume`,{method:'POST'});
 console.log(JSON.stringify({id,jobId,status:response.status,response:await response.json()}));
}
