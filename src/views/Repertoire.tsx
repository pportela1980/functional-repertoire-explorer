// Functional repertoire with progressive disclosure:
// level 0  four functions (links = episodes whose readings name both)
// level 1  a function opens into its configurations (collapsed)
// level 2  a configuration opens into its episodes
// level 3  an episode opens into its initiatives and initiative-level organizations
// Node identity and positions persist across levels and functions.
import { useEffect, useMemo, useState } from 'react';
import ForceGraph, { type GNode, type GLink, type GHull } from '../components/ForceGraph';
import { useApp } from '../state';
import { territoryId, episodes, functions, episodeFunctions, configurations, FUNCTION_COLORS, functionById, episodeById, type FunctionId } from '../data/model';
import type { EdgeInfo, ClusterInfo } from '../components/SidePanel';
import { initNode, actorNode, episodeNode, fnNode, fnNodeId, toAppSelection, selectedNodeId, scopeSet } from './projection';
import { FunctionSelector } from './FunctionSelector';

const HUB0: Record<FunctionId, { x: number; y: number }> = {
  mobilisation: { x: -260, y: -180 }, knowledge: { x: 260, y: -180 }, coordination: { x: 260, y: 180 }, support: { x: -260, y: 180 },
};
const cfgNodeId = (c: string) => `cfg:${c}`;

