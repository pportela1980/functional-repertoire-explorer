import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { setTerritory, territoryId, type FunctionId, type TerritoryId } from './data/model';
import { positionStore } from './components/ForceGraph';

export type Tab = 'territory' | 'listening' | 'system' | 'relational' | 'repertoire' | 'portfolio';
export const TABS: { id: Tab; label: string }[] = [
  { id: 'territory', label: 'Territory' },
  { id: 'listening', label: 'Listening' },
  { id: 'system', label: 'System dynamics' },
  { id: 'relational', label: 'Relational network' },
  { id: 'repertoire', label: 'Functional repertoire' },
  { id: 'portfolio', label: 'Portfolio' },
];

export type SelType = 'initiative' | 'actor' | 'programme' | 'episode' | 'function' | 'edge' | 'variable' | 'causal' | 'listening' | 'excerpt' | 'progress' | 'cluster' | 'config' | 'matrix';
export interface Sel { type: SelType; id: string; data?: unknown }

export interface AppState {
  territory: TerritoryId;
  tab: Tab; fn: FunctionId | 'all'; scopeInitiative: string | null; region: 'necocli' | 'all';
  selection: Sel | null; listeningQuery: string;
}
interface Ctx extends AppState {
  set: (p: Partial<AppState>) => void;
  select: (s: Sel | null) => void;
  go: (tab: Tab, p?: Partial<AppState>) => void;
  switchTerritory: (t: TerritoryId) => void;
}
const C = createContext<Ctx | null>(null);

const parseHash = (): Partial<AppState> => {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [tab, q] = h.split('?');
  const p = new URLSearchParams(q || '');
  const out: Partial<AppState> = {};
  if (tab && ['territory', 'listening', 'system', 'relational', 'repertoire', 'portfolio'].includes(tab)) out.tab = tab as Tab;
  out.territory = p.get('t') === 'urdaibai' ? 'urdaibai' : 'necocli'; // Necoclí is the default for links without a territory
  const fn = p.get('fn');
  if (fn && ['mobilisation', 'knowledge', 'coordination', 'support', 'all'].includes(fn)) out.fn = fn as AppState['fn'];
  if (p.get('init')) out.scopeInitiative = p.get('init');
  if (p.get('region') === 'all') out.region = 'all';
  const sel = p.get('sel');
  if (sel) { const i = sel.indexOf('~'); if (i > 0) out.selection = { type: sel.slice(0, i) as SelType, id: sel.slice(i + 1) }; }
  return out;
};

export function StateProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AppState>(() => ({ territory: 'necocli', tab: 'territory', fn: 'all', scopeInitiative: null, region: 'necocli', selection: null, listeningQuery: '', ...parseHash() }));
  // the data layer follows the state; idempotent when unchanged
  if (territoryId !== s.territory) { setTerritory(s.territory); positionStore.clear(); }
  useEffect(() => {
    const p = new URLSearchParams();
    if (s.territory !== 'necocli') p.set('t', s.territory);
    if (s.fn !== 'all') p.set('fn', s.fn);
    if (s.scopeInitiative) p.set('init', s.scopeInitiative);
    if (s.region === 'all') p.set('region', 'all');
    if (s.selection && !s.selection.data) p.set('sel', `${s.selection.type}~${s.selection.id}`);
    const q = p.toString();
    const next = `#/${s.tab}${q ? '?' + q : ''}`;
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [s]);
  const ctx: Ctx = {
    ...s,
    set: (p) => setS((o) => ({ ...o, ...p })),
    select: (sel) => setS((o) => ({ ...o, selection: sel })),
    go: (tab, p) => setS((o) => {
      // keep entity selections across tabs; drop view-specific ones (edges, groups, system-map items)
      const keep = o.selection && ['initiative', 'actor', 'programme', 'episode', 'function', 'listening', 'excerpt', 'progress'].includes(o.selection.type);
      return { ...o, selection: keep ? o.selection : null, ...p, tab };
    }),
    // keep the tab and function lens; clear everything that refers to records of the other territory
    switchTerritory: (t) => setS((o) => (o.territory === t ? o : { ...o, territory: t, selection: null, scopeInitiative: null, listeningQuery: '', region: 'necocli' })),
  };
  return <C.Provider value={ctx}>{children}</C.Provider>;
}
export const useApp = () => useContext(C)!;
