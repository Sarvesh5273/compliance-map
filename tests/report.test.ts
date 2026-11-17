import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, type ComparisonInput, type ComparisonReport } from '../shared/types.js';
import { finalizeComparison, isInitialCharge, isOfficialUrl, matchQuotedPassage, normalizeResearchReport, parseResearchJson, verifyReportSources } from '../server/report.js';
import type { ResearchRun } from '../server/tinyfish.js';

const input: ComparisonInput = { activity: 'Register a company', places: ['Alpha', 'Beta', 'Gamma'], context: 'Same scope in each place', priority: 'cost' };
const quote = 'Registration costs 100 dollars. Other registrations are free. Annual filing costs 60 dollars.';

function research(overrides: Record<string, unknown> = {}): ResearchRun {
  const payload = {
    assumptions: ['Synthetic test data; never a demo or regulatory claim.'], warnings: [],
    sources: [{ id: 's1', url: 'https://agency.gov/fees', title: 'Fee schedule', authority: 'Agency', quote }],
    places: input.places.map(name => ({ name, currency: 'USD', summary: 'Synthetic fixture', gaps: [], requirements: CATEGORIES.map((category, i) => ({
      id: `r${i}`, category: category.id, title: category.label, description: 'Synthetic requirement', authority: 'Agency',
      jurisdictionLevel: 'state', status: 'required', condition: null,
      cost: { status: i === 0 || i === 5 ? 'known' : 'free', amountMin: i === 0 ? 100 : i === 5 ? 60 : 0, amountMax: i === 0 ? 100 : i === 5 ? 60 : 0, currency: 'USD', basis: i === 5 ? 'Annual renewal' : 'Initial filing' },
      time: { status: 'unknown', minDays: null, maxDays: null, note: 'No end-to-end time is published.' },
      renewal: 'See annual filing', ongoingFiling: 'See annual filing', steps: ['File the form'], dependencies: [], sourceIds: ['s1'],
    })) })), ...overrides,
  };
  return { research_run_id: 'synthetic-test-run', status: 'COMPLETED', deep_result: { result: JSON.stringify(payload), termination_reason: 'planner_done' } };
}

function confirmedReport(): ComparisonReport {
  const report = normalizeResearchReport(input, research(), 'test');
  for (const place of report.places) for (const requirement of place.requirements) requirement.confidence = 'confirmed';
  for (const source of report.sources) { source.verification = 'matched'; source.checkedAt = new Date().toISOString(); }
  return report;
}

test('government authority matching uses hostname boundaries and refuses look-alikes', () => {
  for (const url of ['https://gov.uk/guide', 'https://food.gov.uk/guide', 'https://foodstandards.gov.scot/guide', 'https://companiesoffice.govt.nz/guide', 'https://revenue.delaware.gov/guide', 'https://canada.gc.ca/guide']) assert.equal(isOfficialUrl(url), true, url);
  for (const url of ['https://gov.uk.example.com/guide', 'https://fakegov.uk/guide', 'https://example.com/gov.uk', 'https://agency.gov@evil.com/guide', 'https://evil.com@agency.gov/guide', 'https://127.0.0.1/guide', 'http://localhost/guide', 'javascript:alert(1)', 'https://agency.gov:8443/guide']) assert.equal(isOfficialUrl(url), false, url);
});

test('structured output is required; prose never becomes invented requirements', () => {
  assert.deepEqual(parseResearchJson('Here is the result:\n```json\n{"places":[]}\n```'), { places: [] });
  assert.throws(() => parseResearchJson('The fee might be around $100.'), /valid comparison object/);
});

test('requested places are preserved and missing places receive explicit category gaps', () => {
  const report = normalizeResearchReport(input, research({ places: [] }), 'test');
  assert.deepEqual(report.places.map(p => p.name), input.places);
  assert.equal(report.places.every(p => p.requirements.length === 0 && p.gaps.length === 6), true);
  finalizeComparison(report);
  assert.equal(report.recommendation.place, null);
});

test('ambiguous duplicate source identities are rejected', () => {
  const sources = [{ id: 'same', url: 'https://one.gov/a', quote: 'First passage' }, { id: 'same', url: 'https://two.gov/b', quote: 'Second passage' }];
  assert.throws(() => normalizeResearchReport(input, research({ sources }), 'test'));
});

