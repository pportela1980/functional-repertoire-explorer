import { useMemo, useState } from 'react';
import { territoryId, territory, episodes as allEpisodes } from '../data/model';
import { useApp } from '../state';
import {
  reportExcerpts, listeningRecords, progressReports, documents, programmeById, initiativeById, initiatives, programmeNetworks, pdfHref, PDF_AVAILABLE,
  verification, episodeById, functionById, FUNCTION_COLORS, episodes,
} from '../data/model';
import { Prov, Quote } from '../components/bits';

type Kind = 'excerpt' | 'listening_record' | 'perception_record' | 'event_record' | 'progress_report' | 'interview_reference';
const KIND_LABEL: Record<Kind, string> = {
  excerpt: 'Curated excerpt',
  listening_record: 'Listening record',
  perception_record: 'Perception record',
  event_record: 'Event-like record',
  progress_report: 'Programme progress report',
  interview_reference: 'Supplied interview (reference)',
};
interface Item { id: string; kind: Kind; title: string; snippet: string; text: string; date: string | null; topics: string[]; programmes: string[]; initiatives: string[]; necocli: boolean; selType: 'excerpt' | 'listening' | 'progress'; pdf?: string | null }

const buildItems = (): Item[] => [
  ...reportExcerpts.map((x) => ({
    id: x.id, kind: 'excerpt' as Kind, title: `${(documents[x.documentId]?.title ?? x.documentId).split(' — ')[0]}${x.pdfPage ? ` · PDF p. ${x.pdfPage}` : ''}${x.sourceRecordId ? ` · ${x.sourceRecordId.replace(/^urdaibai:/, '')}` : ''}`, snippet: x.quote, text: `${x.quote} ${x.sourceRecordId ?? ''} ${x.usedBy.map((u) => u.label).join(' ')}`,
    date: '2026', topics: [], programmes: [], initiatives: x.initiativeIds, necocli: true, selType: 'excerpt' as const, pdf: PDF_AVAILABLE ? pdfHref(x) : undefined,
  })),
  ...listeningRecords.map((r) => {
    const body = [r.quote, r.needs, r.challenges, r.opportunities, r.comments].filter(Boolean).join(' ');
    return { id: r.id, kind: r.kind as Kind, title: r.title, snippet: body.slice(0, 260), text: `${r.title} ${body} ${r.topics.join(' ')} ${r.id} ${r.id.replace(/^urdaibai:/, '')} ${r.canonicalId ?? ''} ${r.sourceCode ?? ''} ${r.originalSourceCode ?? ''}`, date: r.date, topics: r.topics, programmes: r.programmeNetworks, initiatives: [], necocli: r.necocli, selType: 'listening' as const };
  }),
  ...progressReports.map((p) => {
    const body = Object.values(p.sections).join(' ');
    const necocli = programmeById.get(p.programmeNetwork)?.necocli ?? false;
    return { id: p.id, kind: 'progress_report' as Kind, title: p.title, snippet: body.slice(0, 220), text: `${p.title} ${body}`, date: null, topics: [], programmes: [p.programmeNetwork], initiatives: [], necocli, selType: 'progress' as const };
  }),
];
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const countBy = <T,>(xs: T[], key: (x: T) => string | string[]) => { const m = new Map<string, number>(); for (const x of xs) for (const k of ([] as string[]).concat(key(x))) m.set(k, (m.get(k) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };

// ---------------- "How the excerpts were made"
const STEPS = [
  { id: 'field', title: 'Field listening', sub: '2024 · 2026' },
  { id: 'reports', title: 'Listening reports', sub: '2026' },
  { id: 'selection', title: 'Excerpt selection', sub: 'analyst' },
  { id: 'verify', title: 'Verification', sub: 'on PDF page' },
  { id: 'use', title: 'Use in this demo', sub: 'evidence ≠ interpretation' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

function Bars({ rows, total }: { rows: [string, number][]; total?: number }) {
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <ul className="mini-bars">
      {rows.map(([k, v]) => <li key={k}><span className="k" lang="es">{k}</span><span className="b"><i style={{ width: `${(v / max) * 100}%` }} /></span><span className="v">{v}{total ? ` · ${Math.round((v / total) * 100)}%` : ''}</span></li>)}
    </ul>
  );
}

function HowNecocli({ onExplore }: { onExplore: (k: Kind) => void }) {
  const { select, region } = useApp();
  const [step, setStep] = useState<StepId>('field');
  const L = listeningRecords.filter((r) => r.kind === 'listening_record' && (region === 'all' || r.necocli));
  const P = listeningRecords.filter((r) => r.kind === 'perception_record' && (region === 'all' || r.necocli));
  const wave = (d: string | null) => (!d ? 'no date' : d < '2025' ? 'First phase, 2024' : 'Second phase, 2026');
  const fromBrief = new Set(episodes.filter((e) => !e.addedInThisBuild).flatMap((e) => e.evidence.map((v) => `${v.documentId}|${v.pdfPage}|${v.quote}`)));
  const ex = reportExcerpts;
  const useCount = (k: string) => ex.filter((x) => x.usedBy.some((u) => u.kind === k)).length;
  const counts: Record<StepId, string> = {
    field: `${L.length + P.length} records`, reports: '2 reports', selection: `${ex.length} excerpts`, verify: `${verification.verified}/${verification.excerpts}`, use: `${useCount('episode')} as episode evidence`,
  };
  const exampleL = L.find((r) => r.id === 'session-listenings:56') ?? L.find((r) => r.needs);
  const exampleP = P.find((r) => r.profileType === 'constructed_ethnographic_profile') ?? P[0];
  const fund = episodeById.get('ep-fund')!;
  const fundQuote = fund.evidence[0];

  return (
    <div className="howto">
      <ol className="pipeline" role="tablist" aria-label="How the excerpts were made">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button role="tab" aria-selected={step === s.id} className={step === s.id ? 'active' : ''} onClick={() => setStep(s.id)}>
              <span className="n">{i + 1}</span><span className="t">{s.title}</span><span className="c">{counts[s.id]}</span><span className="s muted">{s.sub}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="step-body" role="tabpanel" aria-live="polite">
        {step === 'field' && (
          <>
            <h3>1 · What was heard in the territory</h3>
            <p>The consortia recorded their listening on the Work4Progress platform. Two kinds of record are in this snapshot:</p>
            <div className="two-col">
              <div>
                <div className="kicker">Listening records ({L.length}) <Prov kind="source_record" /></div>
                <p className="small">One record per session: interviews, workshops, dialogue groups, observation. Each lists needs, comments, topics and the number of participants.</p>
                <Bars rows={countBy(L, (r) => wave(r.date))} total={L.length} />
                <div className="kicker sub">Listening channel</div>
                <Bars rows={countBy(L, (r) => r.channels ?? [])} />
                <div className="kicker sub">Recorded by programme network</div>
                <Bars rows={countBy(L, (r) => r.programmeNetworks.map((p) => programmeById.get(p)?.name ?? p)).concat(L.some((r) => !r.programmeNetworks.length) ? [['(none recorded)', L.filter((r) => !r.programmeNetworks.length).length]] : [])} />
                <p className="small muted">Participants recorded per session add up to {L.reduce((s, r) => s + (r.participants ?? 0), 0)}; the same people may attend several sessions, so this is not a count of people.</p>
              </div>
              <div>
                <div className="kicker">Perception records ({P.length}) <Prov kind="source_record" /></div>
                <p className="small">Individual responses about challenges and opportunities, plus a few constructed ethnographic profiles. Names of individuals are not shown.</p>
                <Bars rows={countBy(P, (r) => (r.profileType === 'constructed_ethnographic_profile' ? 'Constructed ethnographic profile' : 'Individual response'))} total={P.length} />
                <Bars rows={countBy(P, (r) => wave(r.date))} total={P.length} />
              </div>
            </div>
            <div className="examples">
              <div className="kicker">Examples (original Spanish)</div>
              {exampleL && <button className="example" onClick={() => select({ type: 'listening', id: exampleL.id })}><b lang="es">{exampleL.title}</b><span lang="es">{(exampleL.needs ?? '').slice(0, 220)}…</span></button>}
              {exampleP && <button className="example" onClick={() => select({ type: 'listening', id: exampleP.id })}><b lang="es">{exampleP.title}</b><span lang="es">{(exampleP.challenges ?? '').slice(0, 220)}…</span></button>}
            </div>
            <div className="row-actions"><button onClick={() => onExplore('listening_record')}>See all listening records</button><button onClick={() => onExplore('perception_record')}>See all perception records</button></div>
          </>
        )}
        {step === 'reports' && (
          <>
            <h3>2 · How the consortia wrote it up</h3>
            <p>In 2026 two consortia wrote listening reports that synthesise this phase: what worked in each prototype, what did not, and hypotheses for co-creation.</p>
            <div className="two-col">
              {(['codespa', 'uniban'] as const).map((d) => (
                <div key={d} className="doc-card">
                  <div className="kicker">{d === 'codespa' ? 'Codespa' : 'Fundación Uniban'} <Prov kind="source_record" /></div>
                  <b>{documents[d].title}</b>
                  <p className="small muted">{d === 'codespa' ? '36' : '65'} PDF pages. {ex.filter((x) => x.documentId === d).length} excerpts used in this demo.</p>
                  {PDF_AVAILABLE && <a href={pdfHref({ documentId: d, pdfPage: 1 }) ?? undefined} target="_blank" rel="noreferrer">Open the report ↗</a>}
                </div>
              ))}
            </div>
            <Quote r={{ documentId: 'codespa', pdfPage: 3, quote: 'El proceso permitió evaluar los seis prototipos implementados, identificar desafíos estructurales del ecosistema emprendedor local y construir hipótesis para la fase de cocreación.' }} />
            <p className="small caveat">The platform records and the reports are separate products. We cannot trace which record fed which sentence of a report, so this demo never links a report excerpt to a specific listening record.</p>
          </>
        )}
        {step === 'selection' && (
          <>
            <h3>3 · Choosing short excerpts</h3>
            <p>From the reports, short passages were selected as evidence. The selection is an analytical choice: it picks passages that describe a demand, a response, a gap or a stated link between conditions.</p>
            <Bars rows={[
              ['Selected in the brief for the 8 original episodes', ex.filter((x) => fromBrief.has(`${x.documentId}|${x.pdfPage}|${x.quote}`)).length],
              ['Selected in this build for 2 added episodes', ex.filter((x) => x.usedBy.some((u) => u.kind === 'episode') && !fromBrief.has(`${x.documentId}|${x.pdfPage}|${x.quote}`)).length],
              ['Grounding the system-dynamics map', ex.filter((x) => x.usedBy.some((u) => u.kind === 'variable' || u.kind === 'link')).length],
              ['Territory summary and story', useCount('territory')],
            ]} />
            <p className="small muted">An excerpt can serve more than one use, so the rows overlap. Quotes are copied exactly; nothing is translated or paraphrased inside quotation marks.</p>
            <div className="row-actions"><button onClick={() => onExplore('excerpt')}>See all {ex.length} excerpts</button></div>
          </>
        )}
        {step === 'verify' && (
          <>
            <h3>4 · Checking every quote</h3>
            <p className="big-num">{verification.verified} / {verification.excerpts}</p>
            <p>excerpts were found word for word on the PDF page they cite.</p>
            <p className="small muted">{verification.method} Page numbers are 1-based PDF pages, not the printed page numbers. The check runs automatically on every build (<code>npm run check:data</code>).</p>
          </>
        )}
        {step === 'use' && (
          <>
            <h3>5 · From excerpt to reading — three separate layers</h3>
            <p>Each layer is labelled wherever it appears. A worked example:</p>
            <div className="layers">
              <div className="layer"><Prov kind="source_record" /><p className="small">What the report says</p><blockquote lang="es">“{fundQuote.quote}”</blockquote><span className="small muted">Codespa, PDF p. {fundQuote.pdfPage}</span></div>
              <div className="arrow">→</div>
              <div className="layer"><Prov kind="reported_episode" /><p className="small">The episode, framed in English</p><b>{fund.title}</b><p className="small">{fund.reportedResponse}</p></div>
              <div className="arrow">→</div>
              <div className="layer"><Prov kind="functional_interpretation" /><p className="small">Our reading through a function</p>
                {fund.functionalReadings.map((r) => <p key={r.functionId} className="small"><b style={{ color: FUNCTION_COLORS[r.functionId] }}>{functionById.get(r.functionId)!.label}:</b> {r.interpretation}</p>)}
              </div>
            </div>
            <div className="row-actions"><button className="primary" onClick={() => select({ type: 'episode', id: 'ep-fund' })}>Open this episode</button></div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- Urdaibai: same five steps, its own sources
function HowUrdaibai({ onExplore }: { onExplore: (k: Kind) => void }) {
  const { select } = useApp();
  const [step, setStep] = useState<StepId>('field');
  const L = listeningRecords.filter((r) => r.kind === 'listening_record');
  const sources = new Set(L.map((r) => r.sourceCode).filter(Boolean));
  const unresolved = L.filter((r) => !r.sourceCode).length;
  const ex = reportExcerpts;
  const fromPack = new Set(allEpisodes.filter((e) => !e.addedInThisBuild).flatMap((e) => e.evidence.map((v) => `${v.documentId}|${v.pdfPage ?? ''}|${v.quote}`)));
  const useCount = (k: string) => ex.filter((x) => x.usedBy.some((u) => u.kind === k)).length;
  const counts: Record<StepId, string> = {
    field: '1,002 narratives', reports: '1 final report', selection: `${ex.length} excerpts`, verify: `${verification.verified}/${verification.excerpts}`, use: `${useCount('episode')} as episode evidence`,
  };
  const ib = episodeById.get('urdaibai:episode:ibarrangelu-sensemaking')!;
  const exampleIds = ['urdaibai:informations:370', 'urdaibai:informations:1615', 'urdaibai:informations:1110'];
  const examples = exampleIds.map((id) => L.find((r) => r.id === id)).filter(Boolean) as typeof L;
  return (
    <div className="howto">
      <ol className="pipeline" role="tablist" aria-label="How the excerpts were made">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button role="tab" aria-selected={step === s.id} className={step === s.id ? 'active' : ''} onClick={() => setStep(s.id)}>
              <span className="n">{i + 1}</span><span className="t">{s.id === 'reports' ? 'Final report' : s.title}</span><span className="c">{counts[s.id]}</span><span className="s muted">{s.id === 'field' ? '2025' : s.id === 'reports' ? 'ALC / AC4' : s.sub}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="step-body" role="tabpanel" aria-live="polite">
        {step === 'field' && (
          <>
            <h3>1 · What was heard in the territory</h3>
            <p>Throughout 2025 the ALC / AC4 team held mostly semi-structured, open conversations found through snowball sampling, plus ethnographies and public calls. The report counts 1,002 narratives from 949 people; 53 were interviewed twice. The recordings were anonymised and published on the K-tool platform.</p>
            <Quote r={{ documentId: 'urdaibai:document:alc-final', pdfPage: 63, quote: 'Han participado 949 personas, de las cuales 53 personas han realizado también la entrevista de segunda iteración' }} compact />
            <div className="two-col">
              <div>
                <div className="kicker">Selected excerpts in this demo ({L.length}) <Prov kind="source_record" /></div>
                <p className="small">The API-derived v2 corpus keeps short original excerpts, each with an anonymous source code ({sources.size} sources; {unresolved} excerpts with an unresolved source). Sources 0088 and 0145 are counted as one, because they share nine identical excerpts.</p>
                <div className="kicker sub">Themes (as tagged in the source; one excerpt can carry several)</div>
                <Bars rows={countBy(L, (r) => r.topics).slice(0, 9)} />
              </div>
              <div>
                <div className="kicker">Language</div>
                <p className="small">Excerpts are in Basque or Spanish and are shown as recorded. The source's locale field is not a reliable guide to the language of a quote, so the demo does not filter by it.</p>
                <div className="kicker sub">Other references</div>
                <p className="small">Five narrative-profile references linked from project records and ten supplied interview references (two with selected fragments in the pack). Full interviews are not redistributed.</p>
              </div>
            </div>
            <div className="examples">
              <div className="kicker">Examples (original language)</div>
              {examples.map((r) => <button key={r.id} className="example" onClick={() => select({ type: 'listening', id: r.id })}><b>{r.title}</b><span>{(r.quote ?? '').slice(0, 220)}…</span></button>)}
            </div>
            <div className="row-actions"><button onClick={() => onExplore('listening_record')}>See all listening excerpts</button></div>
          </>
        )}
        {step === 'reports' && (
          <>
            <h3>2 · How the process was written up</h3>
            <p>ALC and AC4 published a preliminary report in July 2025 and a final report after ten months. The final report groups the narratives into five narrative profiles, describes seven contrast sessions, sessions with young people and migrants, and an international seminar.</p>
            <div className="doc-card">
              <div className="kicker">Agirre Lehendakaria Center · AC4 Columbia <Prov kind="source_record" /></div>
              <b>{documents['urdaibai:document:alc-final'].title}</b>
              <p className="small muted">77 PDF pages. Page links use the physical PDF page, not the printed number. {ex.filter((x) => x.documentId === 'urdaibai:document:alc-final').length} excerpts used in this demo.</p>
              {pdfHref({ documentId: 'urdaibai:document:alc-final', pdfPage: 1 }) && <a href={pdfHref({ documentId: 'urdaibai:document:alc-final', pdfPage: 1 })!} target="_blank" rel="noreferrer">Open the report ↗</a>}
            </div>
            <Quote r={territory.story[2].refs[0]} />
            <p className="small caveat">The listening corpus and the public project listing were assembled at different times and for different purposes. No anonymous speaker is joined to an organisation in the agent inventory.</p>
          </>
        )}
        {step === 'selection' && (
          <>
            <h3>3 · Choosing the evidence</h3>
            <p>Evidence for episodes comes from four kinds of source: the final report, listening excerpts, two supplied interviews and public documents (council notices, a cooperative registry). Some public sources are summarised rather than quoted.</p>
            <Bars rows={[
              ['Curated in the pack for the 7 original episodes', ex.filter((x) => fromPack.has(`${x.documentId}|${x.pdfPage ?? ''}|${x.quote}`)).length],
              ['Selected in this build for 9 added episodes', ex.filter((x) => x.usedBy.some((u) => u.kind === 'episode') && !fromPack.has(`${x.documentId}|${x.pdfPage ?? ''}|${x.quote}`)).length],
              ['Territory story and timeline', useCount('territory')],
            ]} />
            <p className="small muted">Counter-evidence is kept and labelled (for example, interviewees who describe the mobilisation as politicised, or quotas as excluding local use).</p>
            <div className="row-actions"><button onClick={() => onExplore('excerpt')}>See all {ex.length} curated excerpts</button></div>
          </>
        )}
        {step === 'verify' && (
          <>
            <h3>4 · Checking every quote</h3>
            <p className="big-num">{verification.verified} / {verification.excerpts}</p>
            <p>{verification.detail}</p>
            <p className="small muted">{verification.method} The check runs on every build (<code>npm run check:data</code>). Public-source summaries without a quotation are labelled as summaries.</p>
          </>
        )}
        {step === 'use' && (
          <>
            <h3>5 · From excerpt to reading — three separate layers</h3>
            <div className="layers">
              <div className="layer"><Prov kind="source_record" /><p className="small">What the report says</p><blockquote lang="es">“{ib.evidence[1].quote}”</blockquote><span className="small muted">ALC final report, PDF p. {ib.evidence[1].pdfPage}</span></div>
              <div className="arrow">→</div>
              <div className="layer"><Prov kind="reported_episode" /><p className="small">The episode, framed in English</p><b>{ib.title}</b><p className="small">{ib.reportedResponse}</p></div>
              <div className="arrow">→</div>
              <div className="layer"><Prov kind="functional_interpretation" /><p className="small">Our reading through a function</p>
                {ib.functionalReadings.map((r) => <p key={r.functionId} className="small"><b style={{ color: FUNCTION_COLORS[r.functionId] }}>{functionById.get(r.functionId)!.label}:</b> {r.interpretation}</p>)}
              </div>
            </div>
            <div className="row-actions"><button className="primary" onClick={() => select({ type: 'episode', id: ib.id })}>Open this episode</button></div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- explore all
function ExploreAll({ kinds, setKinds }: { kinds: Set<Kind>; setKinds: (k: Set<Kind>) => void }) {
  const { scopeInitiative, set, select, selection, region, listeningQuery } = useApp();
  const items = useMemo(buildItems, []);
  const allTopics = useMemo(() => [...new Set(items.flatMap((i) => i.topics))].sort(), [items]);
  const [limit, setLimit] = useState(120);
  const [topic, setTopic] = useState('');
  const [prog, setProg] = useState('');
  const q = listeningQuery;
  const filtered = useMemo(() => {
    const fq = fold(q.trim());
    return items.filter((it) => (region === 'all' || it.necocli)
      && (!kinds.size || kinds.has(it.kind))
      && (!topic || it.topics.includes(topic))
      && (!prog || it.programmes.includes(prog))
      && (!scopeInitiative || it.initiatives.includes(scopeInitiative))
      && (!fq || fold(it.text).includes(fq)));
  }, [q, kinds, topic, prog, scopeInitiative, region, items]);
  const toggleKind = (k: Kind) => { const n = new Set(kinds); if (n.has(k)) n.delete(k); else n.add(k); setKinds(n); };
  const countOf = (k: Kind) => items.filter((i) => i.kind === k && (region === 'all' || i.necocli)).length;
  return (
    <>
      <div className="listen-controls">
        <input type="search" placeholder={territoryId === 'urdaibai' ? 'Search text, theme, source code or record ID: etxebizitza, Guggenheim, 0072, informations:370…' : 'Search (accents optional): fondo, leche, turismo, confianza…'} value={q} onChange={(e) => set({ listeningQuery: e.target.value })} aria-label="Search listening references" />
        <div className="chips" role="group" aria-label="Source type">
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <button key={k} className={`chip${kinds.has(k) ? ' active' : ''}`} aria-pressed={kinds.has(k)} onClick={() => toggleKind(k)}>{KIND_LABEL[k]} <span className="muted">{countOf(k)}</span></button>
          ))}
        </div>
        <div className="filters">
          <label>Topic <select value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">Any</option>{allTopics.map((t) => <option key={t}>{t}</option>)}</select></label>
          {programmeNetworks.length > 0 && <label>Programme network <select value={prog} onChange={(e) => setProg(e.target.value)}><option value="">Any</option>{programmeNetworks.filter((p) => region === 'all' || p.necocli).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
          <label>Initiative <select value={scopeInitiative ?? ''} onChange={(e) => set({ scopeInitiative: e.target.value || null })}><option value="">Any</option>{initiatives.map((i) => <option key={i.id} value={i.id}>{i.shortName}</option>)}</select></label>
        </div>
        {scopeInitiative && <p className="small muted">Initiative filter shows only report excerpts with a curated association to <b lang="es">{initiativeById.get(scopeInitiative)?.shortName}</b>. Listening and perception records have no initiative field in the source and are not forced into one. <button className="link-btn inline" onClick={() => set({ scopeInitiative: null })}>Clear initiative filter</button></p>}
      </div>
      <p className="result-count" aria-live="polite">{filtered.length} reference{filtered.length === 1 ? '' : 's'}</p>
      <ul className="cards">
        {filtered.slice(0, limit).map((it) => (
          <li key={it.id}>
            <button className={`card${selection?.id === it.id ? ' selected' : ''}`} onClick={() => select({ type: it.selType, id: it.id })}>
              <div className="card-top"><span className={`kind kind-${it.kind}`}>{KIND_LABEL[it.kind]}</span> <Prov kind="source_record" /> {it.date && <span className="muted small">{it.date}</span>}</div>
              <div className="card-title" lang="es">{it.title}</div>
              <p className="card-snippet" lang="es">{it.kind === 'excerpt' ? `“${it.snippet}”` : it.snippet || <span className="muted">No text fields; see attachments and metadata.</span>}</p>
              {it.initiatives.length > 0 && <div className="small muted">Linked via curated episode to: {it.initiatives.map((i) => initiativeById.get(i)?.shortName).join(', ')}</div>}
            </button>
            {it.pdf && <a className="pdf-link small" href={it.pdf} target="_blank" rel="noreferrer">PDF ↗</a>}
          </li>
        ))}
      </ul>
      {filtered.length > limit && <div className="row-actions"><button onClick={() => setLimit(limit + 240)}>Show more ({filtered.length - limit} remaining)</button></div>}
    </>
  );
}

export default function Listening() {
  const { scopeInitiative, listeningQuery } = useApp();
  const [mode, setMode] = useState<'how' | 'explore'>(() => (scopeInitiative || listeningQuery ? 'explore' : 'how'));
  const [kinds, setKinds] = useState<Set<Kind>>(new Set());
  return (
    <div className="view view-listening">
      <div className="view-head">
        <div>
          <h2>Listening</h2>
          <p className="lede">How the voices of the territory reach this demo — from field sessions to report excerpts to our reading. Original Spanish is never replaced.</p>
        </div>
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={mode === 'how'} className={mode === 'how' ? 'active' : ''} onClick={() => setMode('how')}>How the excerpts were made</button>
          <button role="tab" aria-selected={mode === 'explore'} className={mode === 'explore' ? 'active' : ''} onClick={() => setMode('explore')}>Explore all references</button>
        </div>
      </div>
      {mode === 'how' ? (territoryId === 'urdaibai'
        ? <HowUrdaibai onExplore={(k) => { setKinds(new Set([k])); setMode('explore'); }} />
        : <HowNecocli onExplore={(k) => { setKinds(new Set([k])); setMode('explore'); }} />) : <ExploreAll kinds={kinds} setKinds={setKinds} />}
    </div>
  );
}
