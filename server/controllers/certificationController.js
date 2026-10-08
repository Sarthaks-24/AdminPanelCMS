const Certification = require('../models/Certification');
const crud = require('../lib/scopedCrud')(Certification, 'certification', { sort: { order: 1, createdAt: 1 } });
module.exports = { getCertifications: crud.list, createCertification: crud.create, updateCertification: crud.update, deleteCertification: crud.remove };
