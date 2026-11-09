// Browser verification for the Urdaibai territory and territory switching.
// Usage: node scripts/verify-urdaibai.cjs [baseUrl] [outDir]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5287/';
const out = process.argv[3] || '.verify-urdaibai';
const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
const results = []; const log = (ok, msg) => { results.push({ ok, msg }); console.log(ok ? 'PASS' : 'FAIL', msg); };
const settle = (p, ms = 3500) => p.waitForTimeout(ms);
async function gs(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.view-area svg.graph g.node')];
    const ids = nodes.map((n) => n.getAttribute('data-id')); const pos = {}; let nan = 0;
    for (const n of nodes) { const m = (n.getAttribute('transform') || '').match(/translate\(([-\d.eE]+),([-\d.eE]+)\)/); if (!m || !isFinite(+m[1])) nan++; else pos[n.getAttribute('data-id')] = [+m[1], +m[2]]; }
    const bad = [...document.querySelectorAll('.view-area svg.graph path.link')].filter((p) => /NaN|Infinity/.test(p.getAttribute('d') || '')).length;
    return { count: ids.length, dup: ids.length - new Set(ids).size, nan, bad, pos, types: nodes.map((n) => n.getAttribute('class')) };
  });
}
const click = (page, id) => page.locator(`.view-area svg.graph g.node[data-id="${id}"]`).dispatchEvent('click');
const tab = (page, name) => page.locator('nav.tabs button', { hasText: name }).click();

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/tile\.openstreetmap|net::ERR/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });

  // default is Necoclí; switch via header
  await page.goto(base + '#/territory'); await settle(page, 1500);
  log(/Necocl/.test(await page.locator('.view-head h2').innerText()), 'Default territory is Necoclí');
  await page.locator('.territory-switch button', { hasText: 'Urdaibai' }).click(); await settle(page, 1500);
  log(/t=urdaibai/.test(page.url()), `URL carries the territory (${page.url().split('#')[1]})`);
  log(/Urdaibai/.test(await page.locator('.view-head h2').innerText()), 'Territory heading switches to Urdaibai');
  log(await page.locator('.story-steps button').count() === 4, 'Urdaibai: four-step story');
  await page.locator('.story-steps button').nth(1).click();
  log(/proxy/.test(await page.locator('.story-card').innerText()), 'Urdaibai story: challenge step quotes the report');
  log(await page.locator('.territory-marker').count() === 1, 'Urdaibai: one territory-level marker');
  log(await page.locator('.init-list').first().locator('li').count() === 5, 'Urdaibai: five featured entry points');
  await page.fill('.init-search', 'Ankurkulu'); await settle(page, 300);
  log(await page.locator('.init-list').nth(1).locator('li').count() >= 2, 'Urdaibai: all initiative records are searchable');
  log(await page.locator('.tl-ep').count() >= 8, `Timeline shows dated episodes (${await page.locator('.tl-ep').count()})`);
  await page.locator('.tl-controls input[type=range]').fill('35'); await settle(page, 1500);
  const tlN = await page.locator('.tl-graph svg.graph g.node').count();
  log(tlN > 10, `Timeline network shows episodes and participants (${tlN} nodes)`);
  await page.screenshot({ path: `${out}/1-territory.png` });

  // Portfolio → Ortube → agreement → funding → vocational episode
  await tab(page, 'Portfolio'); await settle(page);
  let g = await gs(page);
  log(g.pos['urdaibai:projects:543'] && Object.keys(g.pos).filter((k) => k.includes(':projects:') || k.includes(':context:')).length <= 30 && !g.nan, `Portfolio opens on the featured slice (${g.count} nodes)`);
  await page.locator('.view-area svg.graph g.node[data-id="urdaibai:projects:543"]').dispatchEvent('dblclick'); await settle(page);
  g = await gs(page);
  log(g.pos['urdaibai:episode:ortube-agreement'] && g.pos['urdaibai:episode:ortube-school'] && !g.dup, 'Ortube expands into two distinct episodes around the same initiative');
  await click(page, 'urdaibai:episode:ortube-agreement'); await settle(page, 500);
  let panel = await page.locator('.side-panel').innerText();
  log(/signing date/.test(panel) && /190\.000 euros/.test(panel) && /not a total project cost/.test(panel), 'Ortube agreement: signing date, reported provincial contribution with caveat');
  log(/Signatory/.test(panel) && /Reported participation/i.test(panel), 'Ortube agreement: participant roles and status shown');
  await page.screenshot({ path: `${out}/2-portfolio-ortube.png` });
  await click(page, 'urdaibai:episode:ortube-school'); await settle(page, 500);
  panel = await page.locator('.side-panel').innerText();
  log(/report date/.test(panel) && /students|Vocational/i.test(panel), 'Ortube vocational episode: report-date time basis and distinct participants');
  await page.selectOption('.rule-line select >> nth=1', 'all').catch(() => {});
  await page.locator('.rule-line select').first().selectOption('all').catch(() => {});

  // Repertoire: Mutual support → Ankurkulu; Knowledge → Ibarrangelu → PDF p.66
  await tab(page, 'Functional repertoire');
  await page.locator('.fn-selector button', { hasText: 'Overview' }).click(); await settle(page);
  g = await gs(page);
  log(g.count === 4 && !g.nan, 'Repertoire L0: four functions');
  await page.locator('.fn-selector button', { hasText: 'Mutual support' }).click(); await settle(page, 3000);
  await click(page, 'cfg:u-su-housing'); await settle(page, 3000);
  await click(page, 'urdaibai:episode:ankurkulu-use'); await settle(page, 3000);
  panel = await page.locator('.side-panel').innerText();
  log(/Mutual support/.test(panel) && /not evidence|no individuals|not a claim|care/i.test(panel), 'Ankurkulu: mutual-support reading distinguishes collective tenure from care');
  g = await gs(page);
  log(g.pos['urdaibai:context:ankurkulu-members'] !== undefined, 'Role group (resident members) is visible as its own node');
  await page.screenshot({ path: `${out}/3-repertoire-support.png` });
  await page.locator('.fn-selector button', { hasText: 'Knowledge recombination' }).click(); await settle(page, 3000);
  await click(page, 'cfg:u-kn-profiles'); await settle(page, 3000);
  await click(page, 'urdaibai:episode:ibarrangelu-sensemaking'); await settle(page, 2500);
  panel = await page.locator('.side-panel').innerText();
  const href = await page.locator('.side-panel a[href*="alc-urdaibai"]').first().getAttribute('href').catch(() => null);
  log(/perfil 002/.test(panel) && href && /#page=66/.test(href), `Ibarrangelu: profile revision quote linked to physical PDF page 66 (${href})`);
  if (href) { const r = await page.request.get(new URL(href.split('#')[0], base).toString()); log(r.ok() && (r.headers()['content-type'] || '').includes('pdf'), 'Report PDF is served'); }
  // same actor across episodes: open a second session containing GUS
  await click(page, 'urdaibai:episode:murueta-sensemaking'); await settle(page, 3000);
  g = await gs(page);
  log(g.pos['urdaibai:agents:78'] && g.dup === 0, 'Same organisation (GUS platform) keeps one node across two open episodes');
  await page.screenshot({ path: `${out}/4-repertoire-knowledge.png` });

  // Listening: find the talk excerpt by id, by source code and by text
  await tab(page, 'Listening'); await settle(page, 600);
  log(await page.locator('.pipeline button').count() === 5, 'Urdaibai listening explainer has the same five steps');
  await page.locator('.pipeline button').nth(3).click();
  log(/\d+ \/ \d+/.test(await page.locator('.big-num').innerText()), `Verification step: ${await page.locator('.big-num').innerText()}`);
  await page.locator('.seg button', { hasText: 'Explore' }).click();
  for (const q of ['informations:370', '0072', 'Guggenheim Stop Plataformako hitzaldi']) {
    await page.fill('input[type=search]', q); await settle(page, 400);
    const titles = await page.locator('.cards .card').allInnerTexts();
    log(titles.some((t) => /source 0072/.test(t)) || titles.some((t) => /hitzaldi/.test(t)), `Listening search "${q}" finds the talk excerpt (${titles.length} results)`);
  }
  await page.fill('input[type=search]', 'informations:370'); await settle(page, 400);
  await page.locator('.cards .card', { hasText: 'source 0072' }).first().click(); await settle(page, 300);
  panel = await page.locator('.side-panel').innerText();
  log(/Hemen egon zen Guggenheim Stop Plataformako hitzaldi bat/.test(panel) && /does not establish the language/.test(panel), 'Exact original excerpt opens with locale caveat');
  await page.fill('input[type=search]', 'nos enteramos por la plataforma'); await settle(page, 400);
  await page.locator('.cards .card', { hasText: 'source 0264' }).first().click(); await settle(page, 300);
  panel = await page.locator('.side-panel').innerText();
  log(/nos enteramos por la plataforma/.test(panel) && /No initiative or attendance association is inferred/.test(panel), 'Source 0264 shown as separate context, no attendance implied');
  await page.fill('input[type=search]', '0145'); await settle(page, 400);
  log((await page.locator('.cards .card').allInnerTexts()).every((t) => /source 0088/.test(t)), 'Source 0145 excerpts are shown under source 0088');
  await page.screenshot({ path: `${out}/5-listening.png` });
  await page.fill('input[type=search]', '');

  // Relational hypergraph + centrality
  await tab(page, 'Relational network'); await settle(page);
  g = await gs(page);
  const actorsShown = g.types.filter((c) => /type-actor/.test(c)).length;
  log(!g.nan && !g.dup && actorsShown === 0 && g.count > 5, `Hypergraph starts collapsed on the featured slice (${g.count} contexts)`);
  await click(page, 'urdaibai:episode:ortube-agreement'); await settle(page, 2500);
  g = await gs(page);
  log(g.pos['urdaibai:agents:59'] && g.pos['urdaibai:context:itsasmuseum'], 'Opening an episode context shows its participants');
  await page.locator('.rule-line button', { hasText: 'Centrality' }).click(); await settle(page, 1500);
  const r1 = await page.locator('.rank li').allInnerTexts();
  await page.selectOption('.analysis select', 'betweenness'); await settle(page, 1500);
  const r2 = await page.locator('.rank li').allInnerTexts();
  log(r1.length > 3 && r2.length > 3 && !r2.some((t) => /NaN/.test(t)), `Centrality ranks (${r1[0]?.replace(/\n/g, ' ')} | ${r2[0]?.replace(/\n/g, ' ')})`);
  await page.locator('.rule-line select').first().selectOption('all'); await settle(page, 6000);
  g = await gs(page);
  log(!g.nan && !g.bad && g.count >= 200, `Expand to all records: ${g.count} contexts, no NaN`);
  await page.screenshot({ path: `${out}/6-relational.png` });

  // System dynamics
  await tab(page, 'System dynamics'); await settle(page);
  g = await gs(page);
  const l0 = await page.locator('.view-area svg.graph path.link').count();
  await page.locator('.rule-line label', { hasText: 'hypotheses' }).locator('input').check(); await settle(page, 2500);
  const l1 = await page.locator('.view-area svg.graph path.link').count();
  log(g.count === 12 && l0 === 8 && l1 === 16, `System map: 12 variables, ${l0} default links, ${l1} with hypotheses`);
  log(/Everyday economy \(reinforcing\): shown/.test(await page.locator('.rule-line').innerText()), 'Loops shown only when all their links are visible');
  await page.screenshot({ path: `${out}/7-system.png` });

  // switch with a selected episode, then back
  await tab(page, 'Functional repertoire'); await settle(page, 2000);
  await page.goto(base + '#/repertoire?t=urdaibai&sel=episode~urdaibai:episode:ankurkulu-use'); await page.reload(); await settle(page, 2500);
  log(/Ankurkulu/.test(await page.locator('.side-panel').innerText()), 'Deep link with territory and episode reloads correctly');
  await page.locator('.territory-switch button', { hasText: 'Necoclí' }).click(); await settle(page, 2500);
  const url = page.url();
  log(!/t=urdaibai/.test(url) && !/sel=/.test(url) && /Nothing selected/.test(await page.locator('.side-panel').innerText()), 'Switching territory clears the selection and the territory parameter');
  log(/Functional repertoire/.test(await page.locator('nav.tabs button.active').innerText()), 'Active tab is preserved across switching');
  g = await gs(page);
  log(!g.nan && Object.keys(g.pos).every((k) => !k.startsWith('urdaibai:')), 'No Urdaibai node leaks into Necoclí');
  await page.locator('.territory-switch button', { hasText: 'Urdaibai' }).click(); await settle(page, 2500);
  g = await gs(page);
  log(!g.nan && Object.keys(g.pos).every((k) => k.startsWith('urdaibai:') || k.startsWith('fn:') || k.startsWith('cfg:')), 'Back to Urdaibai: only Urdaibai nodes');

  // narrow + reduced motion
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  for (const t of ['territory', 'relational', 'repertoire', 'listening']) {
    await mp.goto(base + `?${t}#/${t}?t=urdaibai`); await mp.waitForTimeout(2500);
    const ov = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    log(ov <= 1, `Narrow ${t}: horizontal overflow ${ov}px`);
    await mp.screenshot({ path: `${out}/8-mobile-${t}.png` });
  }
  log(errors.length === 0, `Console errors: ${errors.length}${errors.length ? ' — ' + errors.slice(0, 4).join(' || ') : ''}`);
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} Urdaibai checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
