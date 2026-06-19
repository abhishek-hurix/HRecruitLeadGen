# Security Design

## Authentication & Authorization

### Candidate Assessment Tokens
- **Type:** JWT (HS256)
- **Payload:** `{ sub: candidateId, jti, type: 'assessment', iat, exp }`
- **Expiry:** 7 days from registration
- **Storage:** `assessment_tokens` table tracks `jti` for revocation
- **Validation:** Signature + expiry + jti not revoked + candidate exists

### Admin Tokens
- **Type:** JWT (HS256)
- **Payload:** `{ sub: adminId, role: 'SUPER_ADMIN', iat, exp }`
- **Expiry:** 8 hours
- **Password:** bcrypt (12 rounds)

## Security Rules Implementation

| # | Rule | Implementation |
|---|------|----------------|
| 1 | One email = one attempt | `users.email` UNIQUE; assessment status COMPLETED blocks re-start |
| 2 | JWT expiration | `exp` claim + DB `expires_at` |
| 3 | Submit = permanent | `assessments.status = COMPLETED` immutable |
| 4 | Disable copy | `onCopy` preventDefault in editor |
| 5 | Disable paste | `onPaste` preventDefault |
| 6 | Disable cut | `onCut` preventDefault |
| 7 | No empty submission | Server validates all 10 answers have non-whitespace code |
| 8 | Disable right-click | `onContextMenu` preventDefault in editor zone |
| 9 | URL protected | All `/assessment/*` require valid Bearer token |
| 10 | No duplicate submit | DB unique on `submissions.assessment_id` + status guard |

## Input Validation
- Zod schemas on all endpoints
- File upload: magic bytes check for PDF, max 5MB
- LinkedIn URL regex validation
- Phone: international format normalization

## HTTP Security
- Helmet.js (CSP, X-Frame-Options, etc.)
- CORS: whitelist frontend origin
- Rate limiting: 5 req/min on register, 10 req/min on login

## Data Protection
- Resumes stored outside web root
- Admin-only resume download with auth
- No PII in logs
- Audit trail for admin actions

## Sandbox Security
- Docker `--network none`
- Resource limits (CPU, memory, timeout)
- No privileged containers
- Temp files deleted after execution
- Code never `eval()`'d on host

## Secrets Management
- All secrets via environment variables
- `.env` never committed
- JWT secrets rotatable without code change
