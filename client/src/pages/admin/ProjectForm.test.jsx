import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// FX-38: Enter in a content form used to submit through the first submit button, "Save as draft",
// which silently unpublished a live project.

const { api } = vi.hoisted(() => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('../../api/client', () => ({ api, SESSION_EXPIRED_EVENT: 'pc:session-expired' }));
vi.mock('../../lib/apiBase', () => ({ useApiBase: () => ({ v1Base: 'https://api.test/v1', resolved: true, configured: true }), PENDING_BASE: '…' }));
vi.mock('../../components/admin/Toast', () => ({ useToast: () => ({ notify: vi.fn() }) }));

import ProjectForm from './ProjectForm';

const PROJECT = {
  _id: 'p1', title: 'Live project', slug: 'live-project', mode: 'solo', shortDescription: 'Already live.',
  stack: ['React'], highlights: [], links: {}, order: 0, featured: true, visibility: 'published',
};

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard/projects/new" element={<ProjectForm />} />
        <Route path="/dashboard/projects/edit/:id" element={<ProjectForm />} />
        <Route path="/dashboard/projects" element={<p>Project list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  api.get.mockImplementation(async (url) => (url === '/skills' ? { data: [] } : { data: { ...PROJECT } }));
  api.put.mockImplementation(async (_url, body) => ({ data: body }));
  api.post.mockImplementation(async (_url, body) => ({ data: body }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ProjectForm: Enter never changes visibility', () => {
  it('keeps an edited published project published when Enter is pressed in a field', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard/projects/edit/p1');
    const title = await screen.findByDisplayValue('Live project');
    await user.clear(title);
    await user.type(title, 'Renamed project{Enter}');
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put.mock.calls[0][0]).toBe('/projects/p1');
    expect(api.put.mock.calls[0][1]).toMatchObject({ title: 'Renamed project', visibility: 'published' });
  });

  it('keeps an edited draft a draft when Enter is pressed', async () => {
    api.get.mockImplementation(async (url) => (url === '/skills' ? { data: [] } : { data: { ...PROJECT, visibility: 'draft' } }));
    const user = userEvent.setup();
    renderAt('/dashboard/projects/edit/p1');
    const title = await screen.findByDisplayValue('Live project');
    await user.type(title, '{Enter}');
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put.mock.calls[0][1]).toMatchObject({ visibility: 'draft' });
  });

  it('still unpublishes when "Save as draft" is clicked explicitly', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard/projects/edit/p1');
    await screen.findByDisplayValue('Live project');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put.mock.calls[0][1]).toMatchObject({ visibility: 'draft' });
  });

  it('saves a new project as a draft when Enter is pressed (FE-02)', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('/dashboard/projects/new');
    const summary = await waitFor(() => {
      const el = container.querySelector('#project-summary');
      if (!el) throw new Error('form not rendered');
      return el;
    });
    await user.type(summary, 'A new project.');
    await user.type(container.querySelector('#project-title'), 'Café Übersicht{Enter}');
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1]).toMatchObject({ title: 'Café Übersicht', slug: 'cafe-ubersicht', visibility: 'draft' });
  });
});
