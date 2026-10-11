import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LegacyAdminRedirect from './LegacyAdminRedirect';

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="where">{`${pathname}${search}${hash}`}</p>;
}

afterEach(cleanup);

describe('LegacyAdminRedirect (FX-50)', () => {
  it.each([
    ['/admin/verify-email?token=abc', '/verify-email?token=abc'],
    ['/admin/reset-password?token=x%2By', '/reset-password?token=x%2By'],
    ['/admin/apps/42?tab=keys#connect', '/dashboard/apps/42?tab=keys#connect'],
    ['/admin', '/dashboard'],
  ])('%s lands on %s', (from, to) => {
    render(
      <MemoryRouter initialEntries={[from]}>
        <Routes>
          <Route path="/admin/*" element={<LegacyAdminRedirect />} />
          <Route path="/admin" element={<LegacyAdminRedirect />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where').textContent).toBe(to);
  });
});
