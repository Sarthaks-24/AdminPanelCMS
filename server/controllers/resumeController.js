const Resume = require('../models/Resume');
const pickFields = require('../lib/pickFields');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const ownerForRequest = require('../lib/ownerForRequest');
const upsertSingleton = require('../lib/upsertSingleton');
const contentChanged = require('../lib/onContentChanged');

async function getResume(req, res, next) {
  try {
    const owner = await ownerForRequest(req);
    if (!owner) return res.status(404).json({ success: false, message: 'Resume entry not found' });
    const query = Resume.findOne({ owner });
    if (!req.userId) query.select('-owner');
    const resume = await query;
    return resume ? res.json(resume) : res.status(404).json({ success: false, message: 'Resume entry not found' });
  } catch (error) { return next(error); }
}

async function downloadResume(req, res, next) {
  try {
    const owner = await ownerForRequest(req);
    if (!owner) return res.status(404).json({ success: false, message: 'Resume entry not found' });
    const resume = await Resume.findOne({ owner }).select('resumeUrl');
    if (!resume?.resumeUrl) return res.status(404).json({ success: false, message: 'Resume entry not found' });
    return res.redirect(302, resume.resumeUrl);
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

module.exports = { getResume, downloadResume, updateResume };
