# Functional Requirements

## FR-001: Landing Page
- Display Hurix branding, platform value proposition, CTA to register
- Responsive layout; logo top-left

## FR-002: Candidate Registration
- Form fields: Full Name*, Email*, Phone*, LinkedIn URL*, Resume (PDF)*, Referral Code
- Client + server validation
- Block duplicate email registration
- Store resume locally; persist candidate profile

## FR-003: Assessment Link Generation
- On successful registration, generate JWT (7-day expiry, candidate-scoped)
- Persist token record for revocation/audit
- Send email with "Start Assessment" link

## FR-004: Email Verification via Link
- `GET /api/verify?token=...` validates JWT, marks email verified
- Redirect to Ready For Test page
- Expired token → "Assessment Link Expired. Please contact HR."

## FR-005: Ready For Test Page
- Show candidate name, language options, 10 questions, 60 min duration
- Display instructions checklist
- "Start Assessment" initiates session

## FR-006: Assessment Session
- Randomly select 10 questions from chosen language bank
- 60-minute countdown timer
- Split-panel UI: question details (left), code editor (right)
- Per-question code persistence in session
- Run Code: execute against sample test cases only
- Submit: validate non-empty answers, run full evaluation

## FR-007: Security Controls
| Rule | Implementation |
|------|----------------|
| One email = one attempt | DB constraint + assessment status check |
| JWT expiration | 7-day token expiry |
| Submit = permanent | Assessment status COMPLETED, immutable |
| Disable copy/paste/cut | Editor event handlers |
| No empty submission | All 10 answers must have code |
| Disable right-click | Context menu prevention in editor |
| URL protected | JWT required for all assessment routes |
| No duplicate submit | Idempotent submit with status guard |

## FR-008: Code Execution Engine
- Docker sandbox per execution
- Python 3.11 and Node.js 20 runtimes
- Limits: 128MB RAM, 0.5 CPU, 10s timeout, no network

## FR-009: Evaluation Engine
- Run against all test cases (sample + hidden)
- Per question: passed/failed count, execution time
- Final score: count of fully-passed questions / 10

## FR-010: Thank You Page
- Success message, candidate name, submission time, status
- No score displayed to candidate

## FR-011: Admin Authentication
- Email/password login, JWT session for admin
- Super Admin role only

## FR-012: Admin Dashboard
- Metrics: total candidates, registered, verified, completed, average score

## FR-013: Candidate Management
- List with search and filters
- View profile, download resume
- Export CSV

## FR-014: Assessment Review
- View candidate answers, per-question results, scores, submission time

## FR-015: Question Management
- CRUD for Python and JavaScript questions
- Manage test cases per question

## FR-016: Audit Logging
- Log admin actions (login, question changes, exports)
