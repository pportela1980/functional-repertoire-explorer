import { useState, type ReactNode } from 'react';
import { documents, pdfHref, FUNCTION_COLORS, functionById, type DocRef, type FunctionId, type Provenance } from '../data/model';

const PROV_LABEL: Record<Provenance, string> = {
  source_record: 'Source record',
  reported_episode: 'Reported episode',
  functional_interpretation: 'Functional interpretation',
  analyst_synthesis: 'Analyst synthesis',
};
export const Prov = ({ kind }: { kind: Provenance }) => <span className={`prov prov-${kind}`}>{PROV_LABEL[kind]}</span>;

export const FnChip = ({ id, onClick, active }: { id: FunctionId; onClick?: () => void; active?: boolean }) => (
  <button type="button" className={`fn-chip${active ? ' active' : ''}`} style={{ ['--fn' as string]: FUNCTION_COLORS[id] }} onClick={onClick} disabled={!onClick}>
    <span className="dot" />{functionById.get(id)?.label}
  </button>
);

const SOURCE_TYPE_LABEL: Record<string, string> = {
  report_excerpt: 'Report excerpt', api_excerpt: 'Listening excerpt (K-tool corpus)', interview_excerpt: 'Supplied interview excerpt',
  official_public_excerpt: 'Official public document', public_source_summary: 'Summary of a public source (no quotation)', project_record: 'K-tool project record',
};
const langOf = (r: { language?: string; documentId: string }) => (r.language === 'eu' ? 'eu' : 'es');

export function Quote({ r, compact }: { r: DocRef & { language?: string; sourceType?: string; englishSummary?: string; printedPage?: number; sourceRecordId?: string; evidenceRole?: string }; compact?: boolean }) {
  const d = documents[r.documentId];
  const href = pdfHref(r);
  const where = r.pdfPage ? `PDF page ${r.pdfPage}${r.printedPage ? ` (printed ${r.printedPage})` : ''}` : d?.file ? 'PDF' : 'source';
  return (
    <figure className={`quote${compact ? ' compact' : ''}${r.quote ? '' : ' summary-only'}`}>
      {r.quote ? <blockquote lang={langOf(r)}>“{r.quote}”</blockquote> : null}
      {r.englishSummary && <p className="ev-summary"><span className="muted small">{r.quote ? 'English summary: ' : ''}</span>{r.englishSummary}</p>}
      <figcaption>
        <Prov kind="source_record" />
        {r.sourceType && <span className="tag">{SOURCE_TYPE_LABEL[r.sourceType] ?? r.sourceType}</span>}
        {r.evidenceRole && <span className="tag">{r.evidenceRole === 'counter' ? 'counter-evidence' : r.evidenceRole}</span>}
        <span className="muted">{d?.title ?? r.documentId}</span>
        {r.sourceRecordId && <span className="muted">· {r.sourceRecordId.replace(/^urdaibai:/, '')}</span>}
        {href ? <> · <a href={href} target="_blank" rel="noreferrer">{where} ↗</a></> : r.pdfPage ? <span> · {where}</span> : null}
      </figcaption>
    </figure>
  );
}

/** Spanish source text, collapsed when long. */
export function SourceText({ label, text, lang = 'es' }: { label: string; text: string | null | undefined; lang?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 420;
  return (
    <div className="source-text">
      <div className="kicker">{label}</div>
      <p lang={lang} className={long && !open ? 'clamped' : ''}>{text}</p>
      {long && <button className="link-btn" onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Show full text'}</button>}
    </div>
  );
}

export const Section = ({ title, children, prov }: { title: string; children: ReactNode; prov?: Provenance }) => (
  <section className="panel-section">
    <h4>{title} {prov && <Prov kind={prov} />}</h4>
    {children}
  </section>
);
