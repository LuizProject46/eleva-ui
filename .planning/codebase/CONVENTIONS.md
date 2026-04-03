# Coding Conventions

**Analysis Date:** 2026-03-27

## Naming Patterns

**Files:**
- React components use `PascalCase.tsx` in `src/components/**` (e.g. `src/components/layout/MainLayout.tsx`, `src/components/courses/CourseEditor.tsx`).
- Utilities/services typically use `camelCase.ts` (e.g. `src/lib/utils.ts`, `src/services/avatarService.ts`).

**Functions:**
- Exported helpers are commonly `camelCase` (e.g. `cn` in `src/lib/utils.ts`, `validateAvatarFile`/`uploadAvatar` in `src/services/avatarService.ts`).
- Local helper factories exist in tests as `makeX` helpers (e.g. `makePdi`, `makePlanAction` in `src/modules/pdi/utils/derivePdiStatus.test.ts`).

**Variables:**
- Constants are usually `SCREAMING_SNAKE_CASE` (e.g. `AUTH_LOADING_TIMEOUT_MS` in `src/App.tsx`, `MAX_SIZE_BYTES` in `src/services/avatarService.ts`).
- Boolean flags often use `is...` naming (e.g. `isAuthenticated`, `isLoading` from `useAuth()` usage in `src/App.tsx`).

**Types:**
- `interface` is used for object shapes (e.g. `AvatarUploadResult` in `src/services/avatarService.ts`).
- `type` is also used where convenient, including `type` imports (e.g. `import type { Pdi... }` in `src/modules/pdi/utils/derivePdiStatus.test.ts`).

## Code Style

**Formatting:**
- Not detected: Prettier config files (`.prettierrc*`, `prettier.config.*`) are not present in repo root.
- Quote style is not consistently enforced by tooling (evidence: `"..."` imports in `src/App.tsx` vs `'...'` in `src/services/avatarService.test.ts`).

**Linting:**
- Tool: ESLint flat config (`eslint.config.js`)
- Config base: `@eslint/js` recommended + `typescript-eslint` recommended (`eslint.config.js`)
- React-specific lint plugins:
  - `eslint-plugin-react-hooks` recommended rules are enabled via spread (`eslint.config.js`)
  - `eslint-plugin-react-refresh` rule `react-refresh/only-export-components` is enabled as `warn` (`eslint.config.js`)
- Notable overrides:
  - `@typescript-eslint/no-unused-vars` is turned **off** (`eslint.config.js`)

## Import Organization

**Order:**
- No explicit enforced order detected in ESLint config.
- In practice, many files group imports with external deps mixed with internal aliases (example: `src/App.tsx`).

**Path Aliases:**
- `@/*` → `src/*` via TS config paths (`tsconfig.json`, `tsconfig.app.json`) and Vite alias (`vite.config.ts`).
- Example usage: `import { derivePdiStatus } from '@/modules/pdi/utils/derivePdiStatus'` in `src/modules/pdi/utils/derivePdiStatus.test.ts`.

## Error Handling

**Patterns:**
- Throwing `Error` for invalid conditions in services (e.g. `uploadAvatar` throws on validation / storage failures in `src/services/avatarService.ts`).
- “Return null” as a non-error sentinel for validation (e.g. `validateAvatarFile` returns `string | null` in `src/services/avatarService.ts`).
- UI routing uses early returns and guard-style components (e.g. `ProtectedRoute` in `src/App.tsx`).

## Logging

**Framework:** Not detected in reviewed files/configs (no logging library configuration surfaced from `package.json` and sampled files).

**Patterns:**
- Not established by lint rules; use is ad-hoc (not evidenced in sampled files).

## Comments

**When to Comment:**
- Used sparingly for intent/context (e.g. brief JSDoc-style comment in `src/App.tsx` around document title mapping).

**JSDoc/TSDoc:**
- Occasional JSDoc-style blocks appear (e.g. top-of-file block in `src/services/avatarService.ts`), but not enforced by config.

## Function Design

**Size:** Not enforced by lint config; files include both small utility functions (e.g. `src/lib/utils.ts`) and large route composition (e.g. `src/App.tsx`).

**Parameters:** Prefer explicit parameter typing in utilities/services (e.g. `uploadAvatar(tenantId: string, userId: string, file: File)` in `src/services/avatarService.ts`).

**Return Values:** Nullability is commonly encoded via unions (e.g. `string | null`) rather than exceptions for validation helpers (`src/services/avatarService.ts`).

## Module Design

**Exports:**
- Mix of `export default` and named exports exists.
  - Default export example: `export default App;` in `src/App.tsx`
  - Named export example: `export function cn(...)` in `src/lib/utils.ts`
- ESLint react-refresh rule allows constant exports (`react-refresh/only-export-components` with `allowConstantExport: true` in `eslint.config.js`), which typically supports patterns like `export const Component = ...`.

**Barrel Files:**
- Present in some areas (e.g. `src/pages/backoffice/index.ts` exists), but usage is not global.

## TypeScript Strictness

**App code (default):**
- Non-strict TS is configured for app sources:
  - `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false` in `tsconfig.app.json`
  - `strictNullChecks: false`, `noImplicitAny: false` in `tsconfig.json`
- `allowJs: true` is enabled in `tsconfig.json`.

**Node/tooling config:**
- Tooling TS config is stricter:
  - `strict: true` in `tsconfig.node.json` (applies to `vite.config.ts`)

**Non-null assertions:**
- Present in app entry (e.g. `document.getElementById("root")!` in `src/main.tsx`).

---

*Convention analysis: 2026-03-27*

