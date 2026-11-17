import { useEffect, useRef, useState } from 'react';

type Priority = 'balanced' | 'cost' | 'speed' | 'certainty';
type UnknownRecord = Record<string, unknown>;
type Job = { id: string; status: string; progress?: { label?: string; completed?: number; total?: number }; report?: unknown; error?: unknown; researchRunId?: string };
type Example = { id: string; title?: string; activity?: string; places?: string[]; checkedAt?: string; checked_at?: string };
type Source = { id: string; url: string; title: string; checkedAt: string; quote?: string; status?: string; official?: boolean; verificationNote?: string };
type Requirement = { id: string; category: string; title: string; description: string; step?: string; cost: unknown; time: unknown; renewal: unknown; ongoingFiling?: string; steps?: string[]; sources: Source[]; applicability?: string; status?: string; confidence?: string; gaps?: string[]; authority?: string };
type Place = { id: string; name: string; requirements: Requirement[]; gaps: string[]; summary: UnknownRecord; timeline: unknown; coverage: UnknownRecord };

const CATEGORY_LABELS: Record<string, string> = {
  business_registration: 'Business registration', operating_licence: 'Operating licences', operating_license: 'Operating licences',
  tax_registration: 'Tax registration', premises_and_safety: 'Premises & safety', sector_specific: 'Activity specific rules', renewals_and_filings: 'Renewals & ongoing filings',
};
const CATEGORIES = ['business_registration', 'operating_licence', 'tax_registration', 'premises_and_safety', 'sector_specific', 'renewals_and_filings'];
const PRIORITIES: { value: Priority; label: string; icon: string }[] = [{ value: 'balanced', label: 'Balanced', icon: 'balance' }, { value: 'cost', label: 'Lower cost', icon: 'coin' }, { value: 'speed', label: 'Faster launch', icon: 'clock' }, { value: 'certainty', label: 'Clearer rules', icon: 'shield' }];
const PRESETS = [
  { id: 'company', label: 'Register a company', icon: 'building', activity: 'Register a single member LLC', places: ['Wyoming, United States', 'Delaware, United States', 'California, United States'], context: 'A domestic LLC with one individual owner, no employees initially, and a standard non-regulated service business. Compare formation and recurring obligations. Flag costs and obligations that depend on physical business location.' },
  { id: 'cafe', label: 'Open a café', icon: 'cup', activity: 'Open a small café', places: ['Westminster, London, England', 'Manchester, England', 'Edinburgh, Scotland'], context: 'An independent café serving coffee and prepared food in leased commercial premises, with no alcohol and no outdoor seating. Include national, regional and local requirements; flag property-specific approvals and fees.' },
];
const record = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const str = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const texts = (value: unknown): string[] => array(value).map(v => typeof v === 'string' ? v : str(record(v).description) || str(record(v).message) || str(record(v).text)).filter(Boolean);
const dateLabel = (value: string): string => { const date = new Date(value); return !value || Number.isNaN(date.getTime()) ? 'Check date unavailable' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
const safeLink = (value: string): string | undefined => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; } };
const readable = (value: unknown): string => { if (typeof value === 'string') return value; if (typeof value === 'number') return String(value); const r = record(value); return str(r.display) || str(r.text) || str(r.description) || str(r.notes) || str(r.note) || ''; };
function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>, chevron: <path d="m9 5 7 7-7 7" />, down: <path d="m6 9 6 6 6-6" />,
    map: <><path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Z" /><path d="M9 2v17m6-14v17" /></>, plus: <path d="M12 5v14M5 12h14" />, x: <path d="m6 6 12 12M6 18 18 6" />,
    external: <><path d="M14 3h7v7m0-7L10 14" /><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></>, check: <path d="m5 12 4 4L19 6" />,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>, search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    coin: <><circle cx="12" cy="12" r="9" /><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12" /></>, clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    balance: <><path d="M12 3v18M5 21h14M4 7h16M6 7l-4 7h8L6 7Zm12 0-4 7h8l-4-7Z" /></>, pin: <><path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    cup: <><path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" /><path d="M16 9h2a3 3 0 0 1 0 6h-2M7 3v2m4-2v2m4-2v2M2 22h16" /></>,
    building: <><path d="M5 21V3h14v18M2 21h20M9 21v-4h6v4M9 7h1m4 0h1M9 11h1m4 0h1" /></>, alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3v.1" /></>,
    file: <><path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-7-7Z" /><path d="M14 2v7h7M7 14h10m-10 4h7" /></>, download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    print: <><path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6v-7Z" /></>, globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    spark: <><path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z" /></>, refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] || paths.file}</svg>;
}

