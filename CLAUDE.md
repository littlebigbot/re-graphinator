# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev          # Dev server at localhost:5173
yarn build        # Type-check + production build (vue-tsc && vite build)
yarn preview      # Preview production build
yarn type-check   # vue-tsc type checking only
yarn test         # Vitest unit tests
yarn test:ui      # Vitest UI dashboard
yarn lint         # ESLint check
yarn lint:fix     # ESLint autofix
yarn format       # Prettier format all files
```

Pre-commit hooks (Husky + lint-staged) run ESLint + Prettier on staged `.ts`/`.vue` files automatically.

## Environment Variables

Copy `.env.example` to `.env`:

- `DEV_TMDB_API_KEY` — used directly in dev (never exposed to prod)
- `TMDB_API_KEY` — server-side only (Vercel function)
- `VITE_APP_URL` — base URL for OG image generation

## Architecture

### Data Flow

1. User searches for people/titles via **PersonSearch** component
2. **useVennState** (singleton composable) holds reactive slot state, credits, filters, and bitmask region masks
3. **useTmdb** fetches from TMDB directly in dev, or via the Vercel proxy (`/api/tmdb`) in prod
4. **useCredits** fetches all credits in parallel with an LRU cache (max 20 entries)
5. **computeRegions** / **computeRegionsCast** partition results into Venn regions using bitmask logic
6. **VennCanvas** renders D3 SVG circles; **VennDiagram** overlays HTML positioned via shared `vennLayout` geometry

### Key Composables (`src/composables/`)

| Composable     | Role                                                            |
| -------------- | --------------------------------------------------------------- |
| `useVennState` | Singleton — slots, credits, filters, region masks; survives HMR |
| `useTmdb`      | TMDB API wrapper; dev→direct, prod→proxy; role categorization   |
| `useCredits`   | Parallel credit fetching + LRU cache                            |
| `useHistory`   | LocalStorage search history (person + title modes)              |
| `useTheme`     | Dark/light mode                                                 |
| `useToast`     | Global toast notifications                                      |

### Region Computation (`src/types/tmdb.ts`, `src/utils/bitmask.ts`)

Venn regions are identified by **bitmask** (one bit per slot). `computeRegionsBase` is generic and shared by both person-mode (`computeRegions`) and title-mode (`computeRegionsCast`). Utility functions in `bitmask.ts`: `popcount`, `activeBits`, `isToggleDisabled`, `collectRegionItems`.

### Venn Layout (`src/utils/vennLayout.ts`)

Pre-calculated circle layouts for 1–5 slots. Both **VennCanvas** (D3 SVG) and **VennDiagram** (HTML overlay) import from this file to stay pixel-aligned.

### API Proxy (`api/tmdb.ts`)

Vercel serverless function. Allowlisted TMDB paths only (search, person details/credits, movie/TV details/credits). Path validation via regex before injecting the server-side API key.

### Search Modes

- **Person mode** — slots are people; overlapping items are shared film/TV credits
- **Title mode** — slots are titles; overlapping items are shared cast members

### State Persistence

- `useVennState` and `useCredits` cache survive HMR via module-level singletons
- Viz mode persists to `sessionStorage`
- Search history persists to `localStorage`
- URL state restoration on load (VennView)

## Code Style

- `<script setup lang="ts">` only — no Options API
- Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`)
- Type imports preferred (`import type { ... }`)
- Always use block bodies with curly braces (ESLint enforced)
- Path alias `@/` maps to `src/`
