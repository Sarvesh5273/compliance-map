import { readFile, writeFile } from 'node:fs/promises';
import { finalizeComparison, parseResearchJson } from '../server/report';
for(const id of ['cafe','company']){
 const example=JSON.parse(await readFile(`data/examples/${id}.json`,'utf8'));
 const reviewed=JSON.parse(await readFile(`data/reviewed/${id}-run.json`,'utf8'));
 const discovery=JSON.parse(await readFile(`data/evidence/${id}-discovery.json`,'utf8'));
 const report=example.job.report;
 report.assumptions=[example.job.input.context];
 for(const place of report.places){
  for(const r of place.requirements){
   if(id==='cafe'&&/Food Business Registration/.test(r.title)){
    r.description='Register the food business with its local authority at least 28 days before opening. Official food-business registration guidance states that registration is free. An individual confirmation target is not an overall approval time.';
    r.steps=['Register with the relevant local food authority at least 28 days before opening.','Provide operator, premises, activity and proposed opening details.','Prepare the applicable food-safety records and respond to the authority’s inspection process.'];
   }
   if(id==='cafe'&&/Food Hygiene Rating \(FHRS\)/.test(r.title))r.description='The local authority inspects food businesses and issues a hygiene rating. Inspection timing depends on risk; a fixed local reinspection interval has not been established in this report. Public rating display in England is voluntary.';
   if(id==='cafe'&&r.id.endsWith('edi-03'))r.title='Alcohol premises licensing — confirm the no-alcohol exemption';
   if(id==='company'&&r.id.endsWith('WY-TX-002'))r.title='Wyoming state income-tax obligations — not established';
   if(id==='company'&&r.id.endsWith('WY-OL-001'))r.title='General state operating licence — applicability unresolved';
  }
 }
 finalizeComparison(report);
 const structured=parseResearchJson(reviewed.deep_result.result);
 structured.assumptions=report.assumptions;
 for(const place of structured.places){const checked=report.places.find((p:any)=>p.name===place.name);place.summary=checked.summary;for(const r of place.requirements){const checkedRow=checked.requirements.find((x:any)=>x.id.endsWith(`-${r.id}`));if(checkedRow){r.title=checkedRow.title;r.description=checkedRow.description;r.steps=checkedRow.steps;}}}
 report.rawReport=JSON.stringify(structured);
 example.job.report.methodology.endpoints=['TinySearch','TinyResearch','TinyFetch'];
 example.job.report.methodology.notes.push('This saved example was semantically reviewed against live official sources. TinySearch separately corroborated regulatory authorities; the original TinyResearch response is archived unchanged.');
 example.job.report.methodology.notes.push(...reviewed.compliance_review.corrections);
 report.warnings=[...new Set(report.warnings)];
 report.methodology.notes=[...new Set(report.methodology.notes)];
 example.summary.description='Saved live TinyResearch, with dated independent TinyFetch checks and documented semantic review. Original provider output is archived unchanged.';
 await writeFile(`data/examples/${id}.json`,JSON.stringify(example,null,2));
 await writeFile(`data/examples/${id}-provenance.json`,JSON.stringify({researchRunId:example.job.researchRunId,createdAt:example.job.createdAt,checkedAt:example.job.updatedAt,semanticReview:reviewed.compliance_review,discovery,sourceEvidence:example.job.report.sources},null,2));
 console.log(JSON.stringify({id,requirements:example.job.report.places.reduce((sum:number,p:any)=>sum+p.requirements.length,0),matchedSources:example.job.report.methodology.verifiedSourceCount,sources:example.job.report.sources.length,checkedAt:example.job.updatedAt}));
}
