import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

const baseUrl = process.env.COMPLIANCE_UI_URL || 'http://127.0.0.1:5173';
const artifactDir = process.env.COMPLIANCE_UI_ARTIFACTS || 'artifacts';
await mkdir(artifactDir, { recursive: true });

type Check = { name: string; passed: boolean; detail?: unknown };
const checks: Check[] = [];
const browserErrors: string[] = [];
const paidRequests: string[] = [];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function check(name: string, action: () => Promise<unknown>) {
  try { const detail = await action(); checks.push({ name, passed: true, detail }); }
  catch (error) { checks.push({ name, passed: false, detail: (error instanceof Error ? error.message : String(error)).slice(0, 2000) }); }
}

const response = await fetch(`${baseUrl}/api/examples`);
assert.equal(response.ok, true, 'The local example API must be available.');
const examples = await response.json() as { id: string; title?: string; activity?: string }[];
const cafe = examples.find(example => /caf[eé]/i.test(`${example.title} ${example.activity} ${example.id}`));
const company = examples.find(example => /company|llc/i.test(`${example.title} ${example.activity} ${example.id}`));
assert.ok(cafe && company, 'Two actual saved activity demos are required for UI QA.');

async function createPage(width: number, height: number, reducedMotion = false) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await context.route(/\/api\/comparisons(?:\/[^/]+\/resume)?(?:\?.*)?$/, async route => {
    if (route.request().method() === 'POST') {
      paidRequests.push(route.request().url());
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push(error.message));
  return { context, page };
}

async function loadExample(page: Page, id: string) {
  await page.goto(`${baseUrl}/?example=${encodeURIComponent(id)}`, { waitUntil: 'networkidle' });
  await page.locator('[data-requirement-id]:visible').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.getByLabel('Requirement category').selectOption('all');
}

async function noPageOverflow(page: Page) {
  const metric = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(metric.document <= metric.viewport + 1, `Document overflows: ${JSON.stringify(metric)}`);
  return metric;
}

async function modalKeyboardCheck(page: Page) {
  const firstCard = page.locator('[data-requirement-id]:visible').first();
  const disclosure = firstCard.locator('summary').first();
  if (await disclosure.count() && await disclosure.locator('..').getAttribute('open') === null) await disclosure.click();
  const sourceButton = firstCard.getByRole('button', { name: /official source|source evidence|source \d/i }).first();
  await sourceButton.focus();
  await sourceButton.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Source evidence' });
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, 'Focus must enter the source dialog.');
  const controls = dialog.locator('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
  const count = await controls.count();
  assert.ok(count >= 1, 'Source dialog needs an operable close control.');
  await controls.last().focus();
  await page.keyboard.press('Tab');
  assert.equal(await controls.first().evaluate(element => element === document.activeElement), true, 'Tab must wrap to the first dialog control.');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await controls.last().evaluate(element => element === document.activeElement), true, 'Shift+Tab must wrap to the last dialog control.');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await sourceButton.evaluate(element => element === document.activeElement), true, 'Escape must return focus to the source trigger.');
  return { focusableControls: count };
}

