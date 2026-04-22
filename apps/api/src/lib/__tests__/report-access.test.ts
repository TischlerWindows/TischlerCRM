import { jest } from '@jest/globals';

const reportFindUnique = jest.fn<(...args: any[]) => Promise<any>>();
const userFindUnique = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('@crm/db/client', () => ({
  prisma: {
    report: { findUnique: reportFindUnique },
    user: { findUnique: userFindUnique },
  },
}));

const { assertReportAccess } = await import('../report-access.js');

describe('assertReportAccess', () => {
  beforeEach(() => {
    reportFindUnique.mockReset();
    userFindUnique.mockReset();
  });

  test('returns 404 when the report does not exist (read)', async () => {
    reportFindUnique.mockResolvedValueOnce(null);
    const result = await assertReportAccess('r1', 'u1', 'USER', 'read');
    expect(result).toEqual({ ok: false, code: 404 });
  });

  test('returns 404 when the report does not exist (write)', async () => {
    reportFindUnique.mockResolvedValueOnce(null);
    const result = await assertReportAccess('r1', 'u1', 'USER', 'write');
    expect(result).toEqual({ ok: false, code: 404 });
  });

  test('owner has read access to their own private report', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1', createdById: 'u1', isPrivate: true, sharedWith: [],
    });
    const result = await assertReportAccess('r1', 'u1', 'USER', 'read');
    expect(result.ok).toBe(true);
  });

  test('owner has write access to their own report', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1', createdById: 'u1', isPrivate: true, sharedWith: [],
    });
    const result = await assertReportAccess('r1', 'u1', 'USER', 'write');
    expect(result.ok).toBe(true);
  });

  test('ADMIN has write access to any report', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1', createdById: 'someoneElse', isPrivate: true, sharedWith: [],
    });
    const result = await assertReportAccess('r1', 'admin', 'ADMIN', 'write');
    expect(result.ok).toBe(true);
  });

  test('ADMIN has read access to any private report', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1', createdById: 'someoneElse', isPrivate: true, sharedWith: [],
    });
    const result = await assertReportAccess('r1', 'admin', 'ADMIN', 'read');
    expect(result.ok).toBe(true);
  });

  test('stranger can read non-private report', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1', createdById: 'owner', isPrivate: false, sharedWith: [],
    });
    const result = await assertReportAccess('r1', 'stranger', 'USER', 'read');
    expect(result.ok).toBe(true);
  });

  test('stranger gets 404 on private report they are not shared with (read)', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1', createdById: 'owner', isPrivate: true, sharedWith: [],
    });
    userFindUnique.mockResolvedValueOnce({ email: 'stranger@example.com' });
    const result = await assertReportAccess('r1', 'stranger', 'USER', 'read');
    expect(result).toEqual({ ok: false, code: 404 });
  });

  test('stranger gets 403 on any report they do not own (write)', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1', createdById: 'owner', isPrivate: false, sharedWith: [],
    });
    const result = await assertReportAccess('r1', 'stranger', 'USER', 'write');
    expect(result).toEqual({ ok: false, code: 403 });
  });

  test('stranger can read when their user id is in sharedWith', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1', createdById: 'owner', isPrivate: true, sharedWith: ['stranger'],
    });
    const result = await assertReportAccess('r1', 'stranger', 'USER', 'read');
    expect(result.ok).toBe(true);
    // User-by-email lookup should not fire when id matches.
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  test('stranger can read when their email is in sharedWith', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1',
      createdById: 'owner',
      isPrivate: true,
      sharedWith: ['stranger@example.com'],
    });
    userFindUnique.mockResolvedValueOnce({ email: 'stranger@example.com' });
    const result = await assertReportAccess('r1', 'stranger', 'USER', 'read');
    expect(result.ok).toBe(true);
  });

  test('shared-with does not grant write access', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1', createdById: 'owner', isPrivate: false, sharedWith: ['stranger'],
    });
    const result = await assertReportAccess('r1', 'stranger', 'USER', 'write');
    expect(result).toEqual({ ok: false, code: 403 });
  });

  test('handles non-array sharedWith gracefully', async () => {
    reportFindUnique.mockResolvedValueOnce({
      id: 'r1', createdById: 'owner', isPrivate: true, sharedWith: null,
    });
    userFindUnique.mockResolvedValueOnce({ email: 'stranger@example.com' });
    const result = await assertReportAccess('r1', 'stranger', 'USER', 'read');
    expect(result).toEqual({ ok: false, code: 404 });
  });
});
