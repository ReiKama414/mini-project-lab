# Projects guide (for Cursor)

## Source of truth
- Metadata: `registry.ts`
- Implementation: `<slug>/index.tsx`
- Routes auto-discovered via `import.meta.glob` in `src/App.tsx`

## Conventions
- Wrap UI with `<ProjectShell meta={meta}>`
- Persist with `useLocalStorage('lab:<slug>', initial)`
- Prefer shared CSS classes from `styles/global.css` over new CSS files
- Keep each project self-contained (no cross-project imports except `lib/` + `components/`)

## Tiers
- `quick` — tools
- `feature` — local apps
- `product` — product-like UIs
- `portfolio` — showcase demos
