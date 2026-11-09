// Hypergraph over organizations. A hyperedge is a context that groups several
// organizations at once: an initiative, a programme network, or a curated episode.
// Centrality is computed on source associations; it describes position in the
// records, not influence, trust or observed collaboration.
import { sourceEdges, initiatives, programmeNetworks, episodes, actorById, nodeLabel } from './model';

export type HyperType = 'initiative' | 'programme' | 'episode';
export interface Hyperedge { id: string; type: HyperType; label: string; members: string[]; provenance: 'source_record' | 'reported_episode' }

const uniq = (a: string[]) => [...new Set(a)].filter((x) => actorById.has(x));

export function buildHyperedges(types: Set<HyperType>, region: 'necocli' | 'all', initiativeSubset?: Set<string>): Hyperedge[] {
  const out: Hyperedge[] = [];
  if (types.has('initiative')) for (const i of initiatives.filter((x) => !initiativeSubset || initiativeSubset.has(x.id))) {
    const m = uniq(sourceEdges.filter((e) => (e.kind === 'actor_initiative' || e.kind === 'responsible_entity') && e.target === i.id).map((e) => e.source));
    out.push({ id: i.id, type: 'initiative', label: i.shortName, members: m, provenance: 'source_record' });
  }
  if (types.has('programme')) for (const p of programmeNetworks.filter((p) => region === 'all' || p.necocli)) {
    const m = uniq(sourceEdges.filter((e) => (e.kind === 'programme_membership' || e.kind === 'ecosystem_registration') && e.target === p.id).map((e) => e.source));
    out.push({ id: p.id, type: 'programme', label: p.name, members: m, provenance: 'source_record' });
  }
  if (types.has('episode')) for (const e of episodes) out.push({ id: e.id, type: 'episode', label: e.title, members: uniq(e.actorRecordIds), provenance: 'reported_episode' });
  return out;
}

/** Context–context relations that exist in the source independently of shared members. */
export function contextLinks(hs: Hyperedge[]) {
  const ids = new Set(hs.map((h) => h.id));
  const links: { id: string; source: string; target: string; kind: 'initiative_initiative' | 'initiative_programme' | 'episode_initiative' }[] = [];
  for (const e of sourceEdges) {
    if ((e.kind === 'initiative_initiative' || e.kind === 'initiative_programme') && ids.has(e.source) && ids.has(e.target)) links.push({ id: e.id, source: e.source, target: e.target, kind: e.kind });
  }
  for (const ep of episodes) if (ids.has(ep.id)) for (const i of ep.initiativeIds) if (ids.has(i)) links.push({ id: `epi:${ep.id}:${i}`, source: ep.id, target: i, kind: 'episode_initiative' });
  return links;
}

export function sharedMembers(a: Hyperedge, b: Hyperedge) { const s = new Set(a.members); return b.members.filter((m) => s.has(m)); }

// ---------------- centrality
export type Metric = 'hyperdegree' | 'betweenness' | 'eigenvector';
export const METRICS: Record<Metric, { label: string; graph: string; reading: string }> = {
  hyperdegree: {
    label: 'Hyperdegree',
    graph: 'Number of included contexts (hyperedges) an organization belongs to.',
    reading: 'How many recorded contexts an organization appears in. The simplest and most transparent measure.',
  },
  betweenness: {
    label: 'Betweenness (bipartite)',
    graph: 'Share of shortest paths between all pairs of nodes that pass through the node, in the organization–context incidence graph (unweighted, normalised to 0–1).',
    reading: 'Organizations or contexts that sit on many of the shortest routes between otherwise separate parts of the record — candidate bridges in the data.',
  },
  eigenvector: {
    label: 'Eigenvector (projection)',
    graph: 'Leading eigenvector of the organization–organization projection, where two organizations are linked with weight = number of contexts they share (power iteration, max = 1).',
    reading: 'High when an organization shares contexts with other organizations that also share many contexts. Concentrates in the largest connected part.',
  },
};

