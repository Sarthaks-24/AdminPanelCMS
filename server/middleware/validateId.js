const mongoose = require('mongoose');

module.exports = (param = 'id') => (req, res, next) => (
  mongoose.isValidObjectId(req.params[param])
    ? next()
    : res.status(404).json({ success: false, error: 'not_found' })
);
