# Prisma Models

The complete Prisma schema is located at `backend/prisma/schema.prisma`.

## Models Overview

| Model | Table | Description |
|-------|-------|-------------|
| User | users | Core user identity (email) |
| CandidateProfile | candidate_profiles | Candidate registration data |
| Referral | referrals | Employee referral codes |
| AssessmentToken | assessment_tokens | JWT token tracking |
| Assessment | assessments | Assessment sessions |
| Question | questions | Question bank |
| QuestionTestCase | question_testcases | Test cases per question |
| Submission | submissions | Completed assessment results |
| SubmissionAnswer | submission_answers | Per-question answers |
| AdminUser | admin_users | Super admin accounts |
| AuditLog | audit_logs | Admin action audit trail |

## Enums

- `Language`: PYTHON, JAVASCRIPT
- `Difficulty`: EASY, EASY_MEDIUM
- `AssessmentStatus`: PENDING, IN_PROGRESS, COMPLETED, EXPIRED
- `AdminRole`: SUPER_ADMIN

See `backend/prisma/schema.prisma` for full field definitions and relations.
