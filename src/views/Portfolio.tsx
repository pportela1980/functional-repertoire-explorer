import { useMemo, useState } from 'react';
import ForceGraph, { type GNode, type GLink, type GHull } from '../components/ForceGraph';
import { useApp } from '../state';
import {
  initiatives, sourceEdges, initiativeComponents, componentOfInitiative, programmeNetworks, functions, FUNCTION_COLORS, functionById,
  episodesOfInitiative, episodeFunctions, evidenceCount, actorsOfInitiative, INITIATIVE_COLORS, initiativeById, programmeById,
  isLargeTerritory, featuredInitiativeIds, contextGroupLabel, contextGroupOf, episodes, type FunctionId,
} from '../data/model';
import type { EdgeInfo, ClusterInfo } from '../components/SidePanel';
import { initNode, actorNode, episodeNode, fnNode, fnNodeId, progNode, sourceLink, edgeInfoOf, applyCollapse, toAppSelection, selectedNodeId, scopeSet } from './projection';
import { FunctionSelector } from './FunctionSelector';

type Grouping = 'cluster' | 'programme' | 'function';
const groupingRule = (g: Grouping) => ({
  cluster: 'Initiative clusters = connected components of source initiative–initiative interconnections.',
  programme: programmeNetworks.length ? 'Programme network under which each initiative is registered in the source (consortium/phase, not an interpersonal network).' : `${contextGroupLabel} recorded on each initiative record (administrative label, not a verified site location).`,
  function: 'Functions for which curated episodes of the initiative carry a reading. Link labels count supporting episodes; they are not capacity scores.',
})[g];
const HUBS: Record<FunctionId, { x: number; y: number }> = { mobilisation: { x: -340, y: -240 }, knowledge: { x: 340, y: -240 }, coordination: { x: 340, y: 240 }, support: { x: -340, y: 240 } };


