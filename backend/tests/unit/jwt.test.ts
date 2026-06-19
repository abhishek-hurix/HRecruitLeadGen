import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateAssessmentToken,
  verifyAssessmentToken,
  generateCandidatePortalToken,
  verifyCandidatePortalToken,
  generateAdminToken,
  verifyAdminToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken,
} from '../../src/utils/jwt';

const ASSESSMENT_SECRET = 'test-assessment-secret-key-32chars!!';
const ADMIN_SECRET = 'test-admin-secret-key-32chars!!!!';

describe('JWT utilities', () => {
  it('creates and validates assessment tokens', () => {
    const token = generateAssessmentToken('cand-1', 'test@hurix.com', 'jti-abc');
    const payload = verifyAssessmentToken(token);
    expect(payload.sub).toBe('cand-1');
    expect(payload.email).toBe('test@hurix.com');
    expect(payload.type).toBe('assessment_link');
    expect(payload.jti).toBe('jti-abc');
  });

  it('creates and validates candidate portal tokens', () => {
    const token = generateCandidatePortalToken('cand-2', 'portal@hurix.com');
    const payload = verifyCandidatePortalToken(token);
    expect(payload.sub).toBe('cand-2');
    expect(payload.type).toBe('candidate_portal');
  });

  it('creates SUPER_ADMIN and ADMIN tokens', () => {
    const superToken = generateAdminToken('admin-1', 'super@hurix.com', 'SUPER_ADMIN');
    const adminToken = generateAdminToken('admin-2', 'admin@hurix.com', 'ADMIN');
    expect(verifyAdminToken(superToken).role).toBe('SUPER_ADMIN');
    expect(verifyAdminToken(adminToken).role).toBe('ADMIN');
  });

  it('rejects tampered JWT', () => {
    const token = generateAdminToken('admin-1', 'super@hurix.com', 'SUPER_ADMIN');
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;
    expect(() => verifyAdminToken(tampered)).toThrow();
  });

  it('rejects expired JWT', () => {
    const expired = jwt.sign(
      { sub: 'x', email: 'e@h.com', role: 'ADMIN', type: 'admin' },
      ADMIN_SECRET,
      { expiresIn: '-1s' }
    );
    expect(() => jwt.verify(expired, ADMIN_SECRET)).toThrow();
  });

  it('rejects wrong token type for admin verifier', () => {
    const wrongType = jwt.sign(
      { sub: 'x', email: 'e@h.com', type: 'candidate_portal' },
      ASSESSMENT_SECRET
    );
    expect(() => verifyAdminToken(wrongType)).toThrow();
  });

  it('rejects assessment token on portal verifier', () => {
    const token = generateAssessmentToken('c1', 'e@h.com', 'jti');
    expect(() => verifyCandidatePortalToken(token)).toThrow();
  });

  it('creates and validates email verification tokens', () => {
    const token = generateEmailVerificationToken('cand-v', 'verify@hurix.com', 'jti-v');
    const payload = verifyEmailVerificationToken(token);
    expect(payload.sub).toBe('cand-v');
    expect(payload.type).toBe('verification');
    expect(payload.jti).toBe('jti-v');
  });

  it('rejects wrong type on verification verifier', () => {
    const token = generateCandidatePortalToken('c1', 'e@h.com');
    expect(() => verifyEmailVerificationToken(token)).toThrow();
  });
});
