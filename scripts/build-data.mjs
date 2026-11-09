// Builds the browser-side subset of source data from the reference pack.
// Input:  reference/w4p-claude-code-brief/data/source-records.json (unchanged)
//         content/aliases.json (editable alias decisions)
// Output: src/data/generated/sources.json
// No network access, no database.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(root, 'reference/w4p-claude-code-brief/data/source-records.json');
if (!fs.existsSync(srcPath)) {
  // Public copies of the repository omit the raw (unredacted) reference pack; use the committed generated file.
  console.log('reference pack not present — keeping committed src/data/generated/sources.json');
  process.exit(0);
}
const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const aliases = JSON.parse(fs.readFileSync(path.join(root, 'content/aliases.json'), 'utf8'));

const byId = new Map(src.records.map((r) => [r.id, r]));
const clean = (s) => (typeof s === 'string' ? redactNames(s.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()) : s ?? null);
// Remove blocks of personal names (participant lists) from free-text fields: 3+ consecutive
// lines that look like a person's name (2–6 words, letters only). Counts are kept.
const NAME_LINE = /^\s*[A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜáéíóúñü'.]+(\s+(de|del|la|los|las|[A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜáéíóúñü'.]+)){1,5}\s*$/;
let redactedBlocks = 0, redactedLines = 0;
const redactNames = (s) => {
  if (typeof s !== 'string') return s;
  const lines = s.split('\n'); const out = []; let run = [];
  // a whole field that is only name lines (e.g. one participant) is also removed
  const onlyNames = lines.every((ln) => NAME_LINE.test(ln) && !/[:;,?¿]/.test(ln));
  const afterHeader = () => /^\s*participantes?\s*:?\s*$/i.test(out[out.length - 1] ?? '');
  const flush = () => {
    if (run.length >= 3 || (run.length >= 1 && (onlyNames || afterHeader()))) {
      if (process.env.SHOW_REDACTED) console.error(run.join(' / ')); out.push(`[${run.length} personal names removed]`); redactedBlocks++; redactedLines += run.length; }
    else out.push(...run);
    run = [];
  };
  for (const ln of lines) { if (NAME_LINE.test(ln) && !/[:;,?¿]/.test(ln)) run.push(ln); else { flush(); out.push(ln); } }
  flush();
  return out.join('\n');
};
const names = (rel) => (rel || []).map((x) => x.fields?.name).filter(Boolean);
const ids = (rel, coll) => (rel || []).map((x) => `${coll}:${x.sourceId}`);

// ---- alias map: source record id -> display node id
const aliasOf = new Map();
for (const g of aliases.groups) {
  if (g.decision !== 'consolidate') continue;
  for (const rid of g.recordIds) aliasOf.set(rid, g.displayId);
}
const excluded = new Set(aliases.excludeFromActorGraph.map((x) => x.recordId));

// ---- programme networks
const programmeNetworks = src.records
  .filter((r) => r.collection === 'networks')
  .map((r) => ({
    id: r.id,
    name: r.fields.name,
    agreementDate: r.fields.agreement_signing_date,
    duration: r.fields.real_program_duration ? { start: r.fields.real_program_duration.start, end: r.fields.real_program_duration.end } : null,
    zones: names(r.relations.zones),
    necocli: r.explicitNecocliTag,
    leader: ids(r.relations.leader_entity, 'w4-p-entities'),
    memberEntities: ids(r.relations.w4p_entities, 'w4-p-entities'),
    registeredEcosystemRecords: ids(r.relations.external_entitities, 'external-entitities'),
    initiatives: ids(r.relations.prototypes, 'protots'),
    progressReports: (r.relations.qualitative_term_reports || []).map((q) => ({
      sourceId: q.sourceId,
      name: q.fields.name,
      sections: Object.fromEntries(
        Object.entries(q.fields)
          .filter(([k, v]) => typeof v === 'string' && !['name', 'createdAt', 'updatedAt', 'locale', 'publishedAt', 'migration_id'].includes(k) && v.trim())
          .map(([k, v]) => [k, clean(v)])
      ),
    })),
    budgetNote: 'Source field budget_period_pair holds only an identifier; no amount is available in this snapshot.',
  }));

