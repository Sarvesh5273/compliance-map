import { createHash } from 'node:crypto';
import { CATEGORIES, type ComparisonInput, type ComparisonReport, type PlaceReport, type Requirement, type SourceEvidence } from '../shared/types.js';
import { ProviderError, type ResearchRun, type TinyFishProvider, type FetchedPage } from './tinyfish.js';

const text = (value: unknown, fallback = '') => typeof value === 'string' ? value.slice(0, 12000) : fallback;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string').slice(0, 100) : [];
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const normalized = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const choose = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;

export function matchQuotedPassage(quote: string, page: string) {
  const haystack = normalized(page);
  if (/\.\.\.|…/.test(quote)) {
    const fragments = quote.split(/\.\.\.|…/).map(normalized).filter(Boolean);
    if (fragments.length < 2 || fragments.some(fragment => fragment.length < 12 || fragment.split(' ').length < 3)) return { matched:false, fragmented:true };
    let cursor = 0;
    for (const fragment of fragments) { const position = haystack.indexOf(fragment,cursor); if(position < 0) return {matched:false,fragmented:true}; cursor=position+fragment.length; }
    return {matched:true,fragmented:true};
  }
  const passage = normalized(quote);
  return { matched:passage.length >= 12 && haystack.includes(passage), fragmented:false };
}

const recurringPattern = /\b(recurring|annual(?:ly)?|yearly|per year|each year|every year|biennial(?:ly)?|every (?:two|2|three|3) years?|monthly|quarterly|renewal(?:s)?|per taxable year)\b/i;
export function isInitialCharge(requirement: Requirement) {
  const basis = requirement.cost.basis;
  const explicitInitial = /\b(initial|up ?front|one[ -]time)\b|\bfirst (?:payment|filing|registration)\b|\b(?:formation|incorporation) (?:filing )?(?:fee|cost|charge)\b|\b(?:fee|cost|charge) (?:for|of) (?:formation|incorporation)\b/i.test(basis);
  if (requirement.category === 'renewals_and_filings' && !explicitInitial) return false;
  return !recurringPattern.test(basis) || explicitInitial;
}

const futureOrProposal = (quote: string) => /\b(?:this bill would|bill proposes?|proposed (?:tax|fee|rule|legislation)|would (?:reduce|increase|change)|if enacted|not yet (?:effective|in force))\b/i.test(quote);
function monetaryAmounts(quote: string): number[] {
  const values = [...quote.matchAll(/(?:[$£€₹]|\b(?:USD|GBP|EUR|INR|CAD|AUD|SGD)\s*)\s*((?:\d[\d,]*|\.\d+)(?:\.\d+)?)/gi)].map(m=>Number(m[1].replace(/,/g,'')));
  for (const match of quote.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\s+(?:dollars?|pounds?|euros?|rupees?)\b/gi)) values.push(Number(match[1].replace(/,/g,'')));
  return [...new Set(values.filter(Number.isFinite))];
}

function addWarning(report: ComparisonReport, warning: string) { if(!report.warnings.includes(warning)) report.warnings.push(warning); }

function obligationMatches(requirement: Requirement, source: SourceEvidence) {
  const label = normalized(requirement.title), evidence = normalized(`${source.title} ${source.quote}`);
  if (/articles of organization|certificate of formation|llc formation/.test(label)) return /articles|organization|formation|filing fee/.test(evidence)&&!recurringPattern.test(source.quote);
  if (/statement of information/.test(label)) return /statement|information|llc 12/.test(evidence);
  if (/annual report/.test(label)) return /annual report|license tax|licence tax/.test(evidence);
  if (/annual.*tax|franchise tax/.test(label)) return /annual tax|annual llc tax|franchise tax/.test(evidence);
  if (/business licen[cs]e/.test(label)) return /business licen[cs]e/.test(evidence);
  const words = label.split(' ').filter(w=>w.length>4&&!['initial','annual','recurring','filing','required','obligation','california','delaware','wyoming','united','states'].includes(w));
  return words.length > 0 && words.some(w=>evidence.includes(w));
}

/** Government domains are accepted structurally; ambiguous domains remain unconfirmed. */
export function isOfficialUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (url.username || url.password || url.port || url.hostname === 'localhost') return false;
    const host = url.hostname.toLowerCase();
    if (/^[\d.]+$/.test(host) || host.includes(':')) return false;
    return /(^|\.)(gov|mil)$/.test(host) || /(^|\.)(gov|gouv|gob|go|govt|gv)\.[a-z]{2}$/.test(host) || /(^|\.)(gc\.ca|admin\.ch|europa\.eu|bund\.de|gov\.scot|gov\.wales)$/.test(host);
  } catch { return false; }
}

