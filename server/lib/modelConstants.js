const PUBLIC_FIELDS = {
  Profile: ['name', 'initials', 'headline', 'shortBio', 'aboutMarkdown', 'email', 'location.city', 'location.country', 'location.isRemoteAvailable', 'statusText', 'isAvailableForHire', 'terminalUser', 'terminalHost', 'bootGreeting', 'metrics'],
  Resume: ['resumeUrl', 'driveUrl', 'fileName', 'version', 'lastUpdated', 'summaryText'],
  Project: ['title', 'slug', 'mode', 'role', 'shortDescription', 'keyMetric', 'highlights', 'caseStudyBody', 'stack', 'teammates', 'thumbnail', 'links.github', 'links.live', 'links.demo', 'order', 'featured', 'lastUpdated'],
  Skill: ['name', 'category', 'proficiency', 'yearsOfExperience', 'featured', 'order'],
  Social: ['platform', 'label', 'url', 'username', 'icon', 'order', 'featured'],
  Experience: ['company', 'role', 'employmentType', 'period', 'startDate', 'endDate', 'isCurrent', 'location', 'companyUrl', 'description', 'achievements', 'technologies', 'order', 'featured'],
  Education: ['institution', 'degree', 'fieldOfStudy', 'period', 'startDate', 'endDate', 'grade', 'location', 'achievements', 'order', 'featured'],
  Certification: ['title', 'issuer', 'issueDate', 'expirationDate', 'credentialId', 'credentialUrl', 'skills', 'order', 'featured'],
};

const DEFAULT_FIELDS = {
  Profile: ['name', 'initials', 'headline', 'shortBio', 'aboutMarkdown', 'location.city', 'location.country', 'location.isRemoteAvailable', 'statusText', 'isAvailableForHire', 'terminalUser', 'terminalHost', 'bootGreeting', 'metrics'],
  Resume: ['resumeUrl', 'fileName', 'version', 'lastUpdated', 'summaryText'],
  Project: ['title', 'slug', 'mode', 'role', 'shortDescription', 'keyMetric', 'highlights', 'caseStudyBody', 'stack', 'thumbnail', 'links.github', 'links.live', 'links.demo', 'order', 'featured'],
  Skill: [...PUBLIC_FIELDS.Skill],
  Social: [...PUBLIC_FIELDS.Social],
  Experience: [...PUBLIC_FIELDS.Experience],
  Education: [...PUBLIC_FIELDS.Education],
  Certification: [...PUBLIC_FIELDS.Certification],
};

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

module.exports = { WRITABLE_FIELDS, PUBLIC_FIELDS, DEFAULT_FIELDS };