// ---- initiatives
const initiatives = src.records
  .filter((r) => r.collection === 'protots')
  .map((r) => ({
    id: r.id,
    name: r.fields.name,
    shortName: r.fields.name.replace(/^Prototipo\s+/i, ''),
    date: r.fields.date,
    endDate: r.fields.end_date,
    type: r.fields.prototype_type || [],
    description: clean(r.fields.prototype_description),
    comments: clean(r.fields.additional_comments),
    sdgs: r.fields.sdgs?.values || [],
    topics: names(r.relations.topics),
    programmeNetworks: ids(r.relations.network, 'networks'),
    responsible: ids(r.relations.responsible_w_4_p_entity, 'w4-p-entities'),
    attachments: names(r.relations.attachments),
    necocli: r.explicitNecocliTag,
  }));

// ---- actors (organization-like records), consolidated through explicit aliases only
const actorRecords = src.records.filter((r) => (r.collection === 'external-entitities' || r.collection === 'w4-p-entities') && !excluded.has(r.id));
const actorMap = new Map();
for (const r of actorRecords) {
  const displayId = aliasOf.get(r.id) || r.id;
  const group = aliases.groups.find((g) => g.displayId === displayId && g.decision === 'consolidate');
  if (!actorMap.has(displayId)) {
    actorMap.set(displayId, {
      id: displayId,
      name: group?.displayName || r.fields.name,
      sourceRecords: [],
      programmeNetworks: new Set(),
      topics: new Set(),
      necocli: false,
      kinds: new Set(),
    });
  }
  const a = actorMap.get(displayId);
  a.sourceRecords.push({
    id: r.id,
    collection: r.collection,
    name: r.fields.name,
    entityType: [r.fields.entity_type, r.fields.entity_type_other].filter(Boolean).join(' · ') || null,
    date: r.fields.date || null,
    capacities: clean(r.fields.capacities),
    necessities: clean(r.fields.necessities),
    actions: clean(r.fields.initiatives_and_actions),
    description: clean(r.fields.description),
    comments: clean(r.fields.additional_comments),
    url: r.fields.url || null,
    explicitNecocliTag: r.explicitNecocliTag,
  });
  a.kinds.add(r.collection === 'w4-p-entities' ? 'programme_entity' : 'ecosystem_record');
  if (r.explicitNecocliTag) a.necocli = true;
  for (const n of ids(r.relations.network, 'networks')) a.programmeNetworks.add(n);
  for (const n of ids(r.relations.networks, 'networks')) a.programmeNetworks.add(n);
  for (const t of names(r.relations.topics)) a.topics.add(t);
}
const actors = [...actorMap.values()].map((a) => ({
  ...a,
  programmeNetworks: [...a.programmeNetworks],
  topics: [...a.topics],
  kinds: [...a.kinds],
  entityType: a.sourceRecords.map((s) => s.entityType).find(Boolean) || null,
}));

const disp = (rid) => aliasOf.get(rid) || rid;

// ---- edges (source associations; never causal, never directed)
const edges = [];
for (const e of src.resolvedInterconnections) {
  const [a, b] = [e.source, e.target];
  const ca = byId.get(a).collection, cb = byId.get(b).collection;
  if (ca === 'perceptions' || cb === 'perceptions') continue; // handled in listening
  if (excluded.has(a) || excluded.has(b)) continue;
  edges.push({
    id: e.id,
    source: disp(a),
    target: disp(b),
    kind: ca === 'protots' && cb === 'protots' ? 'initiative_initiative' : 'actor_initiative',
    label: e.fields.text || null,
    sourceRecordIds: [a, b],
    provenance: 'source_record',
  });
}
for (const m of src.programmeMemberships) {
  edges.push({ id: m.id, source: disp(m.source), target: m.target, kind: 'programme_membership', label: 'Listed as member entity of programme network', sourceRecordIds: [m.provenance.recordId], provenance: 'source_record' });
}
for (const i of initiatives) {
  for (const n of i.programmeNetworks) edges.push({ id: `inprog:${i.id}:${n}`, source: i.id, target: n, kind: 'initiative_programme', label: 'Initiative registered under programme network', sourceRecordIds: [i.id], provenance: 'source_record' });
  for (const r of i.responsible) edges.push({ id: `resp:${i.id}:${r}`, source: disp(r), target: i.id, kind: 'responsible_entity', label: 'Responsible programme entity (source field)', sourceRecordIds: [i.id], provenance: 'source_record' });
}
for (const r of src.records.filter((r) => r.collection === 'external-entitities' && !excluded.has(r.id))) {
  for (const n of ids(r.relations.network, 'networks')) edges.push({ id: `reg:${r.id}:${n}`, source: disp(r.id), target: n, kind: 'ecosystem_registration', label: 'Ecosystem record registered by programme network', sourceRecordIds: [r.id], provenance: 'source_record' });
}
// de-duplicate identical edges created by alias consolidation (keep all source ids)
const edgeKey = (e) => `${e.kind}|${[e.source, e.target].sort().join('|')}`;
const dedup = new Map();
for (const e of edges) {
  const k = edgeKey(e);
  if (dedup.has(k)) {
    const d = dedup.get(k);
    d.sourceRecordIds = [...new Set([...d.sourceRecordIds, ...e.sourceRecordIds])];
    d.mergedEdgeIds = [...(d.mergedEdgeIds || [d.id]), e.id];
    if (!d.label && e.label) d.label = e.label;
    else if (e.label && d.label !== e.label) d.altLabels = [...(d.altLabels || []), e.label];
  } else dedup.set(k, { ...e });
}
const allEdges = [...dedup.values()].filter((e) => e.source !== e.target);

