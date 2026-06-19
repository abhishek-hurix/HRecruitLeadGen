# Admin Dashboard Design

## Navigation Structure

```
Dashboard
├── Overview (metrics)
Candidates
├── All Candidates
├── Search & Filter
├── Export CSV
Assessments
├── Submissions Review
Questions
├── Python Questions
├── JavaScript Questions
Settings (future)
```

## Dashboard Metrics

| Card | Query |
|------|-------|
| Total Candidates | COUNT(candidate_profiles) |
| Registered | Same as total (MVP) |
| Verified | COUNT WHERE email_verified = true |
| Completed | COUNT assessments WHERE status = COMPLETED |
| Average Score | AVG(submissions.score) |

## Candidate Table Columns
- Name, Email, Phone, LinkedIn (link), Referral Code
- Email Verified (badge)
- Assessment Status (badge)
- Score (if completed)
- Submitted At
- Actions: View, Resume

## Filters
- Search: name, email (ILIKE)
- Status: All, Verified, In Progress, Completed, Not Started
- Date range: registered between

## Submission Review Panel
- Candidate header info
- Per-question accordion:
  - Question title, difficulty, topic
  - Submitted code (syntax highlighted)
  - Test results: X/Y passed
  - Execution time
- Overall score: 7/10

## Question CRUD
- Create/Edit modal with all question fields
- Test case table: input, expected output, hidden toggle
- Soft delete (is_active = false)
- Bulk import (future)

## Export CSV Fields
- Full Name, Email, Phone, LinkedIn, Referral Code
- Email Verified, Assessment Status, Score, Submitted At

## Access Control (MVP)
- Single Super Admin account (seeded)
- Future: RBAC with Recruiter, Hiring Manager roles
