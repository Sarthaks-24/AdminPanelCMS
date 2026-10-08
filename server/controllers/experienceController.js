const Experience = require('../models/Experience');
const crud = require('../lib/scopedCrud')(Experience);
module.exports = { getExperience: crud.list, createExperience: crud.create, updateExperience: crud.update, deleteExperience: crud.remove };
