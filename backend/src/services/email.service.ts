import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { config } from '../config';
import { logger } from '../utils/logger';

function maskSecret(value: string): string {
  if (!value || value.length < 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

export class EmailService {
  private transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

  private getTransporter() {
    if (!this.transporter) {
      if (config.email.provider !== 'smtp') {
        throw new Error(`Unsupported EMAIL_PROVIDER: ${config.email.provider}`);
      }

      this.transporter = nodemailer.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure,
        auth: {
          user: config.email.smtp.user,
          pass: config.email.smtp.pass,
        },
      });
    }
    return this.transporter;
  }

  async verifyConnection(): Promise<boolean> {
    if (config.email.mockMode) {
      logger.info('EMAIL_MOCK_MODE enabled — skipping SMTP verification');
      return true;
    }
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      logger.info('SMTP connection verified', {
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        user: config.email.smtp.user,
      });
      return true;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string; response?: string };
      logger.error('SMTP verification failed', {
        code: err.code,
        message: err.message,
        response: err.response,
        host: config.email.smtp.host,
        user: config.email.smtp.user,
        pass: maskSecret(config.email.smtp.pass),
      });
      return false;
    }
  }

  async sendAssessmentLink(params: {
    to: string;
    candidateName: string;
    assessmentUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    if (config.email.mockMode) {
      logger.info('EMAIL_MOCK_MODE: assessment link (not sent)', {
        to: params.to,
        assessmentUrl: params.assessmentUrl,
      });
      return;
    }

    const transporter = this.getTransporter();
    const expiryText = params.expiresAt.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;">Hurix Talent Assessment</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#1e293b;font-size:16px;">Hello <strong>${params.candidateName}</strong>,</p>
              <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
                Thank you for applying to Hurix. Please click the button below to begin your technical assessment.
              </p>
              <p style="text-align:center;margin:32px 0;">
                <a href="${params.assessmentUrl}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;">
                  Start Assessment
                </a>
              </p>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.6;">
                This link expires on <strong>${expiryText}</strong> (7 days from registration).
              </p>
              <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
                If the button does not work, copy and paste this URL into your browser:<br>
                <a href="${params.assessmentUrl}" style="color:#3b82f6;word-break:break-all;">${params.assessmentUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                &copy; ${new Date().getFullYear()} Hurix Digital. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: config.email.from,
        to: params.to,
        subject: 'Your Hurix Talent Assessment Link',
        html,
        text: `Hello ${params.candidateName},\n\nThank you for applying to Hurix.\n\nStart your assessment: ${params.assessmentUrl}\n\nThis link expires on ${expiryText}.`,
      });
      logger.info('Assessment email sent', { to: params.to });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string; response?: string };
      logger.error('Failed to send assessment email', {
        to: params.to,
        code: err.code,
        message: err.message,
        response: err.response,
      });
      throw error;
    }
  }

  async sendVerificationEmail(params: {
    to: string;
    candidateName: string;
    verifyUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    if (config.email.mockMode) {
      logger.info('EMAIL_MOCK_MODE: verification email (not sent)', {
        to: params.to,
        verifyUrl: params.verifyUrl,
      });
      return;
    }

    const transporter = this.getTransporter();
    const expiryText = params.expiresAt.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;">Hurix Talent Assessment</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#1e293b;font-size:16px;">Hello <strong>${params.candidateName}</strong>,</p>
              <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
                Please verify your email to continue your assessment process.
              </p>
              <p style="text-align:center;margin:32px 0;">
                <a href="${params.verifyUrl}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;">
                  Verify Email
                </a>
              </p>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.6;">
                This link expires on <strong>${expiryText}</strong>.
              </p>
              <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
                If you did not request this email, please ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                &copy; ${new Date().getFullYear()} Hurix Digital. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: config.email.from,
        to: params.to,
        subject: 'Verify Your Email - Hurix Talent Assessment',
        html,
        text: `Hello ${params.candidateName},\n\nPlease verify your email to continue your assessment process.\n\nVerify Email: ${params.verifyUrl}\n\nThis link expires on ${expiryText}.\n\nIf you did not request this email, please ignore it.`,
      });
      logger.info('Verification email sent', { to: params.to });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string; response?: string };
      logger.error('Failed to send verification email', {
        to: params.to,
        code: err.code,
        message: err.message,
        response: err.response,
      });
      throw error;
    }
  }

  async sendCustomEmail(params: { to: string; subject: string; html: string; text?: string }): Promise<void> {
    if (config.email.mockMode) {
      logger.info('EMAIL_MOCK_MODE: custom email (not sent)', {
        to: params.to,
        subject: params.subject,
      });
      return;
    }

    const transporter = this.getTransporter();
    try {
      await transporter.sendMail({
        from: config.email.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text || params.html.replace(/<[^>]+>/g, ' '),
      });
      logger.info('Custom email sent', { to: params.to, subject: params.subject });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string; response?: string };
      logger.error('Failed to send custom email', {
        to: params.to,
        code: err.code,
        message: err.message,
        response: err.response,
      });
      throw error;
    }
  }

  async sendInterviewInvite(params: {
    to: string;
    candidateName: string;
    title: string;
    startLocal: string;
    endLocal: string;
    timezone: string;
    meetUrl?: string | null;
    notes?: string | null;
  }): Promise<void> {
    const meetLine = params.meetUrl
      ? `<p><a href="${params.meetUrl}">Join Google Meet</a></p>`
      : '';
    const html = `
      <p>Hello <strong>${params.candidateName}</strong>,</p>
      <p>You have been invited to an interview: <strong>${params.title}</strong>.</p>
      <p>When: ${params.startLocal} – ${params.endLocal} (${params.timezone})</p>
      ${meetLine}
      ${params.notes ? `<p>Notes: ${params.notes}</p>` : ''}
      <p>Regards,<br/>Hurix Digital</p>
    `;
    await this.sendCustomEmail({
      to: params.to,
      subject: `Interview Scheduled: ${params.title}`,
      html,
    });
  }
}

export const emailService = new EmailService();