// ---- listening items: listening records, perception records, event-like ecosystem record
const perceptionLinks = new Map();
for (const e of src.resolvedInterconnections) {
  const [a, b] = [e.source, e.target];
  if (byId.get(a).collection === 'perceptions') perceptionLinks.set(a, [...(perceptionLinks.get(a) || []), { listening: b, text: e.fields.text }]);
}
const listening = [];
for (const r of src.records) {
  if (r.collection === 'session-listenings') {
    listening.push({
      id: r.id,
      kind: 'listening_record',
      title: r.fields.name,
      date: r.fields.date,
      format: r.fields.format,
      channels: r.fields.listening_channels || [],
      needs: clean(r.fields.necesidades_identificadas),
      comments: clean(r.fields.additional_comments),
      topics: names(r.relations.topics),
      programmeNetworks: ids(r.relations.network, 'networks'),
      participants: r.fields.diversity_table?.total ?? null,
      attachments: names(r.relations.attachments),
      necocli: r.explicitNecocliTag,
    });
  } else if (r.collection === 'perceptions') {
    const images = names(r.relations.images);
    const isProfile = images.some((n) => /perfil etnogr/i.test(n));
    listening.push({
      id: r.id,
      kind: 'perception_record',
      // Individual responses carry personal names in the source; the UI does not display them (data minimisation).
      title: isProfile ? `Ethnographic profile · ${r.fields.name}` : `Individual perception response #${r.sourceId}`,
      profileType: isProfile ? 'constructed_ethnographic_profile' : 'individual_response',
      date: r.fields.date,
      occupation: r.fields.occupation_other || r.fields.occupation,
      age: r.fields.age,
      challenges: clean(r.fields.retos),
      opportunities: clean(r.fields.oportunidades),
      comments: clean(r.fields.additional_comments),
      topics: names(r.relations.topics),
      programmeNetworks: ids(r.relations.network, 'networks'),
      linkedListening: (perceptionLinks.get(r.id) || []).map((x) => x.listening),
      attachments: [...names(r.relations.attachments), ...images],
      necocli: r.explicitNecocliTag,
    });
  } else if (excluded.has(r.id)) {
    listening.push({
      id: r.id,
      kind: 'event_record',
      title: r.fields.name,
      date: r.fields.date,
      comments: clean(r.fields.additional_comments),
      topics: names(r.relations.topics),
      programmeNetworks: ids(r.relations.network, 'networks'),
      attachments: names(r.relations.attachments),
      necocli: r.explicitNecocliTag,
      note: 'Stored among external entities in the source; its content describes an event, so it is listed here and not shown as an organization.',
    });
  }
}

const unresolved = src.unresolvedInterconnections.map((u) => ({ id: u.id, text: u.fields.text, knownEndpoints: u.endpointRecordIds }));

const out = {
  generatedFrom: 'reference/w4p-claude-code-brief/data/source-records.json',
  snapshot: '2026-11-05',
  counts: { records: src.records.length, programmeNetworks: programmeNetworks.length, initiatives: initiatives.length, actorDisplayNodes: actors.length, actorSourceRecords: actorRecords.length, edges: allEdges.length, listening: listening.length, unresolved: unresolved.length },
  programmeNetworks,
  initiatives,
  actors,
  edges: allEdges,
  listening,
  unresolvedInterconnections: unresolved,
};
fs.mkdirSync(path.join(root, 'src/data/generated'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/generated/sources.json'), JSON.stringify(out, null, 1));
console.log('sources.json written', out.counts, `redacted ${redactedLines} name lines in ${redactedBlocks} blocks`);
