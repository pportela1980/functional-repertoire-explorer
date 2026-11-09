import type { GNode, GLink, GraphSelection } from '../components/ForceGraph';
import type { Sel } from '../state';
import type { EdgeInfo, ClusterInfo } from '../components/SidePanel';
import {
  initiativeById, actorById, programmeById, episodeById, functionById, actorSector, initiativeColor, episodeFunctions,
  FUNCTION_COLORS, sourceEdges, type FunctionId, type SourceEdge, kindOfId, systemMap } from '../data/model';

export const initNode = (id: string, extra: Partial<GNode> = {}): GNode => ({
  id, type: 'initiative', label: initiativeById.get(id)!.shortName, color: initiativeColor(id), r: 14, alwaysLabel: true,
  title: `${initiativeById.get(id)!.name} (initiative record)`, ...extra,
});
export const actorNode = (id: string, extra: Partial<GNode> = {}): GNode => {
  const a = actorById.get(id)!;
  const s = actorSector(a);
  return { id, type: 'actor', label: shortActorName(a.name), color: s.color, r: 7, doubleRing: a.kinds.includes('programme_entity'), title: `${a.name} · ${s.label}`, ...extra };
};
export const progNode = (id: string, extra: Partial<GNode> = {}): GNode => ({
  id, type: 'programme', label: programmeById.get(id)!.name, color: '#d6dde3', r: 15, alwaysLabel: true, title: `${programmeById.get(id)!.name} (programme network: consortium/phase)`, ...extra,
});
export const episodeNode = (id: string, extra: Partial<GNode> = {}): GNode => {
  const e = episodeById.get(id)!;
  return { id, type: 'episode', label: e.title, color: '#f4f5f0', r: 9, ring: episodeFunctions(e).map((f) => FUNCTION_COLORS[f]), alwaysLabel: true, title: `Episode: ${e.title}`, ...extra };
};
export const fnNodeId = (f: FunctionId) => `fn:${f}`;
export const fnNode = (f: FunctionId, extra: Partial<GNode> = {}): GNode => ({
  id: fnNodeId(f), type: 'function', label: functionById.get(f)!.label, color: FUNCTION_COLORS[f], r: 24, alwaysLabel: true, title: functionById.get(f)!.definition, ...extra,
});

export function shortActorName(n: string) {
  const dash = n.split(/\s[-–]\s/);
  let s = dash.length > 1 && dash[dash.length - 1].length <= 14 ? dash[dash.length - 1] : n;
  s = s.replace(/^(Asociación|Corporación|Fundación|Caja de compensación (familiar|Familiar))\s+/i, '');
  return s.length > 30 ? s.slice(0, 28) + '…' : s;
}

export const sourceLinkStyle = (e: SourceEdge): Partial<GLink> => {
  switch (e.kind) {
    case 'initiative_initiative': return { color: '#9fb7c7', width: 2.6, distance: 110, strength: 0.18 };
    case 'actor_initiative': return { color: '#7f97aa', width: 1.3, distance: 62, strength: 0.32 };
    case 'responsible_entity': return { color: '#7f97aa', width: 1.1, dash: '1 3', distance: 70, strength: 0.15 };
    default: return { color: '#5f7689', width: 1, dash: '5 4', distance: 85, strength: 0.06 };
  }
};
export const sourceLink = (e: SourceEdge, extra: Partial<GLink> = {}): GLink => ({ id: e.id, source: e.source, target: e.target, kind: e.kind, label: e.label ?? undefined, ...sourceLinkStyle(e), ...extra });

