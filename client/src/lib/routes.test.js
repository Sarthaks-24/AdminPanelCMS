import { describe, it, expect } from 'vitest';
import { legacyAdminTarget } from './routes';

describe('legacyAdminTarget (FX-50)', () => {
  it.each([
    ['/admin', '/dashboard'],
    ['/admin/', '/dashboard'],
    ['/admin/dashboard', '/dashboard'],
    ['/admin/login', '/login'],
    ['/admin/signup', '/signup'],
    ['/admin/verify-email', '/verify-email'],
    ['/admin/reset-password', '/reset-password'],
    ['/admin/check-email', '/check-email'],
    ['/admin/forgot-password', '/forgot-password'],
    ['/admin/profile', '/dashboard/profile'],
    ['/admin/projects/edit/abc', '/dashboard/projects/edit/abc'],
    ['/admin/apps/123/', '/dashboard/apps/123'],
  ])('%s → %s', (from, to) => {
    expect(legacyAdminTarget(from)).toBe(to);
  });
});
