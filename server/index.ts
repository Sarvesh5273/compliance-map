import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATEGORIES, type ComparisonInput, type ComparisonJob, type JobStatus } from '../shared/types.js';
import { TinyFishProvider, ProviderError } from './tinyfish.js';
import { buildResearchPrompt } from './prompt.js';
import { isOfficialUrl, normalizeResearchReport, verifyReportSources } from './report.js';
import { getExample, getSavedJob, listExamples, listSavedJobs, readRaw, readDiscovery, saveJob, writeJson } from './storage.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function validateInput(value: unknown): ComparisonInput {
  const v = value as Partial<ComparisonInput> | null;
  if (!v || typeof v.activity !== 'string' || v.activity.trim().length < 3 || v.activity.length > 200) throw new ProviderError('INVALID_INPUT', 'Describe an activity in 3–200 characters.', 400);
  if (!Array.isArray(v.places) || v.places.length < 3 || v.places.length > 6 || v.places.some(p => typeof p !== 'string' || p.trim().length < 2 || p.length > 150)) throw new ProviderError('INVALID_INPUT', 'Provide between three and six places, including a country or state where needed.', 400);
  const places = v.places.map(p => p.trim());
  if (new Set(places.map(p => p.toLowerCase())).size !== places.length) throw new ProviderError('INVALID_INPUT', 'Each place must be different.', 400);
  if (v.context !== undefined && (typeof v.context !== 'string' || v.context.length > 2500)) throw new ProviderError('INVALID_INPUT', 'Business context must be at most 2,500 characters.', 400);
  const priority = v.priority || 'balanced';
  if (!['balanced','cost','speed','certainty'].includes(priority)) throw new ProviderError('INVALID_INPUT', 'Choose a supported comparison priority.', 400);
  return { activity: v.activity.trim(), places, context: v.context?.trim() || '', priority };
}

