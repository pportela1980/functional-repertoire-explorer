# Functional repertoire explorer — Necoclí and Busturialdea–Urdaibai

A lean, local demonstrator that reads two territorial cases through Pedro Portela's functional repertoire / relational field hypothesis: **mobilisation, knowledge recombination, coordination and mutual support**.

- **Necoclí (Colombia)** — Work4Progress (Fundación "la Caixa") data and two 2026 listening reports.
- **Busturialdea–Urdaibai (Basque Country)** — K-tool project listing, the API-derived listening corpus and the ALC / AC4 final report.

Choose the case in the header; both use the same six views. The cases have different sources and sampling and are not ranked against each other.

It organizes and interprets existing data only. No forecasts, scenarios, simulations, recommendations or scores. English UI; Spanish source quotations unchanged. See [DATA-NOTES.md](DATA-NOTES.md) for record selection, aliases, provenance and grouping rules.

## Run

Requires Node 18+.

```bash
npm install
npm run dev
```

The browser opens http://127.0.0.1:5287/ automatically. Port 5287 is fixed (strictPort) so it does not collide with other local Vite sites on 5173; if 5287 is busy, run `npm run dev -- --port 5300`.

Production build and checks:

```bash
npm run build      # regenerates data, runs data checks (quotes verified on PDF pages), typecheck, bundle
npm run preview    # serves dist/ at http://127.0.0.1:5288/
```

Browser verification (uses Playwright with a local Chromium; optional):

```bash
node scripts/verify-ui.cjs http://127.0.0.1:5287/ .verify
node scripts/verify-urdaibai.cjs http://127.0.0.1:5287/ .verify-urdaibai
```

## Views

1. **Territory** — the project story in four steps (place, challenge, Work4Progress response, question), a map, and an interactive timeline (play/scrub) showing when programme networks, initiatives, listening and organization records appear.
2. **Listening** — a five-step explainer of how excerpts were made (field → reports → selection → verification → use), plus a searchable list of all references.
3. **System dynamics** — 18 territorial variables and signed influences (analyst synthesis, each with a report quote).
4. **Relational network** — a hypergraph of contexts (initiatives, programme networks, episodes) that start collapsed and open to show member organizations; centrality menu (hyperdegree, betweenness, eigenvector) with an explicit reading caveat.
5. **Functional repertoire** — progressive disclosure: four functions → configurations → episodes → initiatives and organizations, with a breadcrumb.
6. **Portfolio** — the eleven initiatives, shared organizations, expandable initiatives, and an initiatives × functions evidence matrix.

All network views share one d3-force interaction layer (`src/components/ForceGraph.tsx`): persistent node identity and positions, drag-to-pin (double-click to release), zoom/pan, fit, pause/resume, reset, stable presentation mode, and `prefers-reduced-motion` support.

## Editing the reading

Interpretations live in `content/` and are independent of rendering code:

- `functional-reading.json`, `episodes-extra.json` — episodes, readings, evidence quotes.
- `functional-configurations.json` — how episodes group per function.
- `system-map.json` — variables and signed influences.
- `aliases.json` — consolidation decisions.

After editing, `npm run check:data` verifies references and that each quote occurs on its cited PDF page.

## Scope notes

Data comes from `reference/w4p-claude-code-brief/` (unchanged). No Neo4j connection, no live API calls, no LLM calls at runtime.