function normalizeReport(raw: unknown): { activity: string; places: Place[]; recommendation: UnknownRecord; checkedAt: string; gaps: string[]; sources: Source[]; assumptions: string[]; methodology: string; raw: unknown } {
  const report = record(raw);
  const sourceRows = array(report.sources || report.evidence || report.citations);
  const sources: Source[] = sourceRows.map((v, index) => { const s = record(v); return { id: str(s.id || s.sourceId, String(index)), url: str(s.url), title: str(s.title, 'Source evidence'), checkedAt: str(s.checkedAt || s.checked_at || s.checkedDate || s.checked_date), quote: str(s.quote || s.excerpt || s.evidence), status: str(s.verification || s.status || s.verificationStatus), official: s.official === true, verificationNote: str(s.verificationNote) }; });
  const getSources = (r: UnknownRecord) => {
    const linked = array(r.sources || r.citations || r.sourceIds || r.source_ids).map((v): Source | undefined => {
      if (typeof v === 'string') return sources.find(s => s.id === v) || (safeLink(v) ? { id: v, url: v, title: 'Official source', checkedAt: '', quote: '' } : undefined);
      const s = record(v); const existing = sources.find(source => source.id === str(s.id || s.sourceId));
      return existing || (str(s.url) ? { id: str(s.id, str(s.url)), url: str(s.url), title: str(s.title, 'Source evidence'), checkedAt: str(s.checkedAt || s.checked_at || s.checkedDate), quote: str(s.quote || s.excerpt), status: str(s.verification || s.status), official: s.official === true, verificationNote: str(s.verificationNote) } : undefined);
    }).filter((v): v is Source => Boolean(v));
    const direct = str(r.sourceUrl || r.source_url);
    if (!linked.length && direct) linked.push(sources.find(s => s.url === direct) || { id: direct, url: direct, title: 'Official source', checkedAt: str(r.checkedAt || r.checked_at), quote: str(r.evidenceQuote || r.quote) });
    return linked;
  };
  const places = array(report.places || report.jurisdictions || report.comparisons).map((v, i) => {
    const p = record(v); const name = str(p.name || p.place || p.jurisdiction || p.label, `Place ${i + 1}`);
    const rows = array(p.requirements || p.steps || p.items).map((v, j) => { const r = record(v); return { id: str(r.id, `${i}-${j}`), category: str(r.category, 'sector_specific'), title: str(r.title || r.name || r.requirement, 'Requirement'), description: str(r.description || r.details || r.action), step: str(r.step), cost: r.cost || r.fee || r.fees, time: r.time || r.approvalTime || r.approval_time || r.processingTime || r.approval, renewal: r.renewal || r.renewals || r.ongoing || r.frequency, ongoingFiling: str(r.ongoingFiling), steps: texts(r.steps), sources: getSources(r), applicability: str(r.applicability || r.condition), status: str(r.status), confidence: str(r.confidence), gaps: texts(r.gaps), authority: str(r.authority || r.level) }; });
    return { id: str(p.id, String(i)), name, requirements: rows, gaps: texts(p.gaps || p.uncertainties), summary: record(p.totals || p.summary), timeline: p.timeline, coverage: record(p.coverage) };
  });
  return { activity: str(report.activity || record(report.input).activity, 'Compliance comparison'), places, recommendation: record(report.recommendation), checkedAt: str(report.generatedAt || report.generated_at || report.checkedAt || report.checked_at), gaps: texts(report.warnings || report.gaps || report.uncertainties), sources, assumptions: texts(report.assumptions || report.scope), methodology: readable(report.methodology), raw };
}

function ResearchIllustration() {
  return <div className="research-illustration" aria-hidden="true"><div className="orbital orbital-one" /><div className="orbital orbital-two" /><div className="illustration-grid" />
    <svg className="illustration-lines" viewBox="0 0 420 300"><path d="M90 103C178 95 149 212 270 213M90 103C140 5 278 42 314 101M270 213C375 220 377 108 314 101" fill="none" stroke="#80a198" strokeWidth="1.2" strokeDasharray="4 5" /><circle cx="211" cy="148" r="37" fill="#e5eddd" /><path d="m195 137 10-5 11 5 9-5v24l-9 5-11-5-10 5v-24ZM205 132v24m11-19v24" fill="none" stroke="#214b40" strokeWidth="1.7" /></svg>
    <div className="map-node node-one"><span><Icon name="pin" size={17} /></span><div>Place one<small>National + local rules</small></div><i /></div>
    <div className="map-node node-two"><span><Icon name="pin" size={17} /></span><div>Place two<small>Published fees & timing</small></div><i /></div>
    <div className="map-node node-three"><span><Icon name="pin" size={17} /></span><div>Place three<small>Ongoing obligations</small></div><i /></div>
    <div className="illustration-caption"><span className="tiny-dot" /> Different places. The same questions.</div>
  </div>;
}

