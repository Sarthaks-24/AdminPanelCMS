module.exports = function qString(req, key, maxLen = 64) {
  const value = req.query[key];
  return typeof value === 'string' ? value.slice(0, maxLen) : undefined;
};
