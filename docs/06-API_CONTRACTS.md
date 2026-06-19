# API Contracts

Base URL: `/api`  
Content-Type: `application/json` (unless multipart)

---

## Public Endpoints

### POST /api/register
**Description:** Register a new candidate  
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| fullName | string | Yes | 2-100 chars |
| email | string | Yes | Valid email |
| phone | string | Yes | 10-15 digits |
| linkedinUrl | string | Yes | linkedin.com URL |
| referralCode | string | No | Alphanumeric |
| resume | file | Yes | PDF only, max 5MB |

**Response 201:**
```json
{
  "success": true,
  "message": "Registration successful. Check your email for the assessment link.",
  "candidateId": "uuid"
}
```

**Response 409:** Duplicate email  
**Response 400:** Validation errors

---

### GET /api/verify
**Description:** Verify email via JWT assessment link  
**Query:** `token` (JWT string)

**Response 200:**
```json
{
  "success": true,
  "candidateName": "John Doe",
  "redirectUrl": "/ready?token=..."
}
```

**Response 401:** Invalid/expired token

---

### GET /api/assessment/ready
**Description:** Get ready-for-test page data  
**Headers:** `Authorization: Bearer <assessment_token>`

**Response 200:**
```json
{
  "candidateName": "John Doe",
  "emailVerified": true,
  "hasCompleted": false,
  "hasInProgress": false
}
```

---

### POST /api/assessment/start
**Description:** Start assessment session  
**Headers:** `Authorization: Bearer <assessment_token>`

**Body:**
```json
{ "language": "PYTHON" | "JAVASCRIPT" }
```

**Response 200:**
```json
{
  "assessmentId": "uuid",
  "language": "PYTHON",
  "expiresAt": "2026-06-17T15:00:00Z",
  "questions": [
    {
      "id": "uuid",
      "title": "Reverse String",
      "description": "...",
      "inputFormat": "...",
      "outputFormat": "...",
      "sampleInput": "...",
      "sampleOutput": "...",
      "constraints": "...",
      "starterCode": "...",
      "order": 1
    }
  ]
}
```

---

### GET /api/assessment/session
**Description:** Resume in-progress assessment (same token)  
**Headers:** `Authorization: Bearer <assessment_token>`

**Response 200:** Same as start + saved answers

---

### POST /api/assessment/run
**Description:** Run code against sample test cases  
**Headers:** `Authorization: Bearer <assessment_token>`

**Body:**
```json
{
  "questionId": "uuid",
  "code": "def solution(): ..."
}
```

**Response 200:**
```json
{
  "results": [
    { "input": "...", "expected": "...", "actual": "...", "passed": true }
  ],
  "passedCount": 1,
  "totalCount": 1,
  "executionTimeMs": 120
}
```

---

### POST /api/assessment/submit
**Description:** Submit complete assessment  
**Headers:** `Authorization: Bearer <assessment_token>`

**Body:**
```json
{
  "answers": [
    { "questionId": "uuid", "code": "..." }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "submittedAt": "2026-06-17T14:30:00Z",
  "candidateName": "John Doe",
  "status": "COMPLETED"
}
```

---

### GET /api/assessment/thank-you
**Description:** Post-submission summary (no score)  
**Headers:** `Authorization: Bearer <assessment_token>`

---

## Admin Endpoints

All admin routes require `Authorization: Bearer <admin_jwt>`

### POST /api/admin/login
**Body:** `{ "email": "...", "password": "..." }`  
**Response:** `{ "token": "...", "admin": { "id", "email", "role" } }`

### GET /api/admin/dashboard
**Response:**
```json
{
  "totalCandidates": 150,
  "registeredCandidates": 150,
  "verifiedCandidates": 120,
  "completedAssessments": 85,
  "averageScore": 6.4
}
```

### GET /api/admin/candidates
**Query:** `search`, `status`, `page`, `limit`  
**Response:** Paginated candidate list

### GET /api/admin/candidates/:id
**Response:** Full candidate profile + assessment + submission

### GET /api/admin/candidates/:id/resume
**Response:** PDF file download

### GET /api/admin/candidates/export
**Response:** CSV file

### GET /api/admin/questions
**Query:** `language`, `page`, `limit`

### POST /api/admin/questions
### PUT /api/admin/questions/:id
### DELETE /api/admin/questions/:id

### GET /api/admin/submissions/:id
**Response:** Full submission with answers and test results

---

## Health

### GET /health
**Response:** `{ "status": "ok", "timestamp": "..." }`

### GET /ready
**Response:** `{ "status": "ready", "database": "connected" }`
