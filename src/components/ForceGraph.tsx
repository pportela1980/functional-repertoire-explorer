// One interaction layer for every network view (relational, portfolio,
// functional repertoire, system dynamics). Views pass data projections; this
// component keeps node identity and positions across projections and animates
// changes by updating force targets, never by remounting or reseeding.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { select, type Selection } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { drag as d3drag } from 'd3-drag';
import { polygonHull } from 'd3-polygon';
import {
  forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY,
  type Simulation, type SimulationNodeDatum, type SimulationLinkDatum,
} from 'd3-force';
import 'd3-transition';

export type NodeType = 'initiative' | 'actor' | 'programme' | 'episode' | 'function' | 'cluster' | 'variable';
export interface GNode {
  id: string; type: NodeType; label: string; color: string; r: number;
  target?: { x: number; y: number }; targetStrength?: number;
  dim?: boolean; prominent?: boolean; ring?: string[]; count?: number; seed?: string;
  alwaysLabel?: boolean; outline?: string; doubleRing?: boolean; title?: string;
}
export interface GLink {
  id: string; source: string; target: string; kind: string; directed?: boolean; polarity?: '+' | '-';
  color?: string; width?: number; dash?: string; dim?: boolean; distance?: number; strength?: number; curve?: number; label?: string; showLabel?: boolean; labelOnFocus?: boolean;
}
export interface GHull { id: string; label: string; members: string[]; color: string }
export type GraphSelection = { kind: 'node' | 'link' | 'hull'; id: string } | { kind: 'background' };

interface SimNode extends SimulationNodeDatum, GNode { pinned?: boolean }
interface SimLink extends SimulationLinkDatum<SimNode> { data: GLink }

/** Shared position store: the same id keeps its position across tabs and projections. */
export const positionStore = new Map<string, { x: number; y: number; pinned?: boolean }>();

const reducedMotionQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

interface Props {
  nodes: GNode[]; links: GLink[]; hulls?: GHull[]; selectedId?: string | null;
  onSelect: (s: GraphSelection) => void; onNodeDoubleClick?: (id: string) => void;
  layoutKey: string; ariaLabel: string; legend?: ReactNode; overlay?: ReactNode; highlightIds?: Set<string> | null;
  /** Small embedded graph: fewer controls. */ compact?: boolean;
}

