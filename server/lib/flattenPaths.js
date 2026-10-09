// Turns { location: { city } } into { 'location.city': value } so $set merges sub-documents
// instead of replacing them. Arrays, Dates and ObjectIds are leaf values.
function flattenPaths(value, prefix = '', out = {}) {
  for (const [key, child] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    const plain = child && typeof child === 'object' && Object.getPrototypeOf(child) === Object.prototype;
    if (plain && Object.keys(child).length) flattenPaths(child, path, out);
    else out[path] = child;
  }
  return out;
}

module.exports = flattenPaths;
