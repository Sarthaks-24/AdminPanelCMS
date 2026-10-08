function pickFields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const path of allowed) {
    const parts = path.split('.');
    let source = value;
    for (const part of parts) {
      if (!source || typeof source !== 'object' || !Object.prototype.hasOwnProperty.call(source, part)) {
        source = undefined;
        break;
      }
      source = source[part];
    }
    if (source === undefined) continue;
    let target = result;
    for (const part of parts.slice(0, -1)) target = target[part] ||= {};
    target[parts[parts.length - 1]] = source;
  }
  return result;
}

module.exports = pickFields;