test('initial fee totals exclude recurring fees and retain unknown charges', () => {
  const report = confirmedReport();
  report.places[0].requirements[1].cost = { status: 'unknown', amountMin: null, amountMax: null, currency: 'USD', basis: 'Fee unavailable' };
  finalizeComparison(report);
  assert.equal(report.places[0].totals.knownInitialCost, 100);
  assert.equal(report.places[0].totals.unknownCostCount, 1);
  assert.equal(report.places[0].totals.isComplete, false);
  assert.equal(report.recommendation.provisional, true);
});

test('fees lacking a currency are not added to the verified subtotal', () => {
  const report = confirmedReport();
  report.places[0].requirements[0].cost.currency = null;
  finalizeComparison(report);
  assert.equal(report.places[0].totals.knownInitialCost, 0);
  assert.equal(report.places[0].totals.unknownCostCount, 1);
  assert.equal(report.places[0].totals.isComplete, false);
});

test('different currencies cannot produce a cheapest-place recommendation', () => {
  const report = confirmedReport();
  report.places[1].currency = 'GBP';
  for (const requirement of report.places[1].requirements) requirement.cost.currency = 'GBP';
  finalizeComparison(report);
  assert.equal(report.recommendation.provisional, true);
  assert.doesNotMatch(report.recommendation.headline, /lowest verified initial fees/);
});

test('a fee range is a lower bound and not a complete startup total', () => {
  const report = confirmedReport();
  report.places[0].requirements[0].cost.amountMax = 200;
  finalizeComparison(report);
  assert.equal(report.places[0].totals.knownInitialCost, 100);
  assert.equal(report.places[0].totals.isComplete, false);
  assert.equal(report.recommendation.provisional, true);
});

test('empty evidence never outranks a substantially supported place', () => {
  const report = confirmedReport();
  report.places[0].requirements = [];
  report.places[1].requirements[0].confidence = 'needs_confirmation';
  report.places[2].requirements[0].confidence = 'needs_confirmation';
  finalizeComparison(report);
  assert.notEqual(report.recommendation.place, 'Alpha');
});

test('interim or exhausted research cannot support a final cost winner', () => {
  for (const reason of ['synthesis_failed', 'deadline', 'max_iterations']) {
    const report = confirmedReport();
    report.methodology.terminationReason = reason;
    finalizeComparison(report);
    assert.equal(report.recommendation.provisional, true, reason);
    assert.doesNotMatch(report.recommendation.headline, /lowest verified initial fees/, reason);
  }
});

test('a whole approval time is not computed by adding individual waits', () => {
  const report = confirmedReport();
  for (const requirement of report.places[0].requirements) requirement.time = { status: 'published', minDays: 5, maxDays: 10, note: 'Synthetic individual processing target' };
  finalizeComparison(report);
  assert.equal(report.places[0].timeline.status, 'unknown');
  assert.equal(report.places[0].timeline.minDays, null);
  assert.equal(report.places[0].timeline.maxDays, null);
});

test('reachable government pages are distinguished from matched supporting passages', async () => {
  const report = normalizeResearchReport(input, research(), 'test');
  const startedAt = Date.now();
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: 'This page describes an unrelated service.' })), errors: [] }) });
  assert.equal(report.sources[0].verification, 'reachable');
  assert.ok(Date.parse(report.sources[0].checkedAt!) >= startedAt);
  assert.equal(report.places[0].requirements[0].confidence, 'needs_confirmation');
  assert.equal(report.places[0].requirements[0].cost.status, 'unknown');
});

test('a number elsewhere on the page does not support a quoted fee', async () => {
  const report = normalizeResearchReport(input, research({ sources: [{ id: 's1', url: 'https://agency.gov/fees', quote: 'Registration is required before operating.' }] }), 'test');
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: 'Registration is required before operating. A different service costs 100 dollars.' })), errors: [] }) });
  assert.equal(report.sources[0].verification, 'matched');
  assert.equal(report.places[0].requirements[0].cost.status, 'unknown');
});