export default function Repertoire() {
  const { fn, set, selection, select, scopeInitiative } = useApp();
  const sel = fn === 'all' ? null : (fn as FunctionId);
  const [openCfg, setOpenCfg] = useState<Set<string>>(new Set());
  const [openEp, setOpenEp] = useState<Set<string>>(new Set());
  const narrow = useNarrow();
  useEffect(() => { setOpenCfg(new Set()); setOpenEp(new Set()); }, [fn]);

  const proj = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const info = new Map<string, EdgeInfo>();
    const hulls: GHull[] = [];
    const epCount = (f: FunctionId) => episodes.filter((e) => episodeFunctions(e).includes(f)).length;

    if (!sel) {
      // level 0: functions only
      for (const f of functions) nodes.push(fnNode(f.id, { target: HUB0[f.id], targetStrength: 0.4, r: 16 + epCount(f.id) * 2.2, count: epCount(f.id), title: `${f.label}: ${epCount(f.id)} curated episodes. ${f.definition} Click to open.` }));
      for (let i = 0; i < functions.length; i++) for (let j = i + 1; j < functions.length; j++) {
        const a = functions[i].id, b = functions[j].id;
        const both = episodes.filter((e) => { const fs = episodeFunctions(e); return fs.includes(a) && fs.includes(b); });
        if (!both.length) continue;
        const id = `co:${a}|${b}`;
        links.push({ id, source: fnNodeId(a), target: fnNodeId(b), kind: 'aggregate', color: '#9fb7c7', width: 1 + both.length * 0.7, label: String(both.length), distance: 300, strength: 0.01 });
        info.set(id, { kind: 'fn_cooccurrence', source: fnNodeId(a), target: fnNodeId(b), count: both.length, label: both.map((e) => e.title).join(' · ') });
      }
      return { nodes, links, info, hulls };
    }

    // level 1: selected function + its configurations; other functions shrink to the side
    const cfgs = configurations[sel];
    const others = functions.filter((f) => f.id !== sel);
    nodes.push(fnNode(sel, { target: narrow ? { x: 0, y: -260 } : openCfg.size ? { x: -300, y: 0 } : { x: -380, y: 0 }, targetStrength: 0.5, r: 26, count: epCount(sel), prominent: true }));
    if (!openCfg.size) others.forEach((f, j) => nodes.push(fnNode(f.id, { target: narrow ? { x: (j - 1) * 120, y: -420 } : { x: -560, y: (j - 1) * 150 }, targetStrength: 0.5, r: 12, dim: true, title: `${f.label} — click to switch` })));
    cfgs.forEach((c, k) => {
      const isOpen = openCfg.has(c.id);
      const openList = cfgs.filter((x) => openCfg.has(x.id)), closedList = cfgs.filter((x) => !openCfg.has(x.id));
      const target = narrow ? { x: 0, y: -60 + k * 300 }
        : !openCfg.size ? { x: 40 + (k % 2) * 60, y: (k - (cfgs.length - 1) / 2) * 260 }
        : isOpen ? { x: 0, y: (openList.indexOf(c) - (openList.length - 1) / 2) * 340 }
        : { x: -330, y: 230 + closedList.indexOf(c) * 110 };
      nodes.push({ id: cfgNodeId(c.id), type: 'cluster', label: c.label, color: FUNCTION_COLORS[sel], r: 14 + Math.sqrt(c.episodes.length) * 6, count: c.episodes.length, target, targetStrength: 0.25, alwaysLabel: true, outline: isOpen ? '#f4f5f0' : undefined, dim: openCfg.size > 0 && !isOpen, seed: fnNodeId(sel), title: `${c.label}: ${c.episodes.length} episode(s). ${c.rationale} ${isOpen ? 'Double-click to close.' : 'Click to open.'}` });
      const lid = `fc:${sel}:${c.id}`;
      links.push({ id: lid, source: fnNodeId(sel), target: cfgNodeId(c.id), kind: 'fn_config', color: FUNCTION_COLORS[sel], width: 2, dash: '2 4', distance: 220, strength: 0.05 });
      info.set(lid, { kind: 'fn_config', source: fnNodeId(sel), target: cfgNodeId(c.id) });
      if (!isOpen) return;
      // level 2: episodes of the open configuration
      const members: string[] = [cfgNodeId(c.id)];
      c.episodes.forEach((eid, m) => {
        const e = episodeById.get(eid)!;
        const epOpen = openEp.has(eid);
        nodes.push(episodeNode(eid, { dim: openEp.size > 0 && !epOpen && !c.episodes.some((x) => openEp.has(x)) ? true : openEp.size > 0 && !epOpen, seed: cfgNodeId(c.id), target: { x: target.x + 230 + (m % 2) * 50, y: target.y + (m - (c.episodes.length - 1) / 2) * 90 }, targetStrength: 0.08, r: 10, outline: epOpen ? '#f4f5f0' : undefined, title: `${e.title} — ${epOpen ? 'double-click to close' : 'click to open initiatives and organizations'}` }));
        members.push(eid);
        const id = `ce:${c.id}:${eid}`;
        links.push({ id, source: cfgNodeId(c.id), target: eid, kind: 'config_episode', color: FUNCTION_COLORS[sel], width: 1.4, distance: 90, strength: 0.4 });
        info.set(id, { kind: 'config_episode', source: cfgNodeId(c.id), target: eid });
        if (!epOpen) return;
        // level 3: initiatives and initiative-level organizations
        for (const i of e.initiativeIds) {
          if (!nodes.some((n) => n.id === i)) nodes.push(initNode(i, { seed: eid, r: 11 }));
          const iid = `epi:${eid}:${i}`;
          links.push({ id: iid, source: eid, target: i, kind: 'episode_initiative', color: '#e9eef2', width: 1.5, distance: 50, strength: 0.5 });
          info.set(iid, { kind: 'episode_initiative', source: eid, target: i });
          members.push(i);
        }
        for (const a of e.actorRecordIds) {
          if (!nodes.some((n) => n.id === a)) nodes.push(actorNode(a, { seed: eid }));
          const aid = `epa:${eid}:${a}`;
          const pp = e.participants?.find((p) => p.actorRecordId === a);
          const context = pp && pp.status !== 'reported_participation';
          links.push({ id: aid, source: eid, target: a, kind: 'episode_actor', color: context ? '#6c8193' : '#9aaebe', width: 1, dash: context ? '5 4' : '1 3', distance: 55, strength: 0.35 });
          info.set(aid, { kind: 'episode_actor', source: eid, target: a, role: pp?.role, status: pp?.status });
          members.push(a);
        }
      });
      hulls.push({ id: `hcfg:${c.id}`, label: c.label, members, color: FUNCTION_COLORS[sel] });
    });
    return { nodes, links, info, hulls };
  }, [sel, openCfg, openEp, narrow]);

  const toggle = (s: Set<string>, setS: (x: Set<string>) => void, id: string, force?: boolean) => { const n = new Set(s); if (force ?? !n.has(id)) n.add(id); else n.delete(id); setS(n); };
  const cfgOf = (id: string) => (sel ? configurations[sel].find((c) => cfgNodeId(c.id) === id || `hcfg:${c.id}` === id || `cluster:${c.id}` === id) : undefined);
  const clusterInfo = (id: string): ClusterInfo | null => {
    const c = cfgOf(id);
    if (!c || !sel) return null;
    return {
      label: `${c.label} — ${functionById.get(sel)!.label} configuration`,
      rule: `Analyst grouping of episodes whose ${functionById.get(sel)!.label.toLowerCase()} reading describes a similar kind of response. ${c.rationale}`,
      members: c.episodes, expanded: openCfg.has(c.id), onToggle: () => toggle(openCfg, setOpenCfg, c.id),
    };
  };
  const onSelect: Parameters<typeof ForceGraph>[0]['onSelect'] = (s) => {
    if (s.kind === 'node') {
      if (s.id.startsWith('fn:')) { const f = s.id.slice(3) as FunctionId; if (f !== sel) { set({ fn: f, selection: { type: 'function', id: f } }); return; } }
      const c = cfgOf(s.id);
      if (c) { toggle(openCfg, setOpenCfg, c.id, true); select({ type: 'config', id: s.id, data: { ...clusterInfo(s.id)!, expanded: true, onToggle: () => { toggle(openCfg, setOpenCfg, c.id, false); select(null); } } }); return; }
      if (episodeById.has(s.id)) toggle(openEp, setOpenEp, s.id, true);
    }
    select(toAppSelection(s, proj.info, clusterInfo));
  };
  const onDouble = (id: string) => {
    const c = cfgOf(id);
    if (c) { toggle(openCfg, setOpenCfg, c.id, false); return; }
    if (episodeById.has(id)) toggle(openEp, setOpenEp, id, false);
  };

  // breadcrumb
  const openCfgList = sel ? configurations[sel].filter((c) => openCfg.has(c.id)) : [];
  const lastEp = [...openEp].pop();
  return (
    <div className="view view-graph">
      <div className="view-head">
        <div>
          <h2>Functional repertoire</h2>
          <p className="lede">Start with the four functions. Open one to see the configurations in which it appears, then the episodes, then who was associated with them.</p>
        </div>
        <FunctionSelector allLabel="Overview" />
      </div>
      <nav className="crumbs" aria-label="Level">
        <button className={!sel ? 'here' : ''} onClick={() => set({ fn: 'all' })}>Four functions</button>
        {sel && <><span>›</span><button className={!openCfgList.length ? 'here' : ''} onClick={() => { setOpenCfg(new Set()); setOpenEp(new Set()); }} style={{ color: FUNCTION_COLORS[sel] }}>{functionById.get(sel)!.label}</button></>}
        {openCfgList.length > 0 && <><span>›</span><button className={!openEp.size ? 'here' : ''} onClick={() => setOpenEp(new Set())}>{openCfgList.length === 1 ? openCfgList[0].label : `${openCfgList.length} configurations`}</button></>}
        {lastEp && <><span>›</span><span className="here">{openEp.size === 1 ? episodeById.get(lastEp)!.title : `${openEp.size} episodes`}</span></>}
        <span className="muted small crumb-hint">{!sel ? 'Link numbers: episodes read through both functions. Click a function.' : !openCfgList.length ? 'Click a configuration to open its episodes.' : !openEp.size ? 'Click an episode (diamond) to see initiatives and organizations.' : 'Double-click an open node to close it.'}</span>
      </nav>
      <ForceGraph
        nodes={proj.nodes} links={proj.links} hulls={proj.hulls}
        layoutKey={`rep:${fn}:${[...openCfg].sort().join(',')}:${[...openEp].sort().join(',')}:${narrow}`}
        selectedId={selection?.type === 'config' ? selection.id : selectedNodeId(selection)} highlightIds={scopeSet(scopeInitiative)}
        ariaLabel={`Functional repertoire, ${sel ? functionById.get(sel)!.label : 'overview of four functions'}`}
        onSelect={onSelect} onNodeDoubleClick={onDouble}
        legend={<RepertoireLegend />}
      />
    </div>
  );
}

