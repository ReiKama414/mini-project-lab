# Mini Project Lab

A single React app that hosts many independent mini projects (one route each), with sidebar navigation and top search. The current project count comes from `src/projects/registry.ts`.

## Getting Started

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Architecture

```
src/
  components/          Layout, Sidebar, ProjectShell
  pages/HomePage.tsx   Browse / home page
  lib/                 useLocalStorage, utils
  projects/
    registry.ts        Single source of truth for project metadata
    <slug>/index.tsx   One folder + default export per mini project
  App.tsx              Routes via import.meta.glob → /p/:slug
  styles/global.css    Shared design system
```

### Add a Project (3 Steps)

1. Add an entry in `src/projects/registry.ts`
2. Create `src/projects/<slug>/index.tsx`
3. Done — routes, sidebar, and home cards update automatically

### Project Page Template

```tsx
import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'

const meta = getProject('your-slug')!

export default function Page() {
  return (
    <ProjectShell meta={meta}>
      {/* Use shared classes: panel / stack / row / field / btn */}
    </ProjectShell>
  )
}
```

## Tiers

| Tier | Description |
|------|-------------|
| Utility tools | Converters, timers, generators |
| Everyday apps | Notes, trackers, lists |
| Product prototypes | AI UIs, dashboards, builders |
| Advanced demos | Monitoring, analytics, realtime |

- Data is stored in `localStorage` (keys prefixed with `lab:`)
- AI features use local heuristics / templates (no API key required)
- Some projects call public APIs (GitHub, FX rates, crypto, etc.)

## Tech

- React 19 + TypeScript + Vite 6
- React Router
- `qrcode.react`, `uuid` (used by some tools)

## License

MIT
