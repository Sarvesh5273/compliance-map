# Compliance Map: independent acceptance review

Review date: 17 November 2026. This document distinguishes implemented checks from judgments that need live evidence. Passing software tests does not certify legal accuracy or exhaustiveness.

## Bounty acceptance gates

| Requirement | Evidence to retain |
| --- | --- |
| One activity and at least three places | The submitted input and the three or more place records in each saved run; an additional arbitrary input can be run through the same endpoint. |
| Official government requirements | Each requirement links to official source IDs, each source records its URL, authority, actual check timestamp, extraction status, and supporting passage. |
| Comparable side-by-side output | The same six comparison categories appear for all places. Initial fees, approval duration, renewal obligations, and ongoing filings are separate fields. |
| Recommendation with trade-offs | The recommendation states the method and uncertainty, and refuses unsupported monetary comparisons across currencies. |
| Two different activities | Two completed TinyResearch runs with different activities and saved original provider responses. Loading them is explicitly labeled a saved live run. |
| TinyResearch does the core work | Retain research run IDs, original research text, termination reason, and evidence. Search discovers authorities; Fetch independently checks the cited pages. |
| Honesty about unknown rules | Missing cost, time, authority, scope, or evidence becomes a gap or needs-confirmation status. Zero has to be explicitly supported as free. |
| No individual licence checking | The tool researches what an activity requires. It never asks for a licence holder, registration number, or someone's licence status. |

## Meaningful TinyFish endpoint use

1. **Search:** discovers government authorities for each requested place and activity. Search snippets are leads, never confirmation.
2. **TinyResearch:** researches and synthesizes the cross-jurisdiction obligations with source citations. One newly submitted comparison starts one research run.
3. **Fetch:** retrieves official cited pages for independent citation and passage checks. A reachable page is distinguishable from a matched supporting passage.

Do not add Browser or Monitor usage solely to earn endpoint points. The bounty's exact scoring treatment of TinyResearch should be confirmed by the organizers, because the general rulebook names Search, Fetch, Agent, Browser, and Monitor.

## Recommended reproducible demo scopes

### Café

- Activity: open a small café.
- Places: Westminster (London, England), Manchester (England), Edinburgh (Scotland).
- Founder: resident sole trader already eligible to self-employ.
- Operation: one existing premises already permitted for café use; coffee, packaged drinks, and freshly prepared food sold directly to consumers; no staff initially.
- Excluded: alcohol, music, outdoor seating, street trading, hot food after 23:00, building work, and change of use.
- Required comparison caution: the requirement to register food premises at least 28 days before opening is an advance-notification period. It is not a 28-day licence approval service level.
- Conditional obligations: turnover-based tax registration and changes in premises, staffing, or business activity must remain visible.

### Single-member LLC

- Activity: register a domestic single-member LLC.
- Places: Wyoming, Delaware, California.
- Founder: a US resident with one unregulated online consulting business, operating only in the selected state; no employees, professional registration, assumed name, or separate commercial premises.
- Filing route: normal government filing; compare the local registered-agent prerequisite and exclude privately quoted agent prices.
- Cost comparison: USD in all three places; distinguish filing fees, initial state business licences, annual fees, taxes, and conditional gross-receipts or turnover obligations.
- Locality: no city is specified. City and county business licences remain an explicit gap, so the subtotal cannot claim to be all startup costs.
- Key traps: Delaware's business licence is separate from LLC formation; California's recurring franchise tax is separate from Secretary of State fees; Wyoming's annual licence tax may depend on assets; US domestic entity BOI requirements must be checked against current FinCEN rules.

## Critical accuracy risks

- **Geography:** national, state, and local layers can all apply. A country-only source is insufficient evidence for a city-specific café's premises rules.
- **Authority:** a hostname containing `gov` is not sufficient. Match real suffix boundaries and reject credentials, unapproved redirects, and look-alike domains.
- **Coverage:** a list of known requirements is not a guarantee of every requirement. An unexplored category must be a visible gap.
- **Fees:** initial-cost subtotals exclude recurring and conditional charges, use a lower-bound label when anything is unknown, and never sum different currencies.
- **Time:** an individual processing target cannot be reused as the entire setup time. Parallel tasks and dependency order cannot be inferred from a sum.
- **Evidence:** matching a quote on a page proves that passage exists. It does not automatically prove every statement, monetary number, renewal, or deadline in the requirement.
- **Freshness:** checked today does not mean published today. Use actual retrieval times and retain source publication metadata separately if available.
- **Research completion:** `COMPLETED` is not an accuracy score. `synthesis_failed`, deadline exhaustion, and iteration exhaustion need explicit qualification.
- **Retry:** asynchronous research starts are not idempotent. An uncertain POST result must not silently start another billed run.

