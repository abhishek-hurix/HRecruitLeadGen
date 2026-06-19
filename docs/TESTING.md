# Hurix Talent — Testing Guide

Enterprise automated testing strategy for the Hurix Talent Assessment Platform.

## Coverage Targets

| Layer | Target | Current (scoped modules) | Framework |
|-------|--------|--------------------------|-----------|
| Backend | 80%+ | **94%** lines on critical services/utils/middleware | Vitest + Supertest |
| Frontend | 70%+ | **84%** lines on utils, guards, landing page | Vitest + React Testing Library |
| Critical flows | 100% | **5/5** Playwright flows | Playwright |
| Security / RBAC | 100% | **16/16** tests | Vitest integration |

## Test Structure

```
backend/tests/
  unit/           # Pure logic, JWT, UTM, RBAC, validation, scoring
  integration/    # API + database (Supertest)
  security/       # Auth bypass, role escalation, token isolation
  helpers/        # Factories, DB utilities, app helper

frontend/src/tests/
  utils/          # UTM, form validation
  components/     # Route guards
  pages/          # Landing, forms

e2e/flows/        # Playwright browser automation
```

## Test Database

**Never use production data for tests.**

```bash
# Create hurix_talent_test, migrate, and seed
cd backend
npm run test:db:setup
```

Configure in `backend/.env.test`:

```
TEST_DATABASE_URL=postgresql://hurix:hurix_secret@localhost:5432/hurix_talent_test?schema=public
```

## Running Tests

### All tests (from repo root)

```bash
npm install          # root orchestrator (optional)
cd backend && npm install
cd ../frontend && npm install
cd ../e2e && npm install

npm run test:db:setup   # from backend/
cd ..
npm test                # unit + integration + security + frontend
```

### Backend

```bash
cd backend
npm run test:unit          # JWT, UTM, RBAC, validation (no DB)
npm run test:integration   # API + DB tests
npm run test:security      # RBAC & authorization
npm run test:coverage      # HTML report in backend/coverage/
```

### Frontend

```bash
cd frontend
npm run test
npm run test:coverage      # HTML report in frontend/coverage/
```

### Playwright E2E

```bash
cd e2e
npx playwright install chromium
npm test                   # Starts backend + frontend automatically
npm run report             # View HTML report
```

### Legacy scripts (still available)

```bash
cd backend
npm run test:e2e           # Full assessment flow script
npm run test:attribution   # UTM attribution script
npm run test:hygiene       # Analytics hygiene script
```

## Critical Flows Covered

| Flow | Coverage |
|------|----------|
| Visitor → Register → Assessment → Submit | `e2e-test.ts`, Playwright Flow 1 |
| Candidate Login → Dashboard UI | Playwright Flow 2, `auth.test.ts` |
| Admin login → Candidates | Playwright Flow 3, `rbac.test.ts` |
| SUPER_ADMIN → Analytics | Playwright Flow 4 + `hygiene-test.ts` |
| UTM → Visitor → Attribution | Playwright Flow 5, `attribution-test.ts`, UTM unit tests |
| RBAC / Security | `tests/security/rbac.test.ts`, `assessment-auth.test.ts` |
| One visitor per browser | `visitor-dedup-test.ts`, visitor service tests |
| JWT / Password / OAuth | `jwt.test.ts`, `auth-password.test.ts`, `candidate-auth.service.test.ts` |
| Scoring engine | `evaluation.service.test.ts`, `validation-scoring.test.ts` |

## Test Inventory

| Suite | Tests | Location |
|-------|-------|----------|
| Backend unit | 48 | `backend/tests/unit/` |
| Backend integration | 22 | `backend/tests/integration/` + DB-backed service tests |
| Backend security | 16 | `backend/tests/security/` |
| Frontend | 28 | `frontend/src/tests/` |
| Playwright E2E | 5 | `e2e/flows/` |
| **Total automated** | **88+ backend, 28 frontend, 5 e2e** | |

## CI/CD

GitHub Actions workflow: `.github/workflows/test.yml`

Runs on every push/PR to `main`:
1. Backend unit + integration + security (PostgreSQL service)
2. Frontend unit tests with coverage
3. Playwright E2E (after unit tests pass)

## Quality Gates

CI enforces:
- **Critical module coverage** ≥ 80% backend, ≥ 70% frontend (`vitest.config.ts` thresholds)
- **All security tests pass** (RBAC + assessment token middleware)
- **All integration tests pass** (API, database, auth)
- **Playwright critical flows pass** (5 browser automation specs)

Run `npm run test:coverage` in `backend/` and `frontend/` for HTML reports.

## Reports

| Report | Location |
|--------|----------|
| Backend coverage HTML | `backend/coverage/index.html` |
| Frontend coverage HTML | `frontend/coverage/index.html` |
| Playwright HTML | `e2e/playwright-report/index.html` |

## Writing New Tests

1. **Unit** — pure functions, no DB: `backend/tests/unit/`
2. **Integration** — use `getTestApp()`, `resetTestData()`, factories
3. **Frontend** — mock contexts/APIs, use RTL queries
4. **E2E** — add specs to `e2e/flows/`

Use `describe.skip` pattern via `hasTestDatabase()` when DB unavailable locally.
