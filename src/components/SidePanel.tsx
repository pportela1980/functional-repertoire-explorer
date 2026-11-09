import type { ReactNode } from 'react';
import { useApp, type Sel } from '../state';
import {
  initiativeById, actorById, programmeById, episodeById, functionById, systemMap, listeningRecords, reportExcerpts, progressReports,
  episodesOfInitiative, episodesOfActor, edgesOf, nodeLabel, episodeFunctions, configurations, FUNCTION_COLORS, EDGE_MEANING,
  actorSector, componentOfInitiative, SECTION_LABELS, aliases, documents, pdfHref, episodes, initiativesOfActor, kindOfId, territoryId,
  contextGroupOf, PARTICIPATION_LABEL, participantOf,
  type FunctionId, type Episode, type SourceEdge,
} from '../data/model';
import { Prov, Quote, SourceText, Section, FnChip } from './bits';

export interface EdgeInfo { kind: string; source: string; target: string; label?: string | null; sourceRecordIds?: string[]; altLabels?: string[]; count?: number; functionId?: FunctionId; episodeId?: string; members?: string[]; role?: string; status?: string }
export interface ClusterInfo { label: string; rule: string; members: string[]; expanded: boolean; onToggle?: () => void }

function NodeLink({ id, children }: { id: string; children?: ReactNode }) {
  const { select } = useApp();
  const type: Sel['type'] | null = kindOfId(id);
  if (!type) return <span>{children ?? nodeLabel(id)}</span>;
  return <button className="link-btn inline" onClick={() => select({ type, id })}>{children ?? nodeLabel(id)}</button>;
}

function EpisodeCard({ e, fn }: { e: Episode; fn?: FunctionId | 'all' }) {
  const { select } = useApp();
  const fns = episodeFunctions(e);
  return (
    <button className={`episode-card${fn && fn !== 'all' && !fns.includes(fn) ? ' muted-card' : ''}`} onClick={() => select({ type: 'episode', id: e.id })}>
      <span className="diamond" /> <span>{e.title}</span>
      <span className="fn-dots">{fns.map((f) => <i key={f} style={{ background: FUNCTION_COLORS[f] }} title={functionById.get(f)?.label} />)}</span>
    </button>
  );
}