## API evidence

The official [TinyResearch API reference](https://docs.tinyfish.ai/tinyresearch/reference) was read through TinyFish Search and Fetch on 17 November 2026. It documents:

- `POST https://agent.tinyfish.ai/v1/automation/run-research-async`, authenticated by `X-API-Key`.
- The returned `research_run_id`, and polling through `GET /v1/research-run/{id}`.
- The report string at `deep_result.result`, with citations and source evidence retained separately.
- Original evidence records containing claims, snippets, `fetched_at`, `live_fetch`, and `access_method`.
- Standard `deep` mode and its completed-run charge; no output JSON schema request parameter is documented.

## Submission work outside the app

A working repo or live demo link, notes explaining TinyFish use, a LinkedIn post tagging TinyFish, and a Discord `#showcase` post are required by the supplied rulebook. Drafts are not proof of publication. Submission and public posting require the user's explicit authorization.

## Implemented adversarial checks

The current suite contains **41 passing tests** in `tests/report.test.ts`, `tests/input.test.ts`, and `tests/provider.test.ts`. It covers arbitrary activity inputs, minimum place counts, duplicate places, malformed input, authority hostname boundaries, malformed/prose research output, omitted places, duplicate source IDs, recurring versus initial costs, missing currencies, cross-currency ranking, ranged fees, insufficient-evidence ranking, incomplete research termination, non-additive approval time, reachable versus matched sources, numeric claims outside the cited passage, explicitly free fees, unapproved redirects/failed fetches, advance notification versus approval processing, hours versus days, currency provenance, unsupported variable-fee minima, biennial versus annual obligations, a provisional annual-government-charge floor recommendation, current-versus-proposed fees, conflicting monetary passages, unsupported exemptions, financial thresholds, and mandatory-versus-voluntary duties. Provider tests prove each research start sends one POST and preserves any returned ID after an uncertain outcome. These are synthetic test fixtures and are never exposed as regulatory demos.

The initial review found and the backend corrected: empty results ranking above supported places, currencyless fees contributing to complete totals, fee ranges treated as complete totals, duplicated source IDs, and interim synthesis yielding a final cost-winner headline. Approval checks now require processing/approval language and a day unit, reject contradicted working-day units, and refuse silent hour-to-day conversion. Numeral matching by itself still cannot certify all prose or renewal claims; the live reports need an item-by-item source review.

Where every place has supported annual government charges in the same currency, the backend can recommend a **provisional annual-charge candidate** using the known fee floor. Verified variable minima may participate. Conditional charges, unknown city fees, asset-based increases, and total costs remain separate caveats; biennial or quarterly fees are not silently converted to annual figures.

## Freshness finding for the LLC demo

TinyFetch independently read the current [FinCEN BOI page](https://fincen.gov/boi) and its [11 August 2026 final-rule announcement](https://www.fincen.gov/news/news-releases/fincen-permanently-ends-beneficial-ownership-reporting-requirements-millions) during this review. The current page says domestic US companies are exempt and that the final rule took effect on 14 August 2026. It also warns that older guidance contradicting the exemptions should be disregarded. This is a material example of why live official evidence is needed; it must not be represented merely as the older March 2025 interim rule.

## Completed live-run review

Both café and LLC TinyResearch runs completed with `planner_done`. The separate `docs/live-evidence-audit.md` records their IDs, actual completion times, exact source-backed corrections, and remaining gaps. The manual audit found a false Scottish mandatory-display claim, business-day conversions, conditional tax triggers treated as universal, missing current Delaware formation fees, conflicting Delaware annual-tax pages, and outdated or proposed-law interpretations. Those findings must be represented in reviewed derived demo data, with the original provider research retained.
