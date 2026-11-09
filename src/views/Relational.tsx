// Relational network as a hypergraph: contexts (initiatives, programme networks,
// episodes) group several organizations at once. Contexts start collapsed; opening
// one reveals its member organizations, each shown once and linked to every context
// it belongs to. A centrality menu ranks organizations or contexts.
import { useMemo, useState } from 'react';
import ForceGraph, { type GNode, type GLink, type GHull } from '../components/ForceGraph';
import { useApp } from '../state';
import { initiativeComponents, componentOfInitiative, initiativeColor, actorById, FUNCTION_COLORS, episodeById, episodeFunctions, isLargeTerritory, featuredInitiativeIds, programmeNetworks, initiatives, sourceEdges, territoryId, participantOf, type FunctionId } from '../data/model';
import { buildHyperedges, contextLinks, sharedMembers, computeCentrality, METRICS, type HyperType, type Metric } from '../data/hypergraph';
import type { EdgeInfo, ClusterInfo } from '../components/SidePanel';
import { actorNode, toAppSelection, selectedNodeId, scopeSet } from './projection';
import { FunctionSelector } from './FunctionSelector';

const TYPE_LABEL: Record<HyperType, string> = { initiative: 'Initiatives', programme: 'Programme networks', episode: 'Episodes' };
const TYPE_COLOR: Record<HyperType, string> = { initiative: '#dafa62', programme: '#d6dde3', episode: '#f4f5f0' };