test('an explicitly free registration is supported without a numeral zero', async () => {
  const report = normalizeResearchReport(input, research({ sources: [{ id: 's1', url: 'https://agency.gov/fees', quote: 'Registration of your food business is free.' }] }), 'test');
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: 'Registration of your food business is free.' })), errors: [] }) });
  assert.equal(report.places[0].requirements[1].cost.status, 'free');
  assert.equal(report.places[0].requirements[1].cost.amountMin, 0);
});

test('non-government redirects and failed fetches cannot receive a checked date', async () => {
  for (const page of [{ url: 'https://agency.gov/fees', final_url: 'https://commercial.example/guide', text: quote }, { url: 'https://agency.gov/fees', text: null }]) {
    const report = normalizeResearchReport(input, research(), 'test');
    await verifyReportSources(report, { fetchPages: async () => ({ results: [page], errors: [] }) });
    assert.notEqual(report.sources[0].verification, 'matched');
    assert.equal(report.sources[0].checkedAt, null);
    assert.equal(report.places[0].requirements[0].cost.status, 'unknown');
  }
});

test('advance notice before opening is not an approval-processing duration', async () => {
  const sourceQuote = 'You must register your food business at least 28 days before opening.';
  const report = normalizeResearchReport(input, research({ sources: [{ id: 's1', url: 'https://agency.gov/registration', quote: sourceQuote }] }), 'test');
  report.places[0].requirements[0].time = { status: 'published', minDays: 28, maxDays: 28, note: 'Approval takes 28 days.' };
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: sourceQuote })), errors: [] }) });
  assert.equal(report.places[0].requirements[0].time.status, 'unknown');
  assert.equal(report.places[0].requirements[0].time.minDays, null);
});

test('hours are not silently converted into a claimed day-based approval target', async () => {
  const sourceQuote = 'Your application is usually processed within 24 hours.';
  const report = normalizeResearchReport(input, research({ sources: [{ id: 's1', url: 'https://agency.gov/registration', quote: sourceQuote }] }), 'test');
  report.places[0].requirements[0].time = { status: 'published', minDays: 1, maxDays: 1, note: 'Approval takes 1 day.' };
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: sourceQuote })), errors: [] }) });
  assert.equal(report.places[0].requirements[0].time.status, 'unknown');
});

test('a quoted number does not verify an unsupported currency', async () => {
  const report = normalizeResearchReport(input, research(), 'test');
  report.places[0].requirements[0].cost.currency = 'GBP';
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: quote })), errors: [] }) });
  assert.equal(report.places[0].requirements[0].cost.status, 'unknown');
});

test('unsupported variable-fee minima are removed from numerical output', async () => {
  const report = normalizeResearchReport(input, research(), 'test');
  report.places[0].requirements[0].cost = { status: 'variable', amountMin: 500, amountMax: null, currency: 'USD', basis: 'Depends on assets' };
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: quote })), errors: [] }) });
  assert.equal(report.places[0].requirements[0].cost.status, 'unknown');
  assert.equal(report.places[0].requirements[0].cost.amountMin, null);
});

test('biennial obligations are excluded from annual-charge rankings', () => {
  const report = confirmedReport();
  report.priority = 'balanced';
  report.places[0].requirements[5].cost.amountMin = 20;
  report.places[0].requirements[5].cost.amountMax = 20;
  report.places[0].requirements[5].cost.basis = 'Biennial filing fee';
  report.places[0].requirements[5].renewal = 'Every two years';
  finalizeComparison(report);
  assert.doesNotMatch(report.recommendation.method, /Compare known unconditional annual/);
});

