import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound';

// FE-03: with no 404 rules on the static host, /v1 and /api on the dashboard reach the SPA.
describe('NotFound', () => {
  afterEach(cleanup);

  it('tells an API caller they hit the dashboard', () => {
    render(<MemoryRouter initialEntries={['/v1/projects']}><NotFound /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'This is the dashboard, not the API' })).toBeTruthy();
    expect(screen.getByText('http://localhost:5000/v1/projects')).toBeTruthy();
  });

  it('keeps the plain 404 elsewhere', () => {
    render(<MemoryRouter initialEntries={['/nope']}><NotFound /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'This page doesn’t exist' })).toBeTruthy();
  });
});
