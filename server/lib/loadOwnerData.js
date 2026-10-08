const models = {
  profile: require('../models/Profile'), resume: require('../models/Resume'),
  projects: require('../models/Project'), skills: require('../models/Skill'),
  socials: require('../models/Social'), experience: require('../models/Experience'),
  education: require('../models/Education'), certifications: require('../models/Certification'),
};

async function loadOwnerData(ownerId, sections = []) {
  const entries = await Promise.all([...new Set(sections)].filter((key) => models[key]).map(async (key) => {
    const Model = models[key];
    const query = key === 'profile' || key === 'resume'
      ? Model.findOne({ owner: ownerId })
      : Model.find({ owner: ownerId, visibility: 'published' });
    return [key, await query.lean()];
  }));
  return Object.fromEntries(entries);
}

module.exports = loadOwnerData;
