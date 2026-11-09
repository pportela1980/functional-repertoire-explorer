import { useApp } from '../state';
import { functions, FUNCTION_COLORS } from '../data/model';

export function FunctionSelector({ allLabel = 'All functions' }: { allLabel?: string }) {
  const { fn, set } = useApp();
  return (
    <div className="fn-selector" role="radiogroup" aria-label="Function in focus">
      <button role="radio" aria-checked={fn === 'all'} className={`fn-btn all${fn === 'all' ? ' active' : ''}`} onClick={() => set({ fn: 'all' })}>{allLabel}</button>
      {functions.map((f) => (
        <button key={f.id} role="radio" aria-checked={fn === f.id} title={f.definition}
          className={`fn-btn${fn === f.id ? ' active' : ''}`} style={{ ['--fn' as string]: FUNCTION_COLORS[f.id] }}
          onClick={() => set({ fn: f.id })}>
          <span className="dot" />{f.label}
        </button>
      ))}
    </div>
  );
}
