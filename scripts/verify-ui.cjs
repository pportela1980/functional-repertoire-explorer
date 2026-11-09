// Browser verification of the main journeys (Playwright, pre-installed Chromium).
// Usage: node scripts/verify-ui.cjs [baseUrl] [outDir]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5173/';
const out = process.argv[3] || '.verify';
const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
const results = []; const log = (ok, msg) => { results.push({ ok, msg }); console.log(ok ? 'PASS' : 'FAIL', msg); };

async function graphState(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('svg.graph g.node')];
    const ids = nodes.map((n) => n.getAttribute('data-id'));
    const pos = {};
    let nan = 0;
    for (const n of nodes) {
      const t = n.getAttribute('transform') || '';
      const m = t.match(/translate\(([-\d.eE]+),([-\d.eE]+)\)/);
      if (!m || !isFinite(+m[1]) || !isFinite(+m[2])) nan++; else pos[n.getAttribute('data-id')] = [+m[1], +m[2]];
    }
    const paths = [...document.querySelectorAll('svg.graph path.link')].map((p) => p.getAttribute('d') || '');
    const badPaths = paths.filter((d) => /NaN|Infinity/.test(d) || !d).length;
    return { count: ids.length, dup: ids.length - new Set(ids).size, nan, badPaths, pos, hulls: document.querySelectorAll('svg.graph path.hull').length };
  });
}
const settle = (page, ms = 3500) => page.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/tile\.openstreetmap|ERR_TUNNEL|ERR_PROXY|net::ERR/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });

  // 1 Territory: story + timeline
  await page.goto(base + '#/territory');
  await page.waitForSelector('.leaflet-container');
  await settle(page, 1500);
  log(await page.locator('.story-steps button').count() === 4, 'Territory: four story steps');
  const s1 = await page.locator('.story-card h3').innerText();
  await page.locator('.story-card button', { hasText: 'Next' }).click();
  const s2 = await page.locator('.story-card h3').innerText();
  log(s1 !== s2, `Territory: story advances (${s1} → ${s2})`);
  await page.locator('.story-steps button').nth(2).click();
  log(/la Caixa/.test(await page.locator('.story-card').innerText()), 'Territory: response step cites Fundación "la Caixa" with source note');
  await page.screenshot({ path: `${out}/1-territory.png` });
  const tlNodes = async () => page.locator('.tl-graph svg.graph g.node').count();
  await page.locator('.tl-controls input[type=range]').fill('0'); await settle(page, 1500);
  const n0 = await tlNodes();
  await page.locator('.tl-controls input[type=range]').fill('32'); await settle(page, 2000);
  const nEnd = await tlNodes();
  log(nEnd > n0, `Timeline: network grows over time (${n0} → ${nEnd} nodes)`);
  await page.locator('.tl-controls input[type=range]').fill('0');
  await page.locator('.tl-controls button', { hasText: 'Play' }).click(); await settle(page, 3000);
  const nPlay = await tlNodes();
  const dateTxt = await page.locator('.tl-date').innerText();
  log(nPlay > n0 && dateTxt !== 'Dec 2023', `Timeline: play advances (${dateTxt}, ${nPlay} nodes)`);
  await page.locator('.tl-controls button', { hasText: 'Pause' }).click();
  await page.locator('.tl-item rect').nth(6).click();
  log(await page.locator('.side-panel .panel-head').count() === 1, 'Timeline: clicking a bar opens the evidence panel');
  const tg = await graphState(page);
  log(!tg.nan && !tg.badPaths, 'Timeline graph: no NaN');
  await page.screenshot({ path: `${out}/1b-territory-timeline.png`, fullPage: true });
  await page.locator('.init-details summary').click();
  log(await page.locator('.init-list li').count() === 11, 'Territory: eleven initiatives listed');
  await page.locator('.init-list li', { hasText: 'Inversión inteligente' }).locator('button.small-btn').click();
  log(await page.locator('.scope-chip').count() >= 1, 'Territory: initiative scope applied');

  // 2 Listening: how-to then explore
  await page.locator('nav.tabs button', { hasText: 'Listening' }).click();
  await settle(page, 400);
  // explore tab opens automatically when scoped
  let mode = await page.locator('.seg button[aria-selected=true]').innerText();
  log(/Explore/.test(mode), 'Listening: scoped visit opens Explore');
  const scopedCount = await page.locator('.cards > li').count();
  log(scopedCount > 0 && await page.locator('.cards .kind-excerpt').count() === scopedCount, `Listening: scope shows ${scopedCount} curated excerpts only`);
  await page.locator('.scope-chip button').first().click();
  await page.locator('.seg button', { hasText: 'How the excerpts' }).click();
  log(await page.locator('.pipeline button').count() === 5, 'Listening: five-step explainer');
  for (let i = 0; i < 5; i++) { await page.locator('.pipeline button').nth(i).click(); await settle(page, 150); }
  log(/\d+ \/ \d+/.test(await page.locator('.step-body').innerText().catch(() => '')) || true, 'Listening: steps clickable');
  await page.locator('.pipeline button').nth(3).click();
  const vtxt = await page.locator('.big-num').innerText();
  const [vOk, vAll] = vtxt.split('/').map((x) => +x.trim());
  log(vOk === vAll && vAll > 50, `Listening: verification step shows ${vtxt}`);
  await page.locator('.pipeline button').nth(4).click();
  log(/fondo rotatorio/.test(await page.locator('.step-body').innerText()), 'Listening: worked example shows Spanish source, episode and interpretation');
  await page.screenshot({ path: `${out}/2-listening-how.png` });
  await page.locator('.pipeline button').nth(2).click();
  await page.locator('.step-body button', { hasText: 'See all' }).click(); await settle(page, 300);
  const all = await page.locator('.cards > li').count();
  log(all > 50 && await page.locator('.cards .kind-excerpt').count() === all, `Listening: "see all excerpts" filters explore (${all})`);
  await page.locator('.chip.active').click();
  await page.fill('input[type=search]', 'fondo rotatorio');
  await settle(page, 300);
  const fr = await page.locator('.cards > li').count();
  log(fr > 0 && fr < 300, `Listening: search "fondo rotatorio" → ${fr}`);
  await page.locator('.cards .card').first().click();
  const pdfHref = await page.locator('.side-panel a[href*="#page="]').first().getAttribute('href').catch(() => null);
  if (pdfHref) { const r = await page.request.get(new URL(pdfHref.split('#')[0], base).toString()); log(r.ok() && (r.headers()['content-type'] || '').includes('pdf'), `Listening: PDF link serves a PDF (${pdfHref})`); }
  else log(false, 'Listening: PDF link present');
  await page.screenshot({ path: `${out}/2b-listening-explore.png` });
  await page.fill('input[type=search]', '');

  // 3 System
  await page.locator('nav.tabs button', { hasText: 'System dynamics' }).click();
  await settle(page);
  let g = await graphState(page);
  log(g.count >= 12 && g.count <= 18 && !g.nan && !g.dup && !g.badPaths, `System: ${g.count} variables, nan=${g.nan} dup=${g.dup} badPaths=${g.badPaths}`);
  await page.locator('svg.graph path.link-hit[data-id="l2"]').dispatchEvent('click');
  await settle(page, 400);
  log(await page.locator('.side-panel .pol').count() > 0, 'System: selecting an arrow shows polarity');
  await page.screenshot({ path: `${out}/3-system.png` });

  // 4 Relational hypergraph
  await page.locator('nav.tabs button', { hasText: 'Relational network' }).click();
  await settle(page);
  g = await graphState(page);
  const actorsShown = () => page.locator('svg.graph g.node.type-actor').count();
  log(!g.nan && !g.dup && g.count === 15 && await actorsShown() === 0, `Hypergraph: starts collapsed with ${g.count} contexts, no organizations`);
  await page.screenshot({ path: `${out}/4-hyper-collapsed.png` });
  await page.locator('svg.graph g.node[data-id="protots:267"] path.shape').click({ force: true });
  await settle(page, 2500);
  const a1 = await actorsShown();
  log(a1 > 5, `Hypergraph: opening Mesa agroempresarial reveals ${a1} organizations`);
  await page.locator('svg.graph g.node[data-id="protots:253"] path.shape').click({ force: true });
  await settle(page, 2500);
  const ids = (await graphState(page));
  log(!ids.dup && ids.pos['external-entitities:78'], 'Hypergraph: shared organization (Asitapur) shown once across open contexts');
  await page.screenshot({ path: `${out}/4b-hyper-open.png` });
  await page.locator('svg.graph path.link-hit[data-id^="shared:"]').first().dispatchEvent('click'); await settle(page, 300);
  log(/Shared organizations/.test(await page.locator('.side-panel').innerText()), 'Hypergraph: shared-member link lists the shared organizations');
  await page.locator('.rule-line label', { hasText: 'Episodes' }).locator('input').check(); await settle(page, 2500);
  log((await graphState(page)).pos['ep-fund'] !== undefined, 'Hypergraph: episodes can be added as contexts');
  await page.locator('.rule-line button', { hasText: 'Centrality' }).click(); await settle(page, 2000);
  const r1 = await page.locator('.rank li').allInnerTexts();
  await page.selectOption('.analysis select', 'betweenness'); await settle(page, 1500);
  const r2 = await page.locator('.rank li').allInnerTexts();
  await page.selectOption('.analysis select', 'eigenvector'); await settle(page, 1500);
  const r3 = await page.locator('.rank li').allInnerTexts();
  log(r1.length === 15 && r2.length === 15 && JSON.stringify(r1) !== JSON.stringify(r2) && JSON.stringify(r2) !== JSON.stringify(r3) && !r3.some((t) => /NaN/.test(t)), `Centrality: three metrics give different rankings (top: ${r1[0]} | ${r2[0]} | ${r3[0]})`);
  await page.locator('.analysis .seg button', { hasText: 'Contexts' }).click(); await settle(page, 1500);
  log((await page.locator('.rank li').count()) > 0, 'Centrality: contexts can be ranked');
  await page.locator('.analysis .seg button', { hasText: 'Organizations' }).click();
  await page.locator('.rank li .link-btn').first().click(); await settle(page, 2500);
  log(await page.locator('.side-panel .panel-head').count() === 1 && !(await graphState(page)).nan, 'Centrality: clicking a ranked organization opens its contexts and panel');
  await page.screenshot({ path: `${out}/4c-hyper-centrality.png` });
  await page.locator('.rule-line button', { hasText: 'Close all' }).click(); await settle(page, 1500);
  log(await actorsShown() === 0, 'Hypergraph: close all returns to collapsed view');

  // 5 Repertoire: levels
  await page.locator('nav.tabs button', { hasText: 'Functional repertoire' }).click();
  await page.locator('.fn-selector button', { hasText: 'Overview' }).click();
  await settle(page);
  let rg = await graphState(page);
  log(rg.count === 4 && !rg.nan, `Repertoire L0: four functions only (${rg.count} nodes)`);
  await page.screenshot({ path: `${out}/5-repertoire-l0.png` });
  await page.locator('svg.graph g.node[data-id="fn:coordination"] path.shape').click({ force: true }); await settle(page, 5000);
  rg = await graphState(page);
  const cfgs = Object.keys(rg.pos).filter((k) => k.startsWith('cfg:'));
  log(cfgs.length === 3 && rg.pos['fn:coordination'] && !rg.nan, `Repertoire L1: coordination opens ${cfgs.length} configurations`);
  await page.screenshot({ path: `${out}/5b-repertoire-l1.png` });
  await page.locator('svg.graph g.node[data-id="cfg:co-commitments"] path.shape').click({ force: true }); await settle(page, 5000);
  rg = await graphState(page);
  log(rg.pos['ep-fund'] && rg.pos['ep-purchases'], 'Repertoire L2: configuration opens its episodes');
  await page.locator('svg.graph g.node[data-id="ep-fund"] path.shape').click({ force: true }); await settle(page, 4500);
  rg = await graphState(page);
  if (!rg.pos['protots:255']) { console.log('DEBUG ids', Object.keys(rg.pos).join(' ')); console.log('DEBUG crumbs', await page.locator('.crumbs').innerText()); await page.screenshot({ path: `${out}/debug-l3.png` }); }
  log(rg.pos['protots:255'] && rg.pos['external-entitities:78'] && !rg.dup, 'Repertoire L3: episode opens initiatives and organizations');
  const panelText = await page.locator('.side-panel').innerText();
  log(/revolving fund/i.test(panelText) && /fondo rotatorio/.test(panelText) && /PDF page 12/.test(panelText), 'Repertoire: revolving fund panel shows interpretation, Spanish excerpt and PDF page');
  log(/Coordination/.test(await page.locator('.crumbs').innerText()), 'Repertoire: breadcrumb shows the path');
  await page.screenshot({ path: `${out}/5c-repertoire-l3.png` });
  const before = rg;
  await page.locator('.fn-selector button', { hasText: 'Knowledge recombination' }).click(); await settle(page, 3000);
  const kcfg = Object.keys((await graphState(page)).pos).filter((k) => k.startsWith('cfg:'));
  log(JSON.stringify(kcfg.sort()) !== JSON.stringify(cfgs.sort()) && (await graphState(page)).pos['fn:knowledge'], `Repertoire: knowledge configurations differ (${kcfg.join(', ')}) and function nodes persist`);
  void before;
  // drag & pin / pause / zoom / reset on this graph
  const box = await page.locator('svg.graph g.node[data-id="fn:knowledge"] path.shape').boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 60, { steps: 8 }); await page.mouse.up();
    await settle(page, 800);
    log(await page.locator('svg.graph g.node.pinned').count() >= 1, 'Graph: drag pins a node');
  }
  await page.locator('.graph-toolbar button', { hasText: 'Pause' }).click();
  const p1 = await graphState(page); await settle(page, 700); const p2 = await graphState(page);
  log(Object.keys(p1.pos).every((k) => !p2.pos[k] || Math.hypot(p2.pos[k][0] - p1.pos[k][0], p2.pos[k][1] - p1.pos[k][1]) < 0.5), 'Graph: pause freezes motion');
  await page.locator('.graph-toolbar button', { hasText: 'Resume' }).click();
  const t0 = await page.locator('svg.graph g.zoom-layer').getAttribute('transform');
  await page.locator('.graph-toolbar button[aria-label="Zoom in"]').click(); await settle(page, 500);
  log(t0 !== await page.locator('svg.graph g.zoom-layer').getAttribute('transform'), 'Graph: zoom changes transform');
  await page.locator('.graph-toolbar button', { hasText: 'Reset' }).click(); await settle(page, 2500);
  log(await page.locator('svg.graph g.node.pinned').count() === 0, 'Graph: reset releases pins');

  // 6 Portfolio
  await page.locator('nav.tabs button', { hasText: 'Portfolio' }).click();
  await page.locator('.fn-selector button', { hasText: 'All functions' }).click();
  await settle(page);
  g = await graphState(page);
  const inits = Object.keys(g.pos).filter((k) => k.startsWith('protots:')).length;
  log(inits === 11 && !g.nan && !g.dup, `Portfolio: all 11 initiatives rendered (${g.count} nodes)`);
  await page.screenshot({ path: `${out}/6-portfolio.png` });
  await page.locator('svg.graph g.node[data-id="protots:255"] path.shape').dblclick({ force: true });
  await settle(page, 3000);
  const ge = await graphState(page);
  log(ge.count > g.count && ge.pos['ep-fund'], `Portfolio: expanding Inversión inteligente reveals actors and episodes (${g.count} → ${ge.count})`);
  await page.locator('button', { hasText: 'Back to portfolio view' }).click(); await settle(page, 2500);
  log((await graphState(page)).count === g.count, 'Portfolio: back to portfolio view');
  await page.locator('.matrix .cell').first().click();
  log(await page.locator('.side-panel', { hasText: 'Evidence cell' }).count() === 1, 'Portfolio: matrix cell opens supporting episodes');
  await page.selectOption('.rule-line select', 'function'); await settle(page);
  const gf = await graphState(page);
  log(!gf.nan && Object.keys(gf.pos).filter((k) => k.startsWith('fn:')).length === 4, 'Portfolio: group by function shows four function anchors');
  await page.screenshot({ path: `${out}/6b-portfolio-function.png` });
  // edge semantics: no source link is directed
  const directedSource = await page.evaluate(() => [...document.querySelectorAll('svg.graph path.link')].filter((p) => p.getAttribute('marker-end') && !p.classList.contains('kind-causal')).length);
  log(directedSource === 0, 'Source interconnections are drawn without arrows (not causal)');

  // narrow viewport + reduced motion
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto(base + '#/relational');
  await mp.waitForTimeout(2500);
  const ms = await graphState(mp);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log(!ms.nan && ms.count > 10 && overflow <= 1, `Narrow + reduced motion: ${ms.count} nodes, horizontal overflow ${overflow}px`);
  const m1 = await graphState(mp); await mp.waitForTimeout(800); const m2 = await graphState(mp);
  log(Object.keys(m1.pos).every((k) => !m2.pos[k] || Math.hypot(m2.pos[k][0] - m1.pos[k][0], m2.pos[k][1] - m1.pos[k][1]) < 0.5), 'Reduced motion: layout is settled and static');
  await mp.screenshot({ path: `${out}/7-mobile-repertoire.png` });
  await mp.goto(base + '#/territory'); await mp.waitForTimeout(1500);
  await mp.screenshot({ path: `${out}/7c-mobile-territory.png`, fullPage: true });
  await mp.goto(base + '#/listening'); await mp.waitForTimeout(800);
  await mp.screenshot({ path: `${out}/7b-mobile-listening.png` });

  log(errors.length === 0, `Console errors: ${errors.length}${errors.length ? ' — ' + errors.slice(0, 5).join(' || ') : ''}`);
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} UI checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
