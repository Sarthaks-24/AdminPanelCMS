const LIMITS = require('../config/limits');
const loadOwnerData = require('./loadOwnerData');
const flattenPaths = require('./flattenPaths');
const { sanitizeFields } = require('./applyInclude');
const { PUBLIC_FIELDS } = require('./modelConstants');

// Per-owner budget on published content, measured as the JSON of every servable field: the most any
// App could ever be granted. It keeps every /v1 body (the /fs tree included) under the response
// cache's 1 MB item cap, so the API never has to refuse a read for size. Checked on writes only.
const SECTIONS = {
  profile: 'Profile', resume: 'Resume', projects: 'Project', skills: 'Skill', socials: 'Social',
  experience: 'Experience', education: 'Education', certifications: 'Certification',
};

function publishedBytes(modelName, doc) {
  if (!doc || (doc.visibility !== undefined && doc.visibility !== 'published')) return 0;
  const fields = PUBLIC_FIELDS[modelName] || [];
  return Buffer.byteLength(JSON.stringify(sanitizeFields(doc, fields, fields, fields)));
}

async function ownerPublishedBytes(ownerId) {
  const raw = await loadOwnerData(ownerId, Object.keys(SECTIONS));
  let total = 0;
  for (const [key, modelName] of Object.entries(SECTIONS)) {
    const value = raw[key];
    for (const doc of Array.isArray(value) ? value : [value]) total += publishedBytes(modelName, doc);
  }
  return total;
}

// The document as it would be stored after `$set: flattenPaths(patch)`, for sizing only.
function applyPatch(Model, stored, patch) {
  const doc = Model.hydrate(stored);
  for (const [path, value] of Object.entries(flattenPaths(patch))) doc.set(path, value);
  return doc.toObject();
}

// A write that does not grow the owner's published bytes is always allowed, so an owner over the
// budget can still edit down, unpublish or delete.
async function checkContentBytes(ownerId, modelName, { next, previous = null }) {
  const limit = LIMITS.publishedContentBytes;
  const growth = publishedBytes(modelName, next) - publishedBytes(modelName, previous);
  if (growth <= 0) return { allowed: true };
  const used = (await ownerPublishedBytes(ownerId)) + growth;
  return used > limit ? { allowed: false, used, limit } : { allowed: true };
}

function contentBytesExceeded(res, { used, limit }) {
  return res.status(403).json({
    success: false, error: 'quota_exceeded', resource: 'content_bytes', limit, used,
    message: `Published content is limited to ${Math.round(limit / 1024)} KB per account. Shorten or unpublish something first.`,
  });
}

module.exports = { publishedBytes, ownerPublishedBytes, applyPatch, checkContentBytes, contentBytesExceeded };