export function RepertoireLegend() {
  return (
    <div className="legend">
      <span><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#9cedd8" /></svg>Function</span>
      <span><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="none" stroke="#9cedd8" strokeDasharray="3 2" /></svg>Configuration (analyst grouping)</span>
      <span><svg width="16" height="16"><path d="M8 1L15 8L8 15L1 8Z" fill="#f4f5f0" /></svg>Episode (reported)</span>
      <span><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#dafa62" stroke="#0d1823" /></svg>Initiative</span>
      {territoryId === 'necocli'
        ? <span><svg width="16" height="16"><circle cx="8" cy="8" r="4" fill="#9cedd8" /></svg>Organization (initiative-level)</span>
        : <><span><svg width="16" height="16"><circle cx="8" cy="8" r="4" fill="#9cedd8" /></svg>Organization (reported participant)</span><span><svg width="16" height="16"><circle cx="8" cy="8" r="4" fill="#e9dcc3" /></svg>Role group</span><span><svg width="26" height="10"><line x1="0" y1="5" x2="26" y2="5" stroke="#6c8193" strokeDasharray="5 4" /></svg>Organiser / inferred role</span></>}
    </div>
  );
}

/** Narrow screens stack the layout vertically. */
export function useNarrow(limit = 700) {
  const [n, setN] = useState(() => window.innerWidth < limit);
  useEffect(() => { const f = () => setN(window.innerWidth < limit); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, [limit]);
  return n;
}
