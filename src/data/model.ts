// Small typed adapter over local JSON, one dataset per territory. Source data
// (generated) and analyst content (content/**.json) stay in separate files and
// are only joined here. Exports are live bindings: setTerritory() swaps them, and
// the app remounts its views when the territory changes.
import necSources from './generated/sources.json';
import necReading from '../../content/functional-reading.json';
import necExtra from '../../content/episodes-extra.json';
import necConfig from '../../content/functional-configurations.json';
import necSystem from '../../content/system-map.json';
import necTerritory from '../../content/territory.json';
import necAliases from '../../content/aliases.json';
import necVerification from './generated/verification.json';
import urdSources from './generated/urdaibai-sources.json';
import urdReading from '../../content/urdaibai/functional-reading.json';
import urdExtra from '../../content/urdaibai/episodes-extra.json';
import urdConfig from '../../content/urdaibai/functional-configurations.json';
import urdSystem from '../../content/urdaibai/systems-map.json';
import urdTerritory from '../../content/urdaibai/territory.json';
import urdAliases from '../../content/urdaibai/aliases.json';
import urdVerification from './generated/verification-urdaibai.json';

export type TerritoryId = 'necocli' | 'urdaibai';
export const TERRITORIES: { id: TerritoryId; label: string; country: string }[] = [
  { id: 'necocli', label: 'Necoclí', country: 'Colombia' },
  { id: 'urdaibai', label: 'Busturialdea–Urdaibai', country: 'Spain' },
];

export type FunctionId = 'mobilisation' | 'knowledge' | 'coordination' | 'support';
export type Provenance = 'source_record' | 'reported_episode' | 'functional_interpretation' | 'analyst_synthesis';

