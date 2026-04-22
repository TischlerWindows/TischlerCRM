import { jest } from '@jest/globals';

const findUniqueMock = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule('@crm/db/client', () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}));

const { checkObjectPermission } = await import('../check-object-permission.js');

describe('checkObjectPermission', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  test('ADMIN short-circuits without querying Prisma', async () => {
    const result = await checkObjectPermission('u1', 'ADMIN', 'Account', 'read');
    expect(result).toBe(true);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  test('returns false when the user does not exist', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const result = await checkObjectPermission('u1', 'USER', 'Account', 'read');
    expect(result).toBe(false);
  });

  test('fails closed for non-ADMIN users with no profile (regression: was fail-open)', async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 'u1', profile: null });
    const result = await checkObjectPermission('u1', 'USER', 'Account', 'read');
    expect(result).toBe(false);
  });

  test('allows when the profile grants the requested action', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'u1',
      profile: { permissions: { objects: { Account: { read: true } } } },
    });
    const result = await checkObjectPermission('u1', 'USER', 'Account', 'read');
    expect(result).toBe(true);
  });

  test('denies when the profile grants a different action', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'u1',
      profile: { permissions: { objects: { Account: { read: true } } } },
    });
    const result = await checkObjectPermission('u1', 'USER', 'Account', 'edit');
    expect(result).toBe(false);
  });

  test('denies when the profile has no permissions for the object', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'u1',
      profile: { permissions: { objects: {} } },
    });
    const result = await checkObjectPermission('u1', 'USER', 'Account', 'read');
    expect(result).toBe(false);
  });

  test('denies gracefully when the permissions payload is missing', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'u1',
      profile: { permissions: null },
    });
    const result = await checkObjectPermission('u1', 'USER', 'Account', 'read');
    expect(result).toBe(false);
  });
});
