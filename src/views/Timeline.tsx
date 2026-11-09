// Interactive timeline: when programme networks, initiatives, episodes, listening and
// organization records appear in the source. Dates are record or report dates; relations
// have no dates in the source. For large territories the time-sliced network shows dated
// episodes and their participants instead of every record.
import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph, { type GNode, type GLink } from '../components/ForceGraph';
import { useApp } from '../state';
import {
  initiatives, actors, listeningRecords, sourceEdges, initiativeColor, actorFirstDate, componentOfInitiative, initiativeComponents,
  episodes, territory, territoryId, isLargeTerritory, FUNCTION_COLORS, episodeFunctions,
  type ProgrammeNetwork,
} from '../data/model';
import { initNode, actorNode, progNode, episodeNode, sourceLink, edgeInfoOf, toAppSelection, selectedNodeId } from './projection';
import type { EdgeInfo } from '../components/SidePanel';

const RANGE: Record<string, { start: string; end: string }> = { necocli: { start: '2023-12', end: '2026-08' }, urdaibai: { start: '2023-01', end: '2026-03' } };
const midCut = (t: string, n = 30) => (t.length <= n ? t : `${t.slice(0, 13)}…${t.slice(-(n - 14))}`);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Timeline({ programmes }: { programmes: ProgrammeNetwork[] }) {
  const { select, selection, region } = useApp();
  const R = RANGE[territoryId];
  const START = { y: +R.start.slice(0, 4), m: +R.start.slice(5, 7) - 1 };
  const END = { y: +R.end.slice(0, 4), m: +R.end.slice(5, 7) - 1 };
  const monthIdx = (iso: string) => (+iso.slice(0, 4) - START.y) * 12 + (+iso.slice(5, 7) - 1 - START.m);
  const NM = (END.y - START.y) * 12 + (END.m - START.m) + 1;
  const monthLabel = (i: number) => { const m = START.m + i; return `${MONTHS[m % 12]} ${START.y + Math.floor(m / 12)}`; };

  const [t, setT] = useState(NM - 1);
  const [playing, setPlaying] = useState(false);
  const [undated, setUndated] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setT((v) => { if (v >= NM - 1) { setPlaying(false); return v; } return v + 1; }), reduced() ? 120 : 420);
    return () => window.clearInterval(id);
  }, [playing, NM]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(520, Math.round(el.getBoundingClientRect().width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const LABEL_W = W < 700 ? 150 : 200, PLOT = W - LABEL_W - 16;
  const x = (i: number) => LABEL_W + (clamp(i, 0, NM) / NM) * PLOT;
  const rowH = 15;

  // ---------- lanes
  const listening = useMemo(() => listeningRecords.filter((r) => (region === 'all' || r.necocli) && r.date && r.kind !== 'event_record' && r.profileType !== 'narrative_profile'), [region]);
  const histoOf = (dates: string[]) => { const h = new Array(NM).fill(0); for (const d of dates) { const i = monthIdx(d); if (i >= 0 && i < NM) h[i]++; } return h; };
  const listenHisto = useMemo(() => histoOf(listening.map((r) => r.date!)), [listening]); // eslint-disable-line react-hooks/exhaustive-deps
  const initHisto = useMemo(() => histoOf(initiatives.filter((i) => i.date).map((i) => i.date!)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const dated = useMemo(() => actors.filter((a) => !a.kinds.includes('role_group') && !a.addedInThisBuild).map((a) => ({ a, d: actorFirstDate(a) })).filter((x) => x.d && monthIdx(x.d) < NM && monthIdx(x.d) >= 0), []); // eslint-disable-line react-hooks/exhaustive-deps
  const undatedCount = actors.filter((a) => !a.kinds.includes('role_group') && !a.addedInThisBuild && !actorFirstDate(a)).length;
  const initRows = !isLargeTerritory;
  const sortedInits = useMemo(() => [...initiatives].filter((i) => i.date).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')), []);
  const datedEpisodes = useMemo(() => episodes.filter((e) => e.time?.date).map((e) => ({ e, i: monthIdx(e.time!.date!) })).filter((x) => x.i >= 0 && x.i < NM).sort((a, b) => a.i - b.i), []); // eslint-disable-line react-hooks/exhaustive-deps
  const milestones = (territory.milestones ?? []).map((m) => ({ ...m, i: monthIdx(m.date) }));

  let y = 28;
  const yProg = y; if (programmes.length) y += programmes.length * rowH + 22;
  const yInit = y; const histH = 40; y += initRows ? sortedInits.length * rowH + 22 : histH + 26;
  const yEp = y; if (datedEpisodes.length) y += datedEpisodes.length * rowH + 22;
  const yMil = y; if (milestones.length) y += 38;
  const yHist = y; const hasListenHist = listenHisto.some((v) => v > 0); if (hasListenHist) y += histH + 22;
  const yOrg = y;
  const perMonth = new Map<number, number>();
  const orgDots = dated.map(({ a, d }) => { const i = monthIdx(d!); const k = perMonth.get(i) ?? 0; perMonth.set(i, k + 1); return { a, i, k }; });
  const orgRows = Math.max(...[...perMonth.values()], 1);
  y += Math.min(orgRows, 14) * 7 + 18;
  const H = y;

  const setFromPointer = (clientX: number) => {
    const svg = svgRef.current; if (!svg) return;
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    setT(clamp(Math.floor(((vx - LABEL_W) / PLOT) * NM), 0, NM - 1));
  };
  const dragging = useRef(false);

  // ---------- network present at time t
  const graph = useMemo(() => {
    const present = new Set<string>();
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const info = new Map<string, EdgeInfo>();
    if (isLargeTerritory) {
      // dated episodes and their reported participants (incidence: one spoke per participant)
      for (const { e, i } of datedEpisodes) {
        if (i > t) continue;
        nodes.push(episodeNode(e.id, { r: 9 }));
        for (const iid of e.initiativeIds) { if (!present.has(iid)) { present.add(iid); nodes.push(initNode(iid, { r: 10, seed: e.id })); } const id = `epi:${e.id}:${iid}`; links.push({ id, source: e.id, target: iid, kind: 'episode_initiative', color: '#e9eef2', width: 1.4, distance: 50, strength: 0.5 }); info.set(id, { kind: 'episode_initiative', source: e.id, target: iid }); }
        for (const p of e.participants ?? []) {
          if (!present.has(p.actorRecordId)) { present.add(p.actorRecordId); nodes.push(actorNode(p.actorRecordId, { r: 5, seed: e.id })); }
          const id = `epa:${e.id}:${p.actorRecordId}`;
          links.push({ id, source: e.id, target: p.actorRecordId, kind: 'episode_actor', color: '#9aaebe', width: 1, dash: p.status === 'reported_participation' ? '1 3' : '4 4', distance: 55, strength: 0.35 });
          info.set(id, { kind: 'episode_actor', source: e.id, target: p.actorRecordId, role: p.role, status: p.status });
        }
      }
      return { nodes, links, info, counts: { p: 0, i: nodes.filter((n) => n.type === 'initiative').length, a: nodes.filter((n) => n.type === 'actor').length, e: nodes.filter((n) => n.type === 'episode').length } };
    }
    const compPos = [{ x: -220, y: 0 }, { x: 220, y: 0 }, { x: 0, y: 200 }, { x: 0, y: -200 }];
    for (const p of programmes) if (p.duration && monthIdx(p.duration.start) <= t) { present.add(p.id); nodes.push(progNode(p.id, { r: 12 })); }
    for (const i of initiatives) if (i.date && monthIdx(i.date) <= t) {
      present.add(i.id);
      nodes.push(initNode(i.id, { r: 11, target: compPos[initiativeComponents.indexOf(componentOfInitiative(i.id))], targetStrength: 0.05 }));
    }
    for (const a of actors) {
      const d = actorFirstDate(a);
      if ((d && monthIdx(d) <= t) || (!d && undated)) { present.add(a.id); nodes.push(actorNode(a.id, { r: 5 })); }
    }
    for (const e of sourceEdges) {
      if (!present.has(e.source) || !present.has(e.target)) continue;
      links.push(sourceLink(e)); info.set(e.id, edgeInfoOf(e));
    }
    return { nodes, links, info, counts: { p: nodes.filter((n) => n.type === 'programme').length, i: nodes.filter((n) => n.type === 'initiative').length, a: nodes.filter((n) => n.type === 'actor').length, e: 0 } };
  }, [t, undated, programmes]); // eslint-disable-line react-hooks/exhaustive-deps
  const listenedSoFar = listenHisto.slice(0, t + 1).reduce((a, b) => a + b, 0);
  const initsSoFar = initHisto.slice(0, t + 1).reduce((a, b) => a + b, 0);

  const yearTicks = Array.from({ length: END.y - START.y + 1 }, (_, k) => START.y + k).map((yr) => ({ i: monthIdx(`${yr}-01-01`), label: String(yr) })).filter((d) => d.i > 0 && d.i < NM);
  const past = (i: number) => i <= t;
  const maxL = Math.max(...listenHisto, 1), maxI = Math.max(...initHisto, 1);

  return (
    <section className="timeline-section" aria-label="Timeline">
      <div className="tl-head">
        <h3>How actors and initiatives appear</h3>
        <div className="tl-controls">
          <button className="primary" onClick={() => { if (t >= NM - 1) setT(0); setPlaying(!playing); }} aria-pressed={playing}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
          <input type="range" min={0} max={NM - 1} value={t} onChange={(e) => { setPlaying(false); setT(+e.target.value); }} aria-label="Timeline month" />
          <b className="tl-date">{monthLabel(t)}</b>
          {!isLargeTerritory && <label className="toggle small"><input type="checkbox" checked={undated} onChange={(e) => setUndated(e.target.checked)} /> include {undatedCount} undated organizations</label>}
        </div>
      </div>
      <p className="small muted tl-caveat">{territoryId === 'necocli'
        ? 'Dates are those of the source records: programme durations, initiative start/end, listening dates, and the date of each organization\'s record (not when it began to take part). Relations carry no date in the source, so in the network a link appears once both of its ends are recorded.'
        : 'K-tool project and agent dates are record dates (mostly 2025), not when the work began. Episodes are placed at their stated date (signing, session or report date); undated episodes are not shown. The network beside shows dated episodes with their reported participants as they occur.'}</p>
      <div className="tl-grid">
        <div className="tl-svg-wrap" ref={wrapRef}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="tl-svg" role="img" aria-label={`Timeline up to ${monthLabel(t)}`}
            onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); setPlaying(false); setFromPointer(e.clientX); }}
            onPointerMove={(e) => { if (dragging.current) setFromPointer(e.clientX); }}
            onPointerUp={() => { dragging.current = false; }}>
            {yearTicks.map((d) => <g key={d.label}><line x1={x(d.i)} x2={x(d.i)} y1={14} y2={H} className="tl-year" /><text x={x(d.i) + 4} y={16} className="tl-axis">{d.label}</text></g>)}
            {programmes.length > 0 && <text x={8} y={yProg - 6} className="tl-lane">Programme networks</text>}
            {programmes.map((p, k) => {
              if (!p.duration) return null;
              const a = monthIdx(p.duration.start), b = monthIdx(p.duration.end);
              const yy = yProg + k * rowH;
              return (
                <g key={p.id} className={`tl-item${past(a) ? '' : ' future'}${selection?.id === p.id ? ' sel' : ''}`} onClick={(e) => { e.stopPropagation(); select({ type: 'programme', id: p.id }); }} onPointerDown={(e) => e.stopPropagation()}>
                  <text x={LABEL_W - 8} y={yy + 10} textAnchor="end" className="tl-label">{p.name}</text>
                  <rect x={x(a)} y={yy + 2} width={Math.max(3, x(Math.min(b, NM)) - x(a))} height={rowH - 5} rx={3} className="tl-prog" />
                  {b >= NM && <text x={W - 14} y={yy + 10} className="tl-more">→ {p.duration.end.slice(0, 4)}</text>}
                </g>
              );
            })}
            {initRows ? (<>
              <text x={8} y={yInit - 6} className="tl-lane">Initiatives (start → end)</text>
              {sortedInits.map((i, k) => {
                const a = monthIdx(i.date!), b = i.endDate ? monthIdx(i.endDate) : a + 1;
                const yy = yInit + k * rowH;
                return (
                  <g key={i.id} className={`tl-item${past(a) ? '' : ' future'}${selection?.id === i.id ? ' sel' : ''}`} onClick={(e) => { e.stopPropagation(); select({ type: 'initiative', id: i.id }); }} onPointerDown={(e) => e.stopPropagation()}>
                    <text x={LABEL_W - 8} y={yy + 10} textAnchor="end" className="tl-label" lang="es">{i.shortName.length > 30 ? i.shortName.slice(0, 29) + '…' : i.shortName}</text>
                    <rect x={x(a)} y={yy + 2} width={Math.max(4, x(b + 1) - x(a))} height={rowH - 5} rx={3} fill={initiativeColor(i.id)} />
                  </g>
                );
              })}
            </>) : (<>
              <text x={8} y={yInit - 6} className="tl-lane">Initiative records / month (record date)</text>
              {initHisto.map((v, i) => v > 0 && <rect key={i} x={x(i) + 1} y={yInit + histH - (v / maxI) * histH} width={Math.max(2, PLOT / NM - 2)} height={(v / maxI) * histH} className={`tl-hist alt${past(i) ? '' : ' future'}`}><title>{`${monthLabel(i)}: ${v} records`}</title></rect>)}
              <rect x={LABEL_W} y={yInit + histH} width={PLOT} height={0.6} className="tl-baseline" />
            </>)}
            {datedEpisodes.length > 0 && <text x={8} y={yEp - 6} className="tl-lane">Episodes (stated date)</text>}
            {datedEpisodes.map(({ e, i }, k) => {
              const yy = yEp + k * rowH;
              const fns = episodeFunctions(e);
              return (
                <g key={e.id} className={`tl-item${past(i) ? '' : ' future'}${selection?.id === e.id ? ' sel' : ''}`} onClick={(ev) => { ev.stopPropagation(); select({ type: 'episode', id: e.id }); }} onPointerDown={(ev) => ev.stopPropagation()}>
                  <text x={LABEL_W - 8} y={yy + 10} textAnchor="end" className="tl-label"><title>{e.title}</title>{midCut(e.title)}</text>
                  <path d={`M${x(i) + 5},${yy + 1}L${x(i) + 11},${yy + 7}L${x(i) + 5},${yy + 13}L${x(i) - 1},${yy + 7}Z`} className="tl-ep" />
                  {fns.map((f, j) => <circle key={f} cx={x(i) + 16 + j * 7} cy={yy + 7} r={2.6} fill={FUNCTION_COLORS[f]} />)}
                </g>
              );
            })}
            {milestones.length > 0 && <>
              <text x={8} y={yMil + 6} className="tl-lane">Listening process</text>
              {milestones.map((m, k) => <g key={m.label} className={`tl-item${past(m.i) ? '' : ' future'}`}><line x1={x(m.i) + 3} x2={x(m.i) + 3} y1={yMil - 4} y2={yMil + 22} className="tl-mil" /><text x={x(m.i) + 7} y={yMil + 6 + (k % 2) * 13} className="tl-note"><title>{m.label}</title>{m.label.split(' (')[0]}</text></g>)}
            </>}
            {hasListenHist && <>
              <text x={8} y={yHist - 6} className="tl-lane">Listening &amp; perception records / month</text>
              {listenHisto.map((v, i) => v > 0 && (
                <rect key={i} x={x(i) + 1} y={yHist + histH - (v / maxL) * histH} width={Math.max(2, PLOT / NM - 2)} height={(v / maxL) * histH} className={`tl-hist${past(i) ? '' : ' future'}`}><title>{`${monthLabel(i)}: ${v} records`}</title></rect>
              ))}
              <rect x={LABEL_W} y={yHist + histH} width={PLOT} height={0.6} className="tl-baseline" />
              {territoryId === 'necocli' && <><text x={x(monthIdx('2024-03-01'))} y={yHist + histH + 13} className="tl-note">First listening phase (2024)</text>
                <text x={W - 16} y={yHist + histH + 13} textAnchor="end" className="tl-note">Second listening phase (2026)</text></>}
            </>}
            <text x={8} y={yOrg - 6} className="tl-lane">Organization records (record date)</text>
            {orgDots.map(({ a, i, k }) => (
              <circle key={a.id} cx={x(i) + PLOT / NM / 2} cy={yOrg + 4 + Math.min(k, 13) * 7} r={3} className={`tl-org${past(i) ? '' : ' future'}${selection?.id === a.id ? ' sel' : ''}`}
                onClick={(e) => { e.stopPropagation(); select({ type: 'actor', id: a.id }); }} onPointerDown={(e) => e.stopPropagation()}><title>{`${a.name} — record dated ${actorFirstDate(a)}`}</title></circle>
            ))}
            <text x={LABEL_W - 8} y={yOrg + 10} textAnchor="end" className="tl-label muted">+ {undatedCount} without date</text>
            <line x1={x(t + 1)} x2={x(t + 1)} y1={20} y2={H} className="tl-playhead" />
          </svg>
        </div>
        <div className="tl-graph">
          <div className="tl-counts small">By <b>{monthLabel(t)}</b>: {isLargeTerritory
            ? `${graph.counts.e} dated episodes · ${graph.counts.a} participants (organizations and role groups) · ${initsSoFar} initiative records`
            : `${graph.counts.p} programme networks · ${graph.counts.i} initiatives · ${graph.counts.a} organizations · ${listenedSoFar} listening/perception records`}</div>
          <ForceGraph nodes={graph.nodes} links={graph.links} layoutKey={`tl:${Math.floor(t / 6)}:${undated}`} ariaLabel={`Network recorded up to ${monthLabel(t)}`}
            selectedId={selectedNodeId(selection)} onSelect={(s) => select(toAppSelection(s, graph.info, () => null))} compact />
        </div>
      </div>
    </section>
  );
}