test('verified annual fee floors support a provisional candidate with explicit gaps', () => {
  const report = confirmedReport();
  report.priority = 'balanced';
  const annual = [60, 300, 800];
  report.sources = report.places.map((place, i) => ({ id: `annual-${i}`, url: `https://agency.gov/${i}`, title: 'Synthetic annual charge', authority: 'Agency', checkedAt: new Date().toISOString(), quote: `The required annual government charge has a minimum of ${annual[i]} dollars each year.`, official: true, verification: 'matched', verificationNote: 'Synthetic matched test fixture' }));
  for (let i = 0; i < report.places.length; i++) {
    const place = report.places[i];
    place.gaps = ['City-level costs are unknown.'];
    const requirement = place.requirements[5];
    requirement.sourceIds = [`annual-${i}`];
    requirement.cost = { status: i === 0 ? 'variable' : 'known', amountMin: annual[i], amountMax: i === 0 ? null : annual[i], currency: 'USD', basis: 'Annual government charge; variable with assets in Alpha' };
    requirement.renewal = 'Pay annually';
  }
  finalizeComparison(report);
  assert.equal(report.recommendation.place, 'Alpha');
  assert.match(report.recommendation.headline, /annual-charge candidate/);
  assert.equal(report.recommendation.provisional, true);
  assert.match(report.recommendation.reasoning, /60/);
  assert.match(report.recommendation.reasoning, /unknown|conditional|local/);
});

test('recurring taxes cannot enter initial totals through another category', () => {
  const report = confirmedReport();
  const annual = report.places[0].requirements[5];
  annual.category = 'tax_registration';
  assert.equal(isInitialCharge(annual), false);
  finalizeComparison(report);
  assert.equal(report.places[0].totals.knownInitialCost, 100);
});

test('an explicitly initial statement filing remains initial despite later biennial renewals', () => {
  const report = confirmedReport();
  const initial = report.places[0].requirements[1];
  initial.cost.basis = 'Recurring biennial filing fee of $20; initial filing within 90 days also $20';
  initial.cost = { ...initial.cost, status: 'known', amountMin: 20, amountMax: 20 };
  assert.equal(isInitialCharge(initial), true);
  finalizeComparison(report);
  assert.equal(report.places[0].totals.knownInitialCost, 120);
});

test('verified free and no-separate-government-fee duties do not become unknown charges', () => {
  const report = confirmedReport();
  report.places[0].requirements[1].cost.currency = null;
  report.places[0].requirements[2].cost = { status: 'not_applicable', amountMin: null, amountMax: null, currency: null, basis: 'No separate government filing fee' };
  finalizeComparison(report);
  assert.equal(report.places[0].totals.knownInitialCost, 100);
  assert.equal(report.places[0].totals.unknownCostCount, 0);
});

test('ellipsis quotes must contain substantial fragments in the original order', () => {
  const page = 'Most businesses receive their licence within a month of registering. Further information appears here. Permanent licences are generally sent within 10 working days.';
  assert.equal(matchQuotedPassage('Most businesses receive their licence within a month of registering ... Permanent licences are generally sent within 10 working days', page).matched, true);
  assert.equal(matchQuotedPassage('Permanent licences are generally sent within 10 working days ... Most businesses receive their licence within a month of registering', page).matched, false);
  assert.equal(matchQuotedPassage('Most businesses receive their licence within a month of registering ... A nonexistent promise is not published', page).matched, false);
});

test('conflicting annual tax sources withhold both the charge and a duplicate annual row', async () => {
  const sources = [
    { id: 'current', url: 'https://agency.gov/current', title: 'Annual LLC tax', quote: 'LLCs must pay an annual tax of $400.' },
    { id: 'old', url: 'https://agency.gov/old', title: 'Annual LLC tax FAQ', quote: 'LLCs must pay an annual tax of $300.' },
  ];
  const report = normalizeResearchReport(input, research({ sources }), 'test');
  const first = report.places[0].requirements[4];
  const duplicate = report.places[0].requirements[5];
  for (const r of [first, duplicate]) { r.title = 'Annual LLC tax'; r.cost = { status: 'known', amountMin: 400, amountMax: 400, currency: 'USD', basis: 'Recurring annual tax' }; }
  first.sourceIds = ['current', 'old']; duplicate.sourceIds = ['current'];
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: sources.find(s => s.url === url)!.quote })), errors: [] }) });
  assert.equal(first.cost.status, 'unknown');
  assert.equal(duplicate.cost.status, 'unknown');
  assert.match(report.warnings.join(' '), /disagree|conflict/);
});

