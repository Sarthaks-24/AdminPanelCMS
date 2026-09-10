const Resume = require('../models/Resume');

// @desc    Get the resume link entry
// @route   GET /api/resume
// @access  Public
const getResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne();
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume entry not found' });
    }
    res.json(resume);
  } catch (error) {
    next(error);
  }
};

// @desc    Update or upsert the single resume link entry
// @route   PUT /api/resume
// @access  Protected (Admin)
const updateResume = async (req, res, next) => {
  try {
    const { resumeUrl, driveUrl, fileName, version, summaryText } = req.body;
    const targetUrl = (resumeUrl || driveUrl || '').trim();

    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        message: 'resumeUrl or driveUrl is required',
      });
    }

    let resume = await Resume.findOne();
    if (resume) {
      resume.resumeUrl = targetUrl;
      if (fileName !== undefined) resume.fileName = fileName.trim();
      if (version !== undefined) resume.version = version.trim();
      if (summaryText !== undefined) resume.summaryText = summaryText.trim();
      resume.lastUpdated = new Date();
      await resume.save();
    } else {
      resume = await Resume.create({
        resumeUrl: targetUrl,
        fileName: fileName ? fileName.trim() : 'Resume_Master.pdf',
        version: version ? version.trim() : 'v2026.09',
        summaryText: summaryText
          ? summaryText.trim()
          : 'Full Stack Engineer with expertise in real-time WebSockets, microservices, and electronics debugging.',
        lastUpdated: new Date(),
      });
    }

    // Ensure singleton: remove duplicate entries if any
    await Resume.deleteMany({ _id: { $ne: resume._id } });

    res.json(resume);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getResume,
  updateResume,
};
