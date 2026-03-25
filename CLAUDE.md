# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Two independent Node.js projects in the same repo — run commands from within each directory:

```
BuildMatch/
├── buildmatch-frontend/   # React 18 + TypeScript + Vite 5
└── buildmatch-backend/    # Express 5 + TypeScript + Prisma 5 + PostgreSQL
```

## Frontend (buildmatch-frontend)

```bash
cd buildmatch-frontend

npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Type-check then bundle for production
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
```

**Note:** Node.js v18.12.1 is in use. Engine warnings from ESLint packages are expected and non-blocking.

## Backend (buildmatch-backend)

```bash
cd buildmatch-backend

npm run dev          # Start dev server with nodemon + ts-node (port 3001)
npm run build        # Compile TypeScript → dist/
npm start            # Run compiled production server

npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Create and apply a new migration
npm run db:studio    # Open Prisma Studio GUI
```

Environment variables live in `.env` (not committed). Required:
- `DATABASE_URL` — PostgreSQL connection string
- `PORT` — defaults to `3001`

## Architecture

### Frontend
- Entry: `src/main.tsx` → `src/App.tsx`
- `App.tsx` mounts `QueryClientProvider` → `AuthProvider` → `BrowserRouter` → `Routes`
- Vite uses ESNext modules in dev; `tsc -b && vite build` for production
- TypeScript is split across three configs: `tsconfig.json` (composite root), `tsconfig.app.json` (browser code), `tsconfig.node.json` (build tools)
- Tailwind v3 via PostCSS (`postcss.config.cjs` + `tailwind.config.cjs`). Tailwind brand colors map to token values (e.g. `text-primary`, `bg-surface`, `border-border`)
- Env variable: `VITE_API_URL` (set in `.env.local`). See `.env.example` for all variables.

#### Frontend folder structure
```
src/
  components/
    ui/          # Primitive design-system components (Button, Card, Badge, Avatar, Input, StarRating)
    layout/      # Navbar, Footer, PageWrapper, Sidebar
    auth/        # LoginForm, RegisterForm, ProtectedRoute
    contractor/  # ContractorCard, ContractorProfile, ContractorList
    job/         # JobCard, JobList, JobPostForm, JobDetail
  pages/         # One file per route (HomePage, LoginPage, etc.)
  hooks/         # useAuth, useContractors, useJobs
  services/      # api.ts (Axios instance), auth.service.ts, contractor.service.ts
  context/       # AuthContext.tsx — provides user/token/login/logout
  types/         # user.types.ts, contractor.types.ts, job.types.ts
  styles/        # design-tokens.css (CSS vars), globals.css (Tailwind directives)
```

#### Key patterns
- **API client**: `src/services/api.ts` — Axios instance with `VITE_API_URL` base, JWT request interceptor (reads `localStorage.getItem('token')`), 401 response interceptor (redirects to `/login`)
- **Auth state**: `AuthContext` + `useAuth()` hook — stores token in `localStorage`. `ProtectedRoute` redirects unauthenticated users to `/login`
- **Server state**: TanStack Query v5. Query keys convention: `['contractors']`, `['contractors', id]`, `['jobs']`, `['jobs', id]`
- **Routes**: `/`, `/login`, `/register`, `/contractors`, `/contractors/:id`, `/jobs/:id`, `/dashboard` (protected), `/post-job` (protected)

### Backend
- Entry: `src/index.ts` — sets up Express with CORS and JSON middleware, mounts routes, starts the server
- Prisma singleton: `src/lib/prisma.ts` — import this everywhere instead of instantiating `PrismaClient` directly
- Schema: `prisma/schema.prisma` — PostgreSQL datasource; run `db:generate` after any schema change
- TypeScript compiles to `dist/` (CommonJS) for production; ts-node runs source directly in dev

### API
- `GET /health` — liveness check, returns `{ status: "ok" }`
- All new routes should be added as Express routers and imported into `src/index.ts`

## Design System

BuildMatch uses a custom design system. Tailwind v3 is installed for utility classes. No component library (no shadcn, no MUI).

### Token File
`buildmatch-frontend/src/styles/design-tokens.css` — all CSS custom properties. Imported at the top of `src/index.css`; tokens are globally available via `var(--token-name)`. Never hardcode color or spacing values in components — always use a token.

### Component Library
All UI primitives live in `buildmatch-frontend/src/components/ui/`. Import via the barrel:
```ts
import { Button, Card, Badge, Avatar, Input, StarRating } from '../components/ui';
```

| Component | Key Props |
|---|---|
| `Button` | `variant?: 'primary' \| 'secondary' \| 'danger'`, `size?: 'sm' \| 'md'` |
| `Input` | `label?: string`, `error?: string` + all native input attrs |
| `Card` | `hoverable?: boolean`, `onClick?`, `className?` |
| `Badge` | `variant?: 'default' \| 'warning' \| 'muted'` |
| `Avatar` | `name: string`, `src?: string`, `size?: 'sm' \| 'md' \| 'lg'` |
| `StarRating` | `rating: number`, `maxStars?: number`, `size?: number` |

Each component has a co-located `*.module.css` file. New components should follow the same pattern.

### Colors
| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#1B3A5C` | CTAs, focus borders, active nav |
| `--color-accent` | `#0F6E56` | Success, badge text |
| `--color-highlight` | `#E8F4F0` | Badge backgrounds, hover tints |
| `--color-warning` | `#BA7517` | Pending/caution text |
| `--color-bg` | `#FFFFFF` | Page background |
| `--color-surface` | `#F8F7F5` | Cards, sidebars, muted badge bg |
| `--color-border` | `#E5E4E0` | Dividers, card edges, empty stars |
| `--color-text-primary` | `#1A1A18` | Body text |
| `--color-text-muted` | `#6B6B67` | Labels, metadata |
| `--color-star` | `#F59E0B` | Star ratings |
| `--color-danger` | `#DC2626` | Errors, danger actions |

### Typography Rules
- Font: `var(--font-family)` — system-ui / SF Pro stack
- **Never use `font-weight` above 600.** Use `--font-weight-normal` (400), `--font-weight-medium` (500), `--font-weight-semibold` (600) only.
- Heading letter spacing: `var(--tracking-tight)` (-0.02em) or `var(--tracking-tighter)` (-0.04em)
- Body line height: `var(--leading-body)` (1.6)
- Caps labels (11px, uppercase, 0.06em tracking): use `--tracking-wide` + `--font-weight-medium`

### Spacing
4px base scale. Use `var(--space-N)` tokens — `--space-1` (4px) through `--space-24` (96px). Common: `--space-2` (8px), `--space-4` (16px), `--space-6` (24px).

### Visual Rules
- No background gradients
- Card shadows: `--shadow-card` only (very subtle). No heavy drop shadows.
- Card border radius: `--radius-md` (12px). Button/input: `--radius-sm` (8px). Badges/pills: `--radius-pill` (20px).
- Navigation: white bg, `border-bottom: 1px solid var(--color-border)`, 60px height, sticky.