export default function Relational() {
  const { selection, select, scopeInitiative, region, fn } = useApp();
  const [types, setTypes] = useState<Set<HyperType>>(new Set(isLargeTerritory ? ['initiative', 'episode'] : ['initiative', 'programme']));
  const [scope, setScope] = useState<'featured' | 'linked' | 'all'>(isLargeTerritory ? 'featured' : 'all');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const initiativeSubset = useMemo(() => {
    if (scope === 'all') return undefined;
    const base = new Set([...featuredInitiativeIds, ...added]);
    if (scope === 'featured') return base;
    // one step out: initiatives sharing a listed organization or a source interconnection with the base
    const orgs = new Set(sourceEdges.filter((e) => e.kind === 'actor_initiative' && base.has(e.target)).map((e) => e.source));
    const out = new Set(base);
    for (const e of sourceEdges) {
      if (e.kind === 'actor_initiative' && orgs.has(e.source)) out.add(e.target);
      if (e.kind === 'initiative_initiative' && (base.has(e.source) || base.has(e.target))) { out.add(e.source); out.add(e.target); }
    }
    return out;
  }, [scope, added]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [analysis, setAnalysis] = useState(false);
  const [metric, setMetric] = useState<Metric>('hyperdegree');
  const [rankWhat, setRankWhat] = useState<'orgs' | 'contexts'>('orgs');
  const [sizeByMetric, setSizeByMetric] = useState(true);
  const [minShared, setMinShared] = useState(2);

  const hs = useMemo(() => buildHyperedges(types, region, initiativeSubset), [types, region, initiativeSubset]);
  const central = useMemo(() => computeCentrality(hs, metric), [hs, metric]);
  const scoreOf = useMemo(() => {
    const m = new Map<string, number>();
    const all = [...central.orgs, ...central.contexts];
    const maxO = Math.max(...central.orgs.map((r) => r.value), 1e-9), maxC = Math.max(...central.contexts.map((r) => r.value), 1e-9);
    for (const r of all) m.set(r.id, r.kind === 'organization' ? r.value / maxO : r.value / maxC);
    return m;
  }, [central]);

  const proj = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const info = new Map<string, EdgeInfo>();
    const hulls: GHull[] = [];
    const sel = fn === 'all' ? null : (fn as FunctionId);
    const compPos = [{ x: -320, y: 40 }, { x: 320, y: 40 }, { x: -60, y: 300 }, { x: 60, y: -240 }];
    const progs = hs.filter((h) => h.type === 'programme');
    const showMetric = analysis && sizeByMetric;

    for (const h of hs) {
      const isOpen = open.has(h.id);
      const base = 11 + Math.sqrt(h.members.length) * 3.2;
      const r = showMetric && rankWhat === 'contexts' ? 9 + (scoreOf.get(h.id) ?? 0) * 18 : base;
      let target: { x: number; y: number } | undefined;
      if (h.type === 'initiative') target = compPos[initiativeComponents.indexOf(componentOfInitiative(h.id))];
      if (h.type === 'programme') { const k = progs.indexOf(h); target = { x: (k - (progs.length - 1) / 2) * 230, y: -330 }; }
      const fnRelevant = !sel || (h.type === 'episode' ? episodeFunctions(episodeById.get(h.id)!).includes(sel) : true);
      nodes.push({
        id: h.id, type: h.type === 'programme' ? 'programme' : h.type === 'episode' ? 'episode' : 'initiative',
        label: h.label, color: h.type === 'initiative' ? initiativeColor(h.id) : TYPE_COLOR[h.type], r: h.type === 'episode' ? Math.max(9, r * 0.75) : r,
        count: h.members.length, target, targetStrength: 0.06, alwaysLabel: true, outline: isOpen ? '#f4f5f0' : undefined, dim: !fnRelevant,
        ring: h.type === 'episode' ? episodeFunctions(episodeById.get(h.id)!).map((f) => FUNCTION_COLORS[f]) : undefined,
        title: `${TYPE_LABEL[h.type].replace(/s$/, '')}: ${h.label} — ${h.members.length} organization(s). Click to ${isOpen ? 'inspect; double-click to close' : 'open'}.`,
      });
    }
    // context–context: shared members (only when at least one side is closed) + source relations
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i], b = hs[j];
      if (open.has(a.id) && open.has(b.id)) continue;
      const sh = sharedMembers(a, b);
      if (!sh.length || sh.length < minShared) continue;
      const id = `shared:${a.id}|${b.id}`;
      links.push({ id, source: a.id, target: b.id, kind: 'shared', labelOnFocus: true, color: '#8aa1b4', width: Math.min(7, 0.8 + sh.length * 0.9), label: String(sh.length), distance: 150, strength: 0.04 + sh.length * 0.01, curve: 0.05 });
      info.set(id, { kind: 'shared_members', source: a.id, target: b.id, members: sh, count: sh.length });
    }
    for (const l of contextLinks(hs)) {
      const isEp = l.kind === 'episode_initiative';
      links.push({ id: l.id, source: l.source, target: l.target, kind: l.kind, color: isEp ? '#e9eef2' : l.kind === 'initiative_programme' ? '#5f7689' : '#9fb7c7', width: l.kind === 'initiative_initiative' ? 2.4 : 1.2, dash: l.kind === 'initiative_programme' ? '5 4' : undefined, distance: isEp ? 60 : 120, strength: isEp ? 0.4 : 0.08 });
      info.set(l.id, { kind: l.kind, source: l.source, target: l.target });
    }
    // open contexts: members, each shown once, linked to every context containing it
    const shownOrgs = new Set<string>();
    for (const h of hs) if (open.has(h.id)) h.members.forEach((m) => shownOrgs.add(m));
    for (const o of shownOrgs) {
      const seed = hs.find((h) => open.has(h.id) && h.members.includes(o))!.id;
      const s = scoreOf.get(o) ?? 0;
      nodes.push(actorNode(o, { seed, r: showMetric && rankWhat === 'orgs' ? 5 + s * 11 : 7, prominent: showMetric && rankWhat === 'orgs' && s > 0.6, alwaysLabel: showMetric && rankWhat === 'orgs' && s > 0.6 }));
      for (const h of hs) if (h.members.includes(o)) {
        const id = `mem:${h.id}:${o}`;
        const toOpen = open.has(h.id);
        links.push({ id, source: o, target: h.id, kind: 'hyper_membership', color: toOpen ? '#7f97aa' : '#56708a', width: 1.1, dash: toOpen ? undefined : '2 3', distance: toOpen ? 55 : 140, strength: toOpen ? 0.35 : 0.03 });
        const pp = h.type === 'episode' ? participantOf(h.id, o) : undefined;
        info.set(id, { kind: 'hyper_membership', source: o, target: h.id, role: pp?.role, status: pp?.status });
      }
    }
    for (const h of hs) if (open.has(h.id)) hulls.push({ id: `hx:${h.id}`, label: h.label, members: [h.id, ...h.members], color: h.type === 'initiative' ? initiativeColor(h.id) : TYPE_COLOR[h.type] });
    return { nodes, links, info, hulls };
  }, [hs, open, fn, analysis, sizeByMetric, rankWhat, scoreOf, minShared]);

  const toggleOpen = (id: string) => { const n = new Set(open); if (n.has(id)) n.delete(id); else n.add(id); setOpen(n); };
  const openContaining = (orgId: string) => { const n = new Set(open); hs.filter((h) => h.members.includes(orgId)).forEach((h) => n.add(h.id)); setOpen(n); select({ type: 'actor', id: orgId }); };
  const clusterInfo = (id: string): ClusterInfo | null => {
    const hid = id.replace(/^hx:/, '');
    const h = hs.find((x) => x.id === hid);
    if (!h) return null;
    return { label: h.label, rule: `Hyperedge (${TYPE_LABEL[h.type].toLowerCase().replace(/s$/, '')}): the organizations associated with it in the source.`, members: h.members, expanded: open.has(h.id), onToggle: () => toggleOpen(h.id) };
  };
  const ranking = rankWhat === 'orgs' ? central.orgs : central.contexts;
  const fmt = (v: number) => (metric === 'hyperdegree' ? String(v) : v.toFixed(3));
  const maxV = Math.max(...ranking.map((r) => r.value), 1e-9);

  return (
    <div className="view view-graph">
      <div className="view-head">
        <div>
          <h2>Relational network</h2>
          <p className="lede">A hypergraph: each context — an initiative{programmeNetworks.length ? ', a programme network' : ''} or an episode — groups several organizations{territoryId === 'urdaibai' ? ' or role groups' : ''} at once. Contexts start closed; open one to see who is inside. Organization-level structure, not a person-to-person network.</p>
        </div>
        <FunctionSelector />
      </div>
      <div className="rule-line">
        <span><b>Contexts:</b></span>
        {(['initiative', 'programme', 'episode'] as HyperType[]).filter((t) => t !== 'programme' || programmeNetworks.length > 0).map((t) => (
          <label key={t} className="toggle"><input type="checkbox" checked={types.has(t)} onChange={() => { const n = new Set(types); if (n.has(t)) { if (n.size > 1) n.delete(t); } else n.add(t); setTypes(n); }} /> {TYPE_LABEL[t]}</label>
        ))}
        {isLargeTerritory && (
          <label className="toggle">Initiatives <select value={scope} onChange={(e) => { setScope(e.target.value as typeof scope); setOpen(new Set()); }} aria-label="Initiative scope">
            <option value="featured">Featured slice ({featuredInitiativeIds.length + added.size})</option>
            <option value="linked">+ one step out (shared organizations)</option>
            <option value="all">All {initiatives.length} records</option>
          </select></label>
        )}
        {isLargeTerritory && (
          <span className="add-context">
            <input type="search" list="init-options" placeholder="Add an initiative…" value={search} onChange={(e) => {
              const v = e.target.value; setSearch(v);
              const hit = initiatives.find((i) => i.name === v);
              if (hit) { setAdded(new Set([...added, hit.id])); setSearch(''); if (scope === 'all') setScope('featured'); }
            }} aria-label="Add an initiative to the view" />
            <datalist id="init-options">{initiatives.map((i) => <option key={i.id} value={i.name} />)}</datalist>
          </span>
        )}
        <label className="toggle" title="Hide weak overlaps between contexts">Links with ≥ <select value={minShared} onChange={(e) => setMinShared(+e.target.value)} aria-label="Minimum shared organizations">{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select> shared orgs</label>
        <button className="small-btn" onClick={() => setOpen(new Set(hs.map((h) => h.id)))}>Open all</button>
        <button className="small-btn" onClick={() => setOpen(new Set())} disabled={!open.size}>Close all</button>
        <button className={`small-btn${analysis ? ' active' : ''}`} aria-pressed={analysis} onClick={() => setAnalysis(!analysis)}>Centrality analysis {analysis ? '▴' : '▾'}</button>
      </div>
      <div className={`graph-and-analysis${analysis ? ' with-analysis' : ''}`}>
        <ForceGraph
          nodes={proj.nodes} links={proj.links} hulls={proj.hulls}
          layoutKey={`hyper:${scope}:${[...added].join(',')}:${[...types].join(',')}:${[...open].sort().join(',')}:${region}:${minShared}:${analysis && sizeByMetric ? metric + rankWhat : ''}`}
          selectedId={selectedNodeId(selection)} highlightIds={scopeSet(scopeInitiative)}
          ariaLabel="Hypergraph of contexts and organizations"
          onSelect={(s) => {
            if (s.kind === 'node' && hs.some((h) => h.id === s.id) && !open.has(s.id)) toggleOpen(s.id);
            select(toAppSelection(s, proj.info, clusterInfo));
          }}
          onNodeDoubleClick={(id) => { if (open.has(id)) toggleOpen(id); }}
          legend={<HyperLegend />}
        />
        {analysis && (
          <aside className="analysis" aria-label="Centrality analysis">
            <label>Metric <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              {(Object.keys(METRICS) as Metric[]).map((m) => <option key={m} value={m}>{METRICS[m].label}</option>)}
            </select></label>
            <div className="seg">
              <button className={rankWhat === 'orgs' ? 'active' : ''} onClick={() => setRankWhat('orgs')}>Organizations</button>
              <button className={rankWhat === 'contexts' ? 'active' : ''} onClick={() => setRankWhat('contexts')} disabled={metric === 'eigenvector' && false}>Contexts</button>
            </div>
            <label className="toggle small"><input type="checkbox" checked={sizeByMetric} onChange={(e) => setSizeByMetric(e.target.checked)} /> Size nodes by this metric</label>
            <p className="small"><b>What it computes:</b> {METRICS[metric].graph}{metric === 'eigenvector' && rankWhat === 'contexts' ? ' For contexts: mean score of their members.' : ''}</p>
            <p className="small"><b>How to read it:</b> {METRICS[metric].reading}</p>
            <ol className="rank">
              {ranking.slice(0, 15).map((r) => (
                <li key={r.id}>
                  <button className="link-btn inline" lang="es" onClick={() => (r.kind === 'organization' ? openContaining(r.id) : (setOpen(new Set([...open, r.id])), select(toAppSelection({ kind: 'node', id: r.id }, proj.info, clusterInfo))))}>{r.label}</button>
                  <span className="bar"><i style={{ width: `${(r.value / maxV) * 100}%` }} /></span>
                  <span className="val">{fmt(r.value)}</span>
                </li>
              ))}
            </ol>
            <p className="small caveat">Computed on {hs.length} contexts and {central.orgs.length} organizations from source associations ({[...types].map((t) => TYPE_LABEL[t].toLowerCase()).join(', ')}). These are records of association, not observed interactions: a high value means an organization appears in many or bridging records, not that it is influential, trusted or collaborates more. Results change with the contexts included. Not used in any functional reading.</p>
          </aside>
        )}
      </div>
    </div>
  );
}

function HyperLegend() {
  return (
    <div className="legend">
      <span><svg width="18" height="18"><circle cx="9" cy="9" r="7" fill="#dafa62" stroke="#0d1823" /><text x="9" y="12" fontSize="8" textAnchor="middle" fill="#0d1823">n</text></svg>Initiative (n organizations)</span>
      {programmeNetworks.length > 0 && <span><svg width="18" height="18"><path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5Z" fill="#13283a" stroke="#d6dde3" strokeWidth="1.5" /></svg>Programme network</span>}
      <span><svg width="18" height="18"><path d="M9 2L15 9L9 16L3 9Z" fill="#f4f5f0" /></svg>Episode</span>
      <span><svg width="16" height="16"><circle cx="8" cy="8" r="4" fill="#9cedd8" /></svg>Organization</span>
      {territoryId === 'urdaibai' && <span><svg width="16" height="16"><circle cx="8" cy="8" r="4" fill="#e9dcc3" /></svg>Role group (unnamed people)</span>}
      <span><svg width="26" height="10"><line x1="0" y1="5" x2="26" y2="5" stroke="#8aa1b4" strokeWidth="3" /></svg>Shared organizations (count)</span>
    </div>
  );
}

export { actorById };
