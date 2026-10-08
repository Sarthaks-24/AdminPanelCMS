const mongoose = require('mongoose');
const { applyInclude, byOrder, byIssueDateDesc } = require('../lib/applyInclude');
const { PUBLIC_FIELDS, DEFAULT_FIELDS } = require('../lib/modelConstants');
const buildFsTree = require('../lib/buildFsTree');

describe('applyInclude public projection', () => {
  it('projects nested leaves while omitting email by default and always excluding private fields', () => {
    const profile = {
      _id: new mongoose.Types.ObjectId(), name: 'Ada', email: 'ada@example.test', phone: '555-0100',
      location: { city: 'London', country: 'UK', isRemoteAvailable: true, privateNote: 'secret' },
    };
    const defaultView = applyInclude({ include: { profile: { enabled: true } } }, { profile }).profile;
    expect(defaultView.location).toEqual({ city: 'London', country: 'UK', isRemoteAvailable: true });
    expect(defaultView).not.toHaveProperty('email');
    expect(defaultView).not.toHaveProperty('phone');
    expect(PUBLIC_FIELDS.Profile).not.toContain('phone');
    expect(DEFAULT_FIELDS.Profile).not.toContain('email');

    const optedIn = applyInclude({ include: { profile: { enabled: true, fields: ['email', 'phone', 'location.city'] } } }, { profile }).profile;
    expect(optedIn.email).toBe('ada@example.test');
    expect(optedIn).not.toHaveProperty('phone');
    expect(optedIn.location).toEqual({ city: 'London' });
  });

  it('projects nested project link fields and keeps Date values intact', () => {
    const lastUpdated = new Date('2026-10-01T00:00:00Z');
    const project = { _id: 'project-1', visibility: 'published', title: 'Portfolio', links: { github: 'https://github.test', live: 'https://live.test', private: 'secret' }, lastUpdated };
    const view = applyInclude({ include: { projects: { enabled: true, fields: ['links.github', 'links.live', 'lastUpdated'] } } }, { projects: [project] });
    expect(view.projects[0].links).toEqual({ github: 'https://github.test', live: 'https://live.test' });
    expect(view.projects[0].lastUpdated).toBe(lastUpdated);
  });

  it('sorts published certifications by issue date and uses stable null-safe ordering', () => {
    const certifications = [
      { _id: 'old', visibility: 'published', issueDate: '2023-01' },
      { _id: 'unknown', visibility: 'published', issueDate: 'not a date' },
      { _id: 'new', visibility: 'published', issueDate: '2025-06' },
    ];
    const view = applyInclude({ include: { certifications: { enabled: true, mode: 'all' } } }, { certifications });
    expect(view.certifications.map((item) => item._id)).toEqual(['new', 'old', 'unknown']);
    expect([{ _id: 'b' }, { _id: 'a' }, { _id: 'placed', order: 0 }].sort(byOrder).map((item) => item._id)).toEqual(['placed', 'a', 'b']);
    expect([{ _id: 'bad', issueDate: 'bad' }, { _id: 'date', issueDate: '2024-01' }].sort(byIssueDateDesc).map((item) => item._id)).toEqual(['date', 'bad']);
  });

  it('preserves the configured ID order in selected mode and filters drafts', () => {
    const items = [
      { _id: 'first', visibility: 'published', featured: true, order: 1 },
      { _id: 'draft', visibility: 'draft', featured: true, order: 0 },
      { _id: 'second', visibility: 'published', featured: false, order: 0 },
    ];
    const view = applyInclude({ include: { projects: { enabled: true, mode: 'selected', ids: ['second', 'first', 'draft'] } } }, { projects: items });
    expect(view.projects.map((item) => item._id)).toEqual(['second', 'first']);
  });

  it('builds virtual filesystem output exclusively from the projected view', () => {
    const view = applyInclude({ include: { profile: { enabled: true, fields: ['shortBio', 'aboutMarkdown'] }, projects: { enabled: true, fields: ['title', 'slug', 'shortDescription', 'stack'] } } }, {
      profile: { shortBio: 'Public bio', aboutMarkdown: '# About', phone: 'private' },
      projects: [{ _id: 'p1', visibility: 'published', title: 'Public project', slug: 'public-project', shortDescription: 'Summary', stack: ['Node'] }],
    });
    const tree = buildFsTree(view);
    const about = tree.children.find((node) => node.name === 'about');
    const projects = tree.children.find((node) => node.name === 'projects');
    expect(about.children.find((node) => node.name === 'contact.json').content).not.toHaveProperty('phone');
    expect(projects.children.some((node) => node.path === '/projects/public-project.md')).toBe(true);
  });
});