export interface DocRef { documentId: string; pdfPage?: number; quote?: string | null }
export interface Evidence {
  id: string; documentId: string; sourceType: string; quote?: string | null; language?: string; englishSummary?: string;
  pdfPage?: number; printedPage?: number; sourceRecordId?: string; locator?: string; evidenceRole?: string;
}
export interface Reading { functionId: FunctionId; interpretation: string; status: string; evidenceIds: string[]; strength?: string; addedInThisBuild?: boolean }
export interface Participant { actorRecordId: string; role: string; status: 'reported_participation' | 'organiser_context' | 'inferred_role_context'; evidenceIds: string[] }
export interface Episode {
  id: string; title: string; initiativeIds: string[]; actorRecordIds: string[]; demand: string;
  reportedResponse: string; reportedContinuity: string; functionalReadings: Reading[]; evidence: Evidence[];
  reportingPeriod?: string; curationStatus?: string; actorLinkMeaning?: string; addedInThisBuild?: boolean;
  participants?: Participant[]; time?: { date: string | null; precision: string; basis?: string; label?: string }; place?: string;
  episodeKind?: string; evidenceLevel?: string; series?: string; notes?: string;
}
export interface Initiative {
  id: string; name: string; shortName: string; date: string | null; endDate: string | null; type: string[];
  description: string | null; comments: string | null; sdgs: string[]; topics: string[]; programmeNetworks: string[];
  responsible: string[]; attachments: string[]; necocli: boolean;
  council?: string | null; partners?: string[]; budget?: string | null; sourceUrl?: string | null; kind?: string; dateBasis?: string | null;
  localizations?: { locale: string; name: string; description: string | null }[]; profiles?: string[];
}
export interface ActorSourceRecord {
  id: string; collection: string; name: string; entityType: string | null; date: string | null; capacities: string | null;
  necessities: string | null; actions: string | null; description: string | null; comments: string | null; url: string | null; explicitNecocliTag: boolean;
}
export interface Actor { id: string; name: string; sourceRecords: ActorSourceRecord[]; programmeNetworks: string[]; topics: string[]; necocli: boolean; kinds: string[]; entityType: string | null; council?: string | null; addedInThisBuild?: boolean }
export interface ProgrammeNetwork {
  id: string; name: string; agreementDate: string | null; duration: { start: string; end: string } | null; zones: string[]; necocli: boolean;
  leader: string[]; memberEntities: string[]; registeredEcosystemRecords: string[]; initiatives: string[];
  progressReports: { sourceId: number; name: string; sections: Record<string, string> }[]; budgetNote: string;
}
export type EdgeKind = 'actor_initiative' | 'initiative_initiative' | 'programme_membership' | 'initiative_programme' | 'responsible_entity' | 'ecosystem_registration';
export interface SourceEdge { id: string; source: string; target: string; kind: EdgeKind; label: string | null; sourceRecordIds: string[]; altLabels?: string[]; mergedEdgeIds?: string[] }
export interface ListeningSourceItem {
  id: string; kind: 'listening_record' | 'perception_record' | 'event_record' | 'interview_reference'; title: string; date: string | null; topics: string[]; programmeNetworks: string[];
  attachments: string[]; necocli: boolean; format?: string | null; channels?: string[]; needs?: string | null; comments?: string | null; participants?: number | null;
  profileType?: string; occupation?: string | null; age?: string | null; challenges?: string | null; opportunities?: string | null; linkedListening?: string[]; note?: string;
  quote?: string; sourceCode?: string | null; originalSourceCode?: string | null; canonicalId?: string; localeMetadata?: string; variants?: { locale: string; text: string }[]; availability?: string;
}
export interface Variable { id: string; sector: string; label: string; refs: DocRef[]; definition?: string; origin?: string; interviewRefs?: string[]; reviewNotes?: string }
export interface CausalLink { id: string; from: string; to: string; polarity: '+' | '-'; rationale: string; refs: DocRef[]; origin?: string; interviewRefs?: string[]; conditions?: string; reviewNotes?: string; defaultVisible?: boolean }
export interface Loop { id: string; name: string; type: string; influenceIds: string[]; narrative: string; reviewNotes?: string }
export interface SystemMapData { sectors: { id: string; label: string }[]; variables: Variable[]; links: CausalLink[]; loops: Loop[]; question?: string; note?: string; hasHypotheses: boolean }
export interface Configuration { id: string; label: string; episodes: string[]; rationale: string }
export interface DocumentInfo { id: string; title: string; file?: string; url?: string; kind?: string }
export interface TerritoryInfo {
  id: TerritoryId; name: string; department: string; subregion: string; country: string; center: { lat: number; lon: number }; zoom?: number;
  centerPrecision: string; projectLocationNote: string; reportContext: DocRef[];
  story: { id: string; title: string; text: string; refs: DocRef[] }[];
  programme: { name: string; promoter: string; sourceNote: string; platformUrl: string };
  featuredInitiativeIds?: string[]; comparisonNote?: string;
  milestones?: { date: string; label: string; ref: DocRef }[];
}
export interface Verification { excerpts: number; verified: number; method: string; detail?: string }

interface Dataset {
  id: TerritoryId; territory: TerritoryInfo; documents: Record<string, DocumentInfo>;
  programmeNetworks: ProgrammeNetwork[]; initiatives: Initiative[]; actors: Actor[]; edges: SourceEdge[]; listening: ListeningSourceItem[];
  unresolved: { id: string; text: string | null; knownEndpoints: string[] }[]; counts: Record<string, number>;
  episodes: Episode[]; configurations: Record<FunctionId, Configuration[]>; systemMap: SystemMapData; verification: Verification;
  aliases: unknown; contextGroupLabel: string; contextGroupOf: (i: Initiative) => { id: string; label: string } | null;
}

export const functions = (necReading.functions as { id: FunctionId; label: string; definition: string }[]);
export const FUNCTION_COLORS: Record<FunctionId, string> = { mobilisation: '#f2b56b', knowledge: '#8dd5ee', coordination: '#9cedd8', support: '#ee9fc6' };
export const functionById = new Map(functions.map((f) => [f.id, f]));
/** False in the single-file build shown in the Claude side panel, where the PDFs are not bundled. */
export const PDF_AVAILABLE = import.meta.env.VITE_SINGLEFILE !== '1';

