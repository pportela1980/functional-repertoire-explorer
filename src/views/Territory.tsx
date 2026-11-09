import { useEffect, useMemo, useRef, useState } from 'react';
import { featuredInitiativeIds, isLargeTerritory, territoryId, contextGroupOf } from '../data/model';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../state';
import {
  territory, initiatives, initiativeComponents, initiativeColor, episodesOfInitiative, programmeNetworks,
} from '../data/model';
import { Quote } from '../components/bits';
import Timeline from './Timeline';

function TerritoryMap() {
  const mapEl = useRef<HTMLDivElement>(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!mapEl.current) return;
    const { lat, lon } = territory.center;
    const map = L.map(mapEl.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lon], territory.zoom ?? 9);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    let errors = 0;
    tiles.on('tileerror', () => { errors++; if (errors > 3) setTileError(true); });
    tiles.on('tileload', () => setTileError(false));
    const icon = L.divIcon({ className: 'territory-marker', html: `<div class="tm-ring"></div><div class="tm-badge">${initiatives.length}</div>`, iconSize: [46, 46], iconAnchor: [23, 23] });
    L.marker([lat, lon], { icon, keyboard: true, title: `${territory.name} — territory-level cluster of initiatives` }).addTo(map)
      .bindPopup(`<strong>${territory.name}</strong><br/>${initiatives.length} initiative records at territory level.<br/>Not site locations: the source has no verified project coordinates.`);
    return () => { map.remove(); };
  }, []);
  return (
    <div className="map-wrap">
      <div ref={mapEl} className="map" role="region" aria-label="Map centred on Necoclí" />
      {tileError && <div className="map-note">Map tiles could not be loaded (offline or blocked).</div>}
      <p className="map-caption">{territoryId === 'necocli' ? `Municipal seat of Necoclí (${territory.center.lat.toFixed(4)}, ${territory.center.lon.toFixed(4)}), approximate.` : `Territory reference point (${territory.center.lat.toFixed(4)}, ${territory.center.lon.toFixed(4)}). ${territory.centerPrecision}`} {territory.projectLocationNote}</p>
    </div>
  );
}

export default function Territory() {
  const { scopeInitiative, set, go, region } = useApp();
  const [step, setStep] = useState(0);
  const story = territory.story;
  const st = story[step];
  const progs = useMemo(() => programmeNetworks.filter((p) => region === 'all' || p.necocli), [region]);

  return (
    <div className="view view-territory">
      <div className="view-head">
        <div>
          <h2>{territory.name}, {territory.subregion}</h2>
          <p className="lede">What this project is about, in four steps — then how initiatives and organizations appear over time.</p>
        </div>
        {territoryId === 'necocli' && <div className="region-switch" role="radiogroup" aria-label="Region scope">
          <button role="radio" aria-checked={region === 'necocli'} className={region === 'necocli' ? 'active' : ''} onClick={() => set({ region: 'necocli' })}>Necoclí</button>
          <button role="radio" aria-checked={region === 'all'} className={region === 'all' ? 'active' : ''} onClick={() => set({ region: 'all' })}>Whole Colombia snapshot</button>
        </div>}
      </div>

      <div className="story-grid">
        <section className="story" aria-label="Project story">
          <ol className="story-steps" role="tablist">
            {story.map((s, i) => (
              <li key={s.id}>
                <button role="tab" aria-selected={i === step} className={i === step ? 'active' : i < step ? 'done' : ''} onClick={() => setStep(i)}>
                  <span className="n">{i + 1}</span>{s.title}
                </button>
              </li>
            ))}
          </ol>
          <div className="story-card" role="tabpanel" aria-live="polite">
            <h3>{st.title}</h3>
            <p className="story-text">{st.text}</p>
            {st.refs.map((r, i) => <Quote key={i} r={r} compact />)}
            {st.id === 'response' && <p className="small muted">{territory.programme.sourceNote} <a href={territory.programme.platformUrl} target="_blank" rel="noreferrer">Platform ↗</a></p>}
            <div className="row-actions">
              {step > 0 && <button onClick={() => setStep(step - 1)}>← Back</button>}
              {step < story.length - 1 ? <button className="primary" onClick={() => setStep(step + 1)}>Next →</button>
                : <button className="primary" onClick={() => go('repertoire', { fn: 'all' })}>Explore the functional repertoire →</button>}
            </div>
          </div>
        </section>
        <TerritoryMap />
      </div>

      <Timeline programmes={progs} />

      <details className="init-details" open={isLargeTerritory}>
        <summary>{isLargeTerritory ? `Featured entry points (${featuredInitiativeIds.length}) and all ${initiatives.length} initiative records` : `Initiatives at territory level (${initiatives.length})`} — select to read, or scope every view</summary>
        {isLargeTerritory ? <LargeInitiativeList /> : (
          <div className="init-columns">
            {initiativeComponents.map((c) => (
              <div key={c.id} className="init-group">
                <div className="kicker">{c.label}</div>
                <ul className="init-list">{c.members.map((iid) => <InitRow key={iid} iid={iid} />)}</ul>
              </div>
            ))}
          </div>
        )}
        {scopeInitiative && <div className="row-actions"><button onClick={() => go('repertoire')}>See {initiatives.find((x) => x.id === scopeInitiative)?.shortName} in the functional repertoire →</button></div>}
        {!isLargeTerritory && <p className="small muted">Clusters are connected components of source initiative–initiative interconnections.</p>}
      </details>
    </div>
  );
}

function InitRow({ iid, showGroup }: { iid: string; showGroup?: boolean }) {
  const { scopeInitiative, set, select } = useApp();
  const i = initiatives.find((x) => x.id === iid)!;
  const n = episodesOfInitiative(iid).length;
  const active = scopeInitiative === iid;
  return (
    <li className={active ? 'active' : ''}>
      <span className="swatch" style={{ background: initiativeColor(iid) }} />
      <button className="link-btn inline" lang="es" onClick={() => select({ type: 'initiative', id: iid })}>{i.shortName}</button>
      <span className="muted small">{showGroup && contextGroupOf(i) ? `${contextGroupOf(i)!.label} · ` : ''}{n ? `${n} episode${n > 1 ? 's' : ''}` : 'no episode coded'}</span>
      <button className="small-btn" aria-pressed={active} onClick={() => set({ scopeInitiative: active ? null : iid })}>{active ? 'Scoped ✓' : 'Scope'}</button>
    </li>
  );
}

function LargeInitiativeList() {
  const [q, setQ] = useState('');
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const hits = useMemo(() => (q.trim().length < 2 ? [] : initiatives.filter((i) => fold(`${i.name} ${i.description ?? ''} ${i.council ?? ''} ${i.id}`).includes(fold(q.trim()))).slice(0, 40)), [q]);
  return (
    <div className="init-columns">
      <div className="init-group">
        <div className="kicker">Featured entry points</div>
        <ul className="init-list">{featuredInitiativeIds.map((iid) => <InitRow key={iid} iid={iid} showGroup />)}</ul>
        <p className="small muted">Two of these are curated context (a community practice and the listening process), not K-tool project records.</p>
      </div>
      <div className="init-group">
        <div className="kicker">Search all {initiatives.length} records</div>
        <input type="search" className="init-search" placeholder="Name, council or description…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search initiatives" />
        <ul className="init-list">{hits.map((i) => <InitRow key={i.id} iid={i.id} showGroup />)}</ul>
        {q.trim().length >= 2 && !hits.length && <p className="small muted">No match.</p>}
      </div>
    </div>
  );
}
