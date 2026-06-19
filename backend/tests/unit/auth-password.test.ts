import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';

describe('Password hashing', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await bcrypt.hash('SecurePass123!', 12);
    expect(await bcrypt.compare('SecurePass123!', hash)).toBe(true);
    expect(await bcrypt.compare('WrongPassword', hash)).toBe(false);
  });

  it('produces different hashes for same password', async () => {
    const a = await bcrypt.hash('SamePass123!', 12);
    const b = await bcrypt.hash('SamePass123!', 12);
    expect(a).not.toBe(b);
  });
});
