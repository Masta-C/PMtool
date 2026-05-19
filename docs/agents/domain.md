# Domain Docs

PMtool uses a **single-context** layout.

## Files

| File | Purpose |
|---|---|
| `CONTEXT.md` | Domain language, key concepts, business rules — read this first |
| `docs/adr/` | Architecture Decision Records — one file per decision, named `NNN-short-title.md` |

## Consumer rules

- Always read `CONTEXT.md` before making architecture suggestions or writing domain-touching code
- Before opening a new ADR, check `docs/adr/` — the decision may already be recorded
- ADR status values: `Proposed` → `Accepted` → `Deprecated` / `Superseded`
- When a decision is reversed, mark the old ADR `Superseded` and link to the new one — never delete