export function parseResearchJson(raw: string): any {
  const fenced = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(m => m[1]);
  const candidates = [raw, ...fenced];
  const first = raw.indexOf('{'), last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(raw.slice(first, last + 1));
  for (const candidate of candidates) {
    try { const parsed = JSON.parse(candidate.trim()); if (parsed && Array.isArray(parsed.places)) return parsed; } catch { /* Try another documented representation. */ }
  }
  throw new ProviderError('REPORT_FORMAT', 'TinyResearch produced a cited report but not a valid comparison object. The raw report is retained for review; no requirements or fees were invented.', 422);
}

function emptyPlace(name: string): PlaceReport {
  return { name, currency: null, summary: 'No structured requirements were returned for this place.', requirements: [],
    gaps: CATEGORIES.map(c => `No official evidence returned for ${c.label.toLowerCase()}.`),
    timeline: { status: 'unknown', minDays: null, maxDays: null, note: 'An overall approval time has not been verified.', sourceIds: [] },
    totals: { knownInitialCost: null, currency: null, unknownCostCount: 0, conditionalCostCount: 0, isComplete: false, note: 'No cost evidence.' },
    coverage: { confirmed: 0, needsConfirmation: 0, gaps: 6, categoriesCovered: 0 } };
}

export function normalizeResearchReport(input: ComparisonInput, run: ResearchRun, id: string): ComparisonReport {
  const raw = run.deep_result?.result || '';
  const parsed = parseResearchJson(raw);
  const sources: SourceEvidence[] = (Array.isArray(parsed.sources) ? parsed.sources : []).slice(0, 150).map((source: any, i: number) => ({
    id: text(source.id, `source-${i + 1}`), url: text(source.url), title: text(source.title, 'Official source'), authority: text(source.authority),
    checkedAt: null, quote: text(source.quote), official: isOfficialUrl(text(source.url)), verification: 'unavailable',
    verificationNote: 'This citation has not been independently fetched.',
  }));
  const sourceIds = new Set(sources.map(s => s.id));
  if (sourceIds.size !== sources.length) throw new ProviderError('REPORT_SOURCES_DUPLICATE', 'Research reused a source identifier for different evidence. The raw report is retained; ambiguous citations cannot be confirmed.', 422);
  const warnings = strings(parsed.warnings);
  const places = input.places.map(name => {
    const sourcePlace = (parsed.places as any[]).find(p => normalized(text(p.name)) === normalized(name));
    if (!sourcePlace) { warnings.push(`Research omitted requested place: ${name}.`); return emptyPlace(name); }
    const place = emptyPlace(name);
    place.currency = /^[A-Z]{3}$/.test(text(sourcePlace.currency)) ? sourcePlace.currency : null;
    place.summary = text(sourcePlace.summary);
    place.gaps = strings(sourcePlace.gaps);
    const seen = new Set<string>();
    place.requirements = (Array.isArray(sourcePlace.requirements) ? sourcePlace.requirements : []).slice(0, 100).flatMap((r: any, i: number) => {
      const title = text(r.title, 'Unspecified requirement');
      const key = `${r.category}:${normalized(title)}`;
      if (seen.has(key)) { place.gaps.push(`Duplicate requirement omitted from totals: ${title}.`); return []; }
      seen.add(key);
      const validRefs = strings(r.sourceIds).filter(s => sourceIds.has(s));
      const category = choose(r.category, CATEGORIES.map(c => c.id), 'sector_specific');
      const costStatus = choose(r.cost?.status, ['known','free','variable','unknown','not_applicable'] as const, 'unknown');
      const min = finite(r.cost?.amountMin), max = finite(r.cost?.amountMax);
      const validNumbers = min !== null && (max === null || max >= min);
      const timeMin = finite(r.time?.minDays), timeMax = finite(r.time?.maxDays);
      const requirement: Requirement = {
        id: `${normalized(name).replace(/ /g, '-')}-${text(r.id, `req-${i + 1}`)}`,
        category, title, description: text(r.description), authority: text(r.authority),
        jurisdictionLevel: choose(r.jurisdictionLevel, ['national','state','local','unknown'] as const, 'unknown'),
        status: choose(r.status, ['required','conditional','not_required','unknown'] as const, 'unknown'), condition: text(r.condition) || null,
        cost: { status: costStatus === 'known' && !validNumbers ? 'unknown' : costStatus,
          amountMin: costStatus === 'free' ? 0 : costStatus === 'known' || costStatus === 'variable' ? min : null,
          amountMax: costStatus === 'free' ? 0 : costStatus === 'known' || costStatus === 'variable' ? max : null,
          currency: /^[A-Z]{3}$/.test(text(r.cost?.currency)) ? r.cost.currency : null, basis: text(r.cost?.basis, 'Fee not published or not verified.') },
        time: { status: r.time?.status === 'published' && timeMin !== null && (timeMax === null || timeMax >= timeMin) ? 'published' : r.time?.status === 'not_applicable' ? 'not_applicable' : 'unknown',
          minDays: timeMin, maxDays: timeMax, note: text(r.time?.note, 'No published approval time verified.') },
        renewal: text(r.renewal, 'Renewal details not published or not verified.'), ongoingFiling: text(r.ongoingFiling, 'Ongoing filing details not published or not verified.'),
        steps: strings(r.steps), dependencies: strings(r.dependencies), sourceIds: validRefs,
        confidence: validRefs.length ? 'needs_confirmation' : 'gap',
      };
      if (requirement.time.status !== 'published') requirement.time.minDays = requirement.time.maxDays = null;
      if (!validRefs.length) place.gaps.push(`No usable official citation for ${title}.`);
      return [requirement];
    });
    return place;
  });
  const report: ComparisonReport = { id, activity: input.activity, context: input.context, priority: input.priority, generatedAt: new Date().toISOString(),
    assumptions: input.context ? [input.context] : ['Ownership, legal form, staffing, premises, revenue and exact address were not fully specified. Refine the business context before relying on applicability.'], places, sources, warnings,
    recommendation: { place: null, headline: 'Evidence checking is in progress', reasoning: '', tradeoffs: [], provisional: true, method: '', ranking: [] },
    methodology: { endpoints: ['TinyResearch'], researchRunId: run.research_run_id, terminationReason: run.deep_result?.termination_reason || null,
      sourceCount: sources.length, verifiedSourceCount: 0, notes: [
        'TinyResearch discovers and synthesizes current official rules. TinyFetch independently fetches cited pages without accepting cached content.',
        'A matched citation means its quoted passage was found on a government page. It is not a legal opinion or a guarantee that all requirements were found.',
        'Exact quote and numerical checks do not validate every model interpretation. Literal threshold, optional-scheme and monetary-conflict guards catch some errors; final applicability still needs review.',
        'Initial costs exclude conditional and recurring fees. Approval durations are not summed: tasks can overlap and prerequisites can differ.',
      ] }, rawReport: raw };
  if (run.deep_result?.termination_reason === 'synthesis_failed') report.warnings.push('TinyResearch final synthesis failed. This report contains interim findings and cannot support a final recommendation.');
  return report;
}

