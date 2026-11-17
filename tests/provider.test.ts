import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderError, TinyFishProvider } from '../server/tinyfish.js';

const syntheticRunId = 'synthetic-research-run';
const provider = () => new TinyFishProvider('synthetic-test-key-never-used-on-network');
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('research start makes one POST and returns the accepted run ID', async t => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return response({ research_run_id: syntheticRunId, error: null });
  });
  assert.equal(await provider().startResearch('Synthetic test question', ['agency.gov', 'agency.gov']), syntheticRunId);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.match(requests[0].url, /\/v1\/automation\/run-research-async$/);
  assert.equal(requests[0].init?.method, 'POST');
  const body = JSON.parse(String(requests[0].init?.body));
  assert.equal(body.mode, 'deep');
  assert.deepEqual(body.domain_filter.domains, ['agency.gov']);
});

test('concurrency rejection never automatically retries a billed start', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => response({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Maximum concurrent Research runs reached' } }, 429));
  await assert.rejects(provider().startResearch('Synthetic test question'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'RATE_LIMIT_EXCEEDED');
    assert.equal(error.status, 429);
    assert.equal(error.ambiguous, false);
    return true;
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('transport timeout marks start as uncertain and never sends another POST', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Synthetic timeout', 'TimeoutError'); });
  await assert.rejects(provider().startResearch('Synthetic test question'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'START_UNCONFIRMED');
    assert.equal(error.ambiguous, true);
    assert.match(error.message, /may already be running|history/);
    return true;
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('unreadable start JSON is uncertain and does not trigger an automatic retry', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('not valid JSON', { status: 200 }));
  await assert.rejects(provider().startResearch('Synthetic test question'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'START_UNCONFIRMED');
    assert.equal(error.ambiguous, true);
    return true;
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('an error alongside a research ID preserves the ID for polling', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => response({ research_run_id: syntheticRunId, error: { code: 'DISPATCH_UNCONFIRMED', message: 'Synthetic dispatch issue' } }));
  await assert.rejects(provider().startResearch('Synthetic test question'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'START_UNCONFIRMED');
    assert.equal(error.ambiguous, true);
    assert.equal(error.researchRunId, syntheticRunId);
    assert.match(error.message, /resume polling/);
    return true;
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('a non-success HTTP response still preserves a supplied research ID', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => response({ research_run_id: syntheticRunId, error: { code: 'DISPATCH_UNCONFIRMED', message: 'Synthetic ambiguous dispatch' } }, 502));
  await assert.rejects(provider().startResearch('Synthetic test question'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.ambiguous, true);
    assert.equal(error.researchRunId, syntheticRunId);
    return true;
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});
