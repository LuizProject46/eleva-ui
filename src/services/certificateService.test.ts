import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isNewFormatCertificateCode,
  NEW_CERTIFICATE_CODE_REGEX,
  generateCertificateIfEligible,
} from './certificateService';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const migration040Path = join(
  process.cwd(),
  'supabase',
  'migrations',
  '040_certificate_sync_on_course_update.sql'
);

describe('certificate code format (new format has no ELEVA- prefix)', () => {
  it('new format is 10 uppercase hex chars and does not start with ELEVA-', () => {
    expect(NEW_CERTIFICATE_CODE_REGEX.test('A1B2C3D4E5')).toBe(true);
    expect(NEW_CERTIFICATE_CODE_REGEX.test('0123456789')).toBe(true);
    expect(NEW_CERTIFICATE_CODE_REGEX.test('ELEVA-ABC1')).toBe(false);
    expect(NEW_CERTIFICATE_CODE_REGEX.test('ELEVA-XXXXXXXXXX')).toBe(false);
  });

  it('isNewFormatCertificateCode returns true for 10-char hex, false for ELEVA- codes', () => {
    expect(isNewFormatCertificateCode('A1B2C3D4E5')).toBe(true);
    expect(isNewFormatCertificateCode('  A1B2C3D4E5  ')).toBe(true);
    expect(isNewFormatCertificateCode('ELEVA-A1B2C3D4')).toBe(false);
    expect(isNewFormatCertificateCode('ELEVA-XXXXXXXXXX')).toBe(false);
    expect(isNewFormatCertificateCode('')).toBe(false);
  });

  it('newly generated certificate codes must not start with ELEVA- (contract)', () => {
    const newFormatCode = 'ABCD1234EF';
    expect(newFormatCode.startsWith('ELEVA-')).toBe(false);
    expect(isNewFormatCertificateCode(newFormatCode)).toBe(true);
  });
});

describe('generateCertificateIfEligible', () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset();
  });

  it('returned certificate code does not start with ELEVA- when backend returns new-format code', async () => {
    const assignmentId = '00000000-0000-0000-0000-000000000001';
    const mockCert = {
      id: 'cert-id',
      assignment_id: assignmentId,
      user_id: 'user-id',
      course_id: 'course-id',
      tenant_id: 'tenant-id',
      certificate_code: 'A1B2C3D4E5',
      user_name: 'Test User',
      course_name: 'Test Course',
      workload_hours: 8,
      completion_date: '2025-01-15',
      created_at: '2025-01-15T12:00:00Z',
    };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: mockCert, error: null });

    const result = await generateCertificateIfEligible(assignmentId);

    expect(result).not.toBeNull();
    expect(result?.certificate_code).not.toMatch(/^ELEVA-/);
    expect(result?.certificate_code).toMatch(NEW_CERTIFICATE_CODE_REGEX);
  });

  it('returns null when backend returns null (e.g. not eligible)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });
    const result = await generateCertificateIfEligible('some-assignment-id');
    expect(result).toBeNull();
  });
});

describe('certificate sync on course update (migration 040)', () => {
  it('migration 040 defines trigger that updates certificates when course title or workload changes', () => {
    const migration = readFileSync(migration040Path, 'utf-8');
    expect(migration).toContain('sync_certificates_on_course_update');
    expect(migration).toContain('UPDATE certificates');
    expect(migration).toContain('course_name = NEW.title');
    expect(migration).toContain('workload_hours = NEW.workload_hours');
    expect(migration).toContain('AFTER UPDATE ON courses');
  });
});
