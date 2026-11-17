# UI/UX audit

Scope: the November 2026 interface refresh of Compliance Map. This audit concerns usability and presentation of the existing reviewed reports; it does not establish new regulatory facts.

## Guidance applied

The installed `ui-ux-pro-max` skill and its `references/quick-reference.md` were read. A targeted local search, `keyboard focus modal --domain ux`, returned applicable guidance on visible focus, keyboard navigation, and keeping focused controls unobscured. The design must keep these obligations concrete rather than treating a new palette as accessibility proof.

The interface direction is a professional, accessible compliance tool. Its evidence status, conditional applicability, and incomplete totals take priority over decoration or seasonal treatment.

## Data-presentation requirements

- Keep the three-place overview visible while showing requirement details progressively.
- Use the same category rows and stable place columns when desktop filters change.
- Provide an operable place selector and complete details at small widths.
- Keep conditional/unknown applicability and source-check status visible before expansion.
- Describe annual taxes as recurring charges; do not label an annual tax an initial fee.
- Distinguish a duty with no approval process from an unpublished processing duration.
- Show asset-dependent minima as floors rather than fixed universal fees.
- Retain steps, renewals, filings, source URLs, check dates, and verification notes inside expanded details.
- A source-page fetch and a matched excerpt must remain different statuses.
- Filtering the screen must not filter the exported JSON or printed report.
- When applicability is unknown, do not retain an unqualified “Not Required” or “Exempt” display title or imply a zero charge. Preserve the original reported title and fee basis only with an explicit unconfirmed-claim label in details and print.

## Focused browser QA

`scripts/qa-ui.ts` runs against the local app with installed Chrome through Playwright. It loads the two actual saved activity reports using the existing example API. It aborts any POST that could start or resume research, so this check cannot generate another paid research run.

Checks cover:

1. Labeled input fields, one main heading, readable body type, and document overflow.
2. Actual saved place/requirement counts and stable native-table columns.
3. Per-requirement expansion with full renewals, filings, steps, and citation access.
4. Source-dialog keyboard entry, forward/backward focus wrapping, Escape, and focus return.
5. Category/search filtering, explicit no-result states, and clear-filter recovery.
6. Source search and verification-state filtering.
7. Full JSON download despite an empty filtered screen.
8. Full printed requirement counts, all places, details, and hyperlinks despite active filters.
9. Annual-charge terminology and non-applicable approval semantics.
10. Desktop 1440px, tablet 768px, and mobile 375px layouts.
11. Selected-place access, minimum disclosure hit height, readable controls, and reduced-motion preference.
12. Uncaught browser errors and prevention of paid research requests.

The script writes `artifacts/ui-qa.json` and desktop/mobile/tablet/print screenshots. Its result is a targeted browser check, not a full WCAG certification or a cross-browser audit. Screenshot inspection remains necessary for hierarchy, readability, and visual balance.

## Current verification status

**38 checks passed; zero failed** in installed Chrome against the local app at **2026-11-17T12:28:47Z**. The latest machine-readable result is `artifacts/ui-qa.json`.

The two reports retain **43 café requirements** and **34 company requirements**, each across three places with 51 source records. Filtered-screen JSON export and print preserved those full counts. Printed requirement sources retain HTTPS hyperlinks and visible checked dates. The source modal passed keyboard entry, Tab/Shift-Tab wrapping, Escape, and focus return.

No document overflow was found at 1440px, 768px, or 375px. Visible input/select text measured 16px at both small widths. Requirement disclosure targets measured 44px at 768px and 46px at 375px. Reduced-motion preference was active during the responsive checks. There were zero uncaught browser errors and zero paid research requests.

The audit caught and the frontend corrected 15px tablet place inputs, initially non-link printed URLs, and bold exemption/zero-charge claims competing with unknown applicability. The final run verified neutral unconfirmed-applicability headings, unknown primary charge values, and explicit labels around preserved reported claims.

Desktop, mobile, and tablet screenshots were visually inspected. The refreshed layout has a readable heading hierarchy, separated form and report sections, a compact default source browser, and visible cost/timing uncertainty. This remains a targeted Chrome audit, not a full WCAG or cross-browser certification.