function pageContainsAmount(page: string, amount: number) {
  if (amount === 0 && /\b(no fees?|no charge|free of charge|free)\b/i.test(page)) return true;
  const stripped = page.replace(/,/g, '');
  const escaped = amount.toString().replace('.', '\\.');
  return new RegExp(`(^|[^\\d])${escaped}(?:\\.0+)?([^\\d]|$)`).test(stripped);
}

function supportsCurrency(quote: string, currency: string | null, sources: SourceEvidence[]) {
  if (!currency) return false;
  if(new RegExp(`\\b${currency}\\b`,'i').test(quote)) return true;
  const symbols: Record<string,string> = { GBP:'£', EUR:'€', INR:'₹', JPY:'円', CNY:'元', KRW:'₩' };
  if(symbols[currency] && quote.includes(symbols[currency])) return true;
  const words: Record<string,RegExp> = { USD:/\b(?:US|U\.S\.|United States) dollars?\b/i, GBP:/\b(?:pounds?|sterling)\b/i, EUR:/\beuros?\b/i, INR:/\brupees?\b/i,
    SGD:/\bSingapore dollars?\b/i, CAD:/\bCanadian dollars?\b/i, AUD:/\bAustralian dollars?\b/i };
  if(words[currency]?.test(quote)) return true;
  const byDomain: [RegExp,string][] = [[/\.gov$|\.mil$/,'USD'],[/\.gc\.ca$/,'CAD'],[/\.gov\.sg$/,'SGD'],[/\.gov\.au$/,'AUD'],[/\.govt\.nz$/,'NZD'],[/\.gov\.uk$|\.gov\.scot$|\.gov\.wales$/,'GBP'],[/\.gov\.in$/,'INR'],[/\.go\.jp$/,'JPY'],[/\.gov\.ie$/,'EUR'],[/\.gov\.hk$/,'HKD']];
  return sources.some(s => {
    const host = new URL(s.finalUrl || s.url).hostname;
    return byDomain.some(([pattern,c]) => c === currency && pattern.test(`.${host}`));
  });
}

