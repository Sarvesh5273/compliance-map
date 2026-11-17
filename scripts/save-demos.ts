import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { getSavedJob, saveExample, writeJson } from '../server/storage';

for(const id of ['cafe','company']){
 const job=await getSavedJob(`live-${id}`);
 if(!job?.report||job.status!=='complete'){console.log(JSON.stringify({id,status:job?.status,error:job?.error}));continue}
 const manifest=JSON.parse(await readFile(`data/raw/${id}-manifest.json`,'utf8'));
 const report=job.report;
 const summary={id,title:manifest.title,activity:job.input.activity,places:job.input.places,checkedAt:report.generatedAt,description:'Saved from a completed TinyResearch run. Official pages and supporting passages independently checked using TinyFetch.'};
 await saveExample({...job,id,savedExample:true},summary);
 await writeJson(`examples/${id}-research.json`,JSON.parse(await readFile(`data/raw/live-${id}-run.json`,'utf8')));
 await writeJson(`examples/${id}-provenance.json`,{researchRunId:job.researchRunId,startedAt:job.createdAt,completedAt:job.updatedAt,discovery:JSON.parse(await readFile(`data/evidence/${id}-discovery.json`,'utf8')),sourceEvidence:report.sources});
 console.log(JSON.stringify({id,researchRunId:job.researchRunId,requirements:report.places.map(place=>({name:place.name,...place.coverage,total:place.totals.knownInitialCost,currency:place.totals.currency})),matchedSources:report.methodology.verifiedSourceCount,recommendation:report.recommendation.headline}));
}