export default function Portfolio() {
  const { fn, selection, select, scopeInitiative } = useApp();
  const [grouping, setGrouping] = useState<Grouping>('cluster');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showShared, setShowShared] = useState(true);
  const [scope, setScope] = useState<'featured' | 'linked' | 'all'>(isLargeTerritory ? 'featured' : 'all');
  const visible = useMemo(() => {
    if (scope === 'all') return new Set(initiatives.map((i) => i.id));
    const base = new Set(featuredInitiativeIds);
    if (scope === 'featured') return base;
    const orgs = new Set(sourceEdges.filter((e) => e.kind === 'actor_initiative' && base.has(e.target)).map((e) => e.source));
    const out = new Set(base);
    for (const e of sourceEdges) {
      if (e.kind === 'actor_initiative' && orgs.has(e.source)) out.add(e.target);
      if (e.kind === 'initiative_initiative' && (base.has(e.source) || base.has(e.target))) { out.add(e.source); out.add(e.target); }
    }
    return out;
  }, [scope]);
  // shared actors: organizations associated in source with two or more visible initiatives
  const actorInitiatives = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of sourceEdges) if (e.kind === 'actor_initiative' && visible.has(e.target)) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      m.get(e.source)!.add(e.target);
    }
    return m;
  }, [visible]);
  const sharedActors = useMemo(() => [...actorInitiatives.entries()].filter(([, s]) => s.size >= 2).map(([a]) => a), [actorInitiatives]);

  const proj = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const info = new Map<string, EdgeInfo>();
    const hulls: GHull[] = [];
    const groupOf = new Map<string, string>();
    const meta = new Map<string, { label: string; target?: { x: number; y: number }; color?: string }>();
    const sel = fn === 'all' ? null : (fn as FunctionId);

    // group centres
    const centers = new Map<string, { x: number; y: number }>();
    const shownInits = initiatives.filter((i) => visible.has(i.id));
    const progs = programmeNetworks.filter((p) => p.initiatives.length || initiatives.some((i) => i.programmeNetworks.includes(p.id)));
    const ring = (ids: string[], rx = 320, ry = 260) => ids.forEach((id, i, arr) => centers.set(id, arr.length === 1 ? { x: 0, y: 0 } : { x: Math.cos((i / arr.length) * Math.PI * 2 - Math.PI / 2) * rx, y: Math.sin((i / arr.length) * Math.PI * 2 - Math.PI / 2) * ry }));
    if (grouping === 'cluster') {
      const comps = initiativeComponents.filter((c) => c.members.some((m) => visible.has(m)));
      if (comps.length <= 4) comps.forEach((c, i) => centers.set(c.id, [{ x: -270, y: 0 }, { x: 270, y: 0 }, { x: -40, y: 200 }, { x: 40, y: -200 }][i]));
      else ring(comps.map((c) => c.id), 380, 300);
    }
    const groupOfInitiative = (iid: string) => {
      const i = initiativeById.get(iid)!;
      if (grouping === 'cluster') return componentOfInitiative(iid).id;
      if (grouping === 'programme') return contextGroupOf(i)?.id ?? 'none';
      return null;
    };
    if (grouping === 'programme') ring([...new Set(shownInits.map((i) => groupOfInitiative(i.id)!))]);
    for (const i of shownInits) {
      let target: { x: number; y: number } | undefined;
      const g = groupOfInitiative(i.id);
      if (g) target = centers.get(g);
      if (grouping === 'function') {
        const fs = functions.map((f) => f.id).filter((f) => evidenceCount(i.id, f) > 0);
        target = fs.length ? { x: fs.reduce((a, f) => a + HUBS[f].x, 0) / fs.length * 0.62, y: fs.reduce((a, f) => a + HUBS[f].y, 0) / fs.length * 0.62 } : { x: 0, y: 40 };
      }
      const relevant = !sel || evidenceCount(i.id, sel) > 0;
      nodes.push(initNode(i.id, { target, targetStrength: 0.12, r: expanded.has(i.id) ? 17 : 14, dim: !relevant, prominent: !!sel && relevant, outline: expanded.has(i.id) ? '#f4f5f0' : undefined, title: `${i.name} — double-click to ${expanded.has(i.id) ? 'collapse' : 'expand'} actors and episodes` }));
      if (g) groupOf.set(i.id, g);
    }
    // initiative–initiative source interconnections (the backbone)
    for (const e of sourceEdges.filter((e) => e.kind === 'initiative_initiative' && visible.has(e.source) && visible.has(e.target))) { links.push(sourceLink(e)); info.set(e.id, edgeInfoOf(e)); }

    // shared actors as bridges + actors of expanded initiatives
    const actorSet = new Set<string>(showShared ? sharedActors : []);
    for (const iid of expanded) actorsOfInitiative(iid).forEach((a) => actorSet.add(a));
    for (const a of actorSet) {
      const inits = [...(actorInitiatives.get(a) ?? [])];
      const shared = inits.length >= 2;
      const relevant = !sel || inits.some((i) => evidenceCount(i, sel) > 0);
      const seed = inits.find((i) => expanded.has(i)) ?? inits[0];
      nodes.push(actorNode(a, { seed, r: shared ? 8 : 6, dim: !relevant, alwaysLabel: shared && grouping !== 'function', title: `${actorNode(a).title}${shared ? ` — shared by ${inits.length} initiatives (source associations)` : ''}` }));
      const gs = new Set(inits.map(groupOfInitiative).filter(Boolean) as string[]);
      if (gs.size === 1) groupOf.set(a, [...gs][0]);
    }
    for (const e of sourceEdges.filter((e) => (e.kind === 'actor_initiative' || e.kind === 'responsible_entity') && actorSet.has(e.source) && visible.has(e.target))) {
      if (e.kind === 'responsible_entity' && !expanded.has(e.target)) continue;
      links.push(sourceLink(e)); info.set(e.id, edgeInfoOf(e));
    }
    // episodes of expanded initiatives
    for (const iid of expanded) for (const ep of episodesOfInitiative(iid)) {
      if (!nodes.some((n) => n.id === ep.id)) nodes.push(episodeNode(ep.id, { seed: iid, dim: !!sel && !episodeFunctions(ep).includes(sel) }));
      const id = `epi:${ep.id}:${iid}`;
      links.push({ id, source: ep.id, target: iid, kind: 'episode_initiative', color: '#e9eef2', width: 1.5, distance: 45, strength: 0.6 });
      info.set(id, { kind: 'episode_initiative', source: ep.id, target: iid });
      const g = groupOfInitiative(iid); if (g) groupOf.set(ep.id, g);
    }
    // grouping-specific anchors
    if (grouping === 'programme' && progs.length) {
      for (const p of progs) {
        nodes.push(progNode(p.id, { target: centers.get(p.id), targetStrength: 0.4 }));
        groupOf.set(p.id, p.id);
        for (const e of sourceEdges.filter((e) => e.kind === 'initiative_programme' && e.target === p.id)) { links.push(sourceLink(e, { distance: 70, strength: 0.2 })); info.set(e.id, edgeInfoOf(e)); }
      }
    }
    if (grouping === 'function') {
      for (const f of functions) nodes.push(fnNode(f.id, { target: HUBS[f.id], targetStrength: 0.5, dim: !!sel && sel !== f.id, prominent: sel === f.id }));
      for (const i of shownInits) for (const f of functions) {
        const n = evidenceCount(i.id, f.id);
        if (!n) continue;
        const id = `ev:${i.id}:${f.id}`;
        links.push({ id, source: i.id, target: fnNodeId(f.id), kind: 'episode_function', color: FUNCTION_COLORS[f.id], width: 1 + n, dash: '2 4', distance: 190, strength: 0.03, curve: 0.06, label: String(n), showLabel: true, dim: !!sel && sel !== f.id });
        info.set(id, { kind: 'episode_function', source: i.id, target: fnNodeId(f.id), count: n, label: `${n} curated episode(s) of this initiative carry a ${f.label.toLowerCase()} reading.` });
      }
    }
    // hulls + collapse metadata per group
    const groupLabel = (g: string) => grouping === 'cluster' ? initiativeComponents.find((c) => c.id === g)?.label ?? g : g === 'none' ? `No ${contextGroupLabel.toLowerCase()} recorded` : programmeById.get(g)?.name ?? (shownInits.map((i) => contextGroupOf(i)).find((x) => x?.id === g)?.label ?? g);
    const groupIds = [...new Set(groupOf.values())];
    groupIds.forEach((g, i) => {
      const color = grouping === 'cluster' ? INITIATIVE_COLORS[initiativeComponents.findIndex((c) => c.id === g) % INITIATIVE_COLORS.length] : '#c9d4dc';
      meta.set(g, { label: groupLabel(g), target: centers.get(g), color });
      void i;
    });
    const col = applyCollapse(nodes, links, groupOf, collapsed, meta);
    const present = new Set(col.nodes.map((n) => n.id));
    for (const g of groupIds) {
      const members = [...groupOf.entries()].filter(([n, gg]) => gg === g && present.has(n)).map(([n]) => n);
      if (members.length && !collapsed.has(g)) hulls.push({ id: `grp:${g}`, label: groupLabel(g), members, color: meta.get(g)!.color! });
    }
    return { nodes: col.nodes, links: col.links, hulls, info, aggregates: col.aggregates, groupOf, groupLabel };
  }, [fn, grouping, expanded, collapsed, showShared, visible, actorInitiatives, sharedActors]);

  const toggleExpand = (iid: string) => { const n = new Set(expanded); if (n.has(iid)) n.delete(iid); else n.add(iid); setExpanded(n); };
  const clusterInfo = (id: string): ClusterInfo | null => {
    const g = id.replace(/^cluster:/, '').replace(/^grp:/, '');
    const members = [...(proj.aggregates.get(`cluster:${g}`)?.members ?? []), ...[...proj.groupOf.entries()].filter(([, gg]) => gg === g).map(([n]) => n)];
    if (!members.length) return null;
    return {
      label: proj.groupLabel(g), rule: groupingRule(grouping), members: [...new Set(members)], expanded: !collapsed.has(g),
      onToggle: () => { const n = new Set(collapsed); if (n.has(g)) n.delete(g); else n.add(g); setCollapsed(n); select(null); },
    };
  };

  return (
    <div className="view view-graph">
      <div className="view-head">
        <div>
          <h2>Portfolio</h2>
          <p className="lede">{isLargeTerritory ? `Opens on the ${featuredInitiativeIds.length} featured entry points; all ${initiatives.length} records stay reachable.` : 'The eleven initiative records,'} {isLargeTerritory ? 'Initiatives, their source interconnections and the organizations they share.' : 'their source interconnections and the organizations they share.'} Double-click an initiative to open its organizations and episodes.</p>
        </div>
        <FunctionSelector />
      </div>
      <div className="rule-line">
        <label>Group by{' '}
          <select value={grouping} onChange={(e) => { setGrouping(e.target.value as Grouping); setCollapsed(new Set()); }}>
            <option value="cluster">Initiative cluster</option>
            <option value="programme">{contextGroupLabel}</option>
            <option value="function">Function (episode evidence)</option>
          </select>
        </label>
        {isLargeTerritory && <label>Show <select value={scope} onChange={(e) => { setScope(e.target.value as typeof scope); setCollapsed(new Set()); }} aria-label="Initiatives shown">
          <option value="featured">Featured entry points</option>
          <option value="linked">+ one step out (shared organizations)</option>
          <option value="all">All {initiatives.length} records</option>
        </select></label>}
        <span className="muted">{groupingRule(grouping)}</span>
        <label className="toggle"><input type="checkbox" checked={showShared} onChange={(e) => setShowShared(e.target.checked)} /> Shared organizations</label>
        {expanded.size > 0 && <button className="small-btn" onClick={() => setExpanded(new Set())}>Back to portfolio view</button>}
      </div>
      <div className="graph-and-matrix">
        <ForceGraph
          nodes={proj.nodes} links={proj.links} hulls={proj.hulls}
          layoutKey={`pf:${scope}:${grouping}:${fn}:${[...expanded].join(',')}:${[...collapsed].join(',')}:${showShared}`}
          selectedId={selectedNodeId(selection)} highlightIds={scopeSet(scopeInitiative)}
          ariaLabel="Portfolio network of initiatives"
          onSelect={(s) => select(toAppSelection(s, proj.info, clusterInfo))}
          onNodeDoubleClick={(id) => { if (initiativeById.has(id)) toggleExpand(id); else if (id.startsWith('cluster:')) clusterInfo(id)?.onToggle?.(); }}
          legend={<PortfolioLegend />}
          overlay={selection?.type === 'initiative' ? (
            <div className="graph-callout"><button onClick={() => toggleExpand(selection.id)}>{expanded.has(selection.id) ? 'Collapse' : 'Expand'} {initiativeById.get(selection.id)?.shortName}</button></div>
          ) : null}
        />
        <Matrix />
      </div>
    </div>
  );
}

