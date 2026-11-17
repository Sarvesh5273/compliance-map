import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResearchReport, finalizeComparison } from '../server/report';
test('a partial annual-fee recommendation names the missing place and stays provisional',()=>{
 const places=['Alpha','Beta','Gamma'];
 const report=normalizeResearchReport({activity:'Synthetic test only',places,context:'Same scope',priority:'balanced'},{research_run_id:'synthetic',status:'COMPLETED',deep_result:{termination_reason:'planner_done',result:JSON.stringify({sources:places.map((name,i)=>({id:name,url:`https://agency.gov/${i}`,title:'Annual fee',quote:`Annual filing fee is ${i===0?60:800} dollars.`})),places:places.map((name,i)=>({name,currency:'USD',gaps:['Local costs unknown'],requirements:[{id:name,category:'renewals_and_filings',title:'Annual government filing',status:'required',sourceIds:[name],cost:{status:i===2?'unknown':'known',amountMin:i===2?null:i===0?60:800,amountMax:i===2?null:i===0?60:800,currency:'USD',basis:'Annual filing fee'},renewal:'Annual'}]}))})}},'synthetic');
 for(const source of report.sources)source.verification='matched';
 for(const place of report.places)for(const row of place.requirements)row.confidence='confirmed';
 finalizeComparison(report);
 assert.equal(report.recommendation.place,'Alpha');
 assert.equal(report.recommendation.provisional,true);
 assert.match(report.recommendation.reasoning,/2 of 3/);
 assert.match(report.recommendation.reasoning,/Gamma.*not sufficiently verified/);
 assert.doesNotMatch(report.recommendation.headline,/cheapest|easiest|fastest/);
});
