const logger = require('../lib/logger');

// Dashboard (/api) error handler. Shapes stay `{ success:false, error, message, ... }`; every body
// now also carries `requestId`. A stack is never sent to a client: 5xx are logged server-side with it.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const requestId = req?.id;
  if (err?.name === 'ValidationError' || err?.name === 'CastError') {
    const fields = err.name === 'ValidationError' ? Object.keys(err.errors || {}) : [err.path].filter(Boolean);
    return res.status(400).json({ success: false, error: 'validation_error', message: 'One or more fields are invalid.', fields, requestId });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ success: false, error: 'conflict', message: 'A record with one of these values already exists.', requestId });
  }
  // body-parser errors carry a `type`; they used to fall through as 500s.
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'bad_request', message: 'Malformed JSON body', requestId });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'payload_too_large', message: 'Request body exceeds the 256 KB limit', requestId });
  }

  let statusCode = Number(err?.status ?? err?.statusCode);
  if (!(statusCode >= 400 && statusCode <= 599)) statusCode = res.statusCode >= 400 ? res.statusCode : 500;
  if (statusCode < 500) {
    return res.status(statusCode).json({ success: false, error: 'bad_request', message: err?.expose ? err.message : 'Bad request', requestId });
  }
  logger.error({ err, reqId: requestId, method: req?.method, path: req?.originalUrl }, 'unhandled request error');
  return res.status(statusCode).json({
    success: false,
    error: 'internal',
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err?.message || 'Internal Server Error'),
    requestId,
  });
};

module.exports = errorHandler;
