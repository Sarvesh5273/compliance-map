import 'dotenv/config';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { TinyFishProvider } from '../server/tinyfish';
import { isOfficialUrl } from '../server/report';
import type { ComparisonInput } from '../shared/types';

const provider=new TinyFishProvider();
await mkdir('data/evidence',{recursive:true});
for(const id of ['cafe','company']){
 const input=JSON.parse(await readFile(`data/raw/${id}-input.json`,'utf8')) as ComparisonInput;
 const results=await Promise.allSettled(input.places.map(async place=>({place,checkedAt:new Date().toISOString(),query:`${input.activity} ${place} official government registration licence fees renewals`,sources:(await provider.search(`${input.activity} ${place} official government registration licence fees renewals`)).filter(source=>isOfficialUrl(source.url))})));
 const receipts=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
 await writeFile(`data/evidence/${id}-discovery.json`,JSON.stringify(receipts,null,2));
 console.log(JSON.stringify({id,authorities:receipts.map(result=>({place:result.place,urls:result.sources.map(source=>source.url)})),failures:results.filter(result=>result.status==='rejected').map(result=>String(result.reason))}));
}
