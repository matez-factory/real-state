# CLAUDE.md

## Project Overview

Real estate explorer built with Next.js 16. Renders interactive SVG maps for navigating subdivisions and buildings with variable-depth hierarchies (up to 4 levels). Uses Supabase (PostgreSQL + Storage) for data and media.

## Tech Stack

- Next.js 16 (App Router, SSG via `generateStaticParams`)
- React 19
- TypeScript 5 (strict)
- Tailwind CSS 4 (PostCSS)
- Supabase (PostgreSQL + Storage)

## Commands

```bash
npm run dev              # Dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint
npm run db:seed          # Seed Aurora building data
npm run db:upload-media  # Upload Aurora media to Supabase Storage
```

## Architecture

### Database Schema (3 tables)

- **projects** — slug, name, type (subdivision|building), layer_labels, svg_path
- **layers** — self-referencing hierarchy (parent_id), depth 0-3, svg_element_id, properties JSONB
- **media** — images/videos with purpose (cover, gallery, exploration, transition, thumbnail, floor_plan)

Schema: `SETUP_SCHEMA_V2.sql`

### Data Flow

```
page.tsx (Server Component)
  → repository.ts (Supabase queries)
    → transform.ts (raw rows → typed hierarchy)
      → ExplorerView.tsx (Client Component)
```

- `buildExplorerPageData()` takes all project layers + media and filters for a specific slug path
- `buildSiblingExplorerBundle()` calls the above once per sibling floor — pure in-memory, no extra DB calls
- `repository-admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` for `generateStaticParams` (no cookies at build time)

### Client-Side Floor Switching

Sibling floors (e.g., Piso 1, Piso 2) switch client-side without page reloads:

- Server sends a `SiblingExplorerBundle` with data for ALL sibling floors
- ExplorerView tracks `activeLayerId` in state and swaps data from the bundle
- URL updates via `window.history.replaceState()` (no Next.js navigation)
- SVGs and background images are preloaded into browser cache on mount
- `key={activeLayerId}` forces clean InteractiveSVG remount per floor
- `routerRef` pattern prevents `useMemo` from recomputing `entityConfigs` on URL changes

### Routes

| Route | View |
|-------|------|
| `/` | Project listing |
| `/p/[projectSlug]` | Project home (360 viewer, aerial videos) |
| `/p/[projectSlug]/[...layers]` | Layer explorer or unit detail page |

### Visual Theme

- Dark immersive glass-morphism (`.glass-panel` class)
- Floating overlays on black background — no solid header/footer bars
- Admin pages override with `text-gray-900` for light theme

## Conventions

- **Spanish UI, English code** — all user-facing text is in Spanish
- SVG element IDs resolved via `child.svgElementId ?? child.slug`
- SVG labels use dark glass background (`rgba(0,0,0,0.7)`) + white text
- `outline-none` on interactive buttons to prevent browser focus rings
- SVG files use `fill: #3159ff` (blue) as default — InteractiveSVG applies status colors during setup

## Key Files

| File | Purpose |
|------|---------|
| `types/hierarchy.types.ts` | All TypeScript interfaces |
| `lib/data/transform.ts` | Raw DB rows → typed hierarchy + sibling bundle |
| `lib/data/repository.ts` | Server-side Supabase queries |
| `lib/constants/status.ts` | Status labels, dot classes, colors |
| `components/views/ExplorerView.tsx` | Main exploration view with SVG map |
| `components/views/UnitPage.tsx` | Leaf layer detail page |
| `components/views/ProjectHomePage.tsx` | Project home (360 + videos) |
| `components/svg/InteractiveSVG.tsx` | SVG loading + DOM interactivity |
| `components/navigation/SiblingNavigator.tsx` | Floor/sibling picker sidebar |
| `app/globals.css` | Glass-morphism + theme variables |
