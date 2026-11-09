// Targeted data checks: references resolve, quotes appear on the cited PDF page,
// no duplicate ids, interpretations never reference unknown functions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const j = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const S = j('src/data/generated/sources.json');
const F = j('content/functional-reading.json');
const X = j('content/episodes-extra.json');
const C = j('content/functional-configurations.json');
const M = j('content/system-map.json');
const T = j('content/territory.json');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
if (!fs.existsSync(path.join(root, 'reference/w4p-claude-code-brief/sources/codespa-extracted.txt'))) {
  console.log('check-data: reference pack not present — skipping (run in the full working copy)');
  process.exit(0);
}
const pages = {
  codespa: fs.readFileSync(path.join(root, 'reference/w4p-claude-code-brief/sources/codespa-extracted.txt'), 'utf8').split('\f').map(norm),
  uniban: fs.readFileSync(path.join(root, 'reference/w4p-claude-code-brief/sources/uniban-extracted.txt'), 'utf8').split('\f').map(norm),
};
let fail = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fail++; console.error('FAIL', msg); } };
const quoteOk = (r, ctx) => ok(pages[r.documentId]?.[r.pdfPage - 1]?.includes(norm(r.quote)), `${ctx}: quote not on ${r.documentId} p${r.pdfPage}: "${r.quote.slice(0, 60)}"`);

const nodeIds = new Set([...S.actors.map((a) => a.id), ...S.initiatives.map((i) => i.id), ...S.programmeNetworks.map((n) => n.id)]);
const all = [...S.actors.map((a) => a.id), ...S.initiatives.map((i) => i.id), ...S.programmeNetworks.map((n) => n.id)];
ok(all.length === nodeIds.size, 'duplicate node ids');
ok(S.initiatives.length === 11, 'eleven initiatives');
for (const e of S.edges) ok(nodeIds.has(e.source) && nodeIds.has(e.target), `edge ${e.id} endpoints`);
ok(new Set(S.edges.map((e) => e.id)).size === S.edges.length, 'duplicate edge ids');
ok(S.edges.every((e) => e.provenance === 'source_record'), 'source edges marked as source records');

// alias map: the actor id an episode uses may be a raw record id that was consolidated
const aliasOfRecord = new Map();
for (const a of S.actors) for (const r of a.sourceRecords) aliasOfRecord.set(r.id, a.id);
const fnIds = new Set(F.functions.map((f) => f.id));
const episodes = [...F.episodes, ...X.episodes];
ok(new Set(episodes.map((e) => e.id)).size === episodes.length, 'duplicate episode ids');
for (const ep of episodes) {
  for (const i of ep.initiativeIds) ok(nodeIds.has(i), `${ep.id} initiative ${i}`);
  for (const a of ep.actorRecordIds) ok(nodeIds.has(a) || aliasOfRecord.has(a), `${ep.id} actor ${a}`);
  const ev = new Set(ep.evidence.map((e) => e.id));
  for (const r of ep.functionalReadings) {
    ok(fnIds.has(r.functionId), `${ep.id} function ${r.functionId}`);
    for (const e of r.evidenceIds) ok(ev.has(e), `${ep.id} evidence ${e}`);
  }
  for (const e of ep.evidence) quoteOk(e, ep.id);
}
for (const [fid, groups] of Object.entries(C.functions)) {
  ok(fnIds.has(fid), `configurations function ${fid}`);
  const listed = groups.flatMap((g) => g.episodes);
  const withReading = episodes.filter((e) => e.functionalReadings.some((r) => r.functionId === fid)).map((e) => e.id);
  ok(listed.length === new Set(listed).size, `${fid}: episode in two groups`);
  for (const id of listed) ok(withReading.includes(id), `${fid}: ${id} grouped without a reading`);
  for (const id of withReading) ok(listed.includes(id), `${fid}: ${id} has a reading but no group`);
}
const vIds = new Set(M.variables.map((v) => v.id));
ok(M.variables.length >= 12 && M.variables.length <= 18, 'system map has 12–18 variables');
for (const v of M.variables) for (const r of v.refs) quoteOk(r, v.id);
for (const l of M.links) {
  ok(vIds.has(l.from) && vIds.has(l.to), `link ${l.id} endpoints`);
  ok(l.polarity === '+' || l.polarity === '-', `link ${l.id} polarity`);
  ok(!('weight' in l), `link ${l.id} has no weight`);
  for (const r of l.refs) quoteOk(r, l.id);
}
for (const r of T.reportContext) quoteOk(r, 'territory');
for (const st of T.story ?? []) for (const r of st.refs) quoteOk(r, `story:${st.id}`);
// Summary used by the Listening view (step "Verification").
{
  const all = [];
  for (const ep of episodes) all.push(...ep.evidence);
  for (const v of M.variables) all.push(...v.refs);
  for (const l of M.links) all.push(...l.refs);
  all.push(...T.reportContext);
  for (const st of T.story ?? []) all.push(...st.refs);
  const uniq = new Map(all.map((r) => [`${r.documentId}|${r.pdfPage}|${r.quote}`, r]));
  const verified = [...uniq.values()].filter((r) => pages[r.documentId]?.[r.pdfPage - 1]?.includes(norm(r.quote))).length;
  fs.writeFileSync(path.join(root, 'src/data/generated/verification.json'), JSON.stringify({ excerpts: uniq.size, verified, method: 'Whitespace-normalised substring match against the text extracted from the cited 1-based PDF page.' }, null, 1));
}
console.log(`check-data: ${checks - fail}/${checks} checks passed`);
if (fail) process.exit(1);