export async function verifyReportSources(report: ComparisonReport, provider: Pick<TinyFishProvider, 'fetchPages'>, onProgress?: (complete: number, total: number) => void) {
  const urls = [...new Set(report.sources.filter(s => s.official).map(s => s.url))];
  const pages = new Map<string, FetchedPage>();
  const errors = new Map<string, string>();
  let completed = 0;
  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10);
    try {
      const result = await provider.fetchPages(batch);
      for (const page of result.results || []) pages.set(page.url, page);
      for (const err of result.errors || []) errors.set(err.url, err.error);
    } catch (error) {
      for (const url of batch) errors.set(url, error instanceof ProviderError ? error.code : 'FETCH_FAILED');
    }
    completed += batch.length;
    onProgress?.(completed, urls.length);
  }
  report.methodology.endpoints = [...new Set([...report.methodology.endpoints, 'TinyFetch'])];
  for (const source of report.sources) {
    if (!source.official) { source.verification = 'rejected'; source.verificationNote = 'The URL could not be established as government controlled; it is excluded from confirmed evidence.'; continue; }
    const page = pages.get(source.url);
    if (!page?.text) { source.verification = 'unavailable'; source.verificationNote = `Independent live fetch failed: ${errors.get(source.url) || 'no content returned'}.`; continue; }
    source.finalUrl = page.final_url || page.url;
    if (!isOfficialUrl(source.finalUrl)) { source.official = false; source.verification = 'rejected'; source.verificationNote = 'The citation redirected outside a recognized government domain.'; continue; }
    source.checkedAt = new Date().toISOString();
    source.contentHash = createHash('sha256').update(page.text).digest('hex');
    const { matched, fragmented } = matchQuotedPassage(source.quote,page.text);
    source.verification = matched ? 'matched' : 'reachable';
    source.verificationNote = matched ? fragmented ? 'Every substantial quoted fragment was found in order in the independently fetched official page. The ellipsis marks omitted text; this is not one contiguous passage.' : 'The exact quoted passage was found in the independently fetched official page.' : 'Official page fetched, but the quoted passage was absent or too short. Claims need confirmation.';
  }
  const byId = new Map(report.sources.map(s => [s.id, s]));
  for (const place of report.places) {
    for (const requirement of place.requirements) {
      const refs = requirement.sourceIds.map(id => byId.get(id)).filter((s): s is SourceEvidence => Boolean(s));
      const matchedRefs = refs.filter(s => s.official && s.verification === 'matched' && !futureOrProposal(s.quote));
      const contents = matchedRefs.map(s => s.quote).join('\n');
      const allMatched = refs.length > 0 && refs.every(s => s.official && s.verification === 'matched');
      const proposalRefs = refs.filter(s=>futureOrProposal(s.quote));
      if(proposalRefs.length) addWarning(report,`${place.name} / ${requirement.title}: proposed-law excerpts (${proposalRefs.map(s=>s.id).join(', ')}) are not evidence of a current fee. Those excerpts are excluded from monetary checks.`);
      requirement.confidence = requirement.status === 'unknown' ? 'gap' : allMatched ? 'confirmed' : refs.length ? 'needs_confirmation' : 'gap';
      const singleAmountClaims = matchedRefs.map(s=>({source:s,amounts:monetaryAmounts(s.quote)})).filter(c=>c.amounts.length===1&&obligationMatches(requirement,c.source)&&!/\b(?:assets?|income|revenue|turnover|threshold|penalt|interest|late fee)\b/i.test(c.source.quote));
      const conflictingAmounts = [...new Set(singleAmountClaims.map(c=>c.amounts[0]))];
      const costConflict = ['known','free','variable'].includes(requirement.cost.status) && singleAmountClaims.length > 1 && conflictingAmounts.length > 1 && singleAmountClaims.every(c=>recurringPattern.test(c.source.quote)||/\b(?:filing|registration|application) (?:fee|cost)\b/i.test(c.source.quote));
      if(costConflict) {
        const warning=`${place.name} / ${requirement.title}: cited official passages disagree on the charge (${singleAmountClaims.map(c=>`${c.source.id}: ${c.amounts[0]}`).join('; ')}). Amount withheld until the authority confirms which applies.`;
        addWarning(report,warning); if(!place.gaps.includes(warning)) place.gaps.push(warning);
        requirement.cost.status='unknown'; requirement.cost.amountMin=requirement.cost.amountMax=null;requirement.cost.basis+=' Official monetary sources conflict; no amount selected.';requirement.confidence='needs_confirmation';
      }
      const citedMoney = matchedRefs.flatMap(s=>monetaryAmounts(s.quote));
      const supportedFeeAmount = (amount: number | null) => amount !== null && (citedMoney.includes(amount) || (amount === 0 && /\b(?:no fees?|no charge|free of charge|free)\b/i.test(contents)));
      if (['known','free','variable'].includes(requirement.cost.status) && (!allMatched || !supportedFeeAmount(requirement.cost.amountMin) || (requirement.cost.amountMin !== 0 && !supportsCurrency(contents,requirement.cost.currency,matchedRefs)) || (requirement.cost.amountMax !== null && !supportedFeeAmount(requirement.cost.amountMax)))) {
        requirement.cost.status = 'unknown'; requirement.cost.amountMin = requirement.cost.amountMax = null;
        requirement.cost.basis += ' Amount excluded because independent source checks did not support the number.';
        requirement.confidence = 'needs_confirmation';
      }
      const approvalLanguage = /\b(approv\w*|process\w*|decision\w*|issu(?:e|ed|ance)|turnaround|service standard)\b/i.test(contents);
      const publishedDayUnit = /\b(?:calendar|working|business)?\s*days?\b/i.test(contents);
      const dayUnitContradiction = /\b(?:working|business) days?\b/i.test(contents) && /\bcalendar days?\b/i.test(requirement.time.note);
      if (requirement.time.status === 'published' && (!allMatched || !approvalLanguage || !publishedDayUnit || dayUnitContradiction || requirement.time.minDays === null || !pageContainsAmount(contents, requirement.time.minDays) || (requirement.time.maxDays !== null && !pageContainsAmount(contents, requirement.time.maxDays)))) {
        requirement.time.status = 'unknown'; requirement.time.minDays = requirement.time.maxDays = null;
        requirement.time.note += ' Duration excluded because independent checks did not support the number.';
        requirement.confidence = 'needs_confirmation';
      }
      const financialTrigger = matchedRefs.find(s=>/\b(?:if|when|once|unless|only)\b[^.\n]{0,120}\b(?:income|profits?|revenue|turnover|earnings|receipts)\b|\b(?:income|profits?|revenue|turnover|earnings|receipts)\b[^.\n]{0,80}\b(?:exceeds?|above|over|more than|at least)\b/i.test(s.quote));
      const contextEstablishesFinancialScope = /\b(?:income|profits?|revenue|turnover|earnings|receipts)\b[^.\n]{0,50}\d/i.test(report.context);
      if(requirement.status === 'required' && financialTrigger && !contextEstablishesFinancialScope) {
        requirement.status='conditional';requirement.condition=`Financial trigger in official evidence: ${financialTrigger.quote}`;requirement.confidence='needs_confirmation';
        addWarning(report,`${place.name} / ${requirement.title}: a published income, profit or turnover trigger is not established by the input. Applicability is conditional.`);
      }
      const voluntary = matchedRefs.find(s=>(/\bvoluntary\b/i.test(s.quote)||(/\boptional\b/i.test(s.quote)&&/\b(?:copy|scheme|program|service)\b/i.test(requirement.title))) && obligationMatches(requirement,s));
      if(requirement.status === 'required' && voluntary) {
        requirement.status='unknown';requirement.condition=`The official passage describes a voluntary or optional item: ${voluntary.quote}`;
        const warning=`${place.name} / ${requirement.title}: the reported mandatory status conflicts with an official voluntary/optional passage (${voluntary.id}). Mandatory classification withheld.`;
        addWarning(report,warning);if(!place.gaps.includes(warning))place.gaps.push(warning);
      }
      const explicitExemption = /\b(?:not required|not mandatory|exempt(?:ed|ion)?|no (?:state |general |separate )?(?:income tax|sales tax|tax|licen[cs]e|permit|registration|filing|report)|do(?:es)? not (?:require|apply|impose|file|need)|need not|not subject to|is voluntary|participation is voluntary)\b/i.test(contents);
      if(requirement.status==='not_required' && !explicitExemption) {
        requirement.status='unknown';requirement.condition='The cited passages do not explicitly establish the reported exemption or absence of a duty.';
        const warning=`${place.name} / ${requirement.title}: a not-required conclusion is not established by an explicit exemption in the quoted official evidence.`;
        addWarning(report,warning);if(!place.gaps.includes(warning))place.gaps.push(warning);
      }
      if(requirement.status === 'unknown') requirement.confidence = 'gap';
    }
    const conflictRows = place.requirements.filter(r=>r.cost.basis.includes('Official monetary sources conflict'));
    for(const requirement of place.requirements) {
      if(conflictRows.includes(requirement)) continue;
      const related = conflictRows.find(conflict=>conflict.sourceIds.some(id=>requirement.sourceIds.includes(id)) && recurringPattern.test(conflict.cost.basis) && recurringPattern.test(requirement.cost.basis));
      if(related) {
        requirement.cost.status='unknown';requirement.cost.amountMin=requirement.cost.amountMax=null;requirement.confidence='needs_confirmation';
        requirement.cost.basis+=` The same recurring obligation has conflicting official monetary evidence under ${related.title}; no amount selected.`;
      }
    }
  }
  report.methodology.verifiedSourceCount = report.sources.filter(s => s.verification === 'matched').length;
  return finalizeComparison(report);
}