/** Collapse groups: members are replaced by one cluster node; links are re-routed and counted. */
export function applyCollapse(
  nodes: GNode[], links: GLink[], groupOf: Map<string, string>, collapsed: Set<string>,
  meta: Map<string, { label: string; target?: { x: number; y: number }; color?: string }>,
): { nodes: GNode[]; links: GLink[]; aggregates: Map<string, { members: string[] }> } {
  const rep = (id: string) => { const g = groupOf.get(id); return g && collapsed.has(g) ? `cluster:${g}` : id; };
  const aggregates = new Map<string, { members: string[] }>();
  const out: GNode[] = [];
  for (const n of nodes) {
    const r = rep(n.id);
    if (r === n.id) { out.push(n); continue; }
    if (!aggregates.has(r)) aggregates.set(r, { members: [] });
    aggregates.get(r)!.members.push(n.id);
  }
  for (const [cid, a] of aggregates) {
    const g = cid.slice('cluster:'.length);
    const m = meta.get(g);
    out.push({ id: cid, type: 'cluster', label: `${m?.label ?? g}`, color: m?.color ?? '#9cedd8', r: 14 + Math.sqrt(a.members.length) * 5, count: a.members.length, target: m?.target, targetStrength: 0.12, alwaysLabel: true, title: `${m?.label}: ${a.members.length} members (collapsed). Click to inspect, double-click to expand.` });
  }
  const agg = new Map<string, GLink & { n: number; members: string[] }>();
  const outLinks: GLink[] = [];
  for (const l of links) {
    const s = rep(l.source), t = rep(l.target);
    if (s === l.source && t === l.target) { outLinks.push(l); continue; }
    if (s === t) continue;
    const k = [s, t].sort().join('|');
    if (!agg.has(k)) agg.set(k, { id: `agg:${k}`, source: s, target: t, kind: 'aggregate', color: '#7f97aa', n: 0, members: [], distance: 120, strength: 0.08 });
    const a = agg.get(k)!;
    a.n++; a.members.push(l.id);
  }
  for (const a of agg.values()) outLinks.push({ ...a, width: Math.min(6, 1 + Math.sqrt(a.n)), label: String(a.n) });
  return { nodes: out, links: outLinks, aggregates };
}

/** Map a graph selection to an app selection, using link metadata kept by the view. */
export function toAppSelection(s: GraphSelection, linkInfo: Map<string, EdgeInfo>, clusterInfo: (id: string) => ClusterInfo | null): Sel | null {
  if (s.kind === 'background') return null;
  const id = s.id;
  if (s.kind === 'link') {
    if (systemMap.links.some((l) => l.id === id)) return { type: 'causal', id };
    const info = linkInfo.get(id);
    return info ? { type: 'edge', id, data: info } : null;
  }
  if (s.kind === 'hull' || id.startsWith('cluster:')) { const c = clusterInfo(id); return c ? { type: 'cluster', id, data: c } : null; }
  if (id.startsWith('fn:')) return { type: 'function', id: id.slice(3) };
  if (systemMap.variables.some((v) => v.id === id)) return { type: 'variable', id };
  const k = kindOfId(id);
  if (k) return { type: k, id };
  return null;
}
/** Node id corresponding to the app selection (to highlight it in the graph). */
export const selectedNodeId = (sel: Sel | null): string | null => {
  if (!sel) return null;
  if (sel.type === 'function') return `fn:${sel.id}`;
  return sel.id;
};

export const edgeInfoOf = (e: SourceEdge): EdgeInfo => ({ kind: e.kind, source: e.source, target: e.target, label: e.label, sourceRecordIds: e.sourceRecordIds, altLabels: e.altLabels });

/** Neighbourhood of a scoped initiative, used to emphasise it in every graph view. */
export function scopeSet(iid: string | null): Set<string> | null {
  if (!iid) return null;
  const s = new Set([iid]);
  for (const e of sourceEdges) { if (e.source === iid) s.add(e.target); if (e.target === iid) s.add(e.source); }
  for (const ep of [...episodeById.values()]) if (ep.initiativeIds.includes(iid)) { s.add(ep.id); ep.actorRecordIds.forEach((a) => s.add(a)); episodeFunctions(ep).forEach((f) => s.add(`fn:${f}`)); }
  return s;
}
