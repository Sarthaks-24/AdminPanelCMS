const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const TEST_SECRET = 'test_jwt_secret_64chars_long_for_security_checks_1234567890abcdef1234';
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function encodeBase62(bytes) {
  let value = BigInt(`0x${bytes.toString('hex')}`);
  let encoded = '';

  while (value > 0n) {
    const remainder = Number(value % 62n);
    encoded = BASE62[remainder] + encoded;
    value /= 62n;
  }

  return encoded.padStart(43, '0');
}

async function createUser(User, overrides = {}) {
  const email = overrides.email || `user_${crypto.randomUUID()}@test.com`;
  return User.create({
    email,
    passwordHash: '$2b$10$FakeHashForTesting12345678901234567890',
    emailVerifiedAt: new Date(),
    tokenVersion: 0,
    status: 'active',
    ...overrides,
  });
}

function loginAs(user, secret = process.env.JWT_SECRET || TEST_SECRET) {
  const token = jwt.sign(
    { sub: user._id.toString(), tv: user.tokenVersion || 0 },
    secret,
    { expiresIn: '1d' },
  );
  return `Bearer ${token}`;
}

async function createApp(App, user, overrides = {}) {
  const existing = await App.find({ owner: user._id }).select('quotaSlot').lean();
  const used = new Set(existing.map((item) => item.quotaSlot));
  const quotaSlot = Array.from({ length: 10 }, (_, index) => index).find((index) => !used.has(index));
  if (quotaSlot === undefined) throw new Error('Test owner app quota exhausted');
  return App.create({
    quotaSlot,
    name: 'Test App',
    type: 'static',
    allowedOrigins: ['https://portfolio.test'],
    include: {
      profile: { enabled: true, fields: [] },
      projects: { enabled: true, mode: 'all', ids: [], fields: [] },
    },
    ...overrides,
    owner: user._id,
  });
}

async function createToken(ApiToken, app, type = 'pk', overrides = {}) {
  const rawToken = `${type}_live_${encodeBase62(crypto.randomBytes(32))}`;
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokenDoc = await ApiToken.create({
    type,
    prefix: rawToken.slice(0, 16),
    hash,
    value: type === 'pk' ? rawToken : null,
    expiresAt: null,
    ...overrides,
    owner: app.owner,
    app: app._id,
  });

  return { tokenDoc, rawToken };
}

async function seedContent(models, user) {
  const owner = user._id;

  const profile = await models.Profile.create({
    owner,
    name: `User ${owner}`,
    initials: 'UA',
    headline: 'Senior Systems Engineer',
    shortBio: 'Building low-latency distributed architectures.',
    aboutMarkdown: '# Professional Overview\nFull stack developer...',
    email: `contact_${owner}@test.com`,
    phone: '+1 555-0199',
    location: { city: 'San Francisco', country: 'United States', isRemoteAvailable: true },
    statusText: 'Open for engineering roles',
    isAvailableForHire: true,
    terminalUser: 'user',
    terminalHost: 'workstation',
    bootGreeting: 'PORTFOLIO POST INIT',
    metrics: [{ label: 'Latency', value: '<10ms', description: 'Global p99' }],
  });

  const project = await models.Project.create({
    owner,
    title: 'Alpha Trading Engine',
    slug: `alpha-engine-${owner}`,
    mode: 'solo',
    role: 'Lead Architect',
    shortDescription: 'High-throughput execution daemon in Node.js',
    caseStudyBody: '# Architecture\nDetailed case study...',
    stack: ['Node.js', 'Redis', 'WebSockets'],
    highlights: ['40k ops/sec', '<10us jitter'],
    links: { github: 'https://github.com/test/alpha', live: 'https://alpha.test', demo: '' },
    order: 0,
    featured: true,
    visibility: 'published',
  });

  const resume = await models.Resume.create({
    owner,
    resumeUrl: 'https://drive.google.com/file/d/test-resume/view',
    fileName: 'Resume_Master.pdf',
    version: 'v2026.10',
    summaryText: 'Executive engineering summary',
  });

  const skill = await models.Skill.create({
    owner,
    name: 'react',
    category: 'Frontend',
    proficiency: 'Expert',
    yearsOfExperience: 4,
    order: 0,
    featured: true,
    visibility: 'published',
  });

  const social = await models.Social.create({
    owner,
    platform: 'GitHub',
    label: 'github.com/testuser',
    url: 'https://github.com/testuser',
    username: 'testuser',
    icon: 'github',
    order: 0,
    featured: true,
    visibility: 'published',
  });

  const experience = await models.Experience.create({
    owner,
    company: 'Cloud Corp',
    role: 'Staff Engineer',
    employmentType: 'Full-time',
    period: '2023 - Present',
    isCurrent: true,
    description: 'Cloud systems architecture',
    technologies: ['Kubernetes', 'Go'],
    order: 0,
    featured: true,
    visibility: 'published',
  });

  const education = await models.Education.create({
    owner,
    institution: 'Tech University',
    degree: 'B.S. in Computer Science',
    fieldOfStudy: 'Computer Science',
    period: '2019 - 2023',
    grade: '3.9 GPA',
    order: 0,
    featured: true,
    visibility: 'published',
  });

  const certification = await models.Certification.create({
    owner,
    title: 'Certified Kubernetes Administrator',
    issuer: 'Linux Foundation',
    issueDate: '2024-05',
    expirationDate: '2027-05',
    credentialId: 'CKA-12345',
    credentialUrl: 'https://verify.test/CKA-12345',
    skills: ['Kubernetes', 'Linux'],
    order: 0,
    featured: true,
    visibility: 'published',
  });

  return { profile, project, resume, skill, social, experience, education, certification };
}

module.exports = { createUser, loginAs, createApp, createToken, seedContent };
