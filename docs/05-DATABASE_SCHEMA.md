# Database Schema

## Entity Relationship Overview

```
users ──1:1── candidate_profiles
candidate_profiles ──1:N── assessment_tokens
candidate_profiles ──1:N── assessments
assessments ──1:1── submissions
submissions ──1:N── submission_answers
questions ──1:N── question_testcases
submission_answers ──N:1── questions
referrals ── (referenced by candidate_profiles.referral_code)
admin_users ──1:N── audit_logs
```

## Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | |

### candidate_profiles
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users, UNIQUE |
| full_name | VARCHAR(255) | NOT NULL |
| phone | VARCHAR(20) | NOT NULL |
| linkedin_url | VARCHAR(500) | NOT NULL |
| resume_path | VARCHAR(500) | NOT NULL |
| referral_code | VARCHAR(50) | NULLABLE |
| email_verified | BOOLEAN | DEFAULT false |
| email_verified_at | TIMESTAMPTZ | NULLABLE |

### referrals
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| employee_id | VARCHAR(50) | UNIQUE, NOT NULL |
| employee_name | VARCHAR(255) | NULLABLE |
| is_active | BOOLEAN | DEFAULT true |

### assessment_tokens
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| candidate_id | UUID | FK → candidate_profiles |
| jti | VARCHAR(64) | UNIQUE (JWT ID) |
| expires_at | TIMESTAMPTZ | NOT NULL |
| is_revoked | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### assessments
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| candidate_id | UUID | FK → candidate_profiles |
| language | ENUM | PYTHON, JAVASCRIPT |
| status | ENUM | PENDING, IN_PROGRESS, COMPLETED, EXPIRED |
| question_ids | JSONB | Array of question UUIDs |
| started_at | TIMESTAMPTZ | NULLABLE |
| expires_at | TIMESTAMPTZ | NULLABLE (started_at + 60min) |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### questions
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| language | ENUM | PYTHON, JAVASCRIPT |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | NOT NULL |
| input_format | TEXT | |
| output_format | TEXT | |
| sample_input | TEXT | |
| sample_output | TEXT | |
| constraints | TEXT | |
| difficulty | ENUM | EASY, EASY_MEDIUM |
| topic | VARCHAR(100) | |
| starter_code | TEXT | |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### question_testcases
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| question_id | UUID | FK → questions |
| input | TEXT | NOT NULL |
| expected_output | TEXT | NOT NULL |
| is_hidden | BOOLEAN | DEFAULT true |
| sort_order | INT | DEFAULT 0 |

### submissions
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| assessment_id | UUID | FK → assessments, UNIQUE |
| candidate_id | UUID | FK → candidate_profiles |
| score | DECIMAL(5,2) | NOT NULL |
| passed_questions | INT | NOT NULL |
| total_questions | INT | NOT NULL |
| submitted_at | TIMESTAMPTZ | DEFAULT now() |

### submission_answers
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| submission_id | UUID | FK → submissions |
| question_id | UUID | FK → questions |
| code | TEXT | NOT NULL |
| passed_tests | INT | DEFAULT 0 |
| failed_tests | INT | DEFAULT 0 |
| execution_time_ms | INT | |
| memory_kb | INT | |
| test_results | JSONB | Per-test-case results |
| is_fully_passed | BOOLEAN | DEFAULT false |

### admin_users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| role | ENUM | SUPER_ADMIN |
| created_at | TIMESTAMPTZ | |
| last_login_at | TIMESTAMPTZ | |

### audit_logs
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| admin_user_id | UUID | FK → admin_users, NULLABLE |
| action | VARCHAR(100) | NOT NULL |
| entity_type | VARCHAR(50) | |
| entity_id | VARCHAR(100) | |
| metadata | JSONB | |
| ip_address | VARCHAR(45) | |
| created_at | TIMESTAMPTZ | DEFAULT now() |

## Indexes

- `users(email)` UNIQUE
- `candidate_profiles(user_id)` UNIQUE
- `assessments(candidate_id, status)`
- `questions(language, is_active)`
- `assessment_tokens(jti)` UNIQUE
- `submissions(assessment_id)` UNIQUE
