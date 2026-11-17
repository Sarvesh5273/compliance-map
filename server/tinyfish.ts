export class ProviderError extends Error {
  constructor(public code: string, message: string, public status = 502, public ambiguous = false, public researchRunId?: string) {
    super(message);
  }
}

export type ResearchRun = {
  research_run_id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';
  query?: string;
  created_at?: string;
  completed_at?: string;
  deep_result?: { result: string; citations?: string[]; termination_reason?: string; freshness_report?: unknown } | null;
  evidence?: unknown;
  iterations?: number;
  error?: { code: string; message: string } | null;
};

export type SearchResult = { url: string; title: string; snippet: string };
export type FetchedPage = { url: string; final_url?: string; title?: string; text: string | null; latency_ms?: number };
export type FetchResult = { results: FetchedPage[]; errors: { url: string; error: string; status?: number }[] };

export class TinyFishProvider {
  readonly key: string;
  readonly researchBase: string;
  readonly searchBase: string;
  readonly fetchBase: string;

  constructor(key = process.env.TINYFISH_API_KEY || '') {
    this.key = key;
    this.researchBase = process.env.TINYFISH_RESEARCH_BASE_URL || 'https://agent.tinyfish.ai';
    this.searchBase = process.env.TINYFISH_SEARCH_BASE_URL || 'https://api.search.tinyfish.ai';
    this.fetchBase = process.env.TINYFISH_FETCH_BASE_URL || 'https://api.fetch.tinyfish.ai';
  }

  get configured() { return Boolean(this.key); }

  private async request<T>(url: string, method = 'GET', body?: unknown, timeoutMs = 60000, creating = false): Promise<T> {
    if (!this.key) throw new ProviderError('KEY_REQUIRED', 'Add TINYFISH_API_KEY to the server environment to run live research.', 503);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: { 'X-API-Key': this.key, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ProviderError(creating ? 'START_UNCONFIRMED' : 'PROVIDER_UNREACHABLE', creating
        ? 'The research start was not confirmed. It may already be running. Check your TinyFish research history before starting again.'
        : 'TinyFish did not respond in time. The current research run can be polled again.', 502, creating);
    }
    let payload: any;
    try { payload = await response.json(); } catch {
      throw new ProviderError(creating ? 'START_UNCONFIRMED' : 'INVALID_PROVIDER_RESPONSE', creating
        ? 'TinyFish returned an unreadable start response. Check your research history before starting again.'
        : 'TinyFish returned an unreadable response.', 502, creating);
    }
    if (!response.ok) {
      const code = payload?.error?.code || `HTTP_${response.status}`;
      const known: Record<string, string> = {
        INSUFFICIENT_CREDITS: 'Your TinyFish wallet needs funds before research can start. Add money: https://agent.tinyfish.ai/wallet?utm_source=api&utm_medium=insufficient_funds&utm_campaign=research',
        FORBIDDEN: 'TinyResearch is not enabled for this API key or access is denied.',
        RATE_LIMIT_EXCEEDED: 'TinyFish has reached its research concurrency limit. Wait for an existing run to finish.',
        SERVICE_BUSY: 'TinyFish research is temporarily busy.',
      };
      const message = known[code] || (response.status === 401 ? 'TinyFish rejected the API key.' : 'TinyFish could not complete this request.');
      if (creating && typeof payload?.research_run_id === 'string' && payload.research_run_id.length <= 100) throw new ProviderError('START_UNCONFIRMED', `${message} A research ID was returned and is preserved. Poll it before starting another run.`, 502, true, payload.research_run_id);
      throw new ProviderError(code, message, response.status === 401 || response.status === 403 ? 503 : response.status);
    }
    return payload as T;
  }

  async search(query: string): Promise<SearchResult[]> {
    const url = new URL(this.searchBase);
    url.searchParams.set('query', query);
    url.searchParams.set('language', 'en');
    url.searchParams.set('purpose', 'Discover official government regulatory authorities for a cross-jurisdiction compliance comparison.');
    const result = await this.request<{ results?: SearchResult[] }>(url.toString(), 'GET', undefined, 60000);
    return result.results || [];
  }

  async startResearch(query: string, domains: string[] = []): Promise<string> {
    const payload: Record<string, unknown> = { query, mode: 'deep', output_language: 'en' };
    if (domains.length) payload.domain_filter = { mode: 'include', domains: [...new Set(domains)].slice(0, 150) };
    const result = await this.request<{ research_run_id?: string; error?: unknown }>(`${this.researchBase}/v1/automation/run-research-async`, 'POST', payload, 90000, true);
    const runId = typeof result.research_run_id === 'string' && result.research_run_id.length <= 100 ? result.research_run_id : undefined;
    if (result.error) throw new ProviderError('START_UNCONFIRMED', runId ? 'TinyFish returned a research ID alongside an error. The ID is preserved; resume polling it before starting another run.' : 'TinyFish returned an error without a confirmed research ID. Check research history before starting again.', 502, true, runId);
    if (!runId) throw new ProviderError('START_UNCONFIRMED', 'TinyFish did not return a research ID. Check research history before starting again.', 502, true);
    return runId;
  }

  getResearch(id: string): Promise<ResearchRun> {
    return this.request<ResearchRun>(`${this.researchBase}/v1/research-run/${encodeURIComponent(id)}`, 'GET', undefined, 60000);
  }

  fetchPages(urls: string[]): Promise<FetchResult> {
    return this.request<FetchResult>(this.fetchBase, 'POST', { urls, format: 'markdown', links: true, ttl: 0,
      purpose: 'Independently check official citations and quoted passages from a regulatory comparison.', per_url_timeout_ms: 90000 }, 150000);
  }
}