const hexPath = (r: number) => {
  const p = [...Array(6)].map((_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`; });
  return `M${p.join('L')}Z`;
};
const diamondPath = (r: number) => `M0,${-r * 1.25}L${r * 1.1},0L0,${r * 1.25}L${-r * 1.1},0Z`;
const variableWidth = (label: string) => Math.min(170, Math.max(96, label.length * 5.6 + 18));

export default function ForceGraph(props: Props) {
  const { nodes, links, hulls = [], selectedId, layoutKey, ariaLabel, legend, overlay, highlightIds, compact } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodeMap = useRef(new Map<string, SimNode>());
  const linkData = useRef<SimLink[]>([]);
  const hullData = useRef<GHull[]>([]);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const pendingFit = useRef(true);
  /** True once the person pans/zooms after the last layout change; then we stop auto-fitting. */
  const userMoved = useRef(false);
  const autoFitEnd = useRef(true);
  const lastLayoutKey = useRef<string | null>(null);
  const cbRef = useRef(props);
  cbRef.current = props;
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [presentation, setPresentation] = useState<boolean>(() => !!reducedMotionQuery?.matches);
  const presentationRef = useRef(presentation);
  presentationRef.current = presentation;
  const [hint, setHint] = useState<string | null>(null);

  const reduced = () => !!reducedMotionQuery?.matches;

  // ---------- one-time setup
  useEffect(() => {
    const svg = select(svgRef.current!);
    svg.selectAll('*').remove();
    const defs = svg.append('defs');
    for (const [id, color] of [['arrow-pos', '#9cedd8'], ['arrow-neg', '#ff8f7a'], ['arrow', '#8aa1b4']] as const) {
      defs.append('marker').attr('id', id).attr('viewBox', '0 -5 10 10').attr('refX', 9).attr('refY', 0).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4.5L10,0L0,4.5').attr('fill', color);
    }
    const root = svg.append('g').attr('class', 'zoom-layer');
    root.append('g').attr('class', 'hulls');
    root.append('g').attr('class', 'links');
    root.append('g').attr('class', 'link-labels');
    root.append('g').attr('class', 'nodes');
    root.append('g').attr('class', 'hull-labels');

    const z = d3zoom<SVGSVGElement, unknown>().scaleExtent([0.25, 5]).on('zoom', (ev) => {
      if (ev.sourceEvent) userMoved.current = true;
      transformRef.current = ev.transform;
      root.attr('transform', ev.transform.toString());
      const k = ev.transform.k;
      svg.classed('zoomed-in', k > 1.35).classed('zoomed-out', k < 0.7);
      svg.style('--label-scale', String(1 / Math.sqrt(Math.max(k, 0.4))));
    });
    zoomRef.current = z;
    svg.call(z).on('dblclick.zoom', null);
    svg.on('click', (ev) => { if (ev.target === svgRef.current) cbRef.current.onSelect({ kind: 'background' }); });

    const sim = forceSimulation<SimNode, SimLink>([])
      .velocityDecay(0.38)
      .alphaDecay(0.034)
      .force('link', forceLink<SimNode, SimLink>([]).id((d) => d.id)
        .distance((l) => l.data.distance ?? 60).strength((l) => l.data.strength ?? 0.25))
      .force('charge', forceManyBody<SimNode>().strength((d) => (d.type === 'variable' ? -420 : -60 - d.r * 9)).distanceMax(420))
      .force('collide', forceCollide<SimNode>((d) => (d.type === 'variable' ? variableWidth(d.label) / 2 + 4 : d.r + 7)).strength(0.9))
      .force('x', forceX<SimNode>((d) => d.target?.x ?? 0).strength((d) => (d.target ? d.targetStrength ?? 0.09 : 0.015)))
      .force('y', forceY<SimNode>((d) => d.target?.y ?? 0).strength((d) => (d.target ? d.targetStrength ?? 0.09 : 0.015)))
      .on('tick', () => render())
      .on('end', () => { savePositions(); maybeFit(); if (autoFitEnd.current && !userMoved.current) { autoFitEnd.current = false; fit(); } });
    simRef.current = sim;

    const ro = new ResizeObserver(() => { if (!pendingFit.current) return; maybeFit(true); });
    ro.observe(wrapRef.current!);
    return () => { savePositions(); sim.stop(); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePositions = () => {
    for (const n of nodeMap.current.values()) {
      if (Number.isFinite(n.x) && Number.isFinite(n.y)) positionStore.set(n.id, { x: n.x!, y: n.y!, pinned: n.pinned });
    }
  };

  const maybeFit = (force = false) => {
    const sim = simRef.current;
    if (!sim) return;
    if (!nodeMap.current.size) return;
    if (pendingFit.current && (force || sim.alpha() < 0.06 || pausedRef.current)) { pendingFit.current = false; fit(); }
  };

  const fit = (animate = true) => {
    const svgEl = svgRef.current, z = zoomRef.current;
    if (!svgEl || !z) return;
    const all = [...nodeMap.current.values()];
    const pts = all.filter((n) => !n.dim).length >= 3 ? all.filter((n) => !n.dim) : all;
    if (!pts.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of pts) {
      const w = n.type === 'variable' ? variableWidth(n.label) / 2 + 20 : n.r + 95;
      x0 = Math.min(x0, n.x! - w); x1 = Math.max(x1, n.x! + w); y0 = Math.min(y0, n.y! - n.r - 42); y1 = Math.max(y1, n.y! + n.r + 30);
    }
    const { width, height } = svgEl.getBoundingClientRect();
    if (!width || !height) return;
    // keep clear of the toolbar (top) and legend (bottom)
    const top = compact ? 34 : 50, bottom = compact ? 8 : 34;
    const h = Math.max(60, height - top - bottom);
    const k = Math.min(2.2, 0.92 * Math.min(width / Math.max(1, x1 - x0), h / Math.max(1, y1 - y0)));
    const t = zoomIdentity.translate(width / 2 - (k * (x0 + x1)) / 2, top + h / 2 - (k * (y0 + y1)) / 2).scale(k);
    const s = select(svgEl);
    if (animate && !reduced()) s.transition().duration(650).call(z.transform, t);
    else s.call(z.transform, t);
  };

  // ---------- rendering (called on every tick)
  const render = () => {
    const svg = select(svgRef.current!);
    const nm = nodeMap.current;
    svg.select('g.nodes').selectAll<SVGGElement, SimNode>('g.node').attr('transform', (d) => `translate(${d.x!.toFixed(1)},${d.y!.toFixed(1)})`);
    const linkPath = (l: SimLink) => {
      const s = l.source as SimNode, t = l.target as SimNode;
      let x1 = s.x!, y1 = s.y!, x2 = t.x!, y2 = t.y!;
      const dx = x2 - x1, dy = y2 - y1, dist = Math.hypot(dx, dy) || 1;
      const c = l.data.curve ?? 0;
      const mx = (x1 + x2) / 2 - (dy / dist) * c * dist, my = (y1 + y2) / 2 + (dx / dist) * c * dist;
      if (l.data.directed) {
        const tr = t.type === 'variable' ? Math.min(variableWidth(t.label) / 2, 22) + 6 : t.r + 4;
        const ex = x2 - mx, ey = y2 - my, ed = Math.hypot(ex, ey) || 1;
        x2 -= (ex / ed) * tr; y2 -= (ey / ed) * tr;
        const sr = s.type === 'variable' ? 16 : s.r;
        const sx = mx - x1, sy = my - y1, sd = Math.hypot(sx, sy) || 1;
        x1 += (sx / sd) * sr; y1 += (sy / sd) * sr;
      }
      return c ? `M${x1.toFixed(1)},${y1.toFixed(1)}Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}` : `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`;
    };
    svg.select('g.links').selectAll<SVGPathElement, SimLink>('path').attr('d', linkPath);
    svg.select('g.link-labels').selectAll<SVGGElement, SimLink>('g.link-label').attr('transform', (l) => {
      const s = l.source as SimNode, t = l.target as SimNode;
      const dx = t.x! - s.x!, dy = t.y! - s.y!, dist = Math.hypot(dx, dy) || 1, c = l.data.curve ?? 0;
      const mx = (s.x! + t.x!) / 2 - (dy / dist) * c * dist * 0.5, my = (s.y! + t.y!) / 2 + (dx / dist) * c * dist * 0.5;
      return `translate(${mx.toFixed(1)},${my.toFixed(1)})`;
    });
    // hulls
    const hullPts = (h: GHull) => {
      const pts: [number, number][] = [];
      for (const id of h.members) {
        const n = nm.get(id);
        if (!n || !Number.isFinite(n.x)) continue;
        const pad = (n.type === 'variable' ? variableWidth(n.label) / 2 : n.r) + 16;
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pts.push([n.x! + pad * Math.cos(a), n.y! + pad * Math.sin(a)]); }
      }
      return pts;
    };
    svg.select('g.hulls').selectAll<SVGPathElement, GHull>('path.hull').attr('d', (h) => {
      const hull = polygonHull(hullPts(h));
      return hull ? `M${hull.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L')}Z` : '';
    });
    svg.select('g.hull-labels').selectAll<SVGTextElement, GHull>('text').attr('transform', (h) => {
      const pts = hullPts(h);
      if (!pts.length) return 'translate(-9999,-9999)';
      let minY = Infinity, sx = 0;
      for (const p of pts) { if (p[1] < minY) minY = p[1]; sx += p[0]; }
      return `translate(${(sx / pts.length).toFixed(1)},${(minY - 6).toFixed(1)})`;
    });
    if (pendingFit.current && simRef.current && simRef.current.alpha() < 0.06) maybeFit();
  };

  // ---------- data updates: reuse node objects by id
  useEffect(() => {
    const sim = simRef.current!;
    const nm = nodeMap.current;
    const nextIds = new Set(nodes.map((n) => n.id));
    for (const [id, n] of nm) if (!nextIds.has(id)) { positionStore.set(id, { x: n.x!, y: n.y!, pinned: n.pinned }); nm.delete(id); }
    for (const g of nodes) {
      let n = nm.get(g.id);
      if (!n) {
        const stored = positionStore.get(g.id);
        const seed = g.seed ? nm.get(g.seed) ?? positionStore.get(g.seed) : undefined;
        const jitter = () => (Math.random() - 0.5) * 30;
        const base = stored ?? (seed ? { x: seed.x! + jitter(), y: seed.y! + jitter() } : g.target ? { x: g.target.x + jitter() * 2, y: g.target.y + jitter() * 2 } : { x: jitter() * 6, y: jitter() * 6 });
        n = { ...g, x: base.x, y: base.y, pinned: stored?.pinned };
        if (n.pinned) { n.fx = n.x; n.fy = n.y; }
        nm.set(g.id, n);
      } else {
        Object.assign(n, g);
      }
    }
    const simNodes = [...nm.values()];
    linkData.current = links.filter((l) => nm.has(l.source) && nm.has(l.target)).map((l) => ({ source: l.source, target: l.target, data: l }));
    hullData.current = hulls;
    sim.nodes(simNodes);
    (sim.force('link') as ReturnType<typeof forceLink<SimNode, SimLink>>).links(linkData.current);
    // re-initialise accessor-based forces so new targets/strengths apply
    sim.force('x', forceX<SimNode>((d) => d.target?.x ?? 0).strength((d) => (d.pinned ? 0 : d.target ? d.targetStrength ?? 0.09 : 0.015)));
    sim.force('y', forceY<SimNode>((d) => d.target?.y ?? 0).strength((d) => (d.pinned ? 0 : d.target ? d.targetStrength ?? 0.09 : 0.015)));
    sim.force('collide', forceCollide<SimNode>((d) => (d.type === 'variable' ? variableWidth(d.label) / 2 + 4 : d.r + 7)).strength(0.9));

    joinDom();
    const layoutChanged = lastLayoutKey.current !== layoutKey;
    if (layoutChanged) { pendingFit.current = true; autoFitEnd.current = true; userMoved.current = false; }
    lastLayoutKey.current = layoutKey;

    if (presentationRef.current || reduced()) settleAndAnimate();
    else if (!pausedRef.current) sim.alpha(layoutChanged ? 0.75 : 0.35).restart();
    else render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, hulls, layoutKey]);

  /** Stable presentation: compute the settled layout, then tween once (or jump with reduced motion). */
  const settleAndAnimate = () => {
    const sim = simRef.current!;
    sim.stop();
    const nm = [...nodeMap.current.values()];
    const start = new Map(nm.map((n) => [n.id, { x: n.x!, y: n.y! }]));
    sim.alpha(0.9);
    for (let i = 0; i < 320; i++) sim.tick();
    const end = new Map(nm.map((n) => [n.id, { x: n.x!, y: n.y! }]));
    for (const n of nm) { n.vx = 0; n.vy = 0; }
    if (reduced()) { render(); savePositions(); pendingFit.current = true; maybeFit(true); return; }
    const t0 = performance.now(), dur = 750;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      for (const n of nm) { const a = start.get(n.id)!, b = end.get(n.id)!; n.x = a.x + (b.x - a.x) * e; n.y = a.y + (b.y - a.y) * e; }
      render();
      if (p < 1) requestAnimationFrame(step); else { savePositions(); maybeFit(true); }
    };
    requestAnimationFrame(step);
  };

  const joinDom = () => {
    const svg = select(svgRef.current!);
    const nm = nodeMap.current;
    // hulls
    svg.select('g.hulls').selectAll<SVGPathElement, GHull>('path.hull').data(hullData.current, (h) => h.id).join(
      (enter) => enter.append('path').attr('class', 'hull').style('opacity', 0).call((e) => e.transition().duration(reduced() ? 0 : 500).style('opacity', 1)),
    ).attr('fill', (h) => h.color).attr('stroke', (h) => h.color)
      .on('click', (ev, h) => { ev.stopPropagation(); cbRef.current.onSelect({ kind: 'hull', id: h.id }); });
    svg.select('g.hull-labels').selectAll<SVGTextElement, GHull>('text').data(hullData.current, (h) => h.id).join('text')
      .attr('class', 'hull-label').attr('text-anchor', 'middle').attr('fill', (h) => h.color).text((h) => h.label)
      .on('click', (ev, h) => { ev.stopPropagation(); cbRef.current.onSelect({ kind: 'hull', id: h.id }); });

    // links: visible path + wide hit path
    const L = linkData.current;
    svg.select('g.links').selectAll<SVGPathElement, SimLink>('path').data(L.flatMap((l) => [{ ...l, hit: false }, { ...l, hit: true }]) as (SimLink & { hit: boolean })[], (l: any) => `${l.data.id}|${l.hit}`)
      .join((enter) => enter.append('path').style('opacity', 0).call((e) => e.transition().duration(reduced() ? 0 : 450).style('opacity', null)))
      .attr('class', (l: any) => (l.hit ? 'link-hit' : `link kind-${l.data.kind}`))
      .attr('data-id', (l: any) => l.data.id)
      .attr('stroke', (l: any) => (l.hit ? 'transparent' : l.data.color ?? '#6f8597'))
      .attr('stroke-width', (l: any) => (l.hit ? 12 : l.data.width ?? 1.2))
      .attr('stroke-dasharray', (l: any) => (l.hit ? null : l.data.dash ?? null))
      .attr('marker-end', (l: any) => (!l.hit && l.data.directed ? `url(#${l.data.polarity === '-' ? 'arrow-neg' : l.data.polarity === '+' ? 'arrow-pos' : 'arrow'})` : null))
      .attr('fill', 'none')
      .on('click', (ev, l: any) => { ev.stopPropagation(); cbRef.current.onSelect({ kind: 'link', id: l.data.id }); })
      .each(function (l: any) { select(this).select('title').remove(); if (l.hit) select(this).append('title').text(l.data.label ?? l.data.kind); });
    svg.select('g.links').selectAll<SVGPathElement, any>('path.link-hit').raise();

    svg.select('g.link-labels').selectAll<SVGGElement, SimLink>('g.link-label').data(L.filter((l) => l.data.label && (l.data.polarity || l.data.kind === 'aggregate' || l.data.showLabel || l.data.labelOnFocus)), (l) => l.data.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'link-label');
        g.append('circle').attr('r', 8);
        g.append('text').attr('dy', '0.35em').attr('text-anchor', 'middle');
        return g;
      })
      .attr('data-id', (l) => l.data.id)
      .classed('polarity', (l) => !!l.data.polarity)
      .classed('neg', (l) => l.data.polarity === '-')
      .select('text').text((l) => (l.data.polarity ? (l.data.polarity === '+' ? '+' : '−') : l.data.label!));

    // nodes
    const sel = svg.select('g.nodes').selectAll<SVGGElement, SimNode>('g.node').data([...nm.values()], (d) => d.id);
    sel.exit().transition().duration(reduced() ? 0 : 300).style('opacity', 0).remove();
    const enter = sel.enter().append('g').attr('class', 'node').attr('tabindex', 0).attr('role', 'button')
      .attr('transform', (d) => `translate(${d.x},${d.y})`).style('opacity', 0);
    enter.transition().duration(reduced() ? 0 : 450).style('opacity', null);
    enter.append('circle').attr('class', 'hit');
    enter.append('path').attr('class', 'shape');
    enter.append('g').attr('class', 'ring');
    enter.append('text').attr('class', 'count').attr('text-anchor', 'middle').attr('dy', '0.35em');
    enter.append('text').attr('class', 'pin').attr('text-anchor', 'middle').text('⦿');
    enter.append('text').attr('class', 'label');
    const all = enter.merge(sel);
    all.attr('data-id', (d) => d.id).attr('aria-label', (d) => `${d.type}: ${d.label}`)
      .attr('class', (d) => `node type-${d.type}${d.prominent ? ' prominent' : ''}${d.alwaysLabel ? ' always-label' : ''}${d.pinned ? ' pinned' : ''}`);
    all.select('circle.hit').attr('r', (d) => (d.type === 'variable' ? 0 : Math.max(d.r + 6, 14)));
    all.select<SVGPathElement>('path.shape').attr('d', (d) => {
      if (d.type === 'programme') return hexPath(d.r);
      if (d.type === 'episode') return diamondPath(d.r);
      if (d.type === 'variable') { const w = variableWidth(d.label), h = 34; return `M${-w / 2 + 10},${-h / 2}H${w / 2 - 10}A10,10 0 0 1 ${w / 2},${-h / 2 + 10}V${h / 2 - 10}A10,10 0 0 1 ${w / 2 - 10},${h / 2}H${-w / 2 + 10}A10,10 0 0 1 ${-w / 2},${h / 2 - 10}V${-h / 2 + 10}A10,10 0 0 1 ${-w / 2 + 10},${-h / 2}Z`; }
      const r = d.r;
      return `M${-r},0a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
    })
      .attr('fill', (d) => (d.type === 'variable' ? '#13283a' : d.type === 'cluster' ? 'rgba(156,237,216,0.08)' : d.type === 'programme' ? '#13283a' : d.color))
      .attr('stroke', (d) => d.outline ?? (d.type === 'variable' || d.type === 'programme' || d.type === 'cluster' ? d.color : '#0d1823'))
      .attr('stroke-width', (d) => (d.type === 'cluster' ? 1.6 : d.type === 'programme' ? 2.4 : d.type === 'variable' ? 1.8 : d.doubleRing ? 3 : 1.5))
      .attr('stroke-dasharray', (d) => (d.type === 'cluster' ? '4 3' : null));
    all.select('g.ring').each(function (d) {
      const g = select(this);
      const ring = d.ring ?? [];
      g.selectAll('circle').data(ring).join('circle').attr('r', 3.2).attr('fill', (c) => c)
        .attr('cx', (_, i) => (d.r + 5) * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / Math.max(ring.length, 1)))
        .attr('cy', (_, i) => (d.r + 5) * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / Math.max(ring.length, 1)));
    });
    all.select('text.count').text((d) => (d.count != null && d.type !== 'actor' && d.type !== 'variable' ? String(d.count) : ''));
    all.select('text.pin').attr('dy', (d) => -d.r - 4);
    all.select<SVGTextElement>('text.label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (d.type === 'variable' ? '0.35em' : d.type === 'function' ? d.r + 17 : d.r + 13))
      .each(function (d) {
        const t = select(this);
        t.selectAll('tspan').remove();
        if (d.type === 'variable') {
          // wrap into two lines inside the pill
          const words = d.label.split(' '); const lines: string[] = []; let cur = '';
          const max = Math.floor((variableWidth(d.label) - 14) / 5.6);
          for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
          lines.push(cur);
          const shown = lines.slice(0, 2);
          t.text(null);
          shown.forEach((ln, i) => t.append('tspan').attr('x', 0).attr('dy', i === 0 ? `${-0.55 * (shown.length - 1) + 0.35}em` : '1.1em').text(ln));
          t.attr('dy', null);
        } else {
          const short = d.label.length > 34 ? d.label.slice(0, 32) + '…' : d.label;
          t.text(short);
        }
      });
    all.selectAll('title').remove();
    all.append('title').text((d) => d.title ?? d.label);

    all.on('click', (ev, d) => { ev.stopPropagation(); cbRef.current.onSelect({ kind: 'node', id: d.id }); })
      .on('dblclick', (ev, d) => {
        ev.stopPropagation();
        if (d.pinned) { d.pinned = false; d.fx = null; d.fy = null; positionStore.set(d.id, { x: d.x!, y: d.y!, pinned: false }); select(ev.currentTarget as SVGGElement).classed('pinned', false); if (!pausedRef.current) simRef.current!.alpha(0.3).restart(); }
        else cbRef.current.onNodeDoubleClick?.(d.id);
      })
      .on('keydown', (ev: KeyboardEvent, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cbRef.current.onSelect({ kind: 'node', id: d.id }); } })
      .on('mouseenter', (_, d) => highlight(d.id, true))
      .on('mouseleave', () => highlight(null, true));

    all.call(
      d3drag<SVGGElement, SimNode>().clickDistance(4)
        .on('start', (ev, d) => { dragStart.current = { x: ev.x, y: ev.y, moved: false, wasPinned: !!d.pinned }; })
        .on('drag', (ev, d) => {
          const st = dragStart.current!;
          if (!st.moved && Math.hypot(ev.x - st.x, ev.y - st.y) < 4) return;
          if (!st.moved) { st.moved = true; if (!pausedRef.current && !presentationRef.current) simRef.current!.alphaTarget(0.25).restart(); }
          d.fx = ev.x; d.fy = ev.y;
          if (pausedRef.current || presentationRef.current) { d.x = ev.x; d.y = ev.y; render(); }
        })
        .on('end', (ev, d) => {
          const st = dragStart.current;
          if (!st?.moved) return;
          if (!ev.active) simRef.current!.alphaTarget(0);
          d.pinned = true;
          positionStore.set(d.id, { x: d.fx!, y: d.fy!, pinned: true });
          select(ev.sourceEvent?.target?.closest?.('g.node') ?? null).classed('pinned', true);
          svg.selectAll<SVGGElement, SimNode>('g.node').classed('pinned', (n) => !!n.pinned);
          setHint('Node pinned. Double-click it to release.');
          window.setTimeout(() => setHint(null), 2600);
        }),
    );
    applyHighlight();
    render();
  };

  // ---------- selection / hover emphasis
  const hoverId = useRef<string | null>(null);
  const dragStart = useRef<{ x: number; y: number; moved: boolean; wasPinned: boolean } | null>(null);
  const highlight = (id: string | null, hover: boolean) => { if (hover) hoverId.current = id; applyHighlight(); };
  const applyHighlight = () => {
    const svg = select(svgRef.current!);
    const sel = cbRef.current.selectedId ?? null;
    const focus = hoverId.current ?? sel;
    const extra = cbRef.current.highlightIds ?? null;
    const neighbours = new Set<string>();
    let linkFocus: string | null = null;
    if (focus) {
      neighbours.add(focus);
      for (const l of linkData.current) {
        const s = (l.source as SimNode).id ?? (l.source as unknown as string), t = (l.target as SimNode).id ?? (l.target as unknown as string);
        if (l.data.id === focus) { linkFocus = l.data.id; neighbours.add(s); neighbours.add(t); }
        if (s === focus) neighbours.add(t);
        if (t === focus) neighbours.add(s);
      }
      const hull = hullData.current.find((h) => h.id === focus);
      if (hull) hull.members.forEach((m) => neighbours.add(m));
    }
    const active = !!focus && (nodeMap.current.has(focus) || !!linkFocus || hullData.current.some((h) => h.id === focus));
    const inExtra = (id: string) => !extra || extra.has(id);
    svg.select('g.nodes').selectAll<SVGGElement, SimNode>('g.node')
      .classed('faded', (d) => (active ? !neighbours.has(d.id) : !inExtra(d.id)) || (!!d.dim && !(active && neighbours.has(d.id))))
      .classed('selected', (d) => d.id === sel)
      .classed('neighbour', (d) => active && neighbours.has(d.id) && d.id !== focus)
      .classed('focus', (d) => d.id === focus);
    svg.select('g.links').selectAll<SVGPathElement, SimLink>('path.link')
      .classed('faded', (l) => {
        const s = (l.source as SimNode).id, t = (l.target as SimNode).id;
        if (active) return !(l.data.id === linkFocus || s === focus || t === focus || (hullData.current.find((h) => h.id === focus)?.members.includes(s) && hullData.current.find((h) => h.id === focus)?.members.includes(t)));
        return !!l.data.dim || !(inExtra(s) && inExtra(t));
      })
      .classed('selected', (l) => l.data.id === sel);
    svg.select('g.link-labels').selectAll<SVGGElement, SimLink>('g.link-label')
      .classed('visible', (l) => {
        const s = (l.source as SimNode).id, t = (l.target as SimNode).id;
        return l.data.kind === 'aggregate' || !!l.data.showLabel || (active && (l.data.id === linkFocus || s === focus || t === focus));
      });
  };
  useEffect(() => { applyHighlight(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedId, highlightIds, nodes]);

  // ---------- controls
  const togglePause = () => {
    const sim = simRef.current!;
    if (pausedRef.current) { pausedRef.current = false; setPaused(false); if (!presentationRef.current) sim.alpha(0.3).restart(); }
    else { pausedRef.current = true; setPaused(true); sim.stop(); savePositions(); }
  };
  const reset = () => {
    for (const n of nodeMap.current.values()) { n.pinned = false; n.fx = null; n.fy = null; positionStore.set(n.id, { x: n.x!, y: n.y!, pinned: false }); }
    select(svgRef.current!).selectAll('g.node').classed('pinned', false);
    pendingFit.current = true;
    cbRef.current.onSelect({ kind: 'background' });
    if (presentationRef.current || reduced()) settleAndAnimate();
    else { pausedRef.current = false; setPaused(false); simRef.current!.alpha(0.8).restart(); }
  };
  const togglePresentation = () => {
    const next = !presentationRef.current;
    presentationRef.current = next;
    setPresentation(next);
    if (next) settleAndAnimate();
    else if (!pausedRef.current) simRef.current!.alpha(0.3).restart();
  };
  const zoomBy = (f: number) => { const s = select(svgRef.current!); const z = zoomRef.current!; if (reduced()) s.call(z.scaleBy, f); else s.transition().duration(250).call(z.scaleBy, f); };

  return (
    <div className={`graph-wrap${compact ? ' compact' : ''}`} ref={wrapRef}>
      <svg ref={svgRef} className="graph" role="img" aria-label={ariaLabel} data-testid="graph" />
      <div className="graph-toolbar" role="toolbar" aria-label="Graph controls">
        <button onClick={() => fit()} title="Fit view">Fit</button>
        {!compact && <button onClick={() => zoomBy(1.3)} title="Zoom in" aria-label="Zoom in">+</button>}
        {!compact && <button onClick={() => zoomBy(1 / 1.3)} title="Zoom out" aria-label="Zoom out">−</button>}
        <button onClick={togglePause} aria-pressed={paused} title={paused ? 'Resume motion' : 'Pause motion'}>{paused ? 'Resume' : 'Pause'}</button>
        {!compact && <button onClick={togglePresentation} aria-pressed={presentation} title="Stable presentation: settle the layout, then stop moving">{presentation ? 'Live motion' : 'Stable view'}</button>}
        <button onClick={reset} title="Release pins, clear selection and re-settle">Reset</button>
      </div>
      {hint && <div className="graph-hint" role="status">{hint}</div>}
      {overlay}
      {legend && <div className="graph-legend">{legend}</div>}
    </div>
  );
}

export type { Selection };
