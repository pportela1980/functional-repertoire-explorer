import { useMemo, useState } from 'react';
import ForceGraph, { type GNode, type GLink, type GHull } from '../components/ForceGraph';
import { useApp } from '../state';
import { systemMap, territoryId } from '../data/model';
import { toAppSelection, selectedNodeId } from './projection';

const NEC_SECTOR: Record<string, { x: number; y: number; color: string }> = {
  production: { x: -300, y: -10, color: '#dafa62' },
  finance: { x: -300, y: 400, color: '#ffd27a' },
  tourism: { x: 420, y: 90, color: '#f6c58f' },
  crosscutting: { x: 120, y: -360, color: '#8dd5ee' },
};
const PALETTE = ['#dafa62', '#f6c58f', '#8dd5ee', '#ffd27a', '#c9b6ff', '#9cedd8', '#ee9fc6'];
const sectorPos = (): Record<string, { x: number; y: number; color: string }> => {
  if (territoryId === 'necocli') return NEC_SECTOR;
  const out: Record<string, { x: number; y: number; color: string }> = {};
  systemMap.sectors.forEach((s, i, arr) => { out[s.id] = { x: Math.cos((i / arr.length) * Math.PI * 2 - Math.PI / 2) * 380, y: Math.sin((i / arr.length) * Math.PI * 2 - Math.PI / 2) * 300, color: PALETTE[i % PALETTE.length] }; });
  return out;
};

export default function SystemMap() {
  const { selection, select } = useApp();
  const [showHyp, setShowHyp] = useState(false);
  const SECTOR = useMemo(sectorPos, []);
  const visibleLinks = useMemo(() => systemMap.links.filter((l) => !systemMap.hasHypotheses || showHyp || l.defaultVisible), [showHyp]);
  const proj = useMemo(() => {
    const nodes: GNode[] = systemMap.variables.map((v) => ({
      id: v.id, type: 'variable', label: v.label, color: SECTOR[v.sector].color, r: 22, target: SECTOR[v.sector], targetStrength: 0.2, alwaysLabel: true,
      title: `${v.label} (analyst synthesis)`,
    }));
    const links: GLink[] = visibleLinks.map((l) => ({
      id: l.id, source: l.from, target: l.to, kind: 'causal', directed: true, polarity: l.polarity,
      color: l.origin === 'hypothesis' ? (l.polarity === '+' ? '#3f7f6f' : '#9a5a50') : l.polarity === '+' ? '#5fbfa6' : '#e07a6a',
      dash: l.polarity === '-' ? '6 4' : l.origin === 'hypothesis' ? '2 3' : undefined, width: 1.8, distance: 160, strength: 0.03, curve: 0.12, label: l.polarity,
    }));
    const hulls: GHull[] = systemMap.sectors.map((s) => ({ id: `sector:${s.id}`, label: s.label, members: systemMap.variables.filter((v) => v.sector === s.id).map((v) => v.id), color: SECTOR[s.id].color }));
    return { nodes, links, hulls };
  }, [visibleLinks, SECTOR]);
  const visibleIds = new Set(visibleLinks.map((l) => l.id));
  const loops = systemMap.loops.map((l) => ({ ...l, visible: l.influenceIds.every((id) => visibleIds.has(id)) }));
  const selId = selection?.type === 'causal' ? selection.id : selectedNodeId(selection);
  return (
    <div className="view view-graph">
      <div className="view-head">
        <div>
          <h2>System dynamics</h2>
          <p className="lede">{territoryId === 'necocli'
            ? 'A modest influence map of territorial variables drawn from the 2026 listening reports. It is not an organization map; select a variable or arrow to see polarity, rationale and the report statement.'
            : `An earlier, exploratory influence map of Urdaibai, kept as supplied: ${systemMap.question ?? ''} It is an unvalidated analyst synthesis, separate from the episode evidence.`}</p>
        </div>
      </div>
      <div className="rule-line">
        <span><b>Reading rule:</b> arrows show direction; <span className="pol pos">+</span> same direction, <span className="pol neg">−</span> opposite direction. No weights, no simulation.{territoryId === 'necocli' ? ' The only loop (fund ↔ trust) is stated in both directions by the source.' : ' Interview references are reference-only, not quotation-level validation.'}</span>
        {systemMap.hasHypotheses && <label className="toggle"><input type="checkbox" checked={showHyp} onChange={(e) => setShowHyp(e.target.checked)} /> Show modeller hypotheses ({systemMap.links.filter((l) => !l.defaultVisible).length} links)</label>}
        {loops.length > 0 && <span className="muted">{loops.map((l) => `${l.name} (${l.type}): ${l.visible ? 'shown' : 'hidden — needs hypothesis links'}`).join(' · ')}</span>}
      </div>
      <ForceGraph
        nodes={proj.nodes} links={proj.links} hulls={proj.hulls} layoutKey={`system:${showHyp}`}
        selectedId={selId}
        ariaLabel="Influence map of territorial variables"
        onSelect={(s) => { if (s.kind === 'hull') return; select(toAppSelection(s, new Map(), () => null)); }}
        legend={
          <div className="legend">
            <span><svg width="30" height="16"><rect x="1" y="2" width="28" height="12" rx="6" fill="#13283a" stroke="#dafa62" /></svg>Variable (analyst synthesis)</span>
            <span><svg width="30" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#5fbfa6" strokeWidth="2" /><path d="M22 1L30 5L22 9Z" fill="#9cedd8" /></svg>+ influence</span>
            <span><svg width="30" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#e07a6a" strokeWidth="2" strokeDasharray="6 4" /><path d="M22 1L30 5L22 9Z" fill="#ff8f7a" /></svg>− influence</span>
            {systemMap.hasHypotheses && <span><svg width="30" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#3f7f6f" strokeWidth="2" strokeDasharray="2 3" /></svg>modeller hypothesis</span>}
          </div>
        }
      />
    </div>
  );
}
