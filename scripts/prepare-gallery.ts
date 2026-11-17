import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import type { ComparisonJob, ExampleSummary } from '../shared/types';

await mkdir('public/examples',{recursive:true});
const summaries:ExampleSummary[]=[];
let files:string[]=[];try{files=await readdir('data/examples')}catch{}
for(const file of files.filter(name=>name.endsWith('.json')&&!name.endsWith('-provenance.json')&&!name.endsWith('-research.json'))){
 const example=JSON.parse(await readFile(`data/examples/${file}`,'utf8')) as {job:ComparisonJob;summary:ExampleSummary};
 if(example.job?.status!=='complete'||!example.job.savedExample||!example.job.report||!example.summary)throw new Error(`Invalid saved live example: ${file}`);
 summaries.push(example.summary);
 await writeFile(`public/examples/${file}`,JSON.stringify(example.job,null,2));
}
await writeFile('public/examples/manifest.json',JSON.stringify(summaries,null,2));
console.log(JSON.stringify({savedLiveExamples:summaries.map(example=>({id:example.id,checkedAt:example.checkedAt}))}));
