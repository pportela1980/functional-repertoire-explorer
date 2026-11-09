import { useEffect, useState } from 'react';
import { StateProvider, useApp, TABS } from './state';
import SidePanel from './components/SidePanel';
import { initiativeById, functionById, FUNCTION_COLORS, counts, unresolvedInterconnections, episodes, territoryId, territory, TERRITORIES, type TerritoryId } from './data/model';
import Territory from './views/Territory';
import Listening from './views/Listening';
import SystemMap from './views/SystemMap';
import Relational from './views/Relational';
import Repertoire from './views/Repertoire';
import Portfolio from './views/Portfolio';


function Method({ onClose }: { onClose: () => void }) {
  return (
    <div className="method" role="dialog" aria-label="Method">
      <button className="close" onClick={onClose} aria-label="Close method">×</button>
      <h3>Method: functional repertoire lens</h3>
      <p>Complex territorial challenges call for combinations of collective functions distributed across networks. Portfolios of initiatives can activate different relational configurations, exercise those functions and create possibilities for subsequent responses. Organizations persist across activities; which configuration becomes relevant depends on the demand. <em>Functional repertoire</em> is the set of responses a collective can bring into play under different conditions — not a list of projects and not individual skills.</p>
      <ul>
        <li><b>Mobilisation</b> — activating people and resources in response to a demand.</li>
        <li><b>Knowledge recombination</b> — bringing different situated and technical knowledge into a collective response.</li>
        <li><b>Coordination</b> — aligning interdependent actions, commitments and responsibilities.</li>
        <li><b>Mutual support</b> — making assistance and shared resources available to participants facing needs or constraints.</li>
      </ul>
      <h4>Four labels of provenance</h4>
      <ul>
        {territoryId === 'necocli' ? (<>
          <li><span className="prov prov-source_record">Source record</span> API snapshot of 5 Nov 2026 ({counts.records} records) and the two 2026 listening reports. Spanish text is shown unchanged.</li>
          <li><span className="prov prov-reported_episode">Reported episode</span> {episodes.length} episodes described in the reports (8 curated in the brief, 2 added in this build). Titles and summaries are English framing.</li>
        </>) : (<>
          <li><span className="prov prov-source_record">Source record</span> K-tool public project listing (9 Nov 2026: {counts.initiatives - 2} projects, agents recovered through project fields), the API-derived v2 listening corpus (Basque and Spanish excerpts, unchanged) and the ALC / AC4 final report.</li>
          <li><span className="prov prov-reported_episode">Reported episode</span> {episodes.length} episodes (7 curated in the pack, {episodes.filter((e) => e.addedInThisBuild).length} added in this build from the final report and the corpus). Participants carry the role and status stated in the evidence; role groups stand for unnamed people.</li>
        </>)}
        <li><span className="prov prov-functional_interpretation">Functional interpretation</span> Analytical readings of an episode through a function. Editable in <code>content/</code>.</li>
        <li><span className="prov prov-analyst_synthesis">Analyst synthesis</span> Groupings of configurations and the system-dynamics map.</li>
      </ul>
      <h4>What this version does not do</h4>
      <p>No predictions, scenarios, simulations, recommendations or scores of the collective. Counts in the portfolio matrix are numbers of curated episodes. The centrality menu in the relational view computes standard network measures on source associations; they describe position in the records, not influence or collaboration, and are not used in any functional reading. Source interconnections are associations, never causal claims or measured ties; programme co-membership is shown as shared affiliation, not cooperation. {territoryId === 'necocli' ? 'Episode–organization links are initiative-level associations and do not assert attendance.' : 'Episode participants are those named in the evidence; organiser and inferred roles are marked; no individual is named.'} {unresolvedInterconnections.length} interconnections with a single known endpoint are retained in the data and not drawn. No people are invented; personal names in individual perception responses and participant lists in listening records are not displayed. {territory.comparisonNote ?? 'The two territories use different sources and sampling; they are not ranked against each other.'}</p>
      <p className="muted small">Data notes: see DATA-NOTES.md in the repository.</p>
    </div>
  );
}

function Shell() {
  const { tab, go, scopeInitiative, set, fn, selection, territory: tid, switchTerritory } = useApp();
  const [method, setMethod] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  useEffect(() => { if (selection && panelCollapsed && window.innerWidth < 980) setPanelCollapsed(false); }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.title = `${TABS.find((t) => t.id === tab)?.label} · ${territory.name} · Functional repertoire`; }, [tab, tid]);
  return (
    <div className={`app${selection ? ' with-panel' : ''}`}>
      <header className="top">
        <div className="brand">
          <strong>FUNCTIONAL REPERTOIRE</strong>
          <span className="sub">Territorial case explorer</span>
        </div>
        <div className="territory-switch" role="radiogroup" aria-label="Case study">
          {TERRITORIES.map((t) => (
            <button key={t.id} role="radio" aria-checked={tid === t.id} className={tid === t.id ? 'active' : ''} onClick={() => switchTerritory(t.id as TerritoryId)}>
              <b>{t.label}</b><span>{t.country}</span>
            </button>
          ))}
        </div>
        <nav className="tabs" aria-label="Views">
          {TABS.map((t, i) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <span className="num">{i + 1}</span>{t.label}
            </button>
          ))}
        </nav>
        <div className="top-right">
          {scopeInitiative && (
            <span className="scope-chip" title="Scope applied across views">
              Scope: <b lang="es">{initiativeById.get(scopeInitiative)?.shortName}</b>
              <button onClick={() => set({ scopeInitiative: null })} aria-label="Clear scope">×</button>
            </span>
          )}
          {fn !== 'all' && tab !== 'repertoire' && tab !== 'portfolio' && tab !== 'relational' && (
            <span className="scope-chip" style={{ ['--fn' as string]: FUNCTION_COLORS[fn] }}>Function: <b>{functionById.get(fn)?.label}</b><button onClick={() => set({ fn: 'all' })} aria-label="Clear function">×</button></span>
          )}
          <button className="method-btn" onClick={() => setMethod(!method)} aria-expanded={method}>Method</button>
        </div>
      </header>
      {method && <Method onClose={() => setMethod(false)} />}
      <main className="main" key={tid}>
        <div className="view-area">
          {tab === 'territory' && <Territory />}
          {tab === 'listening' && <Listening />}
          {tab === 'system' && <SystemMap />}
          {tab === 'relational' && <Relational />}
          {tab === 'repertoire' && <Repertoire />}
          {tab === 'portfolio' && <Portfolio />}
        </div>
        <SidePanel collapsed={panelCollapsed} onToggle={() => setPanelCollapsed(!panelCollapsed)} />
      </main>
    </div>
  );
}

export default function App() {
  return <StateProvider><Shell /></StateProvider>;
}
