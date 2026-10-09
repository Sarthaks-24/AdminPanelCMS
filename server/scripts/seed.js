require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Social = require('../models/Social');
const Skill = require('../models/Skill');
const Project = require('../models/Project');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Certification = require('../models/Certification');
const Resume = require('../models/Resume');
const contentChanged = require('../lib/onContentChanged');

const seedData = {
  profile: {
    name: process.env.ADMIN_NAME || 'Portfolio Administrator',
    initials: 'PA',
    headline: 'Full Stack Engineer · Systems & Architecture',
    shortBio: 'Building low-latency distributed web systems and high-throughput cloud architectures.',
    aboutMarkdown:
      '# Professional Overview\n\nFull-stack software engineer with deep expertise in distributed microservices, real-time WebSockets, and modern cloud architectures.',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    phone: '',
    location: {
      city: 'San Francisco',
      country: 'United States',
      isRemoteAvailable: true,
    },
    statusText: 'Available for High-Impact Software Engineering Roles',
    isAvailableForHire: true,
    terminalUser: 'admin',
    terminalHost: 'portfolio',
    bootGreeting: 'PORTFOLIO_SYSTEM v2026.09 - POST INITIATED',
    metrics: [
      { label: 'API Latency', value: '<15ms', description: 'WebSocket order flow' },
      { label: 'Production Uptime', value: '99.98%', description: 'Production services' },
      { label: 'Clustered Services', value: '25+', description: 'Containerized nodes' },
    ],
  },
  socials: [
    {
      platform: 'GitHub',
      label: 'github.com/developer',
      url: 'https://github.com/developer',
      username: 'developer',
      icon: 'github',
      order: 0,
      featured: true,
    },
    {
      platform: 'LinkedIn',
      label: 'linkedin.com/in/developer',
      url: 'https://linkedin.com/in/developer',
      username: 'developer',
      icon: 'linkedin',
      order: 1,
      featured: true,
    },
    {
      platform: 'Email',
      label: process.env.ADMIN_EMAIL || 'admin@example.com',
      url: `mailto:${process.env.ADMIN_EMAIL || 'admin@example.com'}`,
      username: (process.env.ADMIN_EMAIL || 'admin@example.com').split('@')[0],
      icon: 'mail',
      order: 2,
      featured: true,
    },
  ],
  skills: [
    { name: 'TypeScript', category: 'Languages', proficiency: 'Advanced', yearsOfExperience: 2, featured: true, order: 0 },
    { name: 'JavaScript', category: 'Languages', proficiency: 'Expert', yearsOfExperience: 4, featured: true, order: 1 },
    { name: 'Python', category: 'Languages', proficiency: 'Proficient', yearsOfExperience: 2, featured: false, order: 2 },
    { name: 'C++', category: 'Languages', proficiency: 'Familiar', yearsOfExperience: 1, featured: false, order: 3 },
    { name: 'React', category: 'Frontend', proficiency: 'Expert', yearsOfExperience: 3, featured: true, order: 4 },
    { name: 'Tailwind CSS', category: 'Frontend', proficiency: 'Expert', yearsOfExperience: 3, featured: true, order: 5 },
    { name: 'Node.js', category: 'Backend & Systems', proficiency: 'Expert', yearsOfExperience: 3, featured: true, order: 6 },
    { name: 'WebSockets', category: 'Backend & Systems', proficiency: 'Advanced', yearsOfExperience: 2, featured: true, order: 7 },
    { name: 'Express', category: 'Backend & Systems', proficiency: 'Expert', yearsOfExperience: 3, featured: true, order: 8 },
    { name: 'Redis', category: 'Databases & Caching', proficiency: 'Advanced', yearsOfExperience: 2, featured: true, order: 9 },
    { name: 'MongoDB', category: 'Databases & Caching', proficiency: 'Expert', yearsOfExperience: 3, featured: true, order: 10 },
    { name: 'PostgreSQL', category: 'Databases & Caching', proficiency: 'Proficient', yearsOfExperience: 2, featured: false, order: 11 },
    { name: 'Docker', category: 'DevOps & Cloud', proficiency: 'Proficient', yearsOfExperience: 2, featured: false, order: 12 },
    { name: 'Linux / Bash', category: 'DevOps & Cloud', proficiency: 'Advanced', yearsOfExperience: 3, featured: true, order: 13 },
    { name: 'Hardware Diagnostics & Probing', category: 'Hardware & Electronics', proficiency: 'Proficient', yearsOfExperience: 2, featured: true, order: 14 },
    { name: 'Oscilloscopes & Signal Analyzers', category: 'Hardware & Electronics', proficiency: 'Advanced', yearsOfExperience: 3, featured: true, order: 15 },
    { name: 'Git & GitHub', category: 'Tools & Frameworks', proficiency: 'Expert', yearsOfExperience: 4, featured: true, order: 16 },
  ],
  projects: [
    {
      title: 'Real-time Order Flow Dashboard',
      slug: 'real-time-order-flow-dashboard',
      mode: 'solo',
      role: 'Lead Full Stack Engineer',
      shortDescription: 'Sub-15ms WebSocket visualization for options market depth, order flow, and real-time Greeks.',
      keyMetric: 'Latency: <12ms (WebSocket)',
      highlights: [
        'Live streaming options market depth using high-throughput WebSocket microservices.',
        'Redis pub/sub message brokering handling over 1,200 market ticks per second.',
        'Zero-dependency canvas chart rendering for ultra-low frame budget.',
      ],
      caseStudyBody: `# Real-time Order Flow Dashboard

## Engineering Challenge
Modern retail trading terminals often lag during high volatility sessions due to heavy DOM recalculations and unoptimized WebSocket polling. The objective was to build an ultra-responsive order flow dashboard maintaining sub-15ms client latency.

## Architecture
- **Ingestion Engine:** Node.js WebSocket gateway with custom binary protocol compression.
- **Message Broker:** Redis Pub/Sub decoupling ingestion from client socket fan-out.
- **Frontend Engine:** React canvas layer rendering order books at 60fps with zero DOM overhead.

## Results
Benchmark tests confirmed consistent sub-12ms render latency across high-frequency tick bursts.`,
      stack: ['React', 'Node.js', 'WebSockets', 'Redis', 'TypeScript', 'Tailwind CSS'],
      teammates: [],
      thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80',
      links: {
        github: 'https://github.com/developer/trading-dashboard',
        live: 'https://portfolio.example.com',
        demo: '',
      },
      order: 0,
      featured: true,
    },
    {
      title: 'Distributed Telemetry & Metrics Engine',
      slug: 'distributed-telemetry-engine',
      mode: 'solo',
      role: 'Backend Systems Engineer',
      shortDescription: 'High-throughput time-series metrics aggregator and real-time visualization platform.',
      keyMetric: 'Throughput: 100k events/sec',
      highlights: [
        'Zero-drop message ingestion with Kafka and Redis pub/sub channels.',
        'Sub-second real-time aggregation across clustered worker nodes.',
        'Interactive telemetry dashboard for low-latency operational monitoring.',
      ],
      caseStudyBody: `# Distributed Telemetry Engine

## Overview
A scalable time-series ingestion and analysis system designed for microservice clusters.

## Key Features
- High-throughput Kafka ingestion pipeline.
- Redis-backed sliding-window aggregation.
- Sub-second Prometheus and Grafana telemetry export.`,
      stack: ['Go', 'Node.js', 'Kafka', 'Redis', 'Docker', 'Prometheus'],
      teammates: [],
      thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
      links: {
        github: 'https://github.com/developer/telemetry-engine',
        live: '',
        demo: '',
      },
      order: 1,
      featured: true,
    },
  ],
  experience: [
    {
      company: 'Tech Innovations Corp',
      role: 'Full Stack Engineer',
      employmentType: 'Full-time',
      period: 'June 2024 - Present',
      isCurrent: true,
      location: 'Remote',
      companyUrl: 'https://example.com',
      description: 'Building distributed real-time web services, WebSocket infrastructure, and core backend APIs.',
      achievements: [
        'Architected real-time notification engine serving 50,000+ active sessions.',
        'Reduced 99th-percentile API response latency from 180ms to 24ms via Redis caching.',
        'Led CI/CD pipeline modernization with automated Docker deployments.',
      ],
      technologies: ['Node.js', 'React', 'MongoDB', 'Redis', 'Docker', 'AWS'],
      order: 0,
      featured: true,
    },
    {
      company: 'CloudScale Infrastructure',
      role: 'Systems & Infrastructure Engineer',
      employmentType: 'Contract',
      period: 'Jan 2024 - May 2024',
      isCurrent: false,
      location: 'Remote',
      companyUrl: 'https://example.com',
      description: 'Engineered high-throughput cloud infrastructure, telemetry monitors, and automated deployments.',
      achievements: [
        'Built automated Prometheus and Grafana monitoring stacks for 40+ containerized nodes.',
        'Optimized Kubernetes pod autoscaling policies reducing infrastructure spend by 22%.',
      ],
      technologies: ['Kubernetes', 'Docker', 'Prometheus', 'Terraform', 'Go'],
      order: 1,
      featured: true,
    },
  ],
  education: [
    {
      institution: 'University Institute of Technology',
      degree: 'B.S. in Computer Science & Engineering',
      fieldOfStudy: 'Computer Science & Engineering',
      period: '2022 - 2026',
      grade: 'GPA: 3.9 / 4.0',
      location: 'San Francisco, CA',
      achievements: [
        'Data Structures & Algorithms, Distributed Systems, Computer Networks, Operating Systems.',
        'Active participant in technical hackathons and competitive programming.',
      ],
      order: 0,
    },
  ],
  certifications: [
    {
      title: 'AWS Certified Cloud Practitioner',
      issuer: 'Amazon Web Services',
      issueDate: 'October 2024',
      expirationDate: 'October 2027',
      credentialId: 'AWS-CCP-2024-9988',
      credentialUrl: 'https://aws.amazon.com/verification',
      skills: ['AWS', 'Cloud Architecture', 'S3', 'EC2', 'IAM'],
      order: 0,
    },
    {
      title: 'Meta Front-End Developer Specialization',
      issuer: 'Meta / Coursera',
      issueDate: 'August 2024',
      expirationDate: 'No Expiration',
      credentialId: 'META-FE-774411',
      credentialUrl: 'https://coursera.org/verify/example',
      skills: ['React', 'JavaScript', 'CSS3', 'UI/UX'],
      order: 1,
    },
  ],
  resume: {
    resumeUrl: 'https://drive.google.com/file/d/1ABCXYZ-example-id/view?usp=sharing',
    fileName: 'Resume_Master.pdf',
    version: 'v2026.09',
    summaryText: 'Full Stack Engineer specializing in distributed real-time systems, cloud architectures, and scalable APIs.',
    lastUpdated: new Date(),
  },
};

