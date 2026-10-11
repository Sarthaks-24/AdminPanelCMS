// The one error shape every /v1 response uses (contract §1):
//   { error: '<snake_code>', message: '<human>', requestId: '<id>', ...extra }
// `extra` carries the optional `section` (403 section_disabled) or `fields`.
function v1Error(res, status, code, message, extra = {}) {
  return res.status(status).json({ error: code, message, requestId: res.req?.id, ...extra });
}

module.exports = { v1Error };