export function finalizeComparison(report: ComparisonReport) {
  for (const place of report.places) {
    const categories = new Set(place.requirements.filter(r => r.confidence === 'confirmed').map(r => r.category));
    for (const c of CATEGORIES) if (!place.requirements.some(r => r.category === c.id)) {
      const message = `No cited requirement or exemption was returned for ${c.label.toLowerCase()}.`;
      if (!place.gaps.includes(message)) place.gaps.push(message);
    }
    const initial = place.requirements.filter(r => isInitialCharge(r) && r.status !== 'not_required');
    const required = initial.filter(r => r.status === 'required');
    const priced = required.filter(r => r.confidence === 'confirmed' && ['known','free','not_applicable'].includes(r.cost.status) && (r.cost.status === 'not_applicable' || r.cost.amountMin !== null) && (r.cost.amountMin === 0 || r.cost.status === 'not_applicable' || r.cost.currency !== null));
    const currencies = [...new Set(priced.filter(r=>(r.cost.amountMin||0)>0).map(r => r.cost.currency).filter((c): c is string => Boolean(c)))];
    const known = currencies.length <= 1 && priced.length ? priced.reduce((sum, r) => sum + (r.cost.amountMin || 0), 0) : null;
    const unknowns = initial.filter(r => r.status === 'unknown' || (r.status === 'required' && !priced.includes(r))).length;
    const conditional = initial.filter(r => r.status === 'conditional').length;
    const ranged = priced.some(r => r.cost.amountMax !== null && r.cost.amountMax !== r.cost.amountMin);
    const complete = unknowns === 0 && conditional === 0 && categories.size === CATEGORIES.length && place.gaps.length === 0 && required.length > 0 && currencies.length <= 1 && !ranged;
    place.totals = { knownInitialCost: known, currency: currencies[0] || place.currency, unknownCostCount: unknowns, conditionalCostCount: conditional,
      isComplete: complete, note: complete ? 'Sum of verified unconditional initial fees for the stated scope.' : 'A lower bound of verified unconditional initial fees. Conditional, recurring and unverified charges are excluded; this is not the total startup cost.' };
    place.coverage = { confirmed: place.requirements.filter(r => r.confidence === 'confirmed').length,
      needsConfirmation: place.requirements.filter(r => r.confidence === 'needs_confirmation').length, gaps: place.gaps.length,
      categoriesCovered: categories.size };
    place.summary = `${place.coverage.confirmed} requirements have matched cited passages; ${place.coverage.needsConfirmation} need confirmation, with ${place.coverage.gaps} recorded gaps. The initial-fee subtotal is ${known === null ? 'unverified' : `${place.totals.currency || ''} ${known}, a lower bound`}. Overall approval time is unknown.`;
    place.timeline = { status: 'unknown', minDays: null, maxDays: null, note: 'No end-to-end approval duration has been independently verified. Individual published times below may overlap and use different day units.', sourceIds: [] };
  }
  let ranked = [...report.places].sort((a,b) => b.coverage.categoriesCovered - a.coverage.categoriesCovered || b.coverage.confirmed - a.coverage.confirmed || a.coverage.gaps - b.coverage.gaps || a.coverage.needsConfirmation - b.coverage.needsConfirmation);
  const comparableCost = report.places.every(p => p.totals.isComplete && p.totals.knownInitialCost !== null) && new Set(report.places.map(p => p.totals.currency)).size === 1;
  let winner: PlaceReport | undefined;
  const finishedSynthesis = report.methodology.terminationReason === 'planner_done' || report.methodology.terminationReason === null;
  let tied: PlaceReport[] = [];
  if (comparableCost && report.priority === 'cost' && finishedSynthesis) {
    ranked = [...report.places].sort((a,b) => (a.totals.knownInitialCost || 0) - (b.totals.knownInitialCost || 0));
    tied = ranked.filter(p => p.totals.knownInitialCost === ranked[0].totals.knownInitialCost);
    if(tied.length === 1) winner = tied[0];
  }
  const bestDocumented = ranked.find(p => p.coverage.confirmed > 0);
  const sourceById = new Map(report.sources.map(s=>[s.id,s]));
  const annualBurden = report.places.map(place=>{
    const rows = place.requirements.filter(r=>{
      const quotes = r.sourceIds.map(id=>sourceById.get(id)).filter(s=>s?.verification==='matched').map(s=>s!.quote).join(' ');
      const annualQuoted = /\b(annual(?:ly)?|yearly|per year|each year|every year)\b/i.test(quotes);
      const nonAnnual = /\b(biennial(?:ly)?|every (?:two|2) years?|every (?:three|3) years?|monthly|quarterly)\b/i.test(`${r.cost.basis} ${r.renewal}`);
      return recurringPattern.test(r.cost.basis)&&r.status==='required'&&r.confidence==='confirmed'&&['known','free','variable'].includes(r.cost.status)&&r.cost.amountMin!==null&&r.cost.currency!==null&&annualQuoted&&!nonAnnual;
    });
    const uniqueRows: Requirement[] = [];
    for (const row of rows) {
      const duplicate = uniqueRows.find(previous=>previous.cost.amountMin===row.cost.amountMin&&previous.cost.currency===row.cost.currency&&previous.sourceIds.some(id=>row.sourceIds.includes(id)));
      if(duplicate) { addWarning(report,`${place.name}: overlapping annual charge evidence for ${duplicate.title} and ${row.title} is counted once in the annual lower bound.`);continue; }
      uniqueRows.push(row);
    }
    const currencies = [...new Set(uniqueRows.map(r=>r.cost.currency))];
    return {place,rows:uniqueRows,currency:currencies.length===1?currencies[0]:null,amount:uniqueRows.length&&currencies.length===1?uniqueRows.reduce((sum,r)=>sum+(r.cost.amountMin||0),0):null};
  });
  const annualAvailable = annualBurden.filter(b=>b.amount!==null&&b.currency!==null);
  const annualComparable = annualAvailable.length >= 2 && new Set(annualAvailable.map(b=>b.currency)).size===1;
  const annualOrder = [...annualAvailable].sort((a,b)=>(a.amount||0)-(b.amount||0));
  const annualMissing = annualBurden.filter(b=>b.amount===null||b.currency===null);
  const annualWinner = annualComparable&&finishedSynthesis&&report.priority!=='speed'&&report.priority!=='certainty'&&!winner&&tied.length===0&&annualOrder[0].amount!<annualOrder[1].amount! ? annualOrder[0] : undefined;
  if(annualWinner) ranked = [...annualOrder.map(b=>b.place),...annualMissing.map(b=>b.place)];
  const preferenceNote = report.priority === 'speed' ? 'Speed priority: no overall approval duration is verified, so a fastest-place recommendation is withheld.' : report.priority === 'cost' && !comparableCost ? 'Cost priority: missing fees or different currencies prevent a cheapest-place recommendation.' : 'Balanced comparison: weigh required steps, conditional triggers, recurring obligations and evidence gaps together.';
  const isTie = tied.length > 1;
  report.recommendation = {
    place: isTie ? null : winner?.name || annualWinner?.place.name || bestDocumented?.name || null,
    headline: isTie ? `${tied.map(p=>p.name).join(' and ')} tie on verified initial fees` : winner ? `${winner.name} has the lowest verified initial fees` : annualWinner ? `${annualWinner.place.name} is the lower annual-charge candidate` : bestDocumented ? `Investigate ${bestDocumented.name} first` : 'More evidence is needed before choosing',
    reasoning: isTie ? 'Complete verified initial fees are equal. Choose using the remaining operational tradeoffs; approval speed is unverified.' : winner ? 'Every place has complete comparable fees in one currency under the stated scope. This cost result does not establish the fastest or easiest approval.' : annualWinner ? `Among ${annualAvailable.length} of ${report.places.length} places with comparable cited annual-charge evidence, ${annualWinner.place.name} has the lowest known unconditional government charge floor: ${annualWinner.currency} ${annualWinner.amount} per year, versus ${annualOrder.slice(1).map(b=>`${b.place.name} at ${b.currency} ${b.amount}`).join(' and ')}. Each amount and annual recurrence has a matched official citation. ${annualMissing.length ? `Annual charges in ${annualMissing.map(b=>b.place.name).join(', ')} are not sufficiently verified and could change the choice. ` : ''}This supports a provisional first place to investigate. Additional unknown or conditional fees, asset-based charges, local rules and operating in another jurisdiction could change the choice; total cost and fastest/easiest approval have not been established.` : bestDocumented ? `${preferenceNote} ${bestDocumented.name} has ${bestDocumented.coverage.needsConfirmation} requirements needing source confirmation, ${bestDocumented.coverage.gaps} recorded gaps and ${bestDocumented.coverage.categoriesCovered}/6 categories with matched citations. Investigate it first on documentation quality; incomplete costs and approval times prevent a defensible easiest-to-start winner.` : `${preferenceNote} No defensible comparison is available.`,
    tradeoffs: report.places.map(p => {
      const recurring = p.requirements.filter(r=>recurringPattern.test(r.cost.basis)&&r.confidence==='confirmed').map(r=>r.title).slice(0,4);
      const annual = annualBurden.find(b=>b.place.name===p.name);
      return `${p.name}: ${p.requirements.filter(r=>r.status==='required').length} required items; ${p.totals.knownInitialCost === null ? 'no verified initial fee subtotal' : `${p.totals.currency || ''} ${p.totals.knownInitialCost} verified initial fee lower bound`}; ${p.totals.unknownCostCount} unknown initial charges; ${p.totals.conditionalCostCount} conditional requirements; ${annual?.amount!==null?`${annual?.currency} ${annual?.amount} known annual government charge floor; `:''}ongoing obligations: ${recurring.join(', ')||'not fully verified'}; overall approval time unknown.`;
    }),
    provisional: (!winner&&!isTie) || !finishedSynthesis,
    method: winner||isTie ? 'Lowest complete verified unconditional initial fees in a shared currency; equal values stay tied.' : annualWinner ? 'Compare known unconditional annual government charge floors in a shared currency for at least two places with evidence. Explicitly flag missing places. Numbers and annual recurrence must be quoted and independently matched. This limited ranking is provisional, without converting recurring periods or inferring total cost.' : 'Order by most categories with matched citations, then most confirmed requirements, then fewest recorded gaps and requirements needing confirmation. No fabricated ease score or inferred timeline.',
    ranking: ranked.map(p => ({ place: p.name, score: null, reasons: [`${p.coverage.confirmed} requirements with matched citations`, `${p.coverage.needsConfirmation} need confirmation`, `${p.coverage.gaps} recorded gaps`, `${p.coverage.categoriesCovered}/6 categories verified`] })),
  };
  Object.assign(report.recommendation, { evidenceSourceIds: [...new Set(annualWinner ? annualBurden.flatMap(b=>b.rows.flatMap(r=>r.sourceIds)) : winner||isTie ? ranked.flatMap(p=>p.requirements.filter(r=>r.category!=='renewals_and_filings'&&r.confidence==='confirmed'&&r.status==='required').flatMap(r=>r.sourceIds)) : [])] });
  if (!comparableCost) report.warnings.push('Costs are incomplete or in different currencies. Initial fee subtotals cannot establish which place is cheapest.');
  return report;
}