export function createApp(provider = new TinyFishProvider()) {
  const app = express();
  const jobs = new Map<string, ComparisonJob>();
  const running = new Set<string>();
  app.disable('x-powered-by');
  app.use(cors({ origin: false }));
  app.use(express.json({ limit: '20kb' }));
  app.use('/api', (_req,res,next) => { res.setHeader('Cache-Control','no-store'); next(); });

  async function update(job: ComparisonJob, status: JobStatus, label: string) {
    job.status = status; job.updatedAt = new Date().toISOString(); job.progress.label = label;
    jobs.set(job.id,job); await saveJob(job);
  }

  async function processJob(job: ComparisonJob, resume = false) {
    if (running.has(job.id)) return;
    running.add(job.id);
    try {
      if (!resume || !job.researchRunId) {
        await update(job,'discovering','Discovering official regulatory authorities with TinySearch');
        const searched = await Promise.allSettled(job.input.places.map(place => provider.search(`${job.input.activity} ${place} government official licences registration fees requirements`)));
        const discovery = searched.flatMap(r => r.status === 'fulfilled' ? r.value.filter(s => isOfficialUrl(s.url)) : []);
        await writeJson(`raw/${job.id}-discovery.json`, discovery);
        const domains = discovery.map(s => new URL(s.url).hostname);
        await update(job,'researching','TinyResearch is reading official rules and assembling the comparison');
        job.researchRunId = await provider.startResearch(buildResearchPrompt(job.input,discovery),domains);
        await saveJob(job);
      }
      const start = Date.now();
      let transientFailures = 0;
      while (Date.now() - start < 46 * 60 * 1000) {
        let run;
        try { run = await provider.getResearch(job.researchRunId!); transientFailures = 0; }
        catch (error) {
          transientFailures++;
          if (transientFailures >= 5) throw error;
          job.progress.label = 'TinyResearch is still running. Reconnecting to its saved progress…';
          await sleep(20000); continue;
        }
        if (run.status === 'COMPLETED') {
          await writeJson(`raw/${job.id}-run.json`,run);
          await update(job,'verifying','TinyFetch is checking each official citation and quoted passage');
          const report = normalizeResearchReport(job.input,run,job.id);
          const discovery = await readDiscovery(job.id);
          if (!resume || (Array.isArray(discovery) && discovery.length > 0)) report.methodology.endpoints.unshift('TinySearch');
          job.report = await verifyReportSources(report,provider,(complete,total) => { job.progress = {label: `Checking official pages: ${complete} of ${total}`, completed:complete,total}; });
          await update(job,'complete','Comparison ready. Review evidence gaps before choosing a place.');
          return;
        }
        if (['FAILED','CANCELLED','TIMED_OUT'].includes(run.status)) {
          await writeJson(`raw/${job.id}-run.json`,run);
          throw new ProviderError(run.error?.code || run.status, `TinyResearch ended with ${run.status.toLowerCase()}. ${run.error?.message || 'No completed comparison is available.'}`, 502);
        }
        job.progress.label = run.status === 'QUEUED' ? 'TinyResearch is queued at the provider' : `TinyResearch is searching and reading official sources${run.iterations ? ` · ${run.iterations} research rounds` : ''}`;
        await sleep(Number(process.env.COMPLIANCE_POLL_MS || 20000));
      }
      throw new ProviderError('POLL_LIMIT','This run is taking longer than expected. Its TinyResearch ID is saved; resume polling without starting another paid run.',502);
    } catch (error) {
      if (error instanceof ProviderError && error.researchRunId) job.researchRunId = error.researchRunId;
      job.error = error instanceof Error ? error.message : 'The comparison could not be completed.';
      await update(job,'failed',job.error);
      console.error(`[comparison ${job.id}] ${error instanceof ProviderError ? error.code : 'FAILED'}`);
    } finally { running.delete(job.id); }
  }

  app.get('/api/health',(_req,res) => res.json({status:'ok',configured:provider.configured,accessRequired:Boolean(process.env.COMPLIANCE_ACCESS_TOKEN),service:'Compliance Map',endpoints:['TinySearch','TinyResearch','TinyFetch']}));
  app.get('/api/categories',(_req,res) => res.json(CATEGORIES));
  app.get('/api/examples',async (_req,res,next) => { try { res.json(await listExamples()); } catch (e) {next(e);} });
  app.get('/api/examples/:id',async (req,res,next) => { try { const example = await getExample(String(req.params.id)); if (!example) {res.status(404).json({error:'Example not found.'}); return;} res.json(example.job); } catch(e){next(e);} });

  app.post('/api/comparisons',async (req,res,next) => {
    try {
      if (process.env.COMPLIANCE_ACCESS_TOKEN && req.headers.authorization !== `Bearer ${process.env.COMPLIANCE_ACCESS_TOKEN}`) throw new ProviderError('ACCESS_REQUIRED','Enter the deployment access token to start paid live research.',401);
      const input = validateInput(req.body);
      if (!provider.configured) throw new ProviderError('KEY_REQUIRED','Add TINYFISH_API_KEY to the server environment to run live research.',503);
      if (running.size >= 5) throw new ProviderError('LOCAL_BUSY','Five comparisons are already running on this server. Wait for one to finish.',429);
      const now = new Date().toISOString();
      const job: ComparisonJob = {id:randomUUID(),status:'queued',input,createdAt:now,updatedAt:now,progress:{label:'Preparing live research'}};
      await saveJob(job); jobs.set(job.id,job);
      res.status(202).json({jobId:job.id});
      void processJob(job);
    } catch(e){next(e);}
  });

  app.get('/api/comparisons/:id',async (req,res,next) => { try { const id = String(req.params.id); const job = jobs.get(id) || await getSavedJob(id); if(!job){res.status(404).json({error:'Comparison not found.'});return;} res.json(job); }catch(e){next(e);} });
  app.get('/api/comparisons/:id/export',async (req,res,next) => { try { const id = String(req.params.id); const job = jobs.get(id) || await getSavedJob(id); if(!job?.report){res.status(404).json({error:'Completed comparison not found.'});return;} res.setHeader('Content-Disposition',`attachment; filename="compliance-map-${job.id}.json"`);res.json(job.report); }catch(e){next(e);} });
  app.get('/api/comparisons/:id/raw',async (req,res,next) => { try { const raw = await readRaw(String(req.params.id));if(!raw){res.status(404).json({error:'Research output is not available yet.'});return;}res.json(raw); }catch(e){next(e);} });
  app.post('/api/comparisons/:id/resume',async(req,res,next)=>{try{const id=String(req.params.id);const job=jobs.get(id)||await getSavedJob(id);if(!job?.researchRunId){res.status(404).json({error:'No existing TinyResearch run is available to resume.'});return;}if(job.status==='complete'){res.json({jobId:id});return;}delete job.error;await update(job,'researching','Reconnecting to the existing research run');res.json({jobId:id});void processJob(job,true);}catch(e){next(e);}});

  const staticDir = path.resolve('dist');
  app.use(express.static(staticDir));
  app.get('/{*path}',(req,res) => {
    if(req.path.startsWith('/api/')){res.status(404).json({error:'Endpoint not found.'});return;}
    res.sendFile(path.join(staticDir,'index.html'),error=>{if(error&&!res.headersSent)res.status(503).send('Build the frontend with npm run build, or use the Vite development server.');});
  });
  app.use((error: unknown,_req:express.Request,res:express.Response,_next:express.NextFunction) => {
    if(error instanceof ProviderError) {res.status(error.status).json({error:error.message,code:error.code,ambiguous:error.ambiguous});return;}
    if(error instanceof SyntaxError) {res.status(400).json({error:'Request body must be valid JSON.',code:'INVALID_INPUT'});return;}
    console.error('Server request failed'); res.status(500).json({error:'The server could not complete this request.'});
  });

  async function restore() {
    for(const job of await listSavedJobs()) {
      jobs.set(job.id,job);
      if(job.researchRunId&&!['complete','failed'].includes(job.status)) void processJob(job,true);
      else if(!job.researchRunId&&!['complete','failed'].includes(job.status)) {job.error='Server restarted before a research ID was confirmed. Check TinyFish history before starting again.';await update(job,'failed',job.error);}
    }
  }
  return {app,restore};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const {app,restore} = createApp();
  app.listen(Number(process.env.PORT || 3001),process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),()=>{console.log('Compliance Map API ready');void restore();});
}
