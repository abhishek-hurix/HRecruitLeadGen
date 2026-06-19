# System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet / Users                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Nginx (SSL)    │
                    │  Reverse Proxy  │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐  ┌──────▼──────┐      │
     │  React SPA  │  │ Express API │      │
     │  (Vite)     │  │  (Node.js)  │      │
     └─────────────┘  └──────┬──────┘      │
                             │              │
              ┌──────────────┼──────────────┼──────────────┐
              │              │              │              │
     ┌────────▼────┐  ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐
     │ PostgreSQL  │  │ Local/S3    │ │  SMTP /   │ │  Docker   │
     │  (Prisma)   │  │  Storage    │ │  Resend   │ │  Sandbox  │
     └─────────────┘  └─────────────┘ └───────────┘ └───────────┘
```

## Component Diagram

### Frontend (React SPA)
- **Pages:** Landing, Register, Verify, Ready, Assessment, ThankYou, Admin*
- **State:** React Query for server state, local state for editor/timer
- **Routing:** React Router with protected assessment routes (token in URL/query)

### Backend (Express API)
- **Routes:** `/api/register`, `/api/verify`, `/api/assessment/*`, `/api/admin/*`
- **Middleware:** Auth (JWT), validation, rate limit, error handler
- **Services:** Registration, Assessment, Execution, Evaluation, Email, Storage

### Data Layer
- PostgreSQL via Prisma ORM
- Migrations managed by Prisma Migrate

### Execution Layer
- Docker CLI spawns ephemeral containers
- Separate images: `hurix-sandbox-python`, `hurix-sandbox-node`
- Temp workspace per execution, cleaned after run

## Request Flow: Registration

```
Candidate → POST /api/register (multipart)
         → Validate fields + PDF
         → Check duplicate email
         → Save resume (StorageService)
         → Create User + CandidateProfile
         → Generate AssessmentToken (JWT)
         → EmailService.sendAssessmentLink()
         → 201 Created
```

## Request Flow: Assessment Submit

```
Candidate → POST /api/submit (Bearer assessment JWT)
         → Verify token + assessment IN_PROGRESS
         → Validate all answers non-empty
         → For each question: EvaluationService.evaluate()
         → Docker sandbox × test cases
         → Aggregate score
         → Create Submission + SubmissionAnswers
         → Mark Assessment COMPLETED
         → 200 OK → Thank You page
```

## Technology Decisions

| Decision | Rationale |
|----------|-----------|
| Monorepo (frontend + backend) | Simpler MVP deployment |
| Prisma | Type-safe ORM, migrations, PostgreSQL native |
| React Query | Server cache, optimistic updates for admin |
| Docker sandbox | Industry standard for untrusted code execution |
| JWT assessment tokens | Stateless verification, email-link friendly |
| Local storage MVP | Zero cloud dependency for initial deploy |

## Future Architecture Evolution

- Extract execution service to dedicated worker queue (Bull/Redis)
- S3 for resumes and submission artifacts
- Kubernetes for multi-node sandbox scaling
- Event bus for ATS webhooks
