const { PUBLIC_FIELDS, DEFAULT_FIELDS } = require('./modelConstants');

const COLLECTIONS = {
  socials: 'Social', skills: 'Skill', projects: 'Project', experience: 'Experience',
  education: 'Education', certifications: 'Certification',
};

function getPath(value, path) {
  return path.split('.').reduce((current, key) => current == null ? undefined : current[key], value);
}

function setPath(value, path, item) {
  const parts = path.split('.');
  let current = value;
  for (const part of parts.slice(0, -1)) current = current[part] ||= {};
  current[parts[parts.length - 1]] = item;
}

function sanitizeFields(item, fields, defaults, publicFields) {
  if (!item) return null;
  const selected = Array.isArray(fields) && fields.length ? fields : defaults;
  const output = {};
  if (item._id != null) output._id = item._id;
  for (const path of selected) {
    if (!publicFields.includes(path)) continue;
    let value = getPath(item, path);
    if (value === undefined) continue;
    if (path === 'metrics' && Array.isArray(value)) {
      value = value.map((metric) => Object.fromEntries(['label', 'value', 'description']
        .filter((key) => metric[key] !== undefined).map((key) => [key, metric[key]])));
    } else if (Array.isArray(value)) {
      value = value.filter((entry) => entry == null || ['string', 'number', 'boolean'].includes(typeof entry));
    } else if (value instanceof Date) {
      // Keep dates intact; JSON serialization will render them as ISO strings.
    } else if (value && typeof value === 'object') {
      continue;
    }
    setPath(output, path, value);
  }
  return output;
}

function byOrder(a, b) {
  return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
    || String(a._id ?? '').localeCompare(String(b._id ?? ''));
}

function byIssueDateDesc(a, b) {
  const date = (value) => {
    const parsed = value instanceof Date ? value.getTime() : Date.parse(value || '');
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };
  return date(b.issueDate) - date(a.issueDate) || String(a._id ?? '').localeCompare(String(b._id ?? ''));
}

function applyInclude(app, rawData = {}, options = {}) {
  const result = {};
  const include = app?.include || {};
  for (const key of ['profile', 'resume']) {
    const config = include[key];
    const model = key === 'profile' ? 'Profile' : 'Resume';
    if (config?.enabled && rawData[key]) {
      const item = key === 'resume' ? { ...rawData.resume, driveUrl: rawData.resume.driveUrl || rawData.resume.resumeUrl } : rawData.profile;
      result[key] = sanitizeFields(item, config.fields, DEFAULT_FIELDS[model], PUBLIC_FIELDS[model]);
    }
  }
  for (const [key, model] of Object.entries(COLLECTIONS)) {
    const config = include[key];
    if (!config?.enabled || !Array.isArray(rawData[key])) continue;
    let items = rawData[key].filter((item) => item.visibility === 'published');
    if (key === 'projects') {
      const stack = options.tag || options.stack;
      if (typeof stack === 'string') items = items.filter((item) => Array.isArray(item.stack) && item.stack.some((tag) => String(tag).toLowerCase() === stack.toLowerCase()));
      if (options.featured === true || options.featured === 'true') items = items.filter((item) => item.featured === true);
      if (typeof options.slug === 'string') items = items.filter((item) => item.slug === options.slug);
    }
    if (key === 'skills') {
      if (typeof options.category === 'string') items = items.filter((item) => String(item.category || '').toLowerCase() === options.category.toLowerCase());
      if (Array.isArray(config.categories) && config.categories.length) items = items.filter((item) => config.categories.includes(item.category));
    }
    if (config.mode === 'featured') items = items.filter((item) => item.featured === true).sort(byOrder);
    else if (config.mode === 'selected') {
      const byId = new Map(items.map((item) => [String(item._id), item]));
      items = (config.ids || []).map((id) => byId.get(String(id))).filter(Boolean);
    } else items.sort(key === 'certifications' ? byIssueDateDesc : byOrder);
    result[key] = items.map((item) => sanitizeFields(item, config.fields, DEFAULT_FIELDS[model], PUBLIC_FIELDS[model]));
  }
  return result;
}

module.exports = { applyInclude, sanitizeFields, byOrder, byIssueDateDesc };
