const requireSession = require('./requireSession');

module.exports = function optionalSession(req, res, next) {
  return req.headers.authorization ? requireSession(req, res, next) : next();
};
