/**
 * Permanent candidate deletion — relation map
 *
 * Classification:
 * 1. MUST DELETE with candidate
 *    - CandidateResume
 *    - AssessmentToken
 *    - EmailVerificationToken
 *    - Assessment (+ Submission + SubmissionAnswer via cascade/order)
 *    - CandidateProfile
 *
 * 2. RETAIN with candidateId SET NULL + candidateReference preserved
 *    - AdminBulkOperationItem
 *    - EmailReminderDelivery
 *    - CandidateInterviewParticipant
 *    - CandidateRejection
 *
 * 3. RETAIN unchanged (historical / compliance)
 *    - AuditLog (entityId remains the deleted candidate UUID)
 *    - AdminBulkOperation parent rows
 *    - CandidateInterview parent rows (participants keep reference)
 *
 * 4. SET NULL only (no delete)
 *    - Visitor.candidateId
 *
 * 5. NEVER cascade / never delete via candidate removal
 *    - AdminUser
 *    - JobRole
 *    - Question / QuestionTestCase
 *    - EmailReminderTemplate
 *    - PlatformSetting
 *    - IdempotencyRecord
 *    - AdminGoogleCalendar
 *
 * Soft delete does not touch related rows.
 */
export const PERMANENT_DELETE_RELATION_MAP = {
  mustDelete: [
    'candidate_resumes',
    'assessment_tokens',
    'email_verification_tokens',
    'submission_answers',
    'submissions',
    'assessments',
    'candidate_profiles',
  ],
  retainSetNull: [
    'admin_bulk_operation_items',
    'email_reminder_deliveries',
    'candidate_interview_participants',
    'candidate_rejections',
    'visitors.candidate_id',
  ],
  retainUnchanged: ['audit_logs', 'admin_bulk_operations', 'candidate_interviews', 'idempotency_records'],
  neverTouch: [
    'admin_users',
    'job_roles',
    'questions',
    'email_reminder_templates',
    'admin_google_calendars',
    'platform_settings',
  ],
} as const;
