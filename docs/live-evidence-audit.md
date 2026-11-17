# Live research evidence audit

Recorded: **2026-11-17T11:19:28Z** (17 November 2026). Sources below were read live through TinyFetch during this review. This timestamp records the manual review checkpoint; the app retains its own independent-fetch timestamps.

## Runs reviewed

| Demo | Research run | Provider outcome |
| --- | --- | --- |
| Café: Westminster, Manchester, Edinburgh | `01a1e92b-26e6-7d55-bee9-732cd5535f4b` | `COMPLETED`, `planner_done`, completed 11:12:07 UTC |
| Domestic single-member LLC: Wyoming, Delaware, California | `01a1e92b-28ed-75d7-9057-68689851a924` | `COMPLETED`, `planner_done`, completed 11:12:00 UTC |

Original provider files: `data/raw/live-cafe-run.json` and `data/raw/live-company-run.json`. Corrections belong in separately reviewed derived demo data. Keep the original research response available so the review is auditable. A successful provider outcome does not establish the accuracy of every claim.

## Critical corrections before showing the café demo

### `edi-11`: FHIS physical display is voluntary

**Finding: [Certain].** The research invented a mandatory-display rule and a purported “Food Hygiene Information Scheme (Scotland) Act 2015.” Its own Edinburgh source says the council asks businesses to display their certificate. Food Standards Scotland's 2025 operational guidance explicitly says:

> Display of certificates/stickers is voluntary

