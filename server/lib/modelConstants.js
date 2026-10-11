// Resume.driveUrl (CB-12) is a deprecated read-only alias of resumeUrl, not a separate or private link. It stays
// grantable so Apps that already opted in keep receiving it (/v1 is additive-only); it is not writable.
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
  Resume: ['resumeUrl', 'fileName', 'version', 'lastUpdated', 'summaryText'],
  Project: ['title', 'slug', 'mode', 'role', 'shortDescription', 'keyMetric', 'highlights', 'caseStudyBody', 'stack', 'teammates', 'thumbnail', 'links.github', 'links.live', 'links.demo', 'order', 'featured', 'lastUpdated', 'visibility'],
  Skill: ['name', 'category', 'proficiency', 'yearsOfExperience', 'featured', 'order', 'visibility'],
  Social: ['platform', 'label', 'url', 'username', 'icon', 'order', 'featured', 'visibility'],
  Experience: ['company', 'role', 'employmentType', 'period', 'startDate', 'endDate', 'isCurrent', 'location', 'companyUrl', 'description', 'achievements', 'technologies', 'order', 'featured', 'visibility'],
  Education: ['institution', 'degree', 'fieldOfStudy', 'period', 'startDate', 'endDate', 'grade', 'location', 'achievements', 'order', 'featured', 'visibility'],
  Certification: ['title', 'issuer', 'issueDate', 'expirationDate', 'credentialId', 'credentialUrl', 'skills', 'order', 'featured', 'visibility'],
};

// Skill categories are a free string per owner (contract §2.6). These seven are only the
// suggestions shown to an owner who has not created any category yet.
const LEGACY_SKILL_CATEGORIES = Object.freeze([
  'Languages', 'Frontend', 'Backend & Systems', 'Databases & Caching',
  'DevOps & Cloud', 'Hardware & Electronics', 'Tools & Frameworks',
]);

// Upper bound used by the App schema for any section's `fields[]`; validateApp applies the exact per-model cap.
const MAX_FIELDS_PER_SECTION = Math.max(...Object.values(PUBLIC_FIELDS).map((fields) => fields.length));

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 80;

// Schema helper for capped string arrays (contract §4): at most `maxItems` entries, each at most `maxLength` chars.
// A single array-level validator so the same rule runs for document saves and `$set` update validators.
function boundedStringArray(maxItems, maxLength, extra = {}) {
  return {
    type: [{ type: String, trim: true }],
    default: [],
    validate: {
      validator: (value) => Array.isArray(value) && value.length <= maxItems
        && value.every((entry) => typeof entry === 'string' && entry.length <= maxLength),
      message: `Must contain at most ${maxItems} entries of at most ${maxLength} characters each`,
    },
    ...extra,
  };
}

module.exports = {
  WRITABLE_FIELDS, PUBLIC_FIELDS, DEFAULT_FIELDS, LEGACY_SKILL_CATEGORIES,
  MAX_FIELDS_PER_SECTION, SLUG_PATTERN, SLUG_MAX_LENGTH, boundedStringArray,
};
