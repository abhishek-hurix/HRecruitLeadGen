# Hurix Talent Assessment Platform — Product Requirements Document

**Version:** 1.0.0  
**Status:** MVP  
**Owner:** Hurix Digital Engineering  
**Last Updated:** June 2026

---

## 1. Executive Summary

The Hurix Talent Assessment Platform is an enterprise-grade hiring system that enables candidates to register, receive secure assessment links via email, complete timed coding assessments, and submit solutions for automated evaluation. The platform serves as Hurix Digital's foundation for scalable technical hiring.

## 2. Problem Statement

Traditional hiring processes lack standardized technical evaluation, secure candidate verification, and automated scoring. HR teams need a centralized system to manage candidates, assessments, and results with enterprise security and auditability.

## 3. Product Vision

Become Hurix Digital's central hiring and talent assessment system — scalable from MVP to full ATS integration with AI-powered screening, proctoring, and analytics.

## 4. Target Users

| Persona | Goals |
|---------|-------|
| **Candidate** | Register, complete assessment, receive confirmation |
| **Super Admin** | Manage candidates, questions, review submissions, export data |
| **HR Team** | (Future) Review ranked candidates, schedule interviews |

## 5. Core User Flows

### 5.1 Candidate Registration Flow
1. Land on marketing page → Register with profile + resume
2. System creates candidate record (one email = one candidate)
3. JWT assessment link generated (7-day expiry) and emailed
4. Candidate clicks link → email auto-verified → Ready For Test page
5. Select Python or JavaScript → Start 60-minute assessment (10 random questions)
6. Write code, run against sample tests, submit
7. Auto-evaluation → Thank You page (no score shown)

### 5.2 Admin Flow
1. Login with super admin credentials
2. View dashboard metrics
3. Search/filter candidates, download resumes
4. Review assessment submissions and scores
5. CRUD question bank (Python/JavaScript)
6. Export candidates to CSV

## 6. Feature Requirements

### 6.1 Registration
- Required: Full Name, Email, Phone, LinkedIn URL, Resume (PDF, max 5MB)
- Optional: Referral Code (Employee ID)
- Validation on all fields; duplicate email blocked

### 6.2 Email Verification (Link-Based, No OTP)
- JWT-signed assessment URL serves as verification
- 7-day expiration with clear expired-link messaging

### 6.3 Assessment Engine
- Language choice: Python OR JavaScript
- 10 random questions from 100-question bank per language
- 60-minute timer; one attempt only; no resume after submit
- Copy/paste/cut/right-click disabled in editor

### 6.4 Code Execution
- Docker-isolated sandboxes (no network, CPU/memory limits, timeout)
- Run code against visible sample + hidden test cases

### 6.5 Evaluation
- Hybrid: execute against hidden test cases
- Score = questions fully passed / total questions
- Store execution time, memory, per-question results

### 6.6 Admin Panel
- Single role: Super Admin
- Dashboard, candidate management, assessment review, question CRUD, CSV export

## 7. Success Metrics

| Metric | Target (MVP) |
|--------|--------------|
| Registration completion rate | > 80% |
| Assessment completion rate | > 70% |
| Code execution success rate | > 99% |
| Average evaluation time | < 30s per submission |
| Platform uptime | 99.5% |

## 8. Out of Scope (MVP)

- AI resume screening, interview bot, proctoring
- ATS integration, candidate ranking, talent analytics
- Multi-role admin (recruiter, hiring manager)
- OAuth / social login for candidates

## 9. Assumptions & Constraints

- VPS deployment with Docker Compose
- PostgreSQL as primary datastore
- SMTP for email (Resend-ready abstraction)
- Local file storage for resumes (S3-ready abstraction)
- Docker available on host for code execution

## 10. Release Criteria

- [ ] End-to-end candidate flow functional
- [ ] All 10 security rules enforced
- [ ] 200 questions seeded (100 Python, 100 JavaScript)
- [ ] Admin panel operational
- [ ] Docker Compose production stack deployable
- [ ] API documentation complete