const councilLabel = (c: string) => c.replace(/_/g, ' ').replace('Busturialdea Urdaibai', 'Whole comarca (Busturialdea–Urdaibai)').replace('Gernika Lumo', 'Gernika-Lumo').replace('Ibarrangelua', 'Ibarrangelu');

// ---------------- Necoclí
function buildNecocli(): Dataset {
  const S = necSources as unknown as { programmeNetworks: ProgrammeNetwork[]; initiatives: Initiative[]; actors: Actor[]; edges: SourceEdge[]; listening: ListeningSourceItem[]; unresolvedInterconnections: Dataset['unresolved']; counts: Record<string, number> };
  const actorIds = new Set(S.actors.map((a) => a.id));
  const ofRecord = new Map<string, string>();
  for (const a of S.actors) for (const r of a.sourceRecords) ofRecord.set(r.id, a.id);
  const resolve = (x: string) => (actorIds.has(x) ? x : ofRecord.get(x) ?? x);
  const episodes = [
    ...(necReading.episodes as unknown as Episode[]),
    ...(necExtra.episodes as unknown as Episode[]).map((e) => ({ ...e, addedInThisBuild: true })),
  ].map((e) => ({ ...e, actorRecordIds: [...new Set(e.actorRecordIds.map(resolve))] }));
  const sys = necSystem as unknown as { sectors: { id: string; label: string }[]; variables: Variable[]; links: CausalLink[] };
  const progById = new Map(S.programmeNetworks.map((p) => [p.id, p]));
  return {
    id: 'necocli', territory: { ...(necTerritory as unknown as TerritoryInfo), id: 'necocli' },
    documents: {
      codespa: { id: 'codespa', title: 'Codespa — Necoclí listening report, March–June 2026', file: 'reports/codespa-necocli-2026.pdf', kind: 'report' },
      uniban: { id: 'uniban', title: 'Unibán — Agroinnova Necoclí listening report, 2026', file: 'reports/uniban-necocli-2026.pdf', kind: 'report' },
    },
    programmeNetworks: S.programmeNetworks, initiatives: S.initiatives, actors: S.actors, edges: S.edges, listening: S.listening,
    unresolved: S.unresolvedInterconnections, counts: S.counts, episodes,
    configurations: necConfig.functions as Record<FunctionId, Configuration[]>,
    systemMap: { ...sys, loops: [], hasHypotheses: false },
    verification: necVerification as Verification,
    aliases: necAliases,
    contextGroupLabel: 'Programme network',
    contextGroupOf: (i) => (i.programmeNetworks[0] ? { id: i.programmeNetworks[0], label: progById.get(i.programmeNetworks[0])?.name ?? i.programmeNetworks[0] } : null),
  };
}

