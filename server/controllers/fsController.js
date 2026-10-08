const Project = require('../models/Project');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Skill = require('../models/Skill');
const Social = require('../models/Social');
const Resume = require('../models/Resume');
const Profile = require('../models/Profile');
const ownerForRequest = require('../lib/ownerForRequest');

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-');

// @desc    Get complete hierarchical filesystem tree for client applications
// @route   GET /api/fs
// @access  Public
const getVirtualFilesystem = async (req, res, next) => {
  try {
    const owner = await ownerForRequest(req);
    if (!owner) return res.status(404).json({ success: false, message: 'Portfolio owner not configured' });
    const [projects, experiences, educations, skills, socials, resume, profile] =
      await Promise.all([
        Project.find({ owner, visibility: 'published' }).sort({ order: 1 }),
        Experience.find({ owner, visibility: 'published' }).sort({ order: 1 }),
        Education.find({ owner, visibility: 'published' }).sort({ order: 1 }),
        Skill.find({ owner, visibility: 'published' }).sort({ order: 1, name: 1 }),
        Social.find({ owner, visibility: 'published' }).sort({ order: 1 }),
        Resume.findOne({ owner }),
        Profile.findOne({ owner }),
      ]);

    // Build projects virtual directory
    const projectsDir = {};
    projects.forEach((proj) => {
      const slug = proj.slug || slugify(proj.title);
      projectsDir[slug] = {
        type: 'dir',
        meta: {
          id: proj._id,
          title: proj.title,
          slug,
          mode: proj.mode,
          role: proj.role,
          keyMetric: proj.keyMetric,
          shortDescription: proj.shortDescription,
          highlights: proj.highlights,
          stack: proj.stack,
          links: proj.links,
          caseStudyBody: proj.caseStudyBody,
          order: proj.order,
          featured: proj.featured,
        },
      };
    });

    // Build experience virtual directory
    const experienceDir = {};
    experiences.forEach((exp) => {
      const slug = slugify(exp.company);
      experienceDir[slug] = {
        type: 'file',
        meta: {
          id: exp._id,
          company: exp.company,
          role: exp.role,
          employmentType: exp.employmentType,
          period: exp.period,
          location: exp.location,
          companyUrl: exp.companyUrl,
          description: exp.description,
          achievements: exp.achievements,
          technologies: exp.technologies,
          featured: exp.featured,
        },
      };
    });

    // Build education virtual directory
    const educationDir = {};
    educations.forEach((edu) => {
      const slug = slugify(edu.degree);
      educationDir[slug] = {
        type: 'file',
        meta: {
          id: edu._id,
          institution: edu.institution,
          degree: edu.degree,
          fieldOfStudy: edu.fieldOfStudy,
          period: edu.period,
          grade: edu.grade,
          location: edu.location,
          achievements: edu.achievements,
        },
      };
    });

    // Compile skills array (names sorted)
    const skillsList = skills.map((s) => s.name);

    // Compile socials list
    const socialsList = socials.map((s) => ({
      platform: s.platform,
      url: s.url,
      label: s.label,
      username: s.username,
      icon: s.icon,
      featured: s.featured,
    }));

    // Resume document metadata
    const resumeMeta = resume
      ? {
          resumeUrl: resume.resumeUrl,
          driveUrl: resume.driveUrl || resume.resumeUrl,
          fileName: resume.fileName,
          version: resume.version,
          summaryText: resume.summaryText,
          lastUpdated: resume.lastUpdated,
        }
      : null;

    // Profile metadata
    const profileMeta = profile
      ? {
          name: profile.name,
          headline: profile.headline,
          email: profile.email,
          phone: profile.phone,
          location: profile.location,
          statusText: profile.statusText,
          isAvailableForHire: profile.isAvailableForHire,
          terminalUser: profile.terminalUser,
          terminalHost: profile.terminalHost,
          bootGreeting: profile.bootGreeting,
          metrics: profile.metrics,
        }
      : null;

    res.json({
      projects: projectsDir,
      experience: experienceDir,
      education: educationDir,
      'skills.txt': skillsList,
      'socials.txt': socialsList,
      'resume.pdf': resumeMeta,
      profile: profileMeta,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVirtualFilesystem,
};