try {
  const desktop = await createPage(1440, 1000);
  await desktop.page.goto(baseUrl, { waitUntil: 'networkidle' });
  await desktop.page.screenshot({ path: `${artifactDir}/ui-home-desktop.png`, fullPage: true });
  await check('Home: document fits desktop viewport', () => noPageOverflow(desktop.page));
  await check('Home: labeled activity and place fields remain available', async () => {
    assert.ok(await desktop.page.getByRole('textbox', { name: /activity|business|starting/i }).count() >= 1, 'The activity field needs an accessible label.');
    assert.ok(await desktop.page.getByRole('textbox', { name: /place|location|city/i }).count() >= 3, 'All three place fields need accessible labels.');
    assert.ok(await desktop.page.locator('h1').count() === 1);
    const size = await desktop.page.evaluate(() => Number.parseFloat(getComputedStyle(document.body).fontSize));
    assert.ok(size >= 16, `Body type is ${size}px.`);
    return { bodyFontSize: size };
  });

  for (const example of [cafe, company]) {
    await loadExample(desktop.page, example.id);
    const rawResponse = await fetch(`${baseUrl}/api/examples/${encodeURIComponent(example.id)}`);
    const saved = await rawResponse.json() as { report: { places: { name: string; requirements: { id: string; title: string; status: string; sourceIds: string[]; renewal: string; ongoingFiling: string; steps: string[]; cost: { status: string; amountMin: number | null; amountMax: number | null; basis: string }; time: { status: string } }[] }[]; sources: { id: string }[] } };
    const placeNames = saved.report.places.map(place => place.name);
    const expectedCount = saved.report.places.reduce((sum, place) => sum + place.requirements.length, 0);

    await check(`${example.id}: three real places keep comparison columns aligned`, async () => {
      const table = desktop.page.locator('table:visible').first();
      assert.equal(await table.count(), 1, 'Desktop comparison must use table semantics.');
      assert.equal(await table.locator('thead th').count(), placeNames.length + 1);
      const rows = await table.locator('tbody tr').evaluateAll(elements => elements.map(row => row.querySelectorAll(':scope > th, :scope > td').length));
      assert.ok(rows.length >= 6, 'All category rows must be present before filtering.');
      assert.ok(rows.every(count => count === placeNames.length + 1), `Misaligned row columns: ${rows}`);
      for (const name of placeNames) assert.ok(await desktop.page.getByRole('columnheader', { name, exact: false }).count() >= 1, `Missing place header ${name}`);
      assert.equal(await desktop.page.locator('[data-requirement-id]:visible').count(), expectedCount);
      return { places: placeNames, requirements: expectedCount, rows: rows.length };
    });

    await check(`${example.id}: individual expansion preserves steps, renewals, filings and citations`, async () => {
      const card = desktop.page.locator('[data-requirement-id]:visible').first();
      const summary = card.locator('summary').first();
      const details = summary.locator('..');
      assert.equal(await details.getAttribute('open'), null, 'Details should initially be collapsed.');
      const id = await card.getAttribute('data-requirement-id');
      const expected = saved.report.places.flatMap(place => place.requirements).find(requirement => requirement.id === id);
      assert.ok(expected, `Card ${id} must map to the saved requirement.`);
      await summary.click();
      assert.notEqual(await details.getAttribute('open'), null);
      const contents = await card.innerText();
      assert.match(contents, /renewal/i);
      assert.match(contents, /filing/i);
      if (expected.renewal) assert.ok(contents.includes(expected.renewal), 'Complete renewal text must remain available.');
      if (expected.ongoingFiling) assert.ok(contents.includes(expected.ongoingFiling), 'Complete ongoing-filing text must remain available.');
      assert.ok(await card.getByRole('button', { name: /official source|source evidence|source \d/i }).count() >= expected.sourceIds.length, 'Every requirement citation remains operable.');
      return { requirementId: id, citations: expected.sourceIds.length };
    });

    await check(`${example.id}: source dialog supports keyboard entry, focus wrapping and Escape`, () => modalKeyboardCheck(desktop.page));

    await check(`${example.id}: recurring charges and non-applicable approvals retain their meaning`, async () => {
      const requirements = saved.report.places.flatMap(place => place.requirements);
      const annual = requirements.find(requirement => requirement.cost.amountMin === 800 && /annual|yearly|per year/i.test(requirement.cost.basis));
      if (annual) {
        const card = desktop.page.locator(`[data-requirement-id="${annual.id}"]:visible`);
        const summary = card.locator('summary').first();
        if (await summary.locator('..').getAttribute('open') === null) await summary.click();
        const text = await card.innerText();
        assert.ok(text.includes('800'), 'The published annual charge must remain visible.');
        assert.doesNotMatch(text, /initial fee\s*:?\s*\$?800|initial fee/i, 'An annual tax cannot be labeled an initial fee.');
        assert.match(text, /annual|per year|yearly/i);
      }
      const nonApplicable = requirements.find(requirement => requirement.time.status === 'not_applicable');
      assert.ok(nonApplicable, 'The real report contains a duty with no approval process.');
      const card = desktop.page.locator(`[data-requirement-id="${nonApplicable.id}"]:visible`);
      const summary = card.locator('summary').first();
      if (await summary.locator('..').getAttribute('open') === null) await summary.click();
      const definitions = await card.locator('dl > div').evaluateAll(elements => elements.map(element => ({ label: element.querySelector('dt')?.textContent || '', value: element.querySelector('dd')?.textContent || '' })));
      const approval = definitions.find(definition => /approval|processing|time/i.test(definition.label));
      if (approval) {
        assert.match(approval.value, /not applicable|no (?:separate )?(?:approval|processing)/i, 'A non-applicable approval must remain distinct from a missing processing time.');
        assert.doesNotMatch(approval.value, /not published|unknown|missing/i);
      } else {
        assert.match(await card.innerText(), /not applicable|no (?:separate )?(?:approval|processing)/i);
      }
      return { annualRequirement: annual?.id || null, nonApplicableRequirement: nonApplicable.id };
    });

    await check(`${example.id}: unknown applicability cannot display a confident exemption or zero-charge conclusion`, async () => {
      const unknown = saved.report.places.flatMap(place => place.requirements).filter(requirement => requirement.status === 'unknown');
      for (const requirement of unknown) {
        const card = desktop.page.locator(`[data-requirement-id="${requirement.id}"]:visible`);
        const heading = await card.locator('h4').first().innerText();
        assert.doesNotMatch(heading, /\bnot required\b|(?:^|[—–:-]\s*)exempt\b/i, `Unknown requirement ${requirement.id} cannot present a confident exemption in its heading.`);
        if (requirement.cost.status === 'not_applicable') {
          const value = await card.locator('.requirement-summary').innerText();
          assert.match(value, /Fee \/ charge\s+Unknown/i, `Unknown applicability ${requirement.id} cannot imply no charge.`);
        }
      }
      const sample = unknown.find(requirement => /no (?:state |separate |general )?(?:income tax|tax|licen[cs]e)|not required/i.test(requirement.cost.basis));
      if (sample) {
        const card = desktop.page.locator(`[data-requirement-id="${sample.id}"]:visible`);
        const summary = card.locator('summary').first();
        if (await summary.locator('..').getAttribute('open') === null) await summary.click();
        assert.match(await card.innerText(), /unconfirmed reported claim/i, 'A preserved unsupported fee-basis claim must be explicitly qualified.');
      }
      return { unknownRequirementsChecked: unknown.length, unconfirmedClaimSample: sample?.id || null };
    });

    await check(`${example.id}: category and search filters do not shift place columns`, async () => {
      const category = desktop.page.getByLabel('Requirement category');
      const search = desktop.page.getByLabel('Search requirements');
      await category.selectOption('tax_registration');
      const table = desktop.page.locator('table:visible').first();
      const columns = await table.locator('tbody tr').evaluateAll(elements => elements.map(row => row.querySelectorAll(':scope > th, :scope > td').length));
      assert.ok(columns.length >= 1 && columns.every(count => count === placeNames.length + 1));
      const filteredCount = await desktop.page.locator('[data-requirement-id]:visible').count();
      assert.ok(filteredCount < expectedCount, 'A category filter should narrow the displayed requirements.');
      await search.fill('this-query-has-no-match-7d2bc');
      assert.equal(await desktop.page.locator('[data-requirement-id]:visible').count(), 0);
      assert.match(await desktop.page.locator('body').innerText(), /no (?:requirements|items|results|matches)|nothing matches/i, 'No-result state must explain why the table is empty.');
      await desktop.page.getByRole('button', { name: 'Clear filters', exact: true }).click();
      assert.equal(await search.inputValue(), '');
      assert.equal(await desktop.page.locator('[data-requirement-id]:visible').count(), expectedCount);
      assert.equal(await table.locator('thead th').count(), placeNames.length + 1);
      return { filteredCount, restoredCount: expectedCount };
    });

    await check(`${example.id}: source library search and clear restore real evidence`, async () => {
      await desktop.page.getByRole('button', { name: 'Browse source evidence', exact: true }).click();
      const search = desktop.page.getByLabel('Search source evidence');
      await search.fill('no-source-could-have-this-title-93fb');
      assert.match(await desktop.page.locator('.source-browser-results').innerText(), /no (?:sources|source evidence|results|matches)|nothing matches/i);
      await search.fill('');
      const status = desktop.page.getByLabel('Source verification status');
      const options = await status.locator('option').evaluateAll(elements => elements.map(option => ({ value: (option as HTMLOptionElement).value, text: option.textContent })));
      assert.ok(options.some(option => /matched/i.test(String(option.text))), 'Verification filter must distinguish matched excerpts.');
      return { sources: saved.report.sources.length, verificationOptions: options };
    });

    await check(`${example.id}: filtered-screen JSON export preserves the full report`, async () => {
      await desktop.page.getByLabel('Requirement category').selectOption('tax_registration');
      await desktop.page.getByLabel('Search requirements').fill('no-visible-requirement-1ab2c');
      const downloadPromise = desktop.page.waitForEvent('download');
      await desktop.page.getByRole('button', { name: 'Export JSON', exact: true }).click();
      const download = await downloadPromise;
      const file = await download.path();
      assert.ok(file, 'The JSON export should create a downloadable file.');
      const exported = JSON.parse(await readFile(file, 'utf8')) as { places: { requirements: unknown[] }[]; sources: unknown[] };
      assert.equal(exported.places.length, saved.report.places.length);
      assert.equal(exported.places.reduce((sum, place) => sum + place.requirements.length, 0), expectedCount);
      assert.equal(exported.sources.length, saved.report.sources.length);
      return { requirements: expectedCount, places: exported.places.length, sources: exported.sources.length };
    });

    await check(`${example.id}: printing includes every underlying requirement despite active filters`, async () => {
      await desktop.page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      await desktop.page.emulateMedia({ media: 'print' });
      try {
        const dedicated = desktop.page.locator('[data-print-requirement-id]:visible');
        const printed = await dedicated.count() ? dedicated : desktop.page.locator('[data-requirement-id]:visible');
        const printedIds = await printed.evaluateAll(elements => elements.map(element => element.getAttribute('data-print-requirement-id') || element.getAttribute('data-requirement-id')));
        const expectedIds = saved.report.places.flatMap(place => place.requirements.map(requirement => requirement.id));
        assert.equal(printedIds.length, expectedCount);
        assert.deepEqual([...new Set(printedIds)].sort(), [...expectedIds].sort());
        const text = await desktop.page.locator('body').innerText();
        for (const name of placeNames) assert.ok(text.includes(name), `Print must retain place ${name}.`);
        for (const place of saved.report.places) {
          const sample = place.requirements.find(requirement => requirement.renewal || requirement.ongoingFiling || requirement.steps?.length);
          assert.ok(sample, 'Each real place needs details to inspect.');
          if (sample.renewal) assert.ok(text.includes(sample.renewal), `Printed renewal is missing for ${sample.id}.`);
          if (sample.ongoingFiling) assert.ok(text.includes(sample.ongoingFiling), `Printed filing is missing for ${sample.id}.`);
          if (sample.steps?.length) assert.ok(text.includes(sample.steps[0]), `Printed first step is missing for ${sample.id}.`);
        }
        assert.ok(await printed.locator('a[href^="https://"]').count() > 0, 'Printed requirements must retain usable source hyperlinks.');
        await desktop.page.screenshot({ path: `${artifactDir}/ui-${example.id}-print.png`, fullPage: false });
        return { printedRequirements: printedIds.length, printedPlaces: placeNames.length };
      } finally {
        await desktop.page.emulateMedia({ media: 'screen' });
        await desktop.page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
        await desktop.page.getByRole('button', { name: 'Clear filters', exact: true }).click();
      }
    });
    await desktop.page.screenshot({ path: `${artifactDir}/ui-${example.id}-desktop.png`, fullPage: true });
    await check(`${example.id}: document fits desktop viewport`, () => noPageOverflow(desktop.page));
  }
  await desktop.context.close();

  for (const width of [375, 768]) {
    const responsive = await createPage(width, width === 375 ? 812 : 1024, true);
    await responsive.page.goto(baseUrl, { waitUntil: 'networkidle' });
    await check(`Home ${width}px: no horizontal page overflow`, () => noPageOverflow(responsive.page));
    await responsive.page.screenshot({ path: `${artifactDir}/ui-home-${width}.png`, fullPage: true });
    for (const example of [cafe, company]) {
      await loadExample(responsive.page, example.id);
      await check(`${example.id} ${width}px: place selection exposes every place`, async () => {
        const select = responsive.page.getByLabel('View requirements for place');
        await select.waitFor({ state: 'visible' });
        const options = await select.locator('option').evaluateAll(elements => elements.map(option => ({ value: (option as HTMLOptionElement).value, text: option.textContent })));
        assert.equal(options.length, 3);
        for (const option of options) {
          await select.selectOption(option.value);
          assert.ok(await responsive.page.locator('[data-requirement-id]:visible').count() > 0, `Selected place ${option.text} needs visible requirements.`);
          await noPageOverflow(responsive.page);
        }
        return { places: options.map(option => option.text) };
      });
      await check(`${example.id} ${width}px: expansion and citations remain touch accessible`, async () => {
        const summary = responsive.page.locator('[data-requirement-id]:visible summary').first();
        await summary.click();
        const box = await summary.boundingBox();
        assert.ok(box && box.height >= 44, `Expansion touch height is ${box?.height}px.`);
        await modalKeyboardCheck(responsive.page);
        return { summaryHeight: box.height };
      });
      await check(`${example.id} ${width}px: reduced motion and readable controls`, async () => {
        assert.equal(await responsive.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
        const fields = await responsive.page.locator('input, select, textarea').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).map(element => ({ label: element.getAttribute('aria-label') || element.getAttribute('id'), fontSize: Number.parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height })));
        assert.ok(fields.every(field => field.fontSize >= 16), `Small control type: ${JSON.stringify(fields.filter(field => field.fontSize < 16))}`);
        return { fields };
      });
      await responsive.page.screenshot({ path: `${artifactDir}/ui-${example.id}-${width}.png`, fullPage: true });
    }
    await responsive.context.close();
  }
} finally {
  await browser.close();
}

checks.push({ name: 'No paid research request made by UI QA', passed: paidRequests.length === 0, detail: paidRequests });
checks.push({ name: 'No uncaught browser errors', passed: browserErrors.length === 0, detail: browserErrors });
const result = { checkedAt: new Date().toISOString(), baseUrl, demos: [cafe.id, company.id], passed: checks.filter(check => check.passed).length, failed: checks.filter(check => !check.passed).length, checks };
await writeFile(`${artifactDir}/ui-qa.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (result.failed) process.exitCode = 1;