function App() {
  const [activity, setActivity] = useState(PRESETS[0].activity);
  const [places, setPlaces] = useState<string[]>(PRESETS[0].places);
  const [context, setContext] = useState(PRESETS[0].context);
  const [priority, setPriority] = useState<Priority>('balanced');
  const [advanced, setAdvanced] = useState(false);
  const [health, setHealth] = useState<UnknownRecord | null>(null);
  const [examples, setExamples] = useState<Example[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pollSuspended, setPollSuspended] = useState(false);
  const [galleryMode, setGalleryMode] = useState(false);
  const [accessCode, setAccessCode] = useState(() => { try { return sessionStorage.getItem('compliance-map-access-code') || ''; } catch { return ''; } });
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(true);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const baseUrl = import.meta.env.BASE_URL || '/';
  const repoUrl = safeLink(import.meta.env.VITE_REPO_URL || '');
  const running = busy || Boolean(job && !['complete', 'failed'].includes(job.status));
  useEffect(() => {
    aliveRef.current = true;
    const initialize = async () => {
      let serviceHealth: UnknownRecord = { configured: false, unreachable: true };
      let staticMode = false;
      let available: Example[] = [];
      try { serviceHealth = record(await jsonRequest('/api/health')); } catch {}
      try { const data = await jsonRequest('/api/examples'); available = array(Array.isArray(data) ? data : record(data).examples).map(v => record(v) as Example); }
      catch { try { const data = await jsonRequest(`${baseUrl}examples/manifest.json`); available = array(Array.isArray(data) ? data : record(data).examples).map(v => record(v) as Example); staticMode = true; } catch {} }
      if (!aliveRef.current) return;
      setHealth(serviceHealth); setExamples(available); setGalleryMode(staticMode);
      const selectedExample = new URLSearchParams(window.location.search).get('example');
      if (selectedExample && available.some(example => example.id === selectedExample)) { try { const data = await fetchExample(selectedExample, staticMode); if (!aliveRef.current) return; applySavedExample(data, selectedExample); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load the saved report.'); } return; }
      if (staticMode) return;
      try { const previousId = sessionStorage.getItem('compliance-map-active-job'); if (previousId) { const requestId = ++requestRef.current; const data = await jsonRequest(`/api/comparisons/${encodeURIComponent(previousId)}`) as Job; if (!aliveRef.current || requestRef.current !== requestId) return; setJob(data); const input = record(record(data).input); if (str(input.activity)) setActivity(str(input.activity)); if (Array.isArray(input.places)) setPlaces(texts(input.places)); if (str(input.context)) setContext(str(input.context)); if (data.status === 'failed') setError(readable(data.error) || 'The research run needs attention.'); else if (data.status !== 'complete') schedulePoll(previousId, requestId); } } catch { try { sessionStorage.removeItem('compliance-map-active-job'); } catch {} }
    };
    void initialize();
    return () => { aliveRef.current = false; if (pollingRef.current) clearTimeout(pollingRef.current); };
  }, []);
  useEffect(() => {
    if (!activeSource && !methodOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button, a[href], input, textarea, [tabindex="0"]') || []).filter(element => !element.hasAttribute('disabled'));
    controls()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setActiveSource(null); setMethodOpen(false); }
      if (event.key === 'Tab') { const items = controls(); const first = items[0]; const last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    };
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey); return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [activeSource, methodOpen]);
  async function jsonRequest(url: string, init?: RequestInit) {
    const response = await fetch(url, init); const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(str(record(data).message || record(data).error, `Request failed (${response.status}).`));
    return data;
  }
  async function fetchExample(id: string, staticMode = galleryMode) {
    return jsonRequest(staticMode ? `${baseUrl}examples/${encodeURIComponent(id)}.json` : `/api/examples/${encodeURIComponent(id)}`);
  }
  function updateAccessCode(value: string) { setAccessCode(value); try { if (value) sessionStorage.setItem('compliance-map-access-code', value); else sessionStorage.removeItem('compliance-map-access-code'); } catch {} }
  function researchHeaders(): Record<string, string> { return { 'Content-Type': 'application/json', ...(accessCode.trim() ? { Authorization: `Bearer ${accessCode.trim()}` } : {}) }; }
  async function resumeResearch() {
    if (!job?.id || !job.researchRunId || galleryMode || busy) return;
    const id = job.id; const requestId = ++requestRef.current; setBusy(true); setError(''); setPollSuspended(false);
    try { await jsonRequest(`/api/comparisons/${encodeURIComponent(id)}/resume`, { method: 'POST', headers: researchHeaders() }); setJob({ ...job, status: 'researching', error: undefined, progress: { label: 'Reconnecting to the existing TinyResearch run' } }); try { sessionStorage.setItem('compliance-map-active-job', id); } catch {} schedulePoll(id, requestId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to resume the existing research run.'); }
    finally { setBusy(false); }
  }
  function applySavedExample(data: unknown, id: string) {
    const r = record(data); setJob({ id, status: 'complete', report: r.report || data }); setSaved(true);
    const input = record(r.input); if (str(input.context)) setContext(str(input.context)); if (str(input.activity)) setActivity(str(input.activity)); if (Array.isArray(input.places)) setPlaces(texts(input.places));
  }
  function schedulePoll(id: string, requestId: number, retry = 0) {
    pollingRef.current = setTimeout(async () => {
      try { const next = await jsonRequest(`/api/comparisons/${encodeURIComponent(id)}`) as Job;
        if (!aliveRef.current || requestRef.current !== requestId) return;
        setPollSuspended(false); setError('');
        setJob(next); if (next.status === 'failed') setError(readable(next.error) || str(record(next.error).message, 'The research did not finish. Resume this run to check the existing research without starting another paid request.'));
        else if (next.status !== 'complete') schedulePoll(id, requestId);
      } catch (e) { if (!aliveRef.current || requestRef.current !== requestId) return; if (retry < 2) { setError('Connection interrupted. Retrying the status check; your research may still be running.'); schedulePoll(id, requestId, retry + 1); } else { setError(`${e instanceof Error ? e.message : 'Lost connection to research.'} Resume status checks to reconnect to the same run.`); setPollSuspended(true); } }
    }, retry > 0 ? 5000 : 2500);
  }
  async function startComparison(event: React.FormEvent) {
    event.preventDefault(); if (running) return;
    if (galleryMode) { setError('This is a saved live research gallery. Start the full app to run a new TinyResearch comparison.'); return; }
    const cleaned = places.map(p => p.trim()).filter(Boolean);
    if (cleaned.length < 3) { setError('Add at least three distinct places to compare.'); return; }
    if (new Set(cleaned.map(p => p.toLowerCase())).size !== cleaned.length) { setError('Each place must be distinct.'); return; }
    if (!activity.trim()) { setError('Describe the activity you want to start.'); return; }
    setError(''); setSaved(false); setPollSuspended(false); setJob(null); setBusy(true); const requestId = ++requestRef.current;
    try { const data = record(await jsonRequest('/api/comparisons', { method: 'POST', headers: researchHeaders(), body: JSON.stringify({ activity: activity.trim(), places: cleaned, context: context.trim(), priority }) }));
      const id = str(data.jobId || data.id); if (!id) throw new Error('The research service did not return a job ID.');
      try { sessionStorage.setItem('compliance-map-active-job', id); } catch {}
      setJob({ id, status: 'queued', progress: { label: 'Preparing your research brief' } }); schedulePoll(id, requestId);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to start research.'); } finally { setBusy(false); }
  }
  async function selectPreset(preset: typeof PRESETS[number]) {
    if (running) return;
    setActivity(preset.activity); setPlaces(preset.places); setContext(preset.context); setError('');
    let available = examples;
    if (!available.length) { try { const latest = await jsonRequest(galleryMode ? `${baseUrl}examples/manifest.json` : '/api/examples'); available = array(Array.isArray(latest) ? latest : record(latest).examples).map(v => record(v) as Example); setExamples(available); } catch {} }
    const example = available.find(e => e.id === preset.id || e.id.toLowerCase().includes(preset.id) || str(e.activity).toLowerCase().includes(preset.id === 'cafe' ? 'café' : 'company'));
    if (!example) { setSaved(false); setJob(null); return; }
    setBusy(true); setPollSuspended(false); ++requestRef.current; if (pollingRef.current) clearTimeout(pollingRef.current);
    try { sessionStorage.removeItem('compliance-map-active-job'); } catch {}
    try { const data = await fetchExample(example.id); applySavedExample(data, example.id);
      const nextUrl = new URL(window.location.href); nextUrl.searchParams.set('example', example.id); window.history.replaceState(null, '', nextUrl);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load this saved report.'); } finally { setBusy(false); }
  }
  function exportReport() { if (!job?.report) return; const blob = new Blob([JSON.stringify(job.report, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `compliance-map-${job.id}.json`; link.click(); URL.revokeObjectURL(url); }
  const report = job?.report ? normalizeReport(job.report) : null;
  const checkedSources = report?.sources.filter(source => source.checkedAt !== '').length || 0;
  const winner = report ? str(report.recommendation.place || report.recommendation.recommendedPlace || report.recommendation.winner || report.recommendation.jurisdiction) : '';
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="#" aria-label="Compliance Map home"><span className="brand-mark"><Icon name="map" size={23} /></span><span>compliance<span className="brand-light">map</span></span></a><div className="header-right"><button className="text-button" onClick={() => setMethodOpen(true)}>Our research method <Icon name="external" size={13} /></button><span className="header-divider" /><span className="powered"><span className="tinyfish-symbol">✳</span> Powered by TinyFish</span></div></header>
    <main>
      {galleryMode && <div className="gallery-banner"><Icon name="file" size={16} /><div><strong>Saved live research gallery</strong><span>Explore two reports produced by live TinyResearch runs. Dates and evidence remain attached to each source.</span></div>{repoUrl && <a href={repoUrl} target="_blank" rel="noopener noreferrer">Get the full app <Icon name="external" size={13} /></a>}</div>}
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="tiny-dot" /> THE OFFICIAL ROUTE TO YOUR NEXT VENTURE</div><h1>A clearer place<br />to <span>start.</span></h1><p>One business idea. Different rules.<br />Compare the paperwork across places, with every<br className="desktop-break" /> confirmed requirement traced to its official source.</p><div className="hero-benefits"><span><Icon name="shield" size={15} /> Government sources</span><span><Icon name="clock" size={15} /> Checked dates</span><span><Icon name="file" size={15} /> Honest gaps</span></div></div><ResearchIllustration /></section>
      <section className="research-card" aria-labelledby="research-heading"><div className="card-heading"><div><div className="section-kicker">01 / YOUR STARTING POINT</div><h2 id="research-heading">What are you planning?</h2></div><span className="small-tag"><Icon name="globe" size={13} /> Built for any activity & place</span></div>
        <form onSubmit={startComparison}><label className="field-label" htmlFor="activity">Business activity <span>Be specific about what you’ll do</span></label><div className="activity-input"><Icon name="building" size={20} /><input id="activity" value={activity} onChange={e => setActivity(e.target.value)} maxLength={200} placeholder="e.g. Open a café serving food, without alcohol" disabled={running} required /></div>
          <div className="places-heading"><label className="field-label">Places to compare <span>Three to six cities, states, or countries</span></label><span className="place-count">{places.length} places</span></div><div className="places-inputs">{places.map((place, index) => <div className="place-input" key={index}><span className="place-number">{String(index + 1).padStart(2, '0')}</span><input aria-label={`Place ${index + 1}`} value={place} onChange={e => setPlaces(p => p.map((v, i) => i === index ? e.target.value : v))} maxLength={150} placeholder="City, state / country" required disabled={running} /><button type="button" className="remove-place" aria-label={`Remove place ${index + 1}`} onClick={() => setPlaces(p => p.filter((_, i) => i !== index))} disabled={places.length <= 3 || running}><Icon name="x" size={13} /></button></div>)}{places.length < 6 && <button type="button" className="add-place" onClick={() => setPlaces(p => [...p, ''])} disabled={running}><Icon name="plus" size={14} /> Add a place</button>}</div>
          <div className="form-bottom"><div className="priority-section"><div className="field-label">What matters most?</div><div className="priority-options">{PRIORITIES.map(p => <button type="button" key={p.value} className={`priority-button ${priority === p.value ? 'selected' : ''}`} onClick={() => setPriority(p.value)} disabled={running} aria-pressed={priority === p.value}><Icon name={p.icon} size={14} />{p.label}</button>)}</div></div><button type="button" className={`context-toggle ${advanced ? 'open' : ''}`} onClick={() => setAdvanced(v => !v)} aria-expanded={advanced}>Refine your assumptions <Icon name="down" size={14} /></button></div>
          {advanced && <div className="context-field"><label className="field-label" htmlFor="context">Business context <span>Ownership, employees, premises, alcohol, or other details that change the rules</span></label><textarea id="context" rows={3} value={context} onChange={e => setContext(e.target.value)} maxLength={2500} disabled={running} /><p>These assumptions are included in the research and shown with your report.</p></div>}
          {health?.accessRequired === true && !galleryMode && <div className="access-field"><div><label className="field-label" htmlFor="access-code">Live research access code</label><p>This deployment is protected. Use the code supplied by its owner.</p></div><input id="access-code" type="password" value={accessCode} onChange={e => updateAccessCode(e.target.value)} maxLength={256} placeholder="Enter deployment access code" autoComplete="off" required disabled={running} /></div>}
          <div className="form-action"><p><Icon name="search" size={15} /><span>TinyResearch reads official rules.<br /><small>Research can take several minutes.</small></span></p><button className="primary-button" disabled={running || health?.configured === false || (health?.accessRequired === true && !accessCode.trim())} type="submit">{running ? <><span className="spinner" /> Research in progress</> : <>Compare places <Icon name="arrow" size={18} /></>}</button></div>
        </form>
        {health?.configured === false && <div className="service-note" role="status"><Icon name="alert" size={16} /><p>{galleryMode ? 'Start the full app to run new TinyResearch comparisons. This gallery replays saved live research; it does not perform new research.' : health.unreachable ? 'The research service is not reachable. Start the app server to run a comparison.' : 'Live research needs a TinyFish API key configured on the server.'} {!galleryMode && (examples.length > 0 ? ' You can explore saved live reports below.' : ' Example buttons fill the brief so you can run it when connected.')}{galleryMode && repoUrl && <> <a href={repoUrl} target="_blank" rel="noopener noreferrer">Open the repository</a></>}</p></div>}
        {error && <div className="error-note" role="alert"><Icon name="alert" size={17} /><p>{error}</p>{pollSuspended && job && <button className="resume-poll" onClick={() => { setPollSuspended(false); setError(''); schedulePoll(job.id, requestRef.current); }}><Icon name="refresh" size={13} />Resume status checks</button>}<button aria-label="Dismiss error" onClick={() => setError('')}><Icon name="x" size={14} /></button></div>}
        <div className="example-strip"><span>EXPLORE A COMPARISON</span>{PRESETS.map(p => <button type="button" onClick={() => selectPreset(p)} key={p.id} disabled={running}><Icon name={p.icon} size={15} />{p.label}<Icon name="arrow" size={14} /></button>)}<small>{examples.length ? 'Saved reports from live research' : 'Example research briefs'}</small></div>
      </section>
      <div ref={resultsRef} className="results-anchor">
        {job && !['complete', 'failed'].includes(job.status) && <ProgressCard job={job} />}
        {job?.status === 'failed' && !report && <section className="failed-run-card" role="status"><div className="failed-run-icon"><Icon name="alert" size={23} /></div><div><div className="section-kicker">{job.researchRunId ? 'YOUR EXISTING RESEARCH RUN' : 'RESEARCH START NEEDS REVIEW'}</div><h3>The research needs attention.</h3><p>{readable(job.error) || 'A completed comparison is not available yet.'}</p><small>{job.researchRunId ? 'The provider run ID is retained. Resuming checks that run without creating a new paid research request.' : 'No TinyResearch run ID was confirmed. If the start outcome is unclear, check your TinyFish history before submitting again. This app will not automatically start another request.'}</small></div>{!galleryMode && job.researchRunId && <button type="button" className="primary-button" onClick={resumeResearch} disabled={busy || (health?.accessRequired === true && !accessCode.trim())}>{busy ? <span className="spinner" /> : <Icon name="refresh" size={15} />} Resume this run</button>}</section>}
        {report && <section className="report-section"><div className="results-heading"><div><div className="section-kicker">02 / THE COMPARISON</div><h2>{report.activity}</h2><p>{report.places.length} places · {saved ? 'Saved live research' : 'Live research result'} · Research completed {dateLabel(report.checkedAt)}</p></div><div className="report-actions"><button onClick={exportReport}><Icon name="download" size={15} /> Export JSON</button><button onClick={() => window.print()}><Icon name="print" size={15} /> Print report</button></div></div>
          <Recommendation recommendation={report.recommendation} winner={winner} sources={report.sources} onSource={setActiveSource} />
          <div className="scope-note"><Icon name="file" size={17} /><div><strong>Your research scope</strong>{report.assumptions.length > 0 ? <p>{report.assumptions.join(' · ')}</p> : <p>{context || 'See source details and research gaps before relying on this comparison.'}</p>}</div></div>
          <div className="comparison-note"><span><Icon name="shield" size={13} /> {checkedSources} of {report.sources.length} source pages independently checked</span><span>Scroll horizontally to compare every place <Icon name="arrow" size={13} /></span></div><div className="comparison-scroll" tabIndex={0} aria-label="Side by side requirements comparison, scroll horizontally for all places"><div className="comparison-grid" style={{ '--places-count': report.places.length } as React.CSSProperties}><div className="matrix-label summary-label"><span>AT A GLANCE</span><strong>The cost of getting started</strong><p>Published fees are shown separately from unknown costs.</p></div>{report.places.map(p => <PlaceSummary key={p.id} place={p} recommended={p.name === winner} />)}
          {CATEGORIES.map(category => <div className="matrix-row" key={category}><div className="matrix-label"><span>{String(CATEGORIES.indexOf(category) + 1).padStart(2, '0')}</span><strong>{CATEGORY_LABELS[category]}</strong></div>{report.places.map(p => <div className="matrix-cell" key={p.id}>{p.requirements.filter(r => r.category === category || (category === 'operating_licence' && r.category === 'operating_license')).map(r => <RequirementCard key={r.id} requirement={r} onSource={setActiveSource} />)}{!p.requirements.some(r => r.category === category || (category === 'operating_licence' && r.category === 'operating_license')) && <div className="no-confirmed"><Icon name="alert" size={15} /><span>No confirmed item in this category.<small>This is a coverage gap, not confirmation that no rule applies.</small></span></div>}</div>)}</div>)}
          </div></div>
          <div className="gaps-card"><div className="gaps-title"><Icon name="alert" size={19} /><h3>What still needs checking</h3><span>GAPS STAY VISIBLE</span></div>{report.gaps.length > 0 && <ul>{report.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>}<div className="place-gaps">{report.places.map(p => <div key={p.id}><h4>{p.name}</h4>{p.gaps.length ? <ul>{p.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul> : <p>No additional place-level gaps were listed. Review category coverage and source verification details.</p>}</div>)}</div><p className="gap-footnote">Use this report to choose your next steps and confirm the plan with the responsible agency or a qualified adviser.</p></div>
          {report.sources.length > 0 && <div className="source-library"><div><h3>Follow the evidence</h3><p>{report.sources.length} source pages · open a source to inspect its check date and evidence</p></div><div className="source-chips">{report.sources.map(s => <button onClick={() => setActiveSource(s)} key={s.id}><Icon name="external" size={12} />{s.title || new URL(safeLink(s.url) || 'https://invalid.local').hostname}</button>)}</div></div>}
        </section>}
        {!job && <section className="what-you-get"><div><div className="section-kicker">EVIDENCE FIRST. DECISIONS SECOND.</div><h2>The small print,<br />in the big picture.</h2></div><div className="feature"><span><Icon name="file" size={21} /></span><h3>Compare the same things</h3><p>Registration, licences, taxes, premises and ongoing filings, lined up across every place.</p></div><div className="feature"><span><Icon name="shield" size={21} /></span><h3>Trace every confirmed item</h3><p>Official source links, checked dates and evidence excerpts make the report reviewable.</p></div><div className="feature"><span><Icon name="balance" size={21} /></span><h3>Understand the trade-offs</h3><p>Known fees, uncertain timelines and missing rules stay visible when a place is recommended.</p></div></section>}
      </div>
    </main><footer><div className="footer-brand"><Icon name="map" size={15} /> compliance map</div><p>Built with TinyResearch · Clarity before commitment.</p><button className="text-button" onClick={() => setMethodOpen(true)}>How the evidence works <Icon name="arrow" size={13} /></button></footer>
    {activeSource && <div className="modal-backdrop" onClick={() => setActiveSource(null)}><section className="source-modal" role="dialog" aria-modal="true" aria-label="Source evidence" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="Close source" onClick={() => setActiveSource(null)}><Icon name="x" /></button><div className="section-kicker">SOURCE / {activeSource.id}</div><h2>{activeSource.title}</h2><div className="source-status"><span><Icon name="clock" size={14} /> {activeSource.checkedAt ? `Checked ${dateLabel(activeSource.checkedAt)}` : 'Not independently checked'}</span>{activeSource.status && <span>{activeSource.status === 'matched' ? 'Excerpt matched page text' : activeSource.status === 'reachable' ? 'Page reached · excerpt unconfirmed' : activeSource.status.replaceAll('_', ' ')}</span>}</div><p className="source-domain">{activeSource.url}</p>{activeSource.verificationNote && <p className="verification-note">{activeSource.verificationNote}</p>}{activeSource.quote ? <blockquote>{activeSource.quote}</blockquote> : <div className="source-gap"><Icon name="alert" size={16} /> No evidence excerpt is attached to this source.</div>}{safeLink(activeSource.url) && <a className="primary-button" href={safeLink(activeSource.url)} target="_blank" rel="noopener noreferrer">Read {activeSource.official ? 'the official' : 'the source'} page <Icon name="external" size={15} /></a>}</section></div>}
    {methodOpen && <div className="modal-backdrop" onClick={() => setMethodOpen(false)}><section className="source-modal method-modal" role="dialog" aria-modal="true" aria-label="Research methodology" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="Close methodology" onClick={() => setMethodOpen(false)}><Icon name="x" /></button><div className="section-kicker">THE RESEARCH METHOD</div><h2>From official rules<br />to a usable comparison.</h2><ol><li><span>01</span><div><strong>Scope the activity</strong><p>Your activity, places and assumptions become a research brief covering national, regional and local obligations.</p></div></li><li><span>02</span><div><strong>TinyResearch investigates</strong><p>Live research finds and reads government requirements, fee schedules and approval guidance for each place.</p></div></li><li><span>03</span><div><strong>Check and line up the evidence</strong><p>Confirmed items need an official source and checked date. Costs, time and ongoing obligations use the same categories across places.</p></div></li><li><span>04</span><div><strong>Make uncertainty useful</strong><p>Unknown costs are not zero. Unpublished timelines are not instant. Missing rules remain gaps, and the recommendation explains its limits.</p></div></li></ol><div className="method-footer"><Icon name="shield" size={17} /><p>This compares requirements for an activity. It does not check whether a particular person or business holds a licence.</p></div></section></div>}
  </div>;
}

function ProgressCard({ job }: { job: Job }) {
  const stages = [{ id: 'discovering', label: 'Find official sources', icon: 'search' }, { id: 'researching', label: 'Read the requirements', icon: 'file' }, { id: 'verifying', label: 'Check the evidence', icon: 'shield' }, { id: 'complete', label: 'Build the comparison', icon: 'balance' }];
  const activeIndex = Math.max(0, stages.findIndex(s => s.id === job.status));
  return <section className="progress-card" aria-live="polite"><div className="progress-header"><span className="spinner" /><div><div className="section-kicker">LIVE RESEARCH IN PROGRESS</div><h3>{job.progress?.label || 'Preparing your comparison'}</h3></div><span className="research-running">TINYRESEARCH</span></div><div className="progress-stages">{stages.map((s, i) => <div key={s.id} className={`progress-stage ${i < activeIndex ? 'done' : ''} ${i === activeIndex ? 'active' : ''}`}><span><Icon name={i < activeIndex ? 'check' : s.icon} size={15} /></span><p>{s.label}</p></div>)}</div><p className="progress-caption">Good evidence takes a little time. This page will update as the research moves through the sources.</p></section>;
}

function Recommendation({ recommendation, winner, sources, onSource }: { recommendation: UnknownRecord; winner: string; sources: Source[]; onSource: (source: Source) => void }) {
  const reason = str(recommendation.reasoning || recommendation.reason || recommendation.explanation || recommendation.rationale || recommendation.summary);
  const tradeoffs = texts(recommendation.tradeoffs || recommendation.tradeOffs || recommendation.trade_offs);
  const provisional = recommendation.provisional !== false;
  const evidence = texts(recommendation.evidenceSourceIds).map(id => sources.find(source => source.id === id)).filter((s): s is Source => Boolean(s));
  return <div className="recommendation-card"><div className="recommendation-icon"><Icon name="spark" size={25} /></div><div className="recommendation-copy"><div className="recommendation-eyebrow">{provisional ? 'PROVISIONAL RECOMMENDATION' : 'RECOMMENDATION'}<span>{readable(recommendation.confidence) || 'Subject to evidence coverage'}</span></div><h3>{winner ? `Start by exploring ${winner}.` : 'More evidence is needed before choosing a place.'}</h3>{reason && <p>{reason}</p>}{tradeoffs.length > 0 && <ul>{tradeoffs.map((t, i) => <li key={i}>{t}</li>)}</ul>}{evidence.length > 0 && <div className="recommendation-evidence"><span>EVIDENCE BEHIND THIS CHOICE</span>{evidence.map((source, i) => <button key={source.id} onClick={() => onSource(source)}><Icon name="external" size={11} /> Source {i + 1}</button>)}</div>}</div><div className="recommendation-arrow"><Icon name="arrow" size={25} /></div></div>;
}

function formatMoney(value: number, currency: string): string { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); } catch { return `${value.toLocaleString()} ${currency}`; } }
function costLabel(value: unknown): string {
  if (value == null) return 'Not published / unknown'; const r = record(value); const display = readable(value); if (display) return display;
  if (r.status === 'free') return 'Free'; if (r.status === 'not_applicable') return 'Not applicable';
  const currency = str(r.currency); const min = typeof r.amountMin === 'number' ? r.amountMin : typeof r.min === 'number' ? r.min : typeof r.amount === 'number' ? r.amount : typeof r.value === 'number' ? r.value : null; const max = typeof r.amountMax === 'number' ? r.amountMax : typeof r.max === 'number' ? r.max : null;
  if (min !== null && currency) return max !== null && max !== min ? `${formatMoney(min, currency)}–${formatMoney(max, currency)}` : `${formatMoney(min, currency)}${r.status === 'variable' ? '+' : ''}`;
  return str(r.basis, 'Not published / unknown');
}
function timeLabel(value: unknown): string {
  if (value == null) return 'Not published / unknown'; const r = record(value); if (r.status === 'not_applicable') return 'Not applicable';
  const min = typeof r.minDays === 'number' ? r.minDays : typeof r.min_days === 'number' ? r.min_days : null; const max = typeof r.maxDays === 'number' ? r.maxDays : typeof r.max_days === 'number' ? r.max_days : null;
  if (min !== null) return max !== null && min !== max ? `${min}–${max} days` : `${min} days`;
  return readable(value) || 'Not published / unknown';
}
function PlaceSummary({ place, recommended }: { place: Place; recommended: boolean }) {
  const summary = place.summary; const cost = summary.knownInitialCost != null ? { amountMin: summary.knownInitialCost, currency: summary.currency } : summary.startupCost || summary.startup_cost || summary.knownCost || summary.known_cost || summary.cost;
  const costsByCurrency = record(summary.knownCostsByCurrency || summary.costsByCurrency || summary.known_costs_by_currency);
  const unknownCount = typeof summary.unknownCostCount === 'number' ? summary.unknownCostCount : typeof summary.unknown_cost_count === 'number' ? summary.unknown_cost_count : place.requirements.filter(r => !r.cost || ['unknown', 'unpublished'].includes(str(record(r.cost).status))).length;
  const totals = Object.entries(costsByCurrency).filter(([, v]) => typeof v === 'number').map(([currency, v]) => formatMoney(v as number, currency));
  return <div className={`place-summary ${recommended ? 'recommended-place' : ''}`}><div className="place-summary-top"><span><Icon name="pin" size={16} /></span>{recommended && <small>RECOMMENDED</small>}</div><h3>{place.name}</h3><div className="place-cost">{totals.length ? totals.join(' + ') : costLabel(cost)}</div><span className="cost-subline">Known mandatory startup fees{totals.length || cost ? ' · lower bound' : ''}</span><div className="summary-detail"><Icon name="alert" size={13} /><span>{unknownCount} cost{unknownCount === 1 ? '' : 's'} still unclear{typeof summary.conditionalCostCount === 'number' && summary.conditionalCostCount > 0 ? ` · ${summary.conditionalCostCount} conditional` : ''}</span></div><div className="summary-detail"><Icon name="clock" size={13} /><span>{timeLabel(place.timeline || summary.approvalTime || summary.approval_time || summary.timeToApproval || summary.time_to_approval)}</span></div>{str(summary.note) && <p className="totals-note">{str(summary.note)}</p>}<div className="summary-bottom"><span>{place.requirements.length} listed items</span><span>{place.gaps.length} place-level gaps</span></div></div>;
}

function RequirementCard({ requirement, onSource }: { requirement: Requirement; onSource: (source: Source) => void }) {
  const [details, setDetails] = useState(false);
  const unresolved = ['unknown', 'unclear', 'gap', 'unverified'].includes(requirement.status || '') || ['needs_confirmation', 'gap'].includes(requirement.confidence || '') || requirement.sources.length === 0 || requirement.sources.some(s => s.status !== 'matched');
  return <article className={`requirement-card ${unresolved ? 'unresolved' : ''}`}><div className="requirement-meta">{requirement.authority && <span>{requirement.authority}</span>}{requirement.status && <span>{requirement.status.replaceAll('_', ' ')}</span>}</div><h4>{requirement.title}</h4>{unresolved && <span className="confirmation-label">Needs confirmation</span>}{requirement.description && <p>{requirement.description}</p>}{requirement.applicability && <p className="applicability"><strong>Applies:</strong> {requirement.applicability}</p>}{requirement.steps && requirement.steps.length > 0 && <ol className="requirement-steps">{requirement.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}<dl><div><dt>Fee</dt><dd>{costLabel(requirement.cost)}{str(record(requirement.cost).basis) && costLabel(requirement.cost) !== str(record(requirement.cost).basis) && <small>{str(record(requirement.cost).basis)}</small>}</dd></div><div><dt>Approval</dt><dd>{timeLabel(requirement.time)}</dd></div>{Boolean(requirement.renewal) && <div><dt>Renewal</dt><dd>{readable(requirement.renewal) || texts(requirement.renewal).join('; ') || 'See official guidance'}</dd></div>}{requirement.ongoingFiling && <div><dt>Filings</dt><dd>{requirement.ongoingFiling}</dd></div>}</dl>{requirement.gaps?.length ? <p className="item-gap"><Icon name="alert" size={12} />{requirement.gaps.join(' · ')}</p> : null}<div className="requirement-sources">{requirement.sources.map((s, i) => <button key={s.id} onClick={() => onSource(s)}><Icon name="external" size={11} />{requirement.sources.length === 1 ? (s.official ? 'Official source' : 'Source evidence') : `Source ${i + 1}`}<span>{s.checkedAt ? dateLabel(s.checkedAt) : 'Not checked'}</span></button>)}{!requirement.sources.length && <span className="uncited-item"><Icon name="alert" size={12} /> No source attached · requires checking</span>}</div>{requirement.sources.some(s => s.quote) && <button className="evidence-toggle" onClick={() => setDetails(v => !v)} aria-expanded={details}>Evidence excerpt <Icon name="down" size={12} /></button>}{details && <blockquote className="inline-evidence">{requirement.sources.filter(s => s.quote).map(s => <p key={s.id}>{s.quote}</p>)}</blockquote>}</article>;
}

export default App;