Source: [FSS local-authority operational guidance, section 7](https://www.foodstandards.gov.scot/sites/default/files/2025-10/Local_Authority_update_guidance_on_the_operation_of_the_Food_Hygiene_Information_Scheme.pdf), checked 17 November 2026. The [Edinburgh FHIS page](https://www.edinburgh.gov.uk/food-safety-hygiene/food-hygiene-information-scheme) and [FSS business guidance](https://www.foodstandards.gov.scot/business-guidance/running-a-food-business/hygiene-ratings-and-awards/food-hygiene-information-scheme-business-guidance) support inspections, FHIS outcomes, and certificates; they do not support mandatory physical display.

Use this exact replacement for the unsupported fields. Add an official source with ID `audit-fhis-display`, the operational-guidance URL above, and the six-word quoted passage above. Existing source IDs below refer to the café report.

```json
{
  "id": "edi-11",
  "title": "Food hygiene inspections and FHIS outcomes — physical display voluntary",
  "status": "required",
  "condition": null,
  "description": "Local-authority food safety officers inspect food businesses and assess their compliance with food hygiene law. Scotland uses the Food Hygiene Information Scheme (FHIS). The business receives an outcome and may receive a certificate or sticker. Physical display of certificates or stickers is voluntary. The research's claimed mandatory-display rule and named 2015 Act were not supported and have been removed.",
  "cost": {
    "status": "unknown",
    "amountMin": null,
    "amountMax": null,
    "currency": "GBP",
    "basis": "No inspection or revisit charge has been independently established for this specific café. Physical certificate display is voluntary."
  },
  "time": {
    "status": "unknown",
    "minDays": null,
    "maxDays": null,
    "note": "No fixed first-inspection processing time has been established."
  },
  "renewal": "Inspection frequency depends on risk. If a certificate is displayed voluntarily, keep it consistent with the current outcome.",
  "ongoingFiling": "No separate FHIS filing has been established. Physical certificate display is voluntary.",
  "steps": [
    "Register the food business with the council.",
    "Prepare for food hygiene inspection and maintain compliance records.",
    "Review the FHIS outcome. Display the current certificate or sticker if choosing to do so."
  ],
  "sourceIds": ["s18", "s21", "s36", "audit-fhis-display"]
}
```

Remove the false mandatory-display claim from the place summary, gaps, recommendations, assumptions, and any steps referring to the purported Act. The inspection duty and an optional display should not be merged into a new compulsory display requirement. Do not preserve the unverified seven-day appeal-result promise.

### `edi-04`: late-hours catering applies to food, including cold food

**Finding: [Certain].** The context excludes **hot** food after 23:00, but does not explicitly say that every food sale stops then. Edinburgh's [late-hours catering page](https://www.edinburgh.gov.uk/directory-record/1099562/late-hours-catering-licence) states:

> Premises offering food between the hours of 11pm and 5am, whether on or off the premises

That clause is followed by the licence requirement. Replace the “not required on stated facts” conclusion with `status: "conditional"` and `condition: "Required if any food is offered between 23:00 and 05:00; closing hours have not been supplied."` Rename the title to “Late-hours catering licence — conditional on opening hours.” Existing `s24` supports scope; `s25` supports the conditional application and renewal charges; `s26` supports the council's published processing statement. Do not convert nine months to 273 days. A new closing-hours assumption must be clearly added to the demo scope, rather than silently inferred.

### `edi-03`: Scottish alcohol licensing and civic food licensing are distinct

**Finding: [Certain] about source conflict; [Likely] about the legal scope conclusion.** The current [generic GOV.UK Scotland premises-licence guide](https://www.gov.uk/find-licences/premises-licence-scotland) contains an England-style list of hot-food and entertainment triggers. The [Licensing (Scotland) Act 2005](https://www.legislation.gov.uk/asp/2005/16/section/16) defines a premises licence in relation to alcohol sales; the statute's direct fetch was bot-blocked during this audit. Edinburgh separately regulates late-hours food through civic licensing.

Remove the claim that every entertainment or late-hours food activity triggers the alcohol premises licence. For this no-alcohol demo, retain only the limited no-alcohol conclusion with a source-confirmation flag. Remove hypothetical alcohol fee ranges and general processing estimates from the non-applicable row. Record the conflicting generic guidance and the unavailable direct statute check as a gap if no better council/statute evidence is available.

### `wcc-02`, `man-02`, `edi-02`: notification periods are not approval times

**Finding: [Certain].** Twenty-eight days is a minimum advance-registration period. The raw report itself labels it that way but incorrectly populates the numeric approval-time fields. Replace all three `time.status` values with `unknown`, with both numeric values `null`. Preserve the 28-day duty in description and steps.

Remove the guessed “15 working days = 21 calendar days,” “5 working days = 7 calendar days,” and any other fixed business-day conversion from the descriptions and notes. Working days exclude weekends and potentially holidays; a fixed conversion is not published evidence. Published confirmation or processing statements may be shown in their **original units** with their individual sources, without becoming total time to open.

### Tax thresholds and conditional obligations

**Finding: [Certain].** [GOV.UK sole-trader guidance](https://www.gov.uk/become-sole-trader) explicitly permits trading before Self Assessment registration and conditions mandatory registration on more than £1,000 income in a tax year. The demo supplies no revenue. Change `wcc-01`, `man-01`, and `edi-01` to conditional on that threshold. Their later annual-return rows (`wcc-13`, `man-13`, `edi-14`) are conditional on registration/filing requirements rather than universal first-day formation duties.

The [self-employed NI page](https://www.gov.uk/self-employed-national-insurance-rates) conditions Class 4 payment on profits above £12,570. Change `wcc-05`, `man-05`, and `edi-06` to conditional. The current 2026/27 amounts in the raw report match the current page, but profit-based tax cannot be an initial filing fee.

For `wcc-06`, `man-06`, and `edi-07`, preserve the **tax year used for the qualifying-income test**, not just the start dates. [HMRC's MTD guidance](https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax) links 2024/25 income over £50,000 to April 2026, 2025/26 over £30,000 to April 2027, and 2026/27 over £20,000 to April 2028. The new café is not automatically subject to MTD merely because its prospective revenue exceeds £50,000.

### Scottish fire safety, allergens, and leases

- `edi-08`: the sole cited source is England fire-safety guidance that explicitly excludes Scotland. Replace it with [Scottish Government non-domestic fire-safety policy](https://www.gov.scot/policies/fire-and-rescue/non-domestic-fire-safety/), which confirms the Fire (Scotland) Act 2005 and 2006 Regulations. Retain a gap for the precise written-record duty under the no-employees/no-alcohol scope; do not claim an English universal recording rule applies in Scotland.
- `edi-12`: information on allergens is relevant to freshly prepared food. PPDS full packaging labelling is **conditional** on preparing prepacked-for-direct-sale food. Buying packaged drinks is not the same as preparing PPDS food. The supplied English FSA sources do not by themselves establish the Scottish PPDS legal regime; retain the explicit Scottish-source gap until checked.
- `edi-15`: [Edinburgh's current rates/lease guidance](https://www.edinburgh.gov.uk/business-rates/non-domestic-rate-charges-201920) says LBTT depends on lease terms. Change the condition to “If lease terms bring the lease within LBTT,” rather than saying every commercial lease triggers payment. Three-year review and 30-day filing duties apply to leases within the regime, not universally.
- `wcc-14`: rename “LBTT / Lease Registration — Gap” to “SDLT / Commercial lease obligations — not established.” LBTT is the Scottish regime; the Westminster row itself discusses SDLT. Keep unknown status and no invented fee.
- English FHRS display being voluntary is consistent with the raw report. Reinspection intervals are risk dependent: remove unsupported fixed “6 months to 2 years” claims unless the cited page actually publishes that interval for this authority and activity.

## Critical corrections before showing the LLC demo

### `DE-BR-001`: current ordinary formation fee is $110

**Finding: [Certain].** TinyResearch left a discoverable fee gap. The official forms and fee pages link to an August 2026 form and fee schedule:

- [Delaware LLC formation instructions, revised 8/2026](https://corpfiles.delaware.gov/LLC_Forms/LLC%20Formation.pdf): “The fee to file the Certificate is $ 110.”
- [Division fee schedule, revised 1 August 2026](https://corpfiles.delaware.gov/Fee_Schedule/AugustFee2026.pdf): the domestic LLC formation row is $110, with optional copies and expedited charges in separate columns.

Set `DE-BR-001.cost` to known USD 110 for normal formation; add these sources as `audit-de-formation` and `audit-de-fees`. The fee schedule notes that the first column includes the domestic LLC filing and municipality fee. Optional copies and expedited service remain excluded by the stated scope. Remove the obsolete “formation fee unconfirmed” assumption/gap. The older $90 search results are not the current August 2026 fee.

### `DE-TX-001`, `DE-RF-001`: preserve and disclose the $400/$300 conflict

**Finding: [Certain].** Current [LLC tax-payment instructions](https://corp.delaware.gov/alt-entitytaxinstructions/) and [franchise-tax page](https://corp.delaware.gov/frtax/) say $400. The revised August 2026 formation form also says $400 annually, due 1 June after the relevant calendar year closes. The [older tax FAQ](https://corp.delaware.gov/taxfaq/) still says $300.

Use the clearly revised current $400 instructions for the reviewed demo and explicitly record the conflicting older FAQ. Do not silently assume all official pages agree. If the automatic conflict guard withholds the number, retain the conflict and show both source claims until reviewed resolution is recorded. Do not count both duplicate annual-tax rows twice.

### `CA-TX-001`: current tax and timing; enacted future change

**Finding: [Certain].** The current [FTB LLC page](https://www.ftb.ca.gov/file/business/types/limited-liability-company/index.html) states $800 annually and says the first-year payment is due on the fifteenth day of the fourth month **from formation**, with later payments due on the fifteenth day of the fourth month of the taxable year. The raw sentence saying 2026 tax is due on 15 April of the following year is wrong; that confuses the tax payment with after-year-end return filing. Remove it.

[FTB's current forms-change page](https://www.ftb.ca.gov/forms/whats-new.html) lists SB 122 under **chaptered** legislation and confirms a first-taxable-year reduction from $800 to $400 for qualifying taxable years beginning in 2027–2029. Replace the claim that this future change's enactment is unknown with the published enacted change and its exact applicability. A proposed SB 347 analysis saying a bill “would” reduce the tax to $600 is not authority for a current $600 tax. Keep the 2026 $800 figure; do not promote a proposal to enacted law.

`CA-TX-002`: the current income-fee table starts the $900 tier at **$250,000**. Use the exact table ranges, and make tax/payment applicability conditional on income. `CA-BR-003` includes the initial $20 Statement of Information and its later biennial filings; retain the initial charge while excluding later payments from initial totals. `CA-RF-001` is the same recurring obligation and must not add another initial $20.

### Wyoming filing and recurring costs

**Finding: [Certain].** [Wyoming online filing instructions](https://wyobiz.wyo.gov/Business/RegistrationInstr.aspx) show a $100 LLC fee plus a credit-card processing charge of **2.4%, minimum $1**. Standard online filing therefore has an additional charge. The arithmetic at $100 is $2.40; label that as a calculation from the published formula, not a directly quoted flat fee. Add a sourced processing-charge row (`audit-wyo-online`) or retain the formula as a visible unknown/variable charge. Do not present $100 as the total online payment.

The same instructions actually contain the unusual paper-only review rule for names beginning with “A”; the raw rule is supported and should remain visible if relevant to the chosen name. The [annual-report worksheet](https://sos.wyo.gov/forms/business/general/arworksheet.pdf) supports the $60 minimum and asset-based formula. Both `WY-TX-001` and `WY-RF-001` describe that same recurring obligation: keep a single annual monetary contribution. The minimum is not a fixed fee for every asset level.

`WY-TX-002`: inference from the Revenue Department's list of divisions does **not** prove no personal income tax. Change this row to unknown/gap unless an explicit official source is added. `WY-OL-001`: failure to find a state operating licence likewise does not prove an exemption; change to unknown/gap unless official positive exemption guidance is found. Local licence gaps remain appropriate because no city or address is supplied.

### Delaware operational licence, income and receipts

- `DE-OL-001` / `DE-RF-002`: [the licence FAQ](https://revenue.delaware.gov/frequently-asked-questions/business-licenses-faqs/) supports the state licence, year-end renewal, immediate temporary printout, and first-year proration. The generally $75 yearly licence is not necessarily a fixed $75 first payment on the November demo date. Keep renewal separate from any initial prorated charge.
- `DE-TX-003`: [the gross-receipts FAQ](https://revenue.delaware.gov/frequently-asked-questions/gross-receipts-tax-faqs/) says businesses **may** need to pay and that exclusions depend on activity. Change universal payment language to conditional on activity classification, receipts, and exclusions. The published general rate range and quarterly/new-business filing guidance may remain with the source; the precise consulting classification and exclusion are unresolved.
- `DE-TX-002`: a US-resident founder is not necessarily a Delaware-resident taxpayer. Remove a universal instruction to file the resident-only `PIT-RES` form; refer to the appropriate resident or nonresident return and mark residency/filing-threshold applicability for confirmation.
- BOI exemption rows match the current [FinCEN page](https://fincen.gov/boi), including the final rule effective **14 August 2026**. Keep the distinction between domestic formation and an entity formed under foreign law.

## Demo-level decision limits

The reviewed report can support comparisons of specific verified filing fees and known annual government-charge floors. It cannot certify a full startup-cost total or fastest setup when city rules, income-dependent taxes, commercial services, or complete processing duration are unresolved. A provisional Wyoming annual-charge candidate is defensible only if the source conflict policy and duplicated annual taxes are handled and its asset-based minimum is explicit.

Every source being official is insufficient for automatic confirmation: wrong jurisdiction, unsupported absence claims, and conflicts can exist on official pages. The general tool must continue to flag these for arbitrary inputs; the reviewed demos should not disguise model mistakes by overwriting the original run.
