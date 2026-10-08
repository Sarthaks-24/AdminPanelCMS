const Resume = require('../models/Resume');
const pickFields = require('../lib/pickFields');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const upsertSingleton = require('../lib/upsertSingleton');
const contentChanged = require('../lib/onContentChanged');

async function getResume(req, res, next) {
  try {
    const resume = await Resume.findOne({ owner: req.userId });
    return resume ? res.json(resume) : res.status(404).json({ success: false, message: 'Resume entry not found' });
  } catch (error) { return next(error); }
}

async function updateResume(req, res, next) {
  try {
    const data = pickFields(req.body, WRITABLE_FIELDS.Resume);
    data.resumeUrl = String(data.resumeUrl || data.driveUrl || '').trim();
    if (!data.resumeUrl) return res.status(400).json({ success: false, message: 'resumeUrl or driveUrl is required' });
    delete data.driveUrl;
    data.lastUpdated = new Date();
    const resume = await upsertSingleton(Resume, req.userId, data);
    await contentChanged.onContentChanged(req.userId);
    return res.json(resume);
  } catch (error) { return next(error); }
}

module.exports = { getResume, updateResume };
