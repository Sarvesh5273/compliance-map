# Compliance Map interface direction

## Product and audience

Compliance Map helps founders compare official startup paperwork across three to six places. The main job is to inspect comparable requirements and their evidence, then understand what remains uncertain. The interface should read as a research workspace.

## Design source

The UI UX Pro Max skill was installed globally from `nextlevelbuilder/ui-ux-pro-max-skill`, pinned to commit `e59ff376a41f7ca47b7541ad5c116495cbade3ee` on 17 November 2026. GitHub API metadata at the time showed 150,684 stars and a last push on 16 November 2026. The alternative reviewed was `pbakaus/impeccable` (111,783 stars, last push on 17 November 2026).

The skill's local query `government compliance comparison dashboard` returned the **Accessible & Ethical** style. The generated source is [MASTER.md](design-system/compliance-map/MASTER.md), with CSS and JSON tokens alongside it. Recommendations were checked for fit rather than applied as instructions that override the product.

## Visual system

- Light surfaces, navy text, restrained blue accents and amber uncertainty states.
- Atkinson Hyperlegible typography, with a 16px base and readable line spacing.
- Clear borders, consistent spacing and distinct selected, focused, disabled and loading states.
- Text and status words convey meaning alongside color.
- Subtle feedback only; nonessential motion respects reduced-motion preferences.

A Halloween treatment was considered and rejected as a product-direction choice: seasonal decoration would compete with the evidence and trust cues. This is a design judgment, not a measured conversion claim.

## Information hierarchy

1. Explain the activity and place inputs, and distinguish the public snapshot gallery from the full live app.
2. Provide two prominent saved live demos with their real scope and original checked dates.
3. Show all compared places, known initial-fee lower bounds and outstanding uncertainty.
4. Show a provisional recommendation with its limits visible; let users expand the detailed reasoning and trade-offs.
5. Align the same selected requirement category across every place. Keep other categories discoverable through counts and navigation.
6. Reveal detailed steps, renewals, filings and source passages progressively.
7. Provide a searchable evidence browser and explicit source states.

## Interaction rules

- Search and category filters apply consistently to all places.
- A filter yielding no results does not imply no legal obligations.
- Place headers remain visible in the desktop comparison. Mobile users can switch place details while keeping the all-place overview.
- Expansions expose their state and support keyboard use.
- Controls have visible focus and adequate touch areas.
- Source evidence remains accessible from each requirement, including failed or unmatched evidence.
- Export and print retain the complete underlying report, irrespective of the current view filter.

## Accuracy constraints

The redesign changes presentation only. Fees, legal classifications, source URLs, dates, uncertainty flags and the research pipeline remain intact. A matched passage is described as a source match; it is not presented as legal certification. A known initial-fee subtotal remains a lower bound. Unpublished approval times remain unknown. The original research and separate semantic review remain auditable.

## Delivery checks

Check both saved activity reports at desktop and mobile widths, category/search combinations, expansion/collapse, source keyboard navigation, export, print, gallery mode, and reduced motion. Run the existing build and substantive evidence tests before publishing.
