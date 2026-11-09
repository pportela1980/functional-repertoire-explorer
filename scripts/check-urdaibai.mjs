// Targeted checks for the Urdaibai territory: references resolve, report quotes are on
// the cited physical PDF page, API quotes occur in the cited excerpt, configurations
// match readings, no weights on influences. Writes src/data/generated/verification-urdaibai.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const j = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const S = j('src/data/generated/urdaibai-sources.json');
const F = j('content/urdaibai/functional-reading.json');
const X = j('content/urdaibai/episodes-extra.json');
const C = j('content/urdaibai/functional-configurations.json');
const M = j('content/urdaibai/systems-map.json');
const T = j('content/urdaibai/territory.json');
const pdfText = path.join(root, 'reference/derived/alc-urdaibai-extracted.txt');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const pages = fs.existsSync(pdfText) ? fs.readFileSync(pdfText, 'utf8').split('\f').map((p) => [norm(p.replace(/-\n/g, '')), norm(p.replace(/-\n/g, '-'))]) : null;
let fail = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fail++; console.error('FAIL', m); } };
const onPage = (q, pg) => pages && pages[pg - 1] && (pages[pg - 1][0].includes(norm(q)) || pages[pg - 1][1].includes(norm(q)));

const listening = new Map(S.listening.map((l) => [l.id, l]));
const actorIds = new Set([...S.actors.map((a) => a.id), ...X.contextActors.map((a) => a.id)]);
const initIds = new Set(S.initiatives.map((i) => i.id));
ok(new Set([...S.actors.map((a) => a.id), ...X.contextActors.map((a) => a.id)]).size === S.actors.length + X.contextActors.length, 'context actor ids collide with source ids');
for (const e of S.edges) ok((actorIds.has(e.source) || initIds.has(e.source)) && initIds.has(e.target), `edge ${e.id} endpoints`);

const episodes = [...F.episodes, ...X.episodes];
ok(new Set(episodes.map((e) => e.id)).size === episodes.length, 'duplicate episode ids');
const fnIds = new Set(F.functions.map((f) => f.id));
const readings = new Map(episodes.map((e) => [e.id, [...e.functionalReadings]]));
for (const a of X.readingAdditions) { ok(readings.has(a.episodeId), `reading addition ${a.episodeId}`); readings.get(a.episodeId)?.push(a.reading); }
let reportQ = 0, reportOk = 0, apiQ = 0, apiOk = 0;
const roleGroupOwner = new Map();
for (const ep of episodes) {
  for (const i of ep.initiativeIds) ok(initIds.has(i), `${ep.id} initiative ${i}`);
  const ev = new Map(ep.evidence.map((v) => [v.id, v]));
  for (const p of ep.participants ?? []) {
    ok(actorIds.has(p.actorRecordId), `${ep.id} participant ${p.actorRecordId}`);
    ok(['reported_participation', 'organiser_context', 'inferred_role_context'].includes(p.status), `${ep.id} status ${p.status}`);
    for (const id of p.evidenceIds) ok(ev.has(id), `${ep.id} participant evidence ${id}`);
    if (/session-|youth-|migrant-|second-iteration|international-experts|consortium-|local-users|mobilised-/.test(p.actorRecordId)) {
      ok(!roleGroupOwner.has(p.actorRecordId) || roleGroupOwner.get(p.actorRecordId) === ep.id, `episode-specific role group ${p.actorRecordId} reused`);
      roleGroupOwner.set(p.actorRecordId, ep.id);
    }
  }
  for (const r of readings.get(ep.id)) { ok(fnIds.has(r.functionId), `${ep.id} fn`); for (const id of r.evidenceIds) ok(ev.has(id), `${ep.id} reading evidence ${id}`); }
  for (const v of ep.evidence) {
    if (v.sourceType === 'report_excerpt' && v.quote) {
      reportQ++;
      if (pages) { const good = onPage(v.quote, v.pdfPage); if (good) reportOk++; ok(good, `${v.id} quote not on PDF p${v.pdfPage}: "${v.quote.slice(0, 60)}"`); }
    }
    if (v.sourceType === 'api_excerpt' && v.quote) {
      apiQ++;
      const rec = listening.get(v.sourceRecordId);
      const good = !!rec && norm(rec.quote).includes(norm(v.quote));
      if (good) apiOk++;
      ok(good, `${v.id} quote not in ${v.sourceRecordId}`);
    }
  }
}
for (const [fid, groups] of Object.entries(C.functions)) {
  ok(fnIds.has(fid), `config fn ${fid}`);
  const listed = groups.flatMap((g) => g.episodes);
  const withReading = episodes.filter((e) => readings.get(e.id).some((r) => r.functionId === fid)).map((e) => e.id);
  ok(listed.length === new Set(listed).size, `${fid}: episode in two groups`);
  for (const id of listed) ok(withReading.includes(id), `${fid}: ${id} grouped without a reading`);
  for (const id of withReading) ok(listed.includes(id), `${fid}: ${id} has a reading but no group`);
}
const vIds = new Set(M.variables.map((v) => v.id));
for (const l of M.influences) { ok(vIds.has(l.source) && vIds.has(l.target), `influence ${l.id}`); ok(l.polarity === 1 || l.polarity === -1, `influence ${l.id} sign`); ok(!('weight' in l), `influence ${l.id} weight`); }
for (const st of T.story) for (const r of st.refs) { if (pages) { reportQ++; const g = onPage(r.quote, r.pdfPage); if (g) reportOk++; ok(g, `story ${st.id} p${r.pdfPage}`); } }
for (const m of T.milestones) if (pages) { reportQ++; const g = onPage(m.ref.quote, m.ref.pdfPage); if (g) reportOk++; ok(g, `milestone ${m.label}`); }
for (const id of T.featuredInitiativeIds) ok(initIds.has(id), `featured ${id}`);

if (pages) fs.writeFileSync(path.join(root, 'src/data/generated/verification-urdaibai.json'), JSON.stringify({ reportQuotes: reportQ, reportVerified: reportOk, apiQuotes: apiQ, apiVerified: apiOk, method: 'Report quotes: whitespace-normalised match on the cited 1-based physical PDF page. Listening quotes: substring of the cited excerpt in the v2 corpus.' }, null, 1));
console.log(`check-urdaibai: ${checks - fail}/${checks} checks passed${pages ? '' : ' (PDF text not present: quote-on-page checks skipped)'}`);
if (fail) process.exit(1);
