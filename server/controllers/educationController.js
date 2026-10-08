const Education = require('../models/Education');
const crud = require('../lib/scopedCrud')(Education);
module.exports = { getEducation: crud.list, createEducation: crud.create, updateEducation: crud.update, deleteEducation: crud.remove };
