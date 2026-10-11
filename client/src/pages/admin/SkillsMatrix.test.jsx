import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// CB-05: the bulk endpoint answers { success, matchedCount } only. The grid must re-read the list
// rather than look for a `skills` array that never arrives (and keep showing stale values).

const { api } = vi.hoisted(() => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../../api/client', () => ({ api, SESSION_EXPIRED_EVENT: 'pc:session-expired' }));

import SkillsMatrix from './SkillsMatrix';

const draft = { _id: 's1', name: 'Rust', category: 'Languages', visibility: 'draft', featured: false, order: 0, yearsOfExperience: 1 };
let skills;

beforeEach(() => {
  skills = [{ ...draft }];
  api.get.mockImplementation(async (url) => (url === '/skills/categories' ? { data: { categories: [] } } : { data: skills.map((s) => ({ ...s })) }));
  api.patch.mockImplementation(async () => {
    skills = skills.map((s) => ({ ...s, visibility: 'published' }));
    return { data: { success: true, matchedCount: 1 } };
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('SkillsMatrix bulk publish', () => {
  it('re-fetches the skills after the bulk call and reports matchedCount', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SkillsMatrix /></MemoryRouter>);
    await user.click(await screen.findByRole('checkbox', { name: /Rust/ }));
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/skills/bulk', { ids: ['s1'], updates: { visibility: 'published' } }));
    expect(await screen.findByText('Published 1 skill.')).toBeTruthy();
    expect(api.get.mock.calls.filter(([url]) => url === '/skills')).toHaveLength(2);
    expect(await screen.findByText(/· Published/)).toBeTruthy();
  });
});
