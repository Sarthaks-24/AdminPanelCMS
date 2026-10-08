const WRITABLE_FIELDS = {
  Profile: ['name', 'initials', 'headline', 'shortBio', 'aboutMarkdown', 'email', 'phone', 'location.city', 'location.country', 'location.isRemoteAvailable', 'statusText', 'isAvailableForHire', 'terminalUser', 'terminalHost', 'bootGreeting', 'metrics'],
  Resume: ['resumeUrl', 'driveUrl', 'fileName', 'version', 'lastUpdated', 'summaryText'],
  Project: ['title', 'slug', 'mode', 'role', 'shortDescription', 'keyMetric', 'highlights', 'caseStudyBody', 'stack', 'teammates', 'thumbnail', 'links.github', 'links.live', 'links.demo', 'order', 'featured', 'lastUpdated', 'visibility'],
  Skill: ['name', 'category', 'proficiency', 'yearsOfExperience', 'featured', 'order', 'visibility'],
  Social: ['platform', 'label', 'url', 'username', 'icon', 'order', 'featured', 'visibility'],
  Experience: ['company', 'role', 'employmentType', 'period', 'startDate', 'endDate', 'isCurrent', 'location', 'companyUrl', 'description', 'achievements', 'technologies', 'order', 'featured', 'visibility'],
  Education: ['institution', 'degree', 'fieldOfStudy', 'period', 'startDate', 'endDate', 'grade', 'location', 'achievements', 'order', 'featured', 'visibility'],
  Certification: ['title', 'issuer', 'issueDate', 'expirationDate', 'credentialId', 'credentialUrl', 'skills', 'order', 'featured', 'visibility'],
};

const LIMITS = { itemsPerCollection: 500 };
module.exports = { WRITABLE_FIELDS, LIMITS };