// ---------------- Busturialdea–Urdaibai
function buildUrdaibai(): Dataset {
  const S = urdSources as unknown as { initiatives: Initiative[]; actors: Actor[]; edges: SourceEdge[]; listening: ListeningSourceItem[]; unresolvedInterconnections: Dataset['unresolved']; counts: Record<string, number>; projectProfiles: Record<string, string[]> };
  const X = urdExtra as unknown as { episodes: Episode[]; readingAdditions: { episodeId: string; reading: Reading }[]; contextActors: { id: string; name: string; kind: string; actorType: string; provenance: string }[] };
  const added: Actor[] = X.contextActors.map((c) => ({
    id: c.id, name: c.name, programmeNetworks: [], topics: [], necocli: true, kinds: [c.kind], entityType: c.actorType, addedInThisBuild: true,
    sourceRecords: [{ id: c.id, collection: 'curated_context', name: c.name, entityType: c.actorType, date: null, capacities: null, necessities: null, actions: null, description: c.provenance, comments: null, url: null, explicitNecocliTag: true }],
  }));
  const R = urdReading as unknown as { episodes: Episode[]; documents: { id: string; title: string; path?: string; url?: string; kind?: string }[] };
  const toEpisode = (e: Episode, isAdded: boolean): Episode => {
    const extraReadings = X.readingAdditions.filter((a) => a.episodeId === e.id).map((a) => ({ ...a.reading, addedInThisBuild: true }));
    const participants = e.participants ?? [];
    return {
      ...e, addedInThisBuild: isAdded,
      functionalReadings: [...e.functionalReadings, ...extraReadings],
      actorRecordIds: [...new Set(participants.map((p) => p.actorRecordId))],
      reportingPeriod: e.time?.label ?? (e.time?.date ? `${e.time.date}${e.time.basis ? ` (${e.time.basis.replace(/_/g, ' ')})` : ''}` : 'date not specified'),
      actorLinkMeaning: 'Reported participants with the role stated in the evidence; organiser and inferred roles are marked as such',
    };
  };
  const episodes = [...R.episodes.map((e) => toEpisode(e, false)), ...X.episodes.map((e) => toEpisode(e, true))];
  const documents: Record<string, DocumentInfo> = {};
  for (const d of R.documents) documents[d.id] = { id: d.id, title: d.title, url: d.url, kind: d.kind, file: d.id === 'urdaibai:document:alc-final' ? 'reports/alc-urdaibai-final-es.pdf' : undefined };
  const M = urdSystem as unknown as {
    map: { question: string }; presentation: { note: string };
    variables: { id: string; name: string; definition: string; theme: string; origin: string; interview_ids: string[]; review_notes: string }[];
    influences: { id: string; source: string; target: string; polarity: number; origin: string; interview_ids: string[]; explanation: string; conditions: string; review_notes: string; defaultVisible: boolean }[];
    loops: { id: string; name: string; type: string; influence_ids: string[]; narrative: string; review_notes: string }[];
  };
  const themes = [...new Set(M.variables.map((v) => v.theme))];
  const systemMap: SystemMapData = {
    sectors: themes.map((t) => ({ id: t, label: t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ') })),
    variables: M.variables.map((v) => ({ id: v.id, sector: v.theme, label: v.name, refs: [], definition: v.definition, origin: v.origin, interviewRefs: v.interview_ids, reviewNotes: v.review_notes })),
    links: M.influences.map((l) => ({ id: l.id, from: l.source, to: l.target, polarity: l.polarity > 0 ? '+' : '-', rationale: l.explanation, refs: [], origin: l.origin, interviewRefs: l.interview_ids, conditions: l.conditions, reviewNotes: l.review_notes, defaultVisible: l.defaultVisible })),
    loops: M.loops.map((l) => ({ id: l.id, name: l.name, type: l.type, influenceIds: l.influence_ids, narrative: l.narrative, reviewNotes: l.review_notes })),
    question: M.map.question, note: M.presentation.note, hasHypotheses: true,
  };
  const V = urdVerification as { reportQuotes: number; reportVerified: number; apiQuotes: number; apiVerified: number; method: string };
  const initiatives = S.initiatives.map((i) => ({ ...i, profiles: S.projectProfiles[i.id] ?? [] }));
  return {
    id: 'urdaibai', territory: urdTerritory as unknown as TerritoryInfo, documents,
    programmeNetworks: [], initiatives, actors: [...S.actors, ...added], edges: S.edges, listening: S.listening,
    unresolved: S.unresolvedInterconnections, counts: { ...S.counts, records: S.initiatives.length + S.actors.length + S.listening.length },
    episodes, configurations: urdConfig.functions as Record<FunctionId, Configuration[]>, systemMap,
    verification: { excerpts: V.reportQuotes + V.apiQuotes, verified: V.reportVerified + V.apiVerified, method: V.method, detail: `${V.reportVerified}/${V.reportQuotes} report quotes on the cited PDF page; ${V.apiVerified}/${V.apiQuotes} listening quotes found in the cited excerpt.` },
    aliases: urdAliases,
    contextGroupLabel: 'Council',
    contextGroupOf: (i) => (i.council ? { id: `council:${i.council}`, label: councilLabel(i.council) } : i.kind && i.kind !== 'ktool_project' ? { id: 'council:context', label: 'Curated context (not a K-tool record)' } : null),
  };
}

const builders: Record<TerritoryId, () => Dataset> = { necocli: buildNecocli, urdaibai: buildUrdaibai };
const cache = new Map<TerritoryId, Dataset>();

// ---------------- live bindings
export let territoryId: TerritoryId = 'necocli';
export let territory: TerritoryInfo;
export let documents: Record<string, DocumentInfo>;
export let programmeNetworks: ProgrammeNetwork[];
export let initiatives: Initiative[];
export let actors: Actor[];
export let sourceEdges: SourceEdge[];
export let unresolvedInterconnections: Dataset['unresolved'];
export let counts: Record<string, number>;
export let aliases: unknown;
export let episodes: Episode[];
export let configurations: Record<FunctionId, Configuration[]>;
export let systemMap: SystemMapData;
export let verification: Verification;
export let listeningRecords: ListeningSourceItem[];
export let contextGroupLabel: string;
export let contextGroupOf: Dataset['contextGroupOf'];
export let featuredInitiativeIds: string[];
/** Large territories open on a featured slice instead of every record. */
export let isLargeTerritory = false;
export let initiativeById: Map<string, Initiative>;
export let actorById: Map<string, Actor>;
export let programmeById: Map<string, ProgrammeNetwork>;
export let episodeById: Map<string, Episode>;
export let initiativeComponents: { id: string; label: string; members: string[] }[];
export let reportExcerpts: ReportExcerpt[];
export let progressReports: ProgressReportItem[];

export function setTerritory(id: TerritoryId) {
  if (!cache.has(id)) cache.set(id, builders[id]());
  const d = cache.get(id)!;
  territoryId = id; territory = d.territory; documents = d.documents; programmeNetworks = d.programmeNetworks; initiatives = d.initiatives;
  actors = d.actors; sourceEdges = d.edges; unresolvedInterconnections = d.unresolved; counts = d.counts; aliases = d.aliases;
  episodes = d.episodes; configurations = d.configurations; systemMap = d.systemMap; verification = d.verification; listeningRecords = d.listening;
  contextGroupLabel = d.contextGroupLabel; contextGroupOf = d.contextGroupOf;
  featuredInitiativeIds = d.territory.featuredInitiativeIds ?? d.initiatives.map((i) => i.id);
  isLargeTerritory = d.initiatives.length > 30;
  initiativeById = new Map(initiatives.map((i) => [i.id, i]));
  actorById = new Map(actors.map((a) => [a.id, a]));
  programmeById = new Map(programmeNetworks.map((n) => [n.id, n]));
  episodeById = new Map(episodes.map((e) => [e.id, e]));
  initiativeComponents = buildComponents();
  componentIndex = new Map(initiativeComponents.flatMap((c, k) => c.members.map((m) => [m, k] as [string, number])));
  reportExcerpts = buildExcerpts();
  progressReports = programmeNetworks.flatMap((n) => n.progressReports.filter((p) => Object.keys(p.sections).length).map((p) => ({ id: `progress:${p.sourceId}`, kind: 'progress_report' as const, title: p.name, programmeNetwork: n.id, sections: p.sections })));
}

export const pdfHref = (r: { documentId: string; pdfPage?: number }) => {
  const d = documents[r.documentId];
  if (!d) return null;
  if (d.file && PDF_AVAILABLE) return `${import.meta.env.BASE_URL}${d.file}${r.pdfPage ? `#page=${r.pdfPage}` : ''}`;
  return d.url ?? null;
};

// ---------- derived lookups
export const nodeLabel = (id: string): string =>
  initiativeById.get(id)?.shortName ?? actorById.get(id)?.name ?? programmeById.get(id)?.name ?? episodeById.get(id)?.title ?? functionById.get(id as FunctionId)?.label ?? id;
export const kindOfId = (id: string): 'initiative' | 'programme' | 'episode' | 'actor' | null =>
  initiativeById.has(id) ? 'initiative' : programmeById.has(id) ? 'programme' : episodeById.has(id) ? 'episode' : actorById.has(id) ? 'actor' : null;
export const episodeFunctions = (e: Episode) => [...new Set(e.functionalReadings.map((r) => r.functionId))];
export const episodesOfInitiative = (iid: string) => episodes.filter((e) => e.initiativeIds.includes(iid));
export const episodesOfActor = (aid: string) => episodes.filter((e) => e.actorRecordIds.includes(aid));
export const edgesOf = (id: string) => sourceEdges.filter((e) => e.source === id || e.target === id);
export const initiativesOfActor = (aid: string) => [...new Set(sourceEdges.filter((e) => (e.kind === 'actor_initiative' || e.kind === 'responsible_entity') && e.source === aid).map((e) => e.target))];
export const actorsOfInitiative = (iid: string) => [...new Set(sourceEdges.filter((e) => (e.kind === 'actor_initiative' || e.kind === 'responsible_entity') && e.target === iid).map((e) => e.source))];
export const participantOf = (eid: string, aid: string) => episodeById.get(eid)?.participants?.find((p) => p.actorRecordId === aid);
/** Evidence count (number of curated episodes) per initiative × function. Not a capacity score. */
export const evidenceCount = (iid: string, fid: FunctionId) => episodesOfInitiative(iid).filter((e) => episodeFunctions(e).includes(fid)).length;

function buildComponents() {
  const parent = new Map(initiatives.map((i) => [i.id, i.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
  for (const e of sourceEdges.filter((e) => e.kind === 'initiative_initiative')) if (parent.has(e.source) && parent.has(e.target)) parent.set(find(e.source), find(e.target));
  const groups = new Map<string, string[]>();
  for (const i of initiatives) groups.set(find(i.id), [...(groups.get(find(i.id)) || []), i.id]);
  let comps = [...groups.values()];
  if (territoryId !== 'necocli') {
    // large territory: one group for all initiatives without any initiative–initiative link
    const singles = comps.filter((c) => c.length === 1).flat();
    comps = [...comps.filter((c) => c.length > 1), ...(singles.length ? [singles] : [])];
  }
  return comps.sort((a, b) => b.length - a.length).map((members, k) => {
    let label: string;
    if (territoryId === 'necocli') {
      const topics = members.flatMap((m) => initiativeById.get(m)!.topics);
      const tourism = topics.filter((t) => t === 'Tourism').length;
      const agri = topics.filter((t) => ['Agriculture', 'Financial', 'Animal husbandry', 'Circular economy'].includes(t)).length;
      label = members.length === 1 ? `${initiativeById.get(members[0])!.shortName} (no initiative–initiative link)` : tourism > agri ? 'Tourism component' : 'Agro-enterprise & finance component';
    } else {
      const linked = sourceEdges.some((e) => e.kind === 'initiative_initiative' && (e.source === members[0] || e.target === members[0]));
      label = !linked ? 'No initiative–initiative link in the source' : `Linked group ${k + 1} (${members.length} initiatives)`;
    }
    return { id: `cluster:init:${members.slice().sort()[0]}`, label, members };
  });
}
let componentIndex = new Map<string, number>();
export const componentOfInitiative = (iid: string) => initiativeComponents[componentIndex.get(iid) ?? 0];

export const INITIATIVE_COLORS = ['#dafa62', '#f6c58f', '#c9b6ff', '#9fe0f2'];
export const initiativeColor = (iid: string) => {
  const i = initiativeById.get(iid);
  if (i?.kind && i.kind !== 'ktool_project' && territoryId === 'urdaibai') return '#f2e6c9';
  return INITIATIVE_COLORS[(componentIndex.get(iid) ?? 0) % INITIATIVE_COLORS.length];
};

export const actorSector = (a: Actor): { id: string; label: string; color: string } => {
  const t = (a.entityType || '').toLowerCase();
  const n = a.name.toLowerCase();
  if (a.kinds.includes('role_group')) return { id: 'role', label: 'Role group (unnamed people)', color: '#e9dcc3' };
  if (a.kinds.includes('programme_entity') && !a.kinds.includes('ecosystem_record')) return { id: 'programme', label: 'Programme entity', color: '#d6dde3' };
  if (/financ|banco|microfin/.test(t) || /banco|bancolombia|cfa/.test(n)) return { id: 'finance', label: 'Finance', color: '#ffd27a' };
  if (/p[uú]blic|city_hall/.test(t)) return { id: 'public', label: 'Public sector', color: '#8dd5ee' };
  if (/universidad|acad/.test(t)) return { id: 'academic', label: 'Academic', color: '#c9b6ff' };
  if (/gremi|privad|private/.test(t)) return { id: 'private', label: 'Private / guild', color: '#f6a98f' };
  if (/incubada/.test(t)) return { id: 'incubated', label: 'Enterprise incubated by W4P', color: '#dafa62' };
  if (/civil|ong|ngo|association|foundation/.test(t)) return { id: 'civil', label: 'Civil society / association', color: '#9cedd8' };
  return { id: 'other', label: 'Other organisation', color: '#aab6c0' };
};

// ---------- listening layer: curated excerpts + source records
export interface ReportExcerpt { id: string; documentId: string; pdfPage?: number; quote: string; sourceType: string; sourceRecordId?: string; englishSummary?: string; usedBy: { kind: 'episode' | 'variable' | 'link' | 'territory'; id: string; label: string }[]; initiativeIds: string[] }
function buildExcerpts(): ReportExcerpt[] {
  const m = new Map<string, ReportExcerpt>();
  const add = (r: { documentId: string; pdfPage?: number; quote?: string | null; sourceType?: string; sourceRecordId?: string; englishSummary?: string }, use: ReportExcerpt['usedBy'][number], inits: string[]) => {
    if (!r.quote) return;
    const k = `${r.documentId}|${r.pdfPage ?? ''}|${r.quote}`;
    if (!m.has(k)) m.set(k, { id: `excerpt:${m.size + 1}`, documentId: r.documentId, pdfPage: r.pdfPage, quote: r.quote, sourceType: r.sourceType ?? 'report_excerpt', sourceRecordId: r.sourceRecordId, englishSummary: r.englishSummary, usedBy: [], initiativeIds: [] });
    const x = m.get(k)!;
    x.usedBy.push(use);
    x.initiativeIds = [...new Set([...x.initiativeIds, ...inits])];
  };
  for (const e of episodes) for (const ev of e.evidence) add(ev, { kind: 'episode', id: e.id, label: e.title }, e.initiativeIds);
  for (const v of systemMap.variables) for (const r of v.refs) add(r, { kind: 'variable', id: v.id, label: v.label }, []);
  for (const l of systemMap.links) for (const r of l.refs) add(r, { kind: 'link', id: l.id, label: `${systemMap.variables.find((v) => v.id === l.from)!.label} → ${systemMap.variables.find((v) => v.id === l.to)!.label}` }, []);
  for (const r of territory.reportContext) add(r, { kind: 'territory', id: 'territory', label: 'Territory context' }, []);
  for (const st of territory.story) for (const r of st.refs) add(r, { kind: 'territory', id: 'territory', label: `Territory story: ${st.title}` }, []);
  return [...m.values()];
}

export interface ProgressReportItem { id: string; kind: 'progress_report'; title: string; programmeNetwork: string; sections: Record<string, string> }

export const SECTION_LABELS: Record<string, string> = {
  strategic_objectives: 'Strategic objectives',
  prototypes_progress_and_significant_changes: 'Prototype progress and significant changes',
  beneficiaries_progress_and_significant_changes: 'Beneficiary progress',
  territory_changes: 'Territory changes',
  network_changes: 'Network changes',
  partners_progress_and_significant_changes: 'Partner progress',
  impact_visibility: 'Impact visibility',
  sustainability_measures: 'Sustainability measures',
  final_reflections: 'Final reflections',
  additional_comments: 'Additional comments',
};

export const PARTICIPATION_LABEL: Record<string, string> = {
  reported_participation: 'Reported participation',
  organiser_context: 'Organiser (context)',
  inferred_role_context: 'Inferred role (context)',
};

export const EDGE_MEANING: Record<string, { label: string; provenance: Provenance; note: string }> = {
  actor_initiative: { label: 'Source association (organization ↔ initiative)', provenance: 'source_record', note: 'An explicit association in the source (for K-tool: listed as lead or associated agent). Administrative metadata — not its direction, strength, or that cooperation took place.' },
  initiative_initiative: { label: 'Source association (initiative ↔ initiative)', provenance: 'source_record', note: 'The two initiative records share an interconnection ID. Not a causal claim.' },
  programme_membership: { label: 'Shared affiliation: listed programme member', provenance: 'source_record', note: 'Listed as member entity of a programme network (consortium/phase). Co-membership does not imply interpersonal trust or collaboration.' },
  initiative_programme: { label: 'Shared affiliation: initiative registered under programme', provenance: 'source_record', note: 'Administrative registration of the initiative under a programme network.' },
  responsible_entity: { label: 'Responsible programme entity', provenance: 'source_record', note: 'Source field naming the programme entity responsible for the initiative.' },
  ecosystem_registration: { label: 'Shared affiliation: ecosystem record registered by programme', provenance: 'source_record', note: 'The programme network registered this ecosystem record. It does not establish direct cooperation.' },
  episode_initiative: { label: 'Episode reported for initiative', provenance: 'reported_episode', note: 'The source describes this episode in relation to the initiative.' },
  episode_actor: { label: 'Episode participant', provenance: 'reported_episode', note: 'Necoclí: initiative-level association, attendance not asserted. Urdaibai: participant with the role and status stated in the evidence.' },
  episode_function: { label: 'Functional interpretation', provenance: 'functional_interpretation', note: 'Analytical reading of the episode through this function. Not a quote and not a measurement.' },
  causal: { label: 'Signed influence', provenance: 'analyst_synthesis', note: 'Analyst synthesis. No weight, no simulation.' },
  shared_members: { label: 'Shared organizations between two contexts', provenance: 'source_record', note: 'Organizations associated in the source with both contexts. A count of shared records, not a measure of cooperation between the contexts.' },
  hyper_membership: { label: 'Member of context (hyperedge)', provenance: 'source_record', note: 'The organization is associated in the source with this initiative or programme network, or takes part in the episode.' },
  fn_cooccurrence: { label: 'Functions read together', provenance: 'functional_interpretation', note: 'Number of curated episodes whose functional readings name both functions.' },
  fn_config: { label: 'Configuration of a function', provenance: 'analyst_synthesis', note: 'Analyst grouping of episodes by the kind of response their reading of this function describes.' },
  config_episode: { label: 'Episode in configuration', provenance: 'analyst_synthesis', note: 'The episode is grouped in this configuration (analyst synthesis).' },
  aggregate: { label: 'Aggregated source associations', provenance: 'source_record', note: 'Count of source associations between a collapsed group and a node. A count of records, not a tie strength.' },
};

/** Earliest date among an actor's source records (date of the record, not of first involvement). */
export const actorFirstDate = (a: Actor): string | null => a.sourceRecords.map((r) => r.date).filter((d): d is string => !!d).sort()[0] ?? null;

setTerritory('necocli');
