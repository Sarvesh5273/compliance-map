import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import type { ComparisonInput, ComparisonJob } from '../shared/types.js';
import { normalizeResearchReport, verifyReportSources } from './report.js';
import { saveExample } from './storage.js';
import { TinyFishProvider, type ResearchRun } from './tinyfish.js';

export async function importExample(rawFile: string, inputFile: string, id: string, title: string, provider = new TinyFishProvider()) {
  const run: ResearchRun = JSON.parse(await readFile(rawFile,'utf8'));
  const input: ComparisonInput = JSON.parse(await readFile(inputFile,'utf8'));
  if(run.status !== 'COMPLETED') throw new Error('Only an actual completed TinyResearch run can be published as a saved example.');
  const report = await verifyReportSources(normalizeResearchReport(input,run,id),provider,(complete,total)=>console.log(`Verified pages ${complete}/${total}`));
  const now = new Date().toISOString();
  const job: ComparisonJob = {id,status:'complete',input,createdAt:run.created_at || now,updatedAt:now,progress:{label:'Saved live research example'},report,researchRunId:run.research_run_id,savedExample:true};
  await saveExample(job,{id,title,activity:input.activity,places:input.places,checkedAt:now,description:'Recorded from a real TinyResearch run and independently checked with live TinyFetch. Open a new comparison to refresh.'});
  console.log(JSON.stringify({id,sourceCount:report.sources.length,matchedSources:report.methodology.verifiedSourceCount,places:report.places.map(p=>({name:p.name,confirmed:p.coverage.confirmed,gaps:p.gaps.length}))}));
  return job;
}

if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const value = (name:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
  const raw = value('--raw'), input = value('--input'), id = value('--id');
  if(!raw||!input||!id){console.error('Usage: tsx server/import-example.ts --raw path --input path --id cafe --title "Café comparison"');process.exitCode=1;}
  else await importExample(raw,input,id,value('--title')||id).catch(error=>{console.error(error instanceof Error?error.message:'Import failed');process.exitCode=1;});
}