function Matrix() {
  const { select, fn, selection } = useApp();
  return (
    <details className="matrix" open>
      <summary>Initiatives × functions <span className="muted small">(evidence counts: curated episodes, not scores)</span></summary>
      <div className="matrix-scroll">
        <table>
          <thead><tr><th>Initiative</th>{functions.map((f) => <th key={f.id} style={{ color: FUNCTION_COLORS[f.id] }} className={fn !== 'all' && fn !== f.id ? 'muted' : ''}>{f.label}</th>)}</tr></thead>
          <tbody>
            {(isLargeTerritory ? initiatives.filter((i) => featuredInitiativeIds.includes(i.id) || episodes.some((e) => e.initiativeIds.includes(i.id))) : initiatives).map((i) => (
              <tr key={i.id} className={selection?.id === i.id ? 'sel' : ''}>
                <th><button className="link-btn inline" onClick={() => select({ type: 'initiative', id: i.id })} lang="es">{i.shortName}</button></th>
                {functions.map((f) => {
                  const n = evidenceCount(i.id, f.id);
                  return <td key={f.id}>{n ? <button className="cell" style={{ ['--fn' as string]: FUNCTION_COLORS[f.id] }} onClick={() => select({ type: 'matrix', id: `${i.id}|${f.id}`, data: { initiativeId: i.id, functionId: f.id } })} aria-label={`${n} episode(s): ${i.shortName} × ${functionById.get(f.id)?.label}`}>{n}</button> : <span className="muted">·</span>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {episodes.some((e) => !e.initiativeIds.length) && <p className="small muted">{episodes.filter((e) => !e.initiativeIds.length).length} episodes are not tied to an initiative record (institutional responses); they appear in the functional repertoire only. Empty cells mean no episode coded in this selection.</p>}
      </div>
    </details>
  );
}

export function PortfolioLegend() {
  return (
    <div className="legend">
      <span><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#dafa62" stroke="#0d1823" /></svg>Initiative</span>
      <span><svg width="16" height="16"><circle cx="8" cy="8" r="4" fill="#9cedd8" /></svg>Organization</span>
      <span><svg width="26" height="10"><line x1="0" y1="5" x2="26" y2="5" stroke="#9fb7c7" strokeWidth="2.6" /></svg>Source interconnection</span>
      <span><svg width="26" height="10"><line x1="0" y1="5" x2="26" y2="5" stroke="#5f7689" strokeDasharray="5 4" /></svg>Shared affiliation</span>
      <span><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="none" stroke="#9cedd8" strokeDasharray="3 2" /></svg>Collapsed group</span>
    </div>
  );
}
