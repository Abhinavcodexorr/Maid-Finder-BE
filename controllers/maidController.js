const Maid = require('../models/Maid');
const generateToken = require('../utils/jwt');

exports.register = async (req, res, next) => {
  try {
    const {
      email,
      password,
      fullName,
      nationality,
      emirate,
      visaStatus,
      experienceYears,
      monthlySalaryAed,
      skills,
      imageUrl,
      phone,
      whatsapp,
      bio,
    } = req.body;

    const existingMaid = await Maid.findOne({ email });
    if (existingMaid) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const maid = await Maid.create({
      email,
      password,
      fullName,
      nationality,
      emirate,
      visaStatus,
      experienceYears,
      monthlySalaryAed,
      skills: skills || [],
      imageUrl,
      phone,
      whatsapp,
      bio,
    });

    const token = generateToken(maid._id, 'maid');
    res.status(201).json({
      success: true,
      token,
      maid: {
        id: maid._id,
        email: maid.email,
        fullName: maid.fullName,
        nationality: maid.nationality,
        emirate: maid.emirate,
        visaStatus: maid.visaStatus,
        experienceYears: maid.experienceYears,
        monthlySalaryAed: maid.monthlySalaryAed,
        skills: maid.skills,
        imageUrl: maid.imageUrl,
        phone: maid.phone,
        whatsapp: maid.whatsapp,
        bio: maid.bio,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const maid = await Maid.findOne({ email }).select('+password');
    if (!maid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const isMatch = await maid.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const token = generateToken(maid._id, 'maid');
    res.json({
      success: true,
      token,
      maid: {
        id: maid._id,
        email: maid.email,
        fullName: maid.fullName,
        nationality: maid.nationality,
        emirate: maid.emirate,
        visaStatus: maid.visaStatus,
        experienceYears: maid.experienceYears,
        monthlySalaryAed: maid.monthlySalaryAed,
        skills: maid.skills,
        imageUrl: maid.imageUrl,
        phone: maid.phone,
        whatsapp: maid.whatsapp,
        bio: maid.bio,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    res.json({ success: true, maid: req.maid });
  } catch (error) {
    next(error);
  }
};

exports.getMaidById = async (req, res, next) => {
  try {
    const maid = await Maid.findById(req.params.id);
    if (!maid) {
      return res.status(404).json({ success: false, message: 'Maid not found' });
    }
    res.json({ success: true, data: maid });
  } catch (error) {
    next(error);
  }
};

const ALLOWED_PROFILE_FIELDS = [
  'fullName', 'nationality', 'emirate', 'visaStatus', 'experienceYears',
  'monthlySalaryAed', 'skills', 'imageUrl', 'phone', 'whatsapp', 'bio',
  'maritalStatus', 'religion', 'hasPassport', 'visaExpiryDate', 'availability',
  'preferredJob', 'duration', 'languages', 'education', 'certificate',
  'lastWorkingExperience', 'jobDescription', 'hasReferenceLetter', 'referenceLetterUrl',
  'profileComplete',
];

exports.updateMyProfile = async (req, res, next) => {
  try {
    const maid = req.maid;
    ALLOWED_PROFILE_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) maid[key] = req.body[key];
    });
    if (req.body.password) maid.password = req.body.password;
    await maid.save();
    res.json({ success: true, maid });
  } catch (error) {
    next(error);
  }
};

exports.updateMaid = async (req, res, next) => {
  try {
    if (req.maid._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this maid' });
    }
    const maid = req.maid;
    ALLOWED_PROFILE_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) maid[key] = req.body[key];
    });
    if (req.body.password) maid.password = req.body.password;
    await maid.save();
    res.json({ success: true, maid });
  } catch (error) {
    next(error);
  }
};

exports.listMaids = async (req, res, next) => {
  try {
    const { emirate, minSalary, maxSalary, skills, page = 1, limit = 10 } = req.query;
    const query = { isActive: { $ne: false } };

    if (emirate) query.emirate = new RegExp(emirate, 'i');
    if (skills) {
      const skillArr = skills.split(',').map((s) => s.trim()).filter(Boolean);
      if (skillArr.length) query.skills = { $in: skillArr };
    }
    if (minSalary || maxSalary) {
      query.monthlySalaryAed = {};
      if (minSalary) query.monthlySalaryAed.$gte = Number(minSalary);
      if (maxSalary) query.monthlySalaryAed.$lte = Number(maxSalary);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const maids = await Maid.find(query)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Maid.countDocuments(query);
    res.json({
      success: true,
      count: maids.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: maids,
    });
  } catch (error) {
    next(error);
  }
};
