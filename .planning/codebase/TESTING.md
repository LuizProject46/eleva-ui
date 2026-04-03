# Testing Patterns

**Analysis Date:** 2026-03-27

## Test Framework

**Runner:**
- Vitest `^3.2.4` (from `package.json`)
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest `expect` (examples: `src/test/example.test.ts`, `src/lib/periodicity.test.ts`)
- DOM matchers: `@testing-library/jest-dom` loaded in setup (`src/test/setup.ts`)

**Run Commands:**

```bash
npm run test          # Runs `vitest run` (package.json)
npm run test:watch    # Runs `vitest` (package.json)
```

## Test File Organization

**Location:**
- Tests are co-located under `src/**` (e.g. `src/services/avatarService.test.ts`, `src/lib/periodicity.test.ts`).

**Naming:**
- `*.test.ts` / `*.test.tsx` (Vitest include pattern is `src/**/*.{test,spec}.{ts,tsx}` in `vitest.config.ts`)

**Structure:**
- No dedicated `tests/` folder detected; test files sit next to the modules they validate.

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect } from "vitest";

describe("feature", () => {
  it("does something", () => {
    expect(true).toBe(true);
  });
});
```

Example: `src/test/example.test.ts`

**Patterns:**
- Use of helper factories for building typed fixtures (e.g. `makePdi`, `makePlanAction`, `makeActionPlan` in `src/modules/pdi/utils/derivePdiStatus.test.ts`)
- Use of `beforeEach` for mock reset (e.g. `src/services/certificateService.test.ts`)

## Mocking

**Framework:** Vitest mocks (`vi`) (from `vitest` imports in `src/services/certificateService.test.ts`, `src/modules/pdi/utils/derivePdiStatus.test.ts`)

**Patterns:**

```typescript
import { vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: vi.fn() },
}));
```

Example: `src/services/certificateService.test.ts`

**What to Mock:**
- External clients (e.g. Supabase client module mocked in `src/services/certificateService.test.ts`)

**What NOT to Mock:**
- Pure utilities and deterministic logic (e.g. `getPeriodStatus` is used directly without mocks in `src/lib/periodicity.test.ts`)

## Fixtures and Factories

**Test Data:**
- Inline factories returning typed objects, using `Partial<T>` to override fields (evidence: `makePlanAction(partial: Partial<PdiPlanAction>)` in `src/modules/pdi/utils/derivePdiStatus.test.ts`).
- Inline `File` objects for browser APIs under jsdom (evidence: `new File(...)` in `src/services/avatarService.test.ts`).

**Location:**
- Co-located within the test file (no central fixtures directory detected in sampled tests).

## Coverage

**Requirements:** Not detected (no coverage threshold/config in `vitest.config.ts` and no `coverage` script in `package.json`).

**View Coverage:**
- Not configured via `package.json` scripts.

## Test Types

**Unit Tests:**
- Present and dominant (examples: `src/test/example.test.ts`, `src/lib/periodicity.test.ts`, `src/modules/pdi/utils/derivePdiStatus.test.ts`).

**Integration Tests:**
- Some tests validate boundaries against migrations/filesystem behavior (example: reads `supabase/migrations/040_...sql` with `fs.readFileSync` in `src/services/certificateService.test.ts`).

**E2E Tests:**
- Not detected (no Playwright/Cypress config files found in repo root; no related scripts in `package.json`).

## Common Patterns

**Async Testing:**

```typescript
it("does async work", async () => {
  const result = await someAsyncFn();
  expect(result).not.toBeNull();
});
```

Example: `generateCertificateIfEligible` tests in `src/services/certificateService.test.ts`

**Error Testing:**
- Validation functions tested using return values and string containment (example: `expect(validateAvatarFile(file)).toContain("5MB")` in `src/services/avatarService.test.ts`).

**Time Control:**
- Use `vi.setSystemTime(...)` and cleanup with `vi.useRealTimers()` (example: `src/modules/pdi/utils/derivePdiStatus.test.ts`).

## Test Environment Setup

**Environment:**
- `jsdom` (`vitest.config.ts`)
- Vitest globals enabled (`globals: true` in `vitest.config.ts`, and `types: ["vitest/globals"]` in `tsconfig.app.json`)

**Setup Files:**
- `src/test/setup.ts`:
  - Imports `@testing-library/jest-dom`
  - Defines `window.matchMedia` stub for component code relying on it

---

*Testing analysis: 2026-03-27*

