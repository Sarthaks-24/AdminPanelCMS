const slugify = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
const file = (path, content, mimeType = 'text/plain') => ({
  name: path.split('/').pop(), type: 'file', path, mimeType, content,
  size: Buffer.byteLength(typeof content === 'string' ? content : JSON.stringify(content)),
});
const dir = (path, children) => ({ name: path.split('/').pop() || '/', type: 'directory', path, children });

function buildFsTree(view = {}) {
  const root = [];
  if (view.profile) root.push(dir('/about', [
    file('/about/bio.txt', [view.profile.shortBio, view.profile.statusText].filter(Boolean).join('\n\n')),
    file('/about/background.md', view.profile.aboutMarkdown || '', 'text/markdown'),
    file('/about/contact.json', { email: view.profile.email, location: view.profile.location }, 'application/json'),
  ]));
  if (view.skills) {
    const groups = Object.groupBy ? Object.groupBy(view.skills, (skill) => skill.category || 'other') : view.skills.reduce((acc, skill) => ((acc[skill.category || 'other'] ||= []).push(skill), acc), {});
    root.push(dir('/skills', Object.entries(groups).map(([category, skills]) => file(`/skills/${slugify(category)}.json`, skills, 'application/json'))));
  }
  if (view.projects) root.push(dir('/projects', [
    ...view.projects.map((project) => file(`/projects/${slugify(project.slug || project.title)}.md`, `# ${project.title || ''}\n\n${project.caseStudyBody || project.shortDescription || ''}`, 'text/markdown')),
    file('/projects/index.json', view.projects.map(({ title, slug, shortDescription, stack }) => ({ title, slug, shortDescription, stack })), 'application/json'),
  ]));
  if (view.experience) root.push(dir('/experience', view.experience.map((item, i) => file(`/experience/${i}-${slugify(item.company)}.txt`, `${item.role || ''} @ ${item.company || ''}\n${item.period || ''}\n\n${item.description || ''}`))));
  if (view.education) root.push(dir('/education', view.education.map((item) => file(`/education/${slugify(item.institution)}.txt`, `${item.degree || ''}\n${item.institution || ''}\n${item.period || ''}`))));
  if (view.certifications) root.push(dir('/certifications', view.certifications.map((item) => file(`/certifications/${slugify(item.title)}.txt`, `${item.title || ''}\n${item.issuer || ''}\n${item.issueDate || ''}\n${item.credentialUrl || ''}`))));
  if (view.resume?.resumeUrl) root.push({ name: 'resume.pdf', type: 'file', path: '/resume.pdf', mimeType: 'application/pdf', targetUrl: view.resume.resumeUrl });
  return dir('/', root);
}

module.exports = buildFsTree;