function ConnectionList({ id }: { id: string }) {
  const groups = new Map<string, SourceEdge[]>();
  for (const e of edgesOf(id)) groups.set(e.kind, [...(groups.get(e.kind) || []), e]);
  if (!groups.size) return <p className="muted">No source associations.</p>;
  return (
    <>
      {[...groups.entries()].map(([k, es]) => (
        <div key={k} className="conn-group">
          <div className="kicker">{EDGE_MEANING[k]?.label ?? k} ({es.length})</div>
          <ul className="conn-list">
            {es.map((e) => {
              const other = e.source === id ? e.target : e.source;
              return <li key={e.id}><NodeLink id={other} />{e.label && <span className="src-label" lang="es"> — “{e.label}”</span>}</li>;
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

const KIND_LABEL: Record<string, string> = { ktool_project: 'K-tool project record', community_practice: 'Community practice (curated context, not a K-tool record)', listening_process: 'Listening process (curated context, not a K-tool record)' };

function InitiativePanel({ id }: { id: string }) {
  const { fn, go, set, scopeInitiative } = useApp();
  const i = initiativeById.get(id)!;
  const eps = episodesOfInitiative(id);
  const comp = componentOfInitiative(id);
  const grp = contextGroupOf(i);
  const financeActors = edgesOf(id).filter((e) => e.kind === 'actor_initiative').map((e) => (e.source === id ? e.target : e.source)).filter((a) => actorById.get(a) && actorSector(actorById.get(a)!).id === 'finance');
  const isNec = territoryId === 'necocli';
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Initiative · {i.id.replace(/^urdaibai:/, '')} <Prov kind="source_record" />{i.kind && i.kind !== 'ktool_project' && <span className="tag">{KIND_LABEL[i.kind] ?? i.kind}</span>}</div>
        <h3 lang="es">{i.shortName}</h3>
        {isNec ? <p className="muted small">Source name: <span lang="es">{i.name}</span> · type {i.type.join(', ') || '—'} · started {i.date ?? '—'}{i.endDate ? ` · end ${i.endDate}` : ''}</p>
          : <p className="muted small">{grp ? `${grp.label}` : 'No council recorded'}{i.type.length ? ` · impact level: ${i.type.join(', ').replace(/_/g, ' ')}` : ''}{i.date ? ` · record date ${i.date}` : ''}{i.sourceUrl ? <> · <a href={i.sourceUrl} target="_blank" rel="noreferrer">K-tool record ↗</a></> : null}</p>}
        <p className="muted small">Initiative cluster: {comp.label}. Topics: {i.topics.join(', ') || 'none recorded'}.</p>
        <div className="row-actions">
          <button onClick={() => set({ scopeInitiative: scopeInitiative === id ? null : id })}>{scopeInitiative === id ? 'Clear scope' : 'Scope views to this initiative'}</button>
          <button onClick={() => go('listening', { scopeInitiative: id, selection: null })}>Listening references</button>
        </div>
      </header>
      <Section title="Stated purpose" prov="source_record">
        <SourceText label={isNec ? 'Prototype description (Spanish source)' : i.kind === 'ktool_project' ? 'Description (K-tool, English locale of the record)' : 'Curated context description'} text={i.description} lang={isNec ? 'es' : 'en'} />
        <SourceText label="Additional comments (Spanish source)" text={i.comments} />
        {i.localizations && i.localizations.length > 0 && (
          <details><summary>Other language versions in the source ({i.localizations.map((l) => l.locale).join(', ')})</summary>
            {i.localizations.map((l) => <SourceText key={l.locale} label={`${l.locale}: ${l.name}`} text={l.description} lang={l.locale?.startsWith('eu') ? 'eu' : 'es'} />)}
          </details>
        )}
      </Section>
      <Section title="Reported work" prov="reported_episode">
        {eps.length ? eps.map((e) => (
          <div key={e.id} className="reported">
            <EpisodeCard e={e} fn={fn} />
            <p>{e.reportedResponse}</p>
          </div>
        )) : <p className="muted">No curated episode for this initiative. {isNec ? 'The source record above is the only documented content in this build.' : 'Empty means no episode coded in this selection, not that nothing happened.'}</p>}
      </Section>
      <Section title="Functional reading" prov="functional_interpretation">
        {eps.length ? (
          <ul className="readings">
            {eps.flatMap((e) => e.functionalReadings.map((r) => (
              <li key={e.id + r.functionId} className={fn !== 'all' && fn !== r.functionId ? 'muted-card' : ''}>
                <FnChip id={r.functionId} /> {r.strength && <span className="tag">{r.strength}</span>} <span className="muted small">via “{e.title}”</span>
                <p>{r.interpretation}</p>
              </li>
            )))}
          </ul>
        ) : <p className="muted">No functional reading yet.</p>}
      </Section>
      <Section title="Connections" prov="source_record">
        <ConnectionList id={id} />
      </Section>
      {i.profiles && i.profiles.length > 0 && (
        <Section title="Narrative profiles referenced by this record" prov="source_record">
          <ul className="plain">{i.profiles.map((p) => <li key={p}><ListeningLink id={p} /></li>)}</ul>
        </Section>
      )}
      <Section title="Resources and support (where documented)" prov="source_record">
        <ul className="plain">
          {i.responsible.length > 0 && <li>Responsible programme entity: {i.responsible.map((r) => <NodeLink key={r} id={r} />)}</li>}
          {i.programmeNetworks.length > 0 && <li>Programme network: {i.programmeNetworks.map((r) => <NodeLink key={r} id={r} />)}</li>}
          {financeActors.length > 0 && <li>Finance-sector organizations associated in source: {financeActors.map((a) => <NodeLink key={a} id={a} />)}</li>}
          {i.partners && i.partners.length > 0 && <li>Partner types recorded: {i.partners.join(', ').replace(/_/g, ' ')}</li>}
          {i.attachments.length > 0 && <li>Attached documents (names only; files not in this snapshot): <span lang="es">{i.attachments.join('; ')}</span></li>}
          {i.sdgs.length > 0 && <li>SDGs recorded: {i.sdgs.join(', ')}</li>}
          {i.budget ? <li>K-tool budget field: {i.budget} (source metadata — not a verified investment, not aggregated)</li> : null}
          {eps.some((e) => e.evidence.some((v) => v.sourceType === 'official_public_excerpt' && /euros/.test(v.quote ?? ''))) && <li>A reported public contribution appears in the episode evidence (see the episode); it is not a total project cost or a verified disbursement.</li>}
          {!i.budget && <li className="muted">No budget or expenditure amount is recorded for this initiative; none is shown.</li>}
        </ul>
      </Section>
    </>
  );
}

function ListeningLink({ id }: { id: string }) {
  const { select } = useApp();
  const r = listeningRecords.find((x) => x.id === id);
  return <button className="link-btn inline" onClick={() => select({ type: 'listening', id })}>{r?.title ?? id}</button>;
}

function ActorPanel({ id }: { id: string }) {
  const a = actorById.get(id)!;
  const sector = actorSector(a);
  const alias = territoryId === 'necocli' ? (aliases as { groups: { displayId: string; decision: string; reason: string }[] }).groups.find((g) => g.displayId === id && g.decision === 'consolidate') : undefined;
  const eps = episodesOfActor(id);
  return (
    <>
      <header className="panel-head">
        <div className="kicker">{a.kinds.includes('role_group') ? 'Role group' : 'Organization'} · {sector.label} <Prov kind={a.addedInThisBuild ? 'reported_episode' : 'source_record'} />{a.addedInThisBuild && <span className="tag">added in this build</span>}</div>
        <h3 lang="es">{a.name}</h3>
        {territoryId === 'necocli'
          ? <p className="muted small">{a.necocli ? 'Explicit Necoclí tag in at least one record.' : 'No explicit Necoclí tag; included because it is referenced by a Necoclí initiative or programme.'} Programme networks: {a.programmeNetworks.map((n) => programmeById.get(n)?.name).join(', ') || '—'}.</p>
          : <p className="muted small">{a.kinds.includes('role_group') ? 'Stands for unnamed people in one episode; never a named person.' : a.kinds.includes('context_record') ? 'Named in a curated document (not a K-tool agent record).' : `K-tool agent record${a.council ? ` · ${a.council.replace(/_/g, ' ')}` : ''}. Recovered through project fields; listing as lead or associated agent is administrative metadata, not episode participation.`}</p>}
      </header>
      {alias && (
        <Section title="Alias decision">
          <p className="small">{a.sourceRecords.length} source records are shown as this one node: {a.sourceRecords.map((r) => r.id).join(', ')}. {alias.reason}</p>
        </Section>
      )}
      <Section title="Connections" prov="source_record"><ConnectionList id={id} /></Section>
      {eps.length > 0 && (
        <Section title={territoryId === 'necocli' ? 'Episodes (initiative-level association)' : 'Episodes (reported participation)'} prov="reported_episode">
          {territoryId === 'necocli' ? <p className="muted small">Associated with the episode’s initiative in the source; attendance at the episode is not asserted.</p> : null}
          {eps.map((e) => { const p = participantOf(e.id, id); return <div key={e.id}><EpisodeCard e={e} />{p && <p className="small muted">{PARTICIPATION_LABEL[p.status]}: {p.role}</p>}</div>; })}
        </Section>
      )}
      {a.sourceRecords.map((r) => (
        <Section key={r.id} title={`Source record ${r.id}`} prov="source_record">
          <p className="muted small" lang="es">{r.name}{r.entityType ? ` · ${r.entityType}` : ''}{r.date ? ` · ${r.date}` : ''}</p>
          <SourceText label="Capacities" text={r.capacities} />
          <SourceText label="Needs" text={r.necessities} />
          <SourceText label="Initiatives and actions" text={r.actions} />
          <SourceText label="Description" text={r.description} />
          <SourceText label="Comments" text={r.comments} />
        </Section>
      ))}
    </>
  );
}

function ProgrammePanel({ id }: { id: string }) {
  const n = programmeById.get(id)!;
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Programme network (consortium / phase) <Prov kind="source_record" /></div>
        <h3>{n.name}</h3>
        <p className="muted small">Agreement {n.agreementDate ?? '—'} · programme duration {n.duration ? `${n.duration.start} → ${n.duration.end}` : '—'} · zones: {n.zones.join(', ')}</p>
        <p className="small">A programme network is a funded consortium or phase, not an interpersonal network. Membership does not imply collaboration between members.</p>
      </header>
      <Section title="Listed member entities" prov="source_record"><ul className="plain">{n.memberEntities.map((m) => <li key={m}><NodeLink id={m} /></li>)}</ul></Section>
      <Section title="Initiatives registered" prov="source_record">{n.initiatives.length ? <ul className="plain">{n.initiatives.map((m) => <li key={m}><NodeLink id={m} /></li>)}</ul> : <p className="muted">None in this snapshot.</p>}</Section>
      <Section title="Progress reports" prov="source_record">
        {n.progressReports.filter((p) => Object.keys(p.sections).length).map((p) => (
          <details key={p.sourceId}><summary lang="es">{p.name}</summary>
            {Object.entries(p.sections).map(([k, v]) => <SourceText key={k} label={SECTION_LABELS[k] ?? k} text={v} />)}
          </details>
        ))}
        <p className="muted small">{n.budgetNote}</p>
      </Section>
    </>
  );
}

function EpisodePanel({ id }: { id: string }) {
  const { fn } = useApp();
  const e = episodeById.get(id)!;
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Episode <Prov kind="reported_episode" />{e.addedInThisBuild && <span className="tag">added in this build</span>}</div>
        <h3>{e.title}</h3>
        <p className="muted small">English title and summaries are analytical framing.</p>
        <dl className="ep-meta">
          <dt>Time</dt><dd>{e.time ? (e.time.label ?? e.time.date ?? 'not specified') : e.reportingPeriod}{e.time?.precision ? <span className="muted small"> · precision: {e.time.precision.replace(/_/g, ' ')}{e.time.basis ? ` · basis: ${e.time.basis.replace(/_/g, ' ')}` : ''}</span> : null}</dd>
          {e.place && <><dt>Place</dt><dd>{e.place}</dd></>}
          {e.evidenceLevel && <><dt>Evidence</dt><dd>{e.evidenceLevel === 'A' ? 'A · documented with date and actors' : 'B · narrated by anonymous listening sources'}</dd></>}
          {e.series && <><dt>Series</dt><dd>{e.series}</dd></>}
        </dl>
      </header>
      <Section title="Demand"><p>{e.demand}</p></Section>
      <Section title="Involved initiatives" prov="source_record">{e.initiativeIds.length ? <ul className="plain">{e.initiativeIds.map((i) => <li key={i}><NodeLink id={i} /></li>)}</ul> : <p className="muted small">Not linked to an initiative record; read as a configuration in its own right.</p>}</Section>
      <Section title="Relevant actors and roles">
        {e.participants && e.participants.length ? (
          <ul className="plain participants">{e.participants.map((p) => (
            <li key={p.actorRecordId}><NodeLink id={p.actorRecordId} /> <span className={`status status-${p.status}`}>{PARTICIPATION_LABEL[p.status]}</span><div className="small muted">{p.role}</div></li>
          ))}</ul>
        ) : e.actorRecordIds.length ? <ul className="plain">{e.actorRecordIds.map((a) => <li key={a}><NodeLink id={a} /> <span className="muted small">— {actorById.get(a) ? actorSector(actorById.get(a)!).label : ''}</span></li>)}</ul> : <p className="muted">No organization is associated with this episode in the source.</p>}
        <p className="muted small">{e.actorLinkMeaning}.</p>
      </Section>
      <Section title="Functional interpretation" prov="functional_interpretation">
        <ul className="readings">
          {e.functionalReadings.map((r) => (
            <li key={r.functionId} className={fn !== 'all' && fn !== r.functionId ? 'muted-card' : ''}><FnChip id={r.functionId} /> {r.strength && <span className="tag">{r.strength}</span>} {r.addedInThisBuild && <span className="tag">added in this build</span>}<p>{r.interpretation}</p></li>
          ))}
        </ul>
      </Section>
      <Section title="Reported response" prov="reported_episode"><p>{e.reportedResponse}</p></Section>
      <Section title="Reported continuity" prov="reported_episode"><p>{e.reportedContinuity}</p></Section>
      {e.notes && <p className="small muted">{e.notes}</p>}
      <Section title="Source references">{e.evidence.map((ev) => <Quote key={ev.id} r={ev} />)}</Section>
    </>
  );
}

function FunctionPanel({ id }: { id: FunctionId }) {
  const f = functionById.get(id)!;
  const eps = episodes.filter((e) => episodeFunctions(e).includes(id));
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Collective function</div>
        <h3 style={{ color: FUNCTION_COLORS[id] }}>{f.label}</h3>
        <p>{f.definition}</p>
      </header>
      <Section title="Configurations in the curated episodes" prov="analyst_synthesis">
        {configurations[id].map((c) => (
          <div key={c.id} className="config">
            <div className="kicker">{c.label}</div>
            <p className="small muted">{c.rationale}</p>
            {c.episodes.map((eid) => <EpisodeCard key={eid} e={episodeById.get(eid)!} />)}
          </div>
        ))}
        <p className="muted small">{eps.length} of {episodes.length} curated episodes carry a reading for this function. This is a count of curated evidence, not a capacity score.</p>
      </Section>
    </>
  );
}

function EdgePanel({ info }: { info: EdgeInfo }) {
  const m = EDGE_MEANING[info.kind];
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Relation {m && <Prov kind={m.provenance} />}</div>
        <h3>{m?.label ?? info.kind}</h3>
        <p><NodeLink id={info.source} /> — <NodeLink id={info.target} /></p>
        {m && <p className="small">{m.note}</p>}
      </header>
      {info.role && <Section title="Role in the episode" prov="reported_episode"><p>{info.role}</p>{info.status && <p className="small muted">{PARTICIPATION_LABEL[info.status] ?? info.status}</p>}</Section>}
      {info.label && <Section title="Source label"><p lang="es">“{info.label}”</p>{info.altLabels?.map((l) => <p key={l} lang="es">“{l}”</p>)}</Section>}
      {info.functionId && info.episodeId && (
        <Section title="Interpretation" prov="functional_interpretation">
          <p>{episodeById.get(info.episodeId)!.functionalReadings.find((r) => r.functionId === info.functionId)?.interpretation}</p>
        </Section>
      )}
      {info.members && info.members.length > 0 && <Section title={`Shared organizations (${info.members.length})`} prov="source_record"><ul className="plain">{info.members.map((m) => <li key={m}><NodeLink id={m} /></li>)}</ul></Section>}
      {info.count != null && !info.members && <Section title="Aggregation"><p>{info.count} source association{info.count === 1 ? '' : 's'} between the collapsed group and this node.</p></Section>}
      {info.sourceRecordIds && <p className="muted small">Source records: {info.sourceRecordIds.join(', ')}</p>}
    </>
  );
}

function VariablePanel({ id }: { id: string }) {
  const v = systemMap.variables.find((x) => x.id === id)!;
  const { select } = useApp();
  const out = systemMap.links.filter((l) => l.from === id), inn = systemMap.links.filter((l) => l.to === id);
  const lbl = (vid: string) => systemMap.variables.find((x) => x.id === vid)!.label;
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Territorial variable · {systemMap.sectors.find((s) => s.id === v.sector)?.label} <Prov kind="analyst_synthesis" /></div>
        <h3>{v.label}</h3>
        {v.definition && <p>{v.definition}</p>}
      </header>
      {v.refs.length > 0 && <Section title="Grounding in the reports">{v.refs.map((r, i) => <Quote key={i} r={r} />)}</Section>}
      {v.interviewRefs && <Section title="Basis"><p className="small">Origin: {v.origin}. Interview references (reference only — not quotation-level validation): {v.interviewRefs.join(', ')}.</p>{v.reviewNotes && <p className="small muted">Review note: {v.reviewNotes}</p>}</Section>}
      <Section title="Influences" prov="analyst_synthesis">
        <ul className="plain">
          {inn.map((l) => <li key={l.id}><button className="link-btn inline" onClick={() => select({ type: 'causal', id: l.id })}>{lbl(l.from)} → this ({l.polarity === '+' ? 'same direction' : 'opposite direction'})</button></li>)}
          {out.map((l) => <li key={l.id}><button className="link-btn inline" onClick={() => select({ type: 'causal', id: l.id })}>this → {lbl(l.to)} ({l.polarity === '+' ? 'same direction' : 'opposite direction'})</button></li>)}
        </ul>
      </Section>
    </>
  );
}

function CausalPanel({ id }: { id: string }) {
  const l = systemMap.links.find((x) => x.id === id)!;
  const lbl = (vid: string) => systemMap.variables.find((x) => x.id === vid)!.label;
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Signed influence <Prov kind="analyst_synthesis" /></div>
        <h3>{lbl(l.from)} <span className={`pol ${l.polarity === '+' ? 'pos' : 'neg'}`}>{l.polarity === '+' ? '+' : '−'}</span> → {lbl(l.to)}</h3>
        <p className="small">{l.polarity === '+' ? 'Positive polarity: when the first variable increases, the second tends to increase (and vice versa).' : 'Negative polarity: when the first variable increases, the second tends to decrease.'} No weight or magnitude is implied.</p>
      </header>
      <Section title="Rationale" prov="analyst_synthesis"><p>{l.rationale}</p>{l.conditions && <p className="small"><b>Conditions:</b> {l.conditions}</p>}{l.reviewNotes && <p className="small muted">Review note: {l.reviewNotes}</p>}</Section>
      {l.origin && <Section title="Basis"><p className="small">Origin: <b>{l.origin === 'hypothesis' ? 'modeller hypothesis' : l.origin}</b>{l.interviewRefs?.length ? ` · interview references (reference only): ${l.interviewRefs.join(', ')}` : ''}. Unvalidated analyst synthesis; the episode data do not validate this link.</p></Section>}
      {l.refs.length > 0 && <Section title="Report statements">{l.refs.map((r, i) => <Quote key={i} r={r} />)}</Section>}
    </>
  );
}

function ListeningPanel({ id }: { id: string }) {
  const r = listeningRecords.find((x) => x.id === id)!;
  return (
    <>
      <header className="panel-head">
        <div className="kicker">{r.kind === 'listening_record' ? (r.quote ? 'Listening excerpt' : 'Listening record') : r.kind === 'perception_record' ? (r.profileType === 'constructed_ethnographic_profile' ? 'Perception record · constructed ethnographic profile' : r.profileType === 'narrative_profile' ? 'Narrative profile reference' : 'Perception record · individual response') : r.kind === 'interview_reference' ? 'Supplied interview reference' : 'Event-like record'} <Prov kind="source_record" /></div>
        <h3 lang="es">{r.title}</h3>
        {territoryId === 'necocli'
          ? <p className="muted small">{r.id} · {r.date ?? 'no date'} · {r.necocli ? 'Necoclí tag' : 'no Necoclí tag'}{r.participants ? ` · ${r.participants} participants recorded` : ''}{r.programmeNetworks.length ? ` · ${r.programmeNetworks.map((n) => programmeById.get(n)?.name).join(', ')}` : ''}</p>
          : <p className="muted small">{r.id.replace(/^urdaibai:/, '')}{r.canonicalId ? ` · ${r.canonicalId}` : ''}{r.sourceCode ? ` · source ${r.sourceCode}` : ''}{r.originalSourceCode ? ` (recorded as ${r.originalSourceCode}; treated as the same source)` : ''}{r.localeMetadata ? ` · locale metadata: ${r.localeMetadata} (does not establish the language of the quote)` : ''}</p>}
        {r.kind === 'perception_record' && r.profileType === 'individual_response' && <p className="small muted">Personal names in individual responses are not displayed in this demo.</p>}
        {r.note && <p className="small">{r.note}</p>}
      </header>
      {r.quote && <Section title="Original excerpt (Basque or Spanish, as recorded)" prov="source_record">
        <blockquote className="orig" lang={/\b(eta|da|dago|ez|dau|baina)\b/i.test(r.quote) ? 'eu' : 'es'}>“{r.quote}”</blockquote>
        {r.variants && r.variants.length > 0 && <details><summary>Source-provided variants ({r.variants.length})</summary>{r.variants.map((v, k) => <SourceText key={k} label={v.locale} text={v.text} />)}</details>}
      </Section>}
      {r.availability && <p className="small muted">Availability: {r.availability.replace(/_/g, ' ')}.</p>}
      <Section title={r.quote ? 'Other fields' : territoryId === 'necocli' ? 'Original text (Spanish)' : 'Record text'} prov="source_record">
        <SourceText label="Identified needs" text={r.needs} />
        <SourceText label="Challenges" text={r.challenges} />
        <SourceText label="Opportunities" text={r.opportunities} />
        <SourceText label="Comments" text={r.comments} />
        {r.occupation && <p className="small muted">Occupation: {r.occupation}{r.age ? ` · age ${r.age}` : ''}</p>}
        {r.channels && r.channels.length > 0 && <p className="small muted" lang="es">Channels: {r.channels.join('; ')}</p>}
        {r.topics.length > 0 && <p className="small muted">Topics: {r.topics.join(', ')}</p>}
        {r.attachments.length > 0 && <p className="small muted" lang="es">Attachments listed in source (not included): {r.attachments.join('; ')}</p>}
        {r.linkedListening && r.linkedListening.length > 0 && <p className="small">Source association with listening record: {r.linkedListening.join(', ')}</p>}
      </Section>
      <p className="muted small">No English summary has been curated for this record. No initiative or attendance association is inferred.</p>
    </>
  );
}

function ExcerptPanel({ id }: { id: string }) {
  const x = reportExcerpts.find((e) => e.id === id)!;
  const { select } = useApp();
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Curated excerpt <Prov kind="source_record" /></div>
        <h3>{documents[x.documentId]?.title ?? x.documentId}</h3>
        {x.pdfPage ? <p className="small">{pdfHref(x) ? <a href={pdfHref(x)!} target="_blank" rel="noreferrer">Open PDF at page {x.pdfPage} ↗</a> : <span>PDF page {x.pdfPage} (PDF files are in the project folder public/reports/)</span>} (1-based physical PDF page, not the printed page number)</p> : null}
        {x.sourceRecordId && <p className="small">From listening record <ListeningLink id={x.sourceRecordId} /></p>}
      </header>
      <Quote r={x} />
      <Section title="Used in this demo by">
        <ul className="plain">
          {x.usedBy.map((u, i) => (
            <li key={i}>
              {u.kind === 'episode' ? <button className="link-btn inline" onClick={() => select({ type: 'episode', id: u.id })}>Episode: {u.label}</button>
                : u.kind === 'variable' ? <button className="link-btn inline" onClick={() => select({ type: 'variable', id: u.id })}>System variable: {u.label}</button>
                : u.kind === 'link' ? <button className="link-btn inline" onClick={() => select({ type: 'causal', id: u.id })}>System influence: {u.label}</button>
                : <span>{u.label}</span>}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function ProgressPanel({ id }: { id: string }) {
  const p = progressReports.find((x) => x.id === id)!;
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Programme progress report <Prov kind="source_record" /></div>
        <h3 lang="es">{p.title}</h3>
        <p className="muted small">Programme network: {programmeById.get(p.programmeNetwork)?.name}</p>
      </header>
      {Object.entries(p.sections).map(([k, v]) => <SourceText key={k} label={SECTION_LABELS[k] ?? k} text={v} />)}
    </>
  );
}

function ClusterPanel({ info }: { info: ClusterInfo }) {
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Group</div>
        <h3>{info.label}</h3>
        <p className="small">Grouping rule: {info.rule}</p>
        {info.onToggle && <div className="row-actions"><button onClick={info.onToggle}>{info.expanded ? 'Close group' : 'Open group'}</button></div>}
      </header>
      <Section title={`Members (${info.members.length})`}><ul className="plain">{info.members.map((m) => <li key={m}><NodeLink id={m} /></li>)}</ul></Section>
    </>
  );
}

function MatrixPanel({ data }: { data: { initiativeId: string; functionId: FunctionId } }) {
  const eps = episodesOfInitiative(data.initiativeId).filter((e) => episodeFunctions(e).includes(data.functionId));
  return (
    <>
      <header className="panel-head">
        <div className="kicker">Evidence cell <Prov kind="functional_interpretation" /></div>
        <h3><NodeLink id={data.initiativeId} /> × <span style={{ color: FUNCTION_COLORS[data.functionId] }}>{functionById.get(data.functionId)?.label}</span></h3>
        <p className="small muted">{eps.length} curated episode{eps.length === 1 ? '' : 's'}. A count of supporting episodes, not a capacity score.</p>
      </header>
      {eps.map((e) => (
        <div key={e.id} className="reported"><EpisodeCard e={e} /><p>{e.functionalReadings.find((r) => r.functionId === data.functionId)?.interpretation}</p></div>
      ))}
    </>
  );
}

const TIPS: Record<string, string[]> = {
  territory: ['Read the four-step story, then scrub the timeline.', 'Select an initiative to read its record, or scope every view to it.', 'The marker is a territory reference point; initiatives are territory-level, not site locations.'],
  listening: ['Start with how the excerpts were made, or search all references.', 'Every card opens the original text and its provenance.'],
  system: ['Select a variable or an arrow to see polarity, rationale and the report statement.', 'Drag variables to rearrange; double-click to release a pin.'],
  relational: ['Each circle or hexagon is a context grouping several organizations; the number is how many.', 'Click a context to open it; double-click to close. Hover a link to see how many organizations two contexts share.', 'Centrality analysis ranks organizations or contexts by their position in the records.'],
  repertoire: ['Start with the four functions; the numbers on links count episodes read through both.', 'Click a function, then a configuration, then an episode (diamond) to open the next level.', 'Use the breadcrumb to go back up.'],
  portfolio: ['Double-click an initiative to open its organizations and episodes.', 'Matrix cells count curated episodes — evidence, not scores.'],
};

function EmptyPanel() {
  const { tab } = useApp();
  return (
    <div className="empty-panel">
      <div className="kicker">Evidence panel</div>
      <p>Nothing selected.</p>
      <ul>{(TIPS[tab] ?? []).map((t) => <li key={t}>{t}</li>)}</ul>
      <p className="small muted">Provenance labels: <span className="prov prov-source_record">Source record</span> <span className="prov prov-reported_episode">Reported episode</span> <span className="prov prov-functional_interpretation">Functional interpretation</span> <span className="prov prov-analyst_synthesis">Analyst synthesis</span></p>
    </div>
  );
}

export default function SidePanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { selection, select } = useApp();
  if (collapsed) {
    return <button className="panel-toggle collapsed" onClick={onToggle} aria-label="Open evidence panel" title="Open evidence panel">‹ Evidence</button>;
  }
  if (!selection) {
    return (
      <aside className="side-panel empty" aria-label="Evidence panel">
        <button className="close" onClick={onToggle} aria-label="Collapse evidence panel" title="Collapse panel">›</button>
        <div className="panel-scroll"><EmptyPanel /></div>
      </aside>
    );
  }
  let body: ReactNode = null;
  const { type, id, data } = selection;
  if (type === 'initiative' && initiativeById.has(id)) body = <InitiativePanel id={id} />;
  else if (type === 'actor' && actorById.has(id)) body = <ActorPanel id={id} />;
  else if (type === 'programme' && programmeById.has(id)) body = <ProgrammePanel id={id} />;
  else if (type === 'episode' && episodeById.has(id)) body = <EpisodePanel id={id} />;
  else if (type === 'function' && functionById.has(id as FunctionId)) body = <FunctionPanel id={id as FunctionId} />;
  else if (type === 'edge' && data) body = <EdgePanel info={data as EdgeInfo} />;
  else if (type === 'variable') body = <VariablePanel id={id} />;
  else if (type === 'causal') body = <CausalPanel id={id} />;
  else if (type === 'listening' && listeningRecords.some((r) => r.id === id)) body = <ListeningPanel id={id} />;
  else if (type === 'excerpt' && reportExcerpts.some((r) => r.id === id)) body = <ExcerptPanel id={id} />;
  else if (type === 'progress') body = <ProgressPanel id={id} />;
  else if ((type === 'cluster' || type === 'config') && data) body = <ClusterPanel info={data as ClusterInfo} />;
  else if (type === 'matrix' && data) body = <MatrixPanel data={data as { initiativeId: string; functionId: FunctionId }} />;
  if (!body) return null;
  return (
    <aside className="side-panel" aria-label="Evidence panel">
      <div className="panel-buttons"><button onClick={() => select(null)} aria-label="Clear selection" title="Clear selection">×</button><button onClick={onToggle} aria-label="Collapse evidence panel" title="Collapse panel">›</button></div>
      <div className="panel-scroll">{body}</div>
    </aside>
  );
}

export { initiativesOfActor };
