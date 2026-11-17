import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ComparisonJob, ExampleSummary } from '../shared/types.js';

export const dataDirectory = path.resolve(process.env.COMPLIANCE_DATA_DIR || 'data');
const validId = (id: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(id);

export async function writeJson(relative: string, value: unknown) {
  const destination = path.join(dataDirectory, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporary, destination);
}

export async function saveJob(job: ComparisonJob) { if (!validId(job.id)) throw new Error('Invalid job ID'); await writeJson(`jobs/${job.id}.json`, job); }
export async function getSavedJob(id: string): Promise<ComparisonJob | null> {
  if (!validId(id)) return null;
  try { return JSON.parse(await readFile(path.join(dataDirectory, 'jobs', `${id}.json`), 'utf8')); } catch { return null; }
}
export async function listSavedJobs(): Promise<ComparisonJob[]> {
  try {
    const names = await readdir(path.join(dataDirectory, 'jobs'));
    const jobs = await Promise.all(names.filter(n => n.endsWith('.json')).map(n => getSavedJob(n.slice(0, -5))));
    return jobs.filter((j): j is ComparisonJob => Boolean(j));
  } catch { return []; }
}
export async function saveExample(job: ComparisonJob, summary: ExampleSummary) {
  if (!validId(summary.id)) throw new Error('Invalid example ID');
  await writeJson(`examples/${summary.id}.json`, { job: { ...job, savedExample: true }, summary });
}
export async function getExample(id: string): Promise<{ job: ComparisonJob; summary: ExampleSummary } | null> {
  if (!validId(id)) return null;
  try {
    const parsed = JSON.parse(await readFile(path.join(dataDirectory, 'examples', `${id}.json`), 'utf8'));
    return parsed?.job?.report && parsed?.summary ? parsed : null;
  } catch { return null; }
}
export async function listExamples(): Promise<ExampleSummary[]> {
  try {
    const names = await readdir(path.join(dataDirectory, 'examples'));
    const examples = await Promise.all(names.filter(n => n.endsWith('.json')).map(n => getExample(n.slice(0,-5))));
    return examples.flatMap(e => e ? [e.summary] : []);
  } catch { return []; }
}
export async function readRaw(id: string): Promise<unknown | null> {
  if (!validId(id)) return null;
  try { return JSON.parse(await readFile(path.join(dataDirectory, 'raw', `${id}-run.json`), 'utf8')); } catch { return null; }
}
export async function readDiscovery(id: string): Promise<unknown | null> {
  if (!validId(id)) return null;
  try { return JSON.parse(await readFile(path.join(dataDirectory, 'raw', `${id}-discovery.json`), 'utf8')); } catch { return null; }
}