async function runSeed() {
  console.log('[Seed] Connecting to MongoDB Atlas...');
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[Error] MONGODB_URI not defined in server/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log(`[Seed] Connected to database: ${mongoose.connection.name}`);

    const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';
    if (/supersecureadminpassword123|replace_me|changeme/i.test(password)) throw new Error('ADMIN_PASSWORD is still the example value. Set a unique password before seeding.');
    if (!email || password.length < 10) throw new Error('ADMIN_EMAIL and an ADMIN_PASSWORD of at least 10 characters must be configured before seeding.');
    const passwordHash = await bcrypt.hash(password, 10);
    let user = await User.findOne({ email });
    if (user) {
      user.passwordHash = passwordHash;
      user.emailVerifiedAt = new Date();
      user.status = 'active';
      user.tokenVersion += 1;
      await user.save();
    } else {
      user = await User.create({ email, passwordHash, emailVerifiedAt: new Date(), status: 'active', tokenVersion: 0 });
    }
    const owner = user._id;

    // Clean and seed collections
    console.log('[Seed] Seeding Profile...');
    await Profile.deleteMany({ owner });
    await Profile.create({ ...seedData.profile, owner });

    console.log('[Seed] Seeding Social Links...');
    await Social.deleteMany({ owner });
    await Social.insertMany(seedData.socials.map((item) => ({ ...item, owner, visibility: 'published' })));

    console.log('[Seed] Seeding Skills Matrix...');
    await Skill.deleteMany({ owner });
    await Skill.insertMany(seedData.skills.map((item) => ({ ...item, owner, visibility: 'published' })));

    console.log('[Seed] Seeding Projects...');
    await Project.deleteMany({ owner });
    await Project.insertMany(seedData.projects.map((item) => ({ ...item, owner, visibility: 'published' })));

    console.log('[Seed] Seeding Experience...');
    await Experience.deleteMany({ owner });
    await Experience.insertMany(seedData.experience.map((item) => ({ ...item, owner, visibility: 'published' })));

    console.log('[Seed] Seeding Education...');
    await Education.deleteMany({ owner });
    await Education.insertMany(seedData.education.map((item) => ({ ...item, owner, visibility: 'published' })));

    console.log('[Seed] Seeding Certifications...');
    await Certification.deleteMany({ owner });
    await Certification.insertMany(seedData.certifications.map((item) => ({ ...item, owner, visibility: 'published' })));

    console.log('[Seed] Seeding Resume document...');
    await Resume.deleteMany({ owner });
    await Resume.create({ ...seedData.resume, owner });
    await contentChanged.onContentChanged(owner);

    console.log('\n======================================================');
    console.log('   DATABASE SEED COMPLETED SUCCESSFULLY (8 Collections) ');
    console.log('======================================================');
    console.log(`• Profile       : 1 singleton document`);
    console.log(`• Social Links  : ${seedData.socials.length} links`);
    console.log(`• Skills Matrix : ${seedData.skills.length} categorized skills`);
    console.log(`• Projects      : ${seedData.projects.length} case studies`);
    console.log(`• Experience    : ${seedData.experience.length} career milestones`);
    console.log(`• Education     : ${seedData.education.length} credentials`);
    console.log(`• Certifications: ${seedData.certifications.length} awards/licenses`);
    console.log(`• Resume Asset  : 1 master document`);
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

runSeed();
