import { v4 as uuidv4 } from 'uuid';
import { BulkOperationAction, InterviewMode, InterviewStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { writeAuditLog } from '../utils/admin-safety';
import { config } from '../config';
import { emailService } from './email.service';
import { CandidateSelectionInput, resolveCandidateIds } from './candidate-selection.service';
import { BulkOperationResult } from './candidate-bulk.service';
import { logger } from '../utils/logger';
import { candidateReferenceFromId } from '../utils/idempotency';

export interface ScheduleInterviewInput {
  selection: CandidateSelectionInput;
  title: string;
  notes?: string;
  startUtc: string;
  timezone: string;
  durationMinutes: number;
  gapMinutes?: number;
  mode: 'SINGLE' | 'GROUP' | 'SEQUENTIAL';
  createMeet?: boolean;
  idempotencyKey: string;
  interviewerEmails?: string[];
}

/**
 * Google Calendar integration.
 * When GOOGLE_CALENDAR_MOCK_MODE=true (default in test/dev without credentials),
 * events are simulated with fake IDs.
 */
async function createCalendarEvent(params: {
  adminUserId: string;
  title: string;
  description: string;
  startUtc: Date;
  endUtc: Date;
  attendeeEmails: string[];
  createMeet: boolean;
}): Promise<{ eventId: string; meetUrl: string | null }> {
  const mockMode =
    process.env.GOOGLE_CALENDAR_MOCK_MODE === 'true' ||
    !process.env.GOOGLE_CALENDAR_CLIENT_ID ||
    !process.env.TOKEN_ENCRYPTION_KEY;

  if (mockMode) {
    const eventId = `mock-event-${uuidv4()}`;
    return {
      eventId,
      meetUrl: params.createMeet ? `https://meet.google.com/mock-${eventId.slice(0, 8)}` : null,
    };
  }

  const connection = await prisma.adminGoogleCalendar.findFirst({
    where: { adminUserId: params.adminUserId, status: 'ACTIVE', revokedAt: null },
    orderBy: { connectedAt: 'desc' },
  });
  if (!connection) {
    throw new AppError(400, 'Connect Google Calendar before scheduling interviews');
  }

  // Production path: use googleapis with decrypted refresh token.
  // Kept behind mock until OAuth connect flow credentials are configured.
  throw new AppError(
    501,
    'Google Calendar live mode requires GOOGLE_CALENDAR_CLIENT_ID/SECRET and TOKEN_ENCRYPTION_KEY. Use GOOGLE_CALENDAR_MOCK_MODE=true for local testing.'
  );
}

export class InterviewService {
  async getCalendarStatus(adminUserId: string) {
    const connection = await prisma.adminGoogleCalendar.findFirst({
      where: { adminUserId, status: 'ACTIVE', revokedAt: null },
      orderBy: { connectedAt: 'desc' },
    });
    return {
      connected: Boolean(connection),
      googleEmail: connection?.googleEmail || null,
      mockMode:
        process.env.GOOGLE_CALENDAR_MOCK_MODE === 'true' ||
        !process.env.GOOGLE_CALENDAR_CLIENT_ID,
    };
  }

  async schedule(
    input: ScheduleInterviewInput,
    adminUserId: string,
    adminEmail: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<BulkOperationResult & { interviewId?: string; meetUrl?: string | null }> {
    if (!input.idempotencyKey?.trim()) throw new AppError(400, 'idempotencyKey is required');
    if (!input.title?.trim()) throw new AppError(400, 'Interview title is required');
    if (!input.timezone?.trim()) throw new AppError(400, 'Timezone is required');
    if (!input.durationMinutes || input.durationMinutes < 15) {
      throw new AppError(400, 'Duration must be at least 15 minutes');
    }

    const existing = await prisma.candidateInterview.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { participants: true },
    });
    if (existing) {
      return {
        operationId: existing.idempotencyKey,
        interviewId: existing.id,
        meetUrl: existing.meetUrl,
        summary: {
          requested: existing.participants.length,
          succeeded: existing.status === InterviewStatus.CONFIRMED ? existing.participants.length : 0,
          failed: existing.status === InterviewStatus.FAILED ? existing.participants.length : 0,
          skipped: 0,
        },
        errors: [],
      };
    }

    const { ids, filterSnapshot } = await resolveCandidateIds(input.selection);
    if (ids.length > 1 && input.mode === 'SINGLE') {
      throw new AppError(400, 'Choose GROUP or SEQUENTIAL mode for multiple candidates');
    }

    const start = new Date(input.startUtc);
    if (Number.isNaN(start.getTime())) throw new AppError(400, 'Invalid start time');

    const durationMs = input.durationMinutes * 60_000;
    const gapMs = (input.gapMinutes || 0) * 60_000;
    const end =
      input.mode === 'SEQUENTIAL'
        ? new Date(start.getTime() + ids.length * durationMs + Math.max(0, ids.length - 1) * gapMs)
        : new Date(start.getTime() + durationMs);

    const operationId = uuidv4();
    await prisma.adminBulkOperation.create({
      data: {
        operationId,
        action: BulkOperationAction.SCHEDULE_INTERVIEW,
        status: 'RUNNING',
        adminUserId,
        selectionMode: input.selection.mode,
        filterSnapshot: (filterSnapshot || input.selection.filters || undefined) as object,
        requestedCount: ids.length,
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        metadata: { idempotencyKey: input.idempotencyKey, mode: input.mode },
      },
    });

    const interview = await prisma.candidateInterview.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        operationId,
        mode: input.mode as InterviewMode,
        title: input.title.trim(),
        notes: input.notes || null,
        startUtc: start,
        endUtc: end,
        timezone: input.timezone,
        durationMinutes: input.durationMinutes,
        gapMinutes: input.gapMinutes || 0,
        status: InterviewStatus.PENDING,
        scheduledByAdminId: adminUserId,
      },
    });

    const candidates = await prisma.candidateProfile.findMany({
      where: { id: { in: ids } },
      include: { user: true },
    });

    const participantSlots = candidates.map((c, index) => {
      const slotStart =
        input.mode === 'SEQUENTIAL'
          ? new Date(start.getTime() + index * (durationMs + gapMs))
          : start;
      const slotEnd = new Date(slotStart.getTime() + durationMs);
      return { candidate: c, slotStart, slotEnd };
    });

    let eventId: string | null = null;
    let meetUrl: string | null = null;
    const errors: Array<{ candidateId: string; code: string; message: string }> = [];

    try {
      if (input.mode === 'GROUP' || ids.length === 1) {
        const created = await createCalendarEvent({
          adminUserId,
          title: input.title,
          description: input.notes || '',
          startUtc: start,
          endUtc: end,
          attendeeEmails: [
            ...candidates.map((c) => c.user.email),
            adminEmail,
            ...(input.interviewerEmails || []),
          ],
          createMeet: input.createMeet !== false,
        });
        eventId = created.eventId;
        meetUrl = created.meetUrl;
      } else {
        // Sequential: one event per candidate
        for (const slot of participantSlots) {
          const created = await createCalendarEvent({
            adminUserId,
            title: `${input.title} — ${slot.candidate.fullName}`,
            description: input.notes || '',
            startUtc: slot.slotStart,
            endUtc: slot.slotEnd,
            attendeeEmails: [slot.candidate.user.email, adminEmail, ...(input.interviewerEmails || [])],
            createMeet: input.createMeet !== false,
          });
          await prisma.candidateInterviewParticipant.create({
            data: {
              interviewId: interview.id,
              candidateId: slot.candidate.id,
              candidateReference: candidateReferenceFromId(slot.candidate.id),
              startUtc: slot.slotStart,
              endUtc: slot.slotEnd,
              googleEventId: created.eventId,
              meetUrl: created.meetUrl,
            },
          });
        }
      }

      if (input.mode !== 'SEQUENTIAL') {
        await prisma.candidateInterviewParticipant.createMany({
          data: participantSlots.map((slot) => ({
            interviewId: interview.id,
            candidateId: slot.candidate.id,
            candidateReference: candidateReferenceFromId(slot.candidate.id),
            startUtc: slot.slotStart,
            endUtc: slot.slotEnd,
            googleEventId: eventId,
            meetUrl,
          })),
        });
      }

      await prisma.candidateInterview.update({
        where: { id: interview.id },
        data: {
          status: InterviewStatus.CONFIRMED,
          googleEventId: eventId,
          meetUrl,
          calendarOwnerEmail: adminEmail,
        },
      });

      // Mark candidates as INTERVIEWED in selection status when scheduled
      await prisma.candidateProfile.updateMany({
        where: { id: { in: ids } },
        data: { selectionStatus: 'INTERVIEWED' },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Calendar creation failed';
      await prisma.candidateInterview.update({
        where: { id: interview.id },
        data: { status: InterviewStatus.FAILED, failureSummary: msg },
      });
      await prisma.adminBulkOperation.update({
        where: { operationId },
        data: {
          status: 'FAILED',
          failedCount: ids.length,
          completedAt: new Date(),
          errorSummary: msg,
        },
      });
      throw e instanceof AppError ? e : new AppError(502, msg);
    }

    let emailFailed = 0;
    for (const slot of participantSlots) {
      try {
        await emailService.sendInterviewInvite({
          to: slot.candidate.user.email,
          candidateName: slot.candidate.fullName,
          title: input.title,
          startLocal: slot.slotStart.toISOString(),
          endLocal: slot.slotEnd.toISOString(),
          timezone: input.timezone,
          meetUrl: meetUrl || undefined,
          notes: input.notes,
        });
        await prisma.candidateInterviewParticipant.updateMany({
          where: { interviewId: interview.id, candidateId: slot.candidate.id },
          data: { emailStatus: 'SENT' },
        });
      } catch (e) {
        emailFailed += 1;
        logger.error('Interview email failed', {
          candidateId: slot.candidate.id,
          error: e instanceof Error ? e.message : e,
        });
        await prisma.candidateInterviewParticipant.updateMany({
          where: { interviewId: interview.id, candidateId: slot.candidate.id },
          data: { emailStatus: 'FAILED' },
        });
        errors.push({
          candidateId: slot.candidate.id,
          code: 'EMAIL_FAILED',
          message: 'Interview created but email failed',
        });
      }
    }

    try {
      await emailService.sendCustomEmail({
        to: adminEmail,
        subject: `Interview scheduled: ${input.title}`,
        html: `<p>You scheduled an interview for ${ids.length} candidate(s).</p>
               <p>Title: ${input.title}</p>
               <p>Start (UTC): ${start.toISOString()}</p>
               ${meetUrl ? `<p>Meet: <a href="${meetUrl}">${meetUrl}</a></p>` : ''}`,
      });
    } catch {
      logger.warn('Admin interview confirmation email failed', { adminEmail });
    }

    await prisma.candidateInterview.update({
      where: { id: interview.id },
      data: { emailStatus: emailFailed > 0 ? 'PARTIAL' : 'SENT' },
    });

    await prisma.adminBulkOperation.update({
      where: { operationId },
      data: {
        status: emailFailed > 0 ? 'PARTIAL' : 'SUCCEEDED',
        succeededCount: ids.length - emailFailed,
        failedCount: emailFailed,
        completedAt: new Date(),
      },
    });

    await writeAuditLog({
      adminUserId,
      action: 'INTERVIEW_SCHEDULED',
      entityType: 'interview',
      entityId: interview.id,
      metadata: {
        operationId,
        mode: input.mode,
        candidateCount: ids.length,
        meetUrl,
        frontendUrl: config.frontendUrl,
      },
    });

    return {
      operationId,
      interviewId: interview.id,
      meetUrl,
      summary: {
        requested: ids.length,
        succeeded: ids.length - emailFailed,
        failed: emailFailed,
        skipped: 0,
      },
      errors,
    };
  }
}

export const interviewService = new InterviewService();
