# Technology Stack

**Analysis Date:** 2026-03-27

## Languages

**Primary:**
- TypeScript - Application code in `src/**/*.ts(x)` (see `package.json`, `tsconfig.app.json`)

**Secondary:**
- JavaScript - Tooling config in `postcss.config.js`
- SQL - Supabase migrations in `supabase/migrations/*.sql`

## Runtime

**Environment:**
- Node.js - Local dev/build/test via `npm run dev|build|test` (`package.json`, `README.md`)
- Deno (Supabase Edge Functions) - Function code in `supabase/functions/**` (e.g. `supabase/functions/provision-tenant/index.ts`)

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- React 18 - UI framework (`package.json`)
- React Router DOM 6 - Client-side routing (`package.json`, routes defined in `src/App.tsx`)
- TanStack React Query 5 - Server state/caching (`package.json`, `QueryClientProvider` in `src/App.tsx`)

**UI / Design System:**
- Tailwind CSS 3 - Styling (`tailwind.config.ts`, `postcss.config.js`, `src/index.css`)
- shadcn/ui-style component library built on Radix UI + Tailwind
  - Radix primitives (many `@radix-ui/*` deps in `package.json`)
  - Variants via `class-variance-authority` (`src/components/ui/button.tsx`)
  - Class merging via `clsx` + `tailwind-merge` (`package.json`)
- Icons: `lucide-react` (`package.json`)
- Notifications/Toasts: `sonner` + shadcn toaster (`package.json`, `src/App.tsx`)

**Forms & Validation:**
- `react-hook-form` + `@hookform/resolvers` (`package.json`)
- `zod` schema validation (`package.json`)

**Data viz / docs / utilities (selected):**
- Charts: `recharts` (`package.json`)
- Dates: `date-fns` (`package.json`)
- PDF generation: `jspdf` (`package.json`)
- QR codes: `qrcode` (`package.json`)

**Testing:**
- Vitest - Test runner (`package.json`, `vitest.config.ts`)
- Testing Library (React + jest-dom) (`package.json`, `src/test/setup.ts`)
- jsdom environment (`vitest.config.ts`)

**Build/Dev:**
- Vite 5 - Dev server + build (`package.json`, `vite.config.ts`, `index.html`)
- React SWC plugin: `@vitejs/plugin-react-swc` (`vite.config.ts`, `vitest.config.ts`)
- Optional dev-only plugin: `lovable-tagger` (`vite.config.ts`, `package.json`)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` - Primary backend client (`package.json`, initialized in `src/lib/supabase.ts`)
- `react-router-dom` - App navigation (`src/App.tsx`)
- `@tanstack/react-query` - Data fetching cache layer (`src/App.tsx`)

**Infrastructure:**
- `tailwindcss` + `autoprefixer` + `postcss` - Styling toolchain (`tailwind.config.ts`, `postcss.config.js`, `package.json`)
- `eslint` + `typescript-eslint` - Linting (`eslint.config.js`, `package.json`)

## Configuration

**Environment:**
- Frontend expects Vite env vars (documented in `README.md`, typed in `src/vite-env.d.ts`):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

**Build:**
- Vite config: `vite.config.ts` (alias `@` → `src/`, dev server on port 8080)
- TypeScript configs: `tsconfig.json` (references) + `tsconfig.app.json` + `tsconfig.node.json`
- Tailwind config: `tailwind.config.ts` (CSS-variable-driven design tokens; `darkMode: ["class"]`)

## Platform Requirements

**Development:**
- Node.js + npm (see `README.md`)
- Supabase project credentials for auth/data access (see `README.md`, `src/lib/supabase.ts`)

**Production:**
- Frontend deployed as static SPA built by Vite (`npm run build` in `package.json`)
- Supabase used for Auth/DB/Storage/Edge Functions (see `src/lib/supabase.ts`, `supabase/` directory)

---

*Stack analysis: 2026-03-27*
