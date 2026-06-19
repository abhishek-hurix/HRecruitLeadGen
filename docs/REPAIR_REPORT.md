# Hurix Talent Assessment Platform — Repair Report

**Date:** June 2026  
**Status:** Fixed and Verified

---

## Phase 1: Root Cause Analysis

| # | Problem | Root Cause | Affected File | Fix |
|---|---------|------------|---------------|-----|
| 1 | Prisma seed fails — `DATABASE_URL` not found | `seed.ts` ran via `tsx` without loading `dotenv`; Prisma Client instantiated before env vars available | `backend/prisma/seed.ts` | Added `dotenv.config()` with explicit path to `backend/.env` before `PrismaClient` creation |
| 2 | Question table = 0 | Seed never completed due to #1 | `backend/prisma/seed.ts` | Fixed env loading; re-ran seed successfully |
| 3 | QuestionTestCase table = 0 | Same as #2 — seed aborted before question inserts | `backend/prisma/seed.ts` | Same fix; 600 test cases now seeded |
| 4 | Assessment table = 0 | Expected — assessments are created at runtime when candidate clicks Start | N/A | No fix needed; verified POST `/start` creates assessment |
| 5 | `GET /api/assessment/session` → 404 | Correct behavior when no IN_PROGRESS assessment exists yet | `frontend/src/pages/AssessmentPage.tsx` | Frontend was treating 404 as fatal → redirect to `/expired`. Now redirects to `/ready` instead |
| 6 | `POST /api/assessment/start` → 500 | Empty question bank ("Insufficient questions in bank") caused by failed seed | `backend/src/services/assessment.service.ts` | Fixed seed; verified start returns 10 questions |
| 7 | Valid users land on `/expired` | Frontend catch-all error handlers redirected ANY API failure to `/expired` | `ReadyPage.tsx`, `AssessmentPage.tsx`, `VerifyPage.tsx`, `ThankYouPage.tsx` | Added `isLinkExpiredError()` — only HTTP 401 redirects to `/expired` |
| 8 | Assessment never starts | Chain: empty DB → start 500 → catch → `/expired`. Also Ready page navigated without calling start API | `ReadyPage.tsx`, `AssessmentPage.tsx` | Ready page now calls `POST /start` before navigate; Assessment page only loads existing session |

---

## Phase 2: Database Repair

### Changes
- `backend/prisma/seed.ts` — dotenv loading, per-language seed counts, verification logs
- `backend/src/config/index.ts` — explicit `.env` path resolution

### Verification (after fix)
```
Questions (Python):     100
Questions (JavaScript): 100
Questions (Total):      200
QuestionTestCases:      600
Admin user:             seeded
Referral codes:         3
```

### Command
```bash
cd backend
npm run prisma:seed
```

---

## Phase 3: API Repair

### Verified Endpoints
| Endpoint | Status | Result |
|----------|--------|--------|
| `GET /api/assessment/ready` | 200 | Returns candidate info |
| `GET /api/assessment/session` | 404 | Expected when no session |
| `POST /api/assessment/start` | 200 | Creates assessment with 10 questions |
| `GET /api/assessment/session` | 200 | Returns same question IDs after start |
| `POST /api/assessment/run` | 200 | Executes code against sample tests |

### Assessment persistence
- Question IDs stored in `assessments.question_ids` (JSONB)
- Refresh loads same questions via `GET /session`
- `startAssessment` returns existing session if IN_PROGRESS (no re-randomization)

---

## Phase 4: Assessment Creation Flow (Fixed)

```
Ready Page → Select Language → [Start Assessment]
  → POST /api/assessment/start (creates DB record + 10 random question IDs)
  → Navigate to /assessment?token=...
  → GET /api/assessment/session (loads persisted questions)
```

---

## Phase 5: Registration Flow (Fixed)

- New route: `/registration-success`
- After registration → redirects with email in state
- Shows professional success UI with candidate email

---

## Phase 6: Token Verification (Fixed)

- `/expired` shown only for HTTP 401 (invalid/expired JWT)
- API 404/500/network errors show inline error or redirect to `/ready`
- Verify page: non-auth errors still proceed to ready page

---

## Phase 7: SMTP Integration

### Changes to `backend/src/services/email/email.service.ts`
- `verifyConnection()` — tests SMTP on startup
- `sendWithRetry()` — 3 attempts with exponential backoff
- Production-ready auth via `SMTP_USER` / `SMTP_PASS`
- Updated `.env.example` with `smtp.office365.com` and `shivesh.mishra@hurix.com`

### Production config
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=shivesh.mishra@hurix.com
SMTP_PASS=<provided later>
```

---

## Files Modified

### Backend
- `backend/prisma/seed.ts`
- `backend/src/config/index.ts`
- `backend/src/services/assessment.service.ts`
- `backend/src/services/email/email.service.ts`
- `backend/src/index.ts`
- `backend/package.json`
- `.env.example`

### Frontend
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/RegistrationSuccessPage.tsx` (new)
- `frontend/src/pages/ReadyPage.tsx`
- `frontend/src/pages/AssessmentPage.tsx`
- `frontend/src/pages/VerifyPage.tsx`
- `frontend/src/pages/ThankYouPage.tsx`
- `frontend/src/utils/apiErrors.ts` (new)
- `frontend/src/App.tsx`

### Scripts
- `backend/scripts/test-setup.ts` (QA helper)

---

## Manual QA Checklist

- [ ] `npm run prisma:seed` completes with 200 questions
- [ ] Register at `/register` → lands on `/registration-success`
- [ ] Email received (MailHog dev / SMTP prod)
- [ ] Click email link → `/verify` → `/ready`
- [ ] Select language → Start Assessment
- [ ] 10 questions load in assessment screen
- [ ] Refresh page → same 10 questions (same order)
- [ ] Run Code returns results
- [ ] Submit → Thank You page
- [ ] Invalid/expired token → `/expired` only
- [ ] API 500/404 does NOT redirect to `/expired`

---

## Final Working Candidate Flow

```
Landing → Register → Registration Success → Email → Verify Link
→ Ready Page → Start Assessment → 10 Questions → Run Code → Submit
→ Evaluation → Thank You ("Our team will reach out to you.")
```
