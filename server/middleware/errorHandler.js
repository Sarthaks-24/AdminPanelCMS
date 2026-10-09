const errorHandler = (err, req, res, next) => {
  if (err?.name === 'ValidationError' || err?.name === 'CastError') {
    const fields = err.name === 'ValidationError'
      ? Object.keys(err.errors || {})
      : [err.path].filter(Boolean);
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      message: 'One or more fields are invalid.',
      fields,
    });
  }

  if (err?.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'conflict',
      message: 'A record with one of these values already exists.',
    });
  }

  console.error(`[Server Error] ${err.message}`);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;