test('a proposed lower tax does not override a verified current tax', async () => {
  const sources = [
    { id: 'current', url: 'https://agency.gov/current', title: 'Annual LLC tax', quote: 'Every LLC must pay an annual tax of $800.' },
    { id: 'proposal', url: 'https://agency.gov/proposal', title: 'Bill analysis', quote: 'This bill would reduce the annual tax to $600.' },
  ];
  const report = normalizeResearchReport(input, research({ sources }), 'test');
  const r = report.places[0].requirements[0];
  r.title = 'Annual LLC tax'; r.sourceIds = ['current', 'proposal'];
  r.cost = { status: 'known', amountMin: 800, amountMax: 800, currency: 'USD', basis: 'Recurring annual tax' };
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: sources.find(s => s.url === url)!.quote })), errors: [] }) });
  assert.equal(r.cost.status, 'known');
  assert.equal(r.cost.amountMin, 800);
  assert.match(report.warnings.join(' '), /proposed-law/);
});

test('a financial threshold stays conditional when input does not establish revenue', async () => {
  const sourceQuote = 'If your turnover exceeds £90,000 you must register for VAT.';
  const report = normalizeResearchReport(input, research({ sources: [{ id: 's1', url: 'https://agency.gov/vat', quote: sourceQuote }] }), 'test');
  const r = report.places[0].requirements[0];
  r.title = 'VAT registration'; r.cost = { status: 'not_applicable', amountMin: null, amountMax: null, currency: null, basis: 'No separate government fee' };
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: sourceQuote })), errors: [] }) });
  assert.equal(r.status, 'conditional');
  assert.match(r.condition!, /Financial trigger/);
});

test('an official voluntary-display passage cannot confirm mandatory display', async () => {
  const sourceQuote = 'Display of certificates and stickers is voluntary.';
  const report = normalizeResearchReport(input, research({ sources: [{ id: 's1', url: 'https://agency.gov/hygiene', title: 'Food hygiene certificate guidance', quote: sourceQuote }] }), 'test');
  const r = report.places[0].requirements[0];
  r.title = 'Food hygiene certificate display';
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: sourceQuote })), errors: [] }) });
  assert.equal(r.status, 'unknown');
  assert.equal(r.confidence, 'gap');
});

test('optional certified copies do not make mandatory formation optional', async () => {
  const sourceQuote = 'Filing Fee - $70.00 Certified Copy Fee (Optional) - $5.00';
  const report = normalizeResearchReport(input, research({ sources: [{ id: 's1', url: 'https://agency.gov/llc', title: 'Articles of Organization', quote: sourceQuote }] }), 'test');
  const r = report.places[0].requirements[0];
  r.title = 'Articles of Organization'; r.cost = { status: 'known', amountMin: 70, amountMax: 70, currency: 'USD', basis: 'Initial formation filing' };
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: sourceQuote })), errors: [] }) });
  assert.equal(r.status, 'required');
  assert.equal(r.cost.amountMin, 70);
});

test('absence of an income-tax department does not establish an income-tax exemption', async () => {
  const sourceQuote = 'Department divisions include Excise Tax, Mineral Tax and Property Tax.';
  const report = normalizeResearchReport(input, research({ sources: [{ id: 's1', url: 'https://agency.gov/departments', quote: sourceQuote }] }), 'test');
  const r = report.places[0].requirements[0];
  r.title = 'State personal income tax'; r.status = 'not_required';
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: sourceQuote })), errors: [] }) });
  assert.equal(r.status, 'unknown');
  assert.equal(r.confidence, 'gap');
});

test('a percentage numeral cannot be reused as a quoted flat dollar charge', async () => {
  const sourceQuote = 'Online filing adds a credit card processing fee of 2.4% (minimum $1) of the filing fee.';
  const report = normalizeResearchReport(input, research({ sources: [{ id: 's1', url: 'https://agency.gov/online', quote: sourceQuote }] }), 'test');
  const r = report.places[0].requirements[0];
  r.title = 'Online card fee'; r.cost = { status: 'known', amountMin: 2.4, amountMax: 2.4, currency: 'USD', basis: 'Initial card fee' };
  await verifyReportSources(report, { fetchPages: async urls => ({ results: urls.map(url => ({ url, text: sourceQuote })), errors: [] }) });
  assert.equal(r.cost.status, 'unknown');
});