export interface Ranked { id: string; label: string; kind: 'organization' | HyperType; value: number }

export function computeCentrality(hs: Hyperedge[], metric: Metric): { orgs: Ranked[]; contexts: Ranked[] } {
  const orgIds = [...new Set(hs.flatMap((h) => h.members))];
  const lab = (id: string) => nodeLabel(id);
  if (metric === 'hyperdegree') {
    const orgs = orgIds.map((o) => ({ id: o, label: lab(o), kind: 'organization' as const, value: hs.filter((h) => h.members.includes(o)).length }));
    const contexts = hs.map((h) => ({ id: h.id, label: h.label, kind: h.type, value: h.members.length }));
    return { orgs: orgs.sort((a, b) => b.value - a.value), contexts: contexts.sort((a, b) => b.value - a.value) };
  }
  if (metric === 'betweenness') {
    // Brandes on the bipartite incidence graph
    const nodes = [...orgIds, ...hs.map((h) => h.id)];
    const idx = new Map(nodes.map((n, i) => [n, i]));
    const adj: number[][] = nodes.map(() => []);
    for (const h of hs) for (const m of h.members) { const a = idx.get(h.id)!, b = idx.get(m)!; adj[a].push(b); adj[b].push(a); }
    const n = nodes.length, CB = new Array(n).fill(0);
    for (let s = 0; s < n; s++) {
      const S: number[] = [], P: number[][] = nodes.map(() => []), sigma = new Array(n).fill(0), d = new Array(n).fill(-1);
      sigma[s] = 1; d[s] = 0; const Q = [s];
      while (Q.length) { const v = Q.shift()!; S.push(v); for (const w of adj[v]) { if (d[w] < 0) { Q.push(w); d[w] = d[v] + 1; } if (d[w] === d[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); } } }
      const delta = new Array(n).fill(0);
      while (S.length) { const w = S.pop()!; for (const v of P[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]); if (w !== s) CB[w] += delta[w]; }
    }
    const norm = n > 2 ? (n - 1) * (n - 2) : 1; // undirected: CB/2 normalised by (n-1)(n-2)/2
    const val = (id: string) => CB[idx.get(id)!] / norm;
    const orgs = orgIds.map((o) => ({ id: o, label: lab(o), kind: 'organization' as const, value: val(o) }));
    const contexts = hs.map((h) => ({ id: h.id, label: h.label, kind: h.type, value: val(h.id) }));
    return { orgs: orgs.sort((a, b) => b.value - a.value), contexts: contexts.sort((a, b) => b.value - a.value) };
  }
  // eigenvector on the weighted projection (power iteration)
  const idx = new Map(orgIds.map((o, i) => [o, i]));
  const W: Map<number, number>[] = orgIds.map(() => new Map());
  for (const h of hs) for (const a of h.members) for (const b of h.members) if (a !== b) { const i = idx.get(a)!, j = idx.get(b)!; W[i].set(j, (W[i].get(j) ?? 0) + 1); }
  let x = new Array(orgIds.length).fill(1);
  for (let it = 0; it < 200; it++) {
    const y = x.map((_, i) => { let s = x[i] * 1e-9; for (const [j, w] of W[i]) s += w * x[j]; return s; });
    const m = Math.max(...y, 1e-12);
    x = y.map((v) => v / m);
  }
  const orgs = orgIds.map((o) => ({ id: o, label: lab(o), kind: 'organization' as const, value: x[idx.get(o)!] }));
  // contexts: mean eigenvector score of their members (descriptive aggregate)
  const contexts = hs.map((h) => ({ id: h.id, label: h.label, kind: h.type, value: h.members.length ? h.members.reduce((s, m) => s + x[idx.get(m)!], 0) / h.members.length : 0 }));
  return { orgs: orgs.sort((a, b) => b.value - a.value), contexts: contexts.sort((a, b) => b.value - a.value) };
}
