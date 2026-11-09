// Builds the browser-side subset for the Busturialdea–Urdaibai territory.
// Input:  reference/urdaibai-claude-code-pack/ (unchanged), content/urdaibai/aliases.json
// Output: src/data/generated/urdaibai-sources.json
// Same shapes as the Necoclí generated file so one adapter serves both territories.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, 'reference/urdaibai-claude-code-pack');
const out = path.join(root, 'src/data/generated/urdaibai-sources.json');
if (!fs.existsSync(path.join(pack, 'data/source-records.json'))) {
  console.log('urdaibai pack not present — keeping committed', path.relative(root, out));
  process.exit(0);
}
const S = JSON.parse(fs.readFileSync(path.join(pack, 'data/source-records.json'), 'utf8'));
const corpus = JSON.parse(fs.readFileSync(path.join(pack, 'sources/ktool-listening-v2-selected-excerpts.json'), 'utf8')).units;
const aliases = JSON.parse(fs.readFileSync(path.join(root, 'content/urdaibai/aliases.json'), 'utf8'));
const sourceAlias = new Map(aliases.listeningSourceAliases.map((a) => [a.alias, a.canonical]));

const clean = (s) => (typeof s === 'string' ? s.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : s ?? null);
const names = (rel) => (rel || []).map((x) => x.fields?.name ?? x.name).filter(Boolean);
const recs = S.records;

// ---- initiatives: canonical K-tool projects (localisation aliases are not separate records) + curated context entries
const initiatives = recs.filter((r) => r.recordType === 'initiative').map((r) => {
  const f = r.fields;
  const isContext = r.collection === 'curated_context';
  return {
    id: r.id,
    name: f.name,
    shortName: f.name,
    date: f.date ?? null,
    dateBasis: isContext ? null : 'record date',
    endDate: null,
    type: [f.impact_level].filter(Boolean),
    description: clean(f.description),
    comments: null,
    sdgs: [],
    topics: names(r.relations?.topics_thematic_areas),
    programmeNetworks: [],
    responsible: [],
    attachments: [],
    necocli: true,
    council: f.council ?? null,
    partners: f.partners ?? [],
    budget: f.associated_budget ?? null,
    sourceUrl: f.sourceUrl ?? null,
    kind: isContext ? f.contextKind ?? 'context' : 'ktool_project',
    localizations: (r.relations?.localizations || []).map((l) => ({ locale: l.fields?.locale, name: l.fields?.name, description: clean(l.fields?.description) })).filter((l) => l.name),
    profiles: names(r.relations?.perceptions),
  };
});

// ---- actors: K-tool agents, curated context organisations and unnamed role groups
const actors = recs.filter((r) => r.recordType === 'ecosystem_record' || r.recordType === 'role_group').map((r) => {
  const f = r.fields;
  const kind = r.recordType === 'role_group' ? 'role_group' : r.collection === 'curated_context' ? 'context_record' : 'ecosystem_record';
  return {
    id: r.id,
    name: f.name,
    sourceRecords: [{
      id: r.id, collection: r.collection, name: f.name, entityType: f.type ?? f.actorType ?? null, date: f.date ?? null,
      capacities: null, necessities: null, actions: null, description: clean(f.description) || null, comments: null, url: null, explicitNecocliTag: true,
    }],
    programmeNetworks: [],
    topics: [],
    necocli: true,
    kinds: [kind],
    entityType: f.type ?? f.actorType ?? (kind === 'role_group' ? 'role_group' : null),
    council: f.council ?? null,
  };
});

// ---- source associations (never causal, never directed)
const edges = [];
for (const e of S.resolvedInterconnections) {
  if (e.relation === 'source_interconnection') {
    edges.push({ id: e.id, source: e.source, target: e.target, kind: 'initiative_initiative', label: e.fields?.type ? `Source interconnection (${e.fields.type})` : 'Source interconnection', sourceRecordIds: e.endpointRecordIds, provenance: 'source_record' });
  } else {
    edges.push({ id: e.id, source: e.source, target: e.target, kind: 'actor_initiative', label: e.relation === 'listed_lead_agent' ? 'Listed as lead agent' : 'Listed as associated agent', sourceRecordIds: e.endpointRecordIds, provenance: 'source_record' });
  }
}
// one visual association per pair and kind; both source labels retained
const dedup = new Map();
for (const e of edges) {
  const k = `${e.kind}|${[e.source, e.target].sort().join('|')}`;
  if (dedup.has(k)) {
    const d = dedup.get(k);
    d.sourceRecordIds = [...new Set([...d.sourceRecordIds, ...e.sourceRecordIds])];
    d.mergedEdgeIds = [...(d.mergedEdgeIds || [d.id]), e.id];
    if (e.label && e.label !== d.label) d.altLabels = [...new Set([...(d.altLabels || []), e.label])];
  } else dedup.set(k, { ...e });
}

// ---- listening layer
const listening = [];
for (const u of corpus) {
  const code = u.sourceId && u.sourceId !== 'Source unresolved' ? u.sourceId : null;
  const canonical = code ? sourceAlias.get(code) ?? code : null;
  listening.push({
    id: u.id,
    kind: 'listening_record',
    title: canonical ? `Listening excerpt · source ${canonical}` : 'Listening excerpt · source unresolved',
    date: null,
    topics: u.themes || [],
    programmeNetworks: [],
    attachments: [],
    necocli: true,
    quote: u.originalText,
    sourceCode: canonical,
    originalSourceCode: code !== canonical ? code : null,
    canonicalId: u.canonicalId,
    localeMetadata: u.localeMetadata,
    variants: (u.sourceVariants || []).filter((v) => v.text && v.text !== u.originalText).map((v) => ({ locale: v.locale_metadata, text: v.text })),
  });
}
for (const r of recs.filter((r) => r.recordType === 'perception_record')) {
  listening.push({
    id: r.id, kind: 'perception_record', profileType: 'narrative_profile', title: `Narrative profile ${r.fields.name}`, date: r.fields.date ?? null,
    topics: [], programmeNetworks: [], attachments: [], necocli: true,
    comments: 'One of the five narrative profiles of the ALC / AC4 listening process, referenced by K-tool project records. The profile text is in the final report (Part II), not in this record.',
  });
}
for (const r of recs.filter((r) => r.recordType === 'listening_source')) {
  listening.push({
    id: r.id, kind: 'interview_reference', title: r.fields.name, date: null, topics: [], programmeNetworks: [], attachments: [], necocli: true,
    comments: r.fields.description, availability: r.fields.availability,
  });
}

const projectProfiles = {};
for (const l of S.recordLinks || []) if (l.relation === 'source_perception_reference') (projectProfiles[l.source] ||= []).push(l.target);

const result = {
  generatedFrom: 'reference/urdaibai-claude-code-pack/data/source-records.json + sources/ktool-listening-v2-selected-excerpts.json',
  counts: { initiatives: initiatives.length, actors: actors.length, edges: dedup.size, listening: listening.length, unresolved: S.unresolvedInterconnections.length, localisationAliases: Object.keys(S.projectLocalizationAliases).length },
  programmeNetworks: [],
  initiatives,
  actors,
  edges: [...dedup.values()].filter((e) => e.source !== e.target),
  listening,
  projectProfiles,
  unresolvedInterconnections: S.unresolvedInterconnections.map((u) => ({ id: u.id, text: u.fields?.type ?? null, knownEndpoints: u.endpointRecordIds })),
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result));
console.log('urdaibai-sources.json written', result.counts);
