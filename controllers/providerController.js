const Provider = require('../models/Provider');
const generateToken = require('../utils/jwt');
const { uploadBufferToS3 } = require('../utils/s3Upload');
const MESSAGES = require('../config/errorMessages.json');

const serializeProvider = (provider) => ({
  id: provider._id,
  email: provider.email,
  fullName: provider.fullName,
  gender: provider.gender,
  nationality: provider.nationality,
  categoryId: provider.categoryId,
  area: provider.area,
  city: provider.city,
  mobileNumber: provider.mobileNumber,
  whatsappNumber: provider.whatsappNumber,
  emirate: provider.emirate,
  visaStatus: provider.visaStatus,
  experienceYears: provider.experienceYears,
  monthlySalaryAed: provider.monthlySalaryAed,
  skills: provider.skills,
  imageUrl: provider.imageUrl,
  phone: provider.phone,
  whatsapp: provider.whatsapp,
  bio: provider.bio,
  kyc: provider.kyc && {
    idType: provider.kyc.idType,
    idDocumentUrl: provider.kyc.idDocumentUrl,
  },
  applicationStatus: provider.applicationStatus,
});

exports.register = async (req, res, next) => {
  try {
    const {
      fullName,
      gender,
      nationality,
      categoryId,
      area,
      city,
      mobileNumber,
      whatsappNumber,
      email,
      password,
      idType,
      idNumber,
    } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.registerFieldsRequired });
    }

    const photoFile = req.files?.photo?.[0];
    const idDocumentFile = req.files?.idDocument?.[0];
    if (!photoFile) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.photoRequired });
    }
    if (!idDocumentFile) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.idDocumentRequired });
    }

    const existingProvider = await Provider.findOne({ email });
    if (existingProvider) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.emailAlreadyRegistered });
    }

    const [imageUrl, idDocumentUrl] = await Promise.all([
      uploadBufferToS3(photoFile.buffer, photoFile.mimetype, 'help-zone/photos'),
      uploadBufferToS3(idDocumentFile.buffer, idDocumentFile.mimetype, 'help-zone/kyc'),
    ]);

    const provider = await Provider.create({
      email,
      password,
      fullName,
      gender,
      nationality,
      categoryId,
      area,
      city,
      mobileNumber,
      whatsappNumber,
      imageUrl,
      kyc: {
        idType,
        idNumber,
        idDocumentUrl,
      },
      applicationStatus: 'pending',
    });

    const token = generateToken(provider._id, 'provider');
    res.status(201).json({
      success: true,
      token,
      provider: serializeProvider(provider),
    });
  } catch (error) {
    next(error);
  }
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.login = async (req, res, next) => {
  try {
    // Accepts either `identifier` (preferred) or the legacy `email` field,
    // and the identifier can be an email address or a phone number.
    const rawIdentifier = (req.body.identifier ?? req.body.email ?? '').toString().trim();
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.loginFieldsRequired });
    }

    const isEmail = EMAIL_PATTERN.test(rawIdentifier);
    const query = isEmail
      ? { email: rawIdentifier.toLowerCase() }
      : { mobileNumberDigits: rawIdentifier.replace(/\D/g, '') };

    if (!isEmail && !query.mobileNumberDigits) {
      return res.status(401).json({ success: false, message: MESSAGES.provider.invalidCredentials });
    }

    const provider = await Provider.findOne(query).select('+password');
    if (!provider) {
      return res.status(401).json({ success: false, message: MESSAGES.provider.invalidCredentials });
    }
    const isMatch = await provider.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: MESSAGES.provider.invalidCredentials });
    }
    if (!provider.isActive) {
      return res.status(401).json({ success: false, message: MESSAGES.provider.accountDeactivated });
    }
    const token = generateToken(provider._id, 'provider');
    res.json({
      success: true,
      token,
      provider: serializeProvider(provider),
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    res.json({ success: true, provider: req.provider });
  } catch (error) {
    next(error);
  }
};

exports.getProviderById = async (req, res, next) => {
  try {
    const provider = await Provider.findById(req.params.id).select('-kyc.idNumber');
    if (!provider) {
      return res.status(404).json({ success: false, message: MESSAGES.provider.notFound });
    }
    res.json({ success: true, data: provider });
  } catch (error) {
    next(error);
  }
};

const ALLOWED_PROFILE_FIELDS = [
  'fullName', 'gender', 'nationality', 'categoryId', 'area', 'city',
  'mobileNumber', 'whatsappNumber', 'emirate', 'visaStatus', 'experienceYears',
  'monthlySalaryAed', 'skills', 'imageUrl', 'phone', 'whatsapp', 'bio',
  'maritalStatus', 'religion', 'hasPassport', 'visaExpiryDate', 'availability',
  'preferredJob', 'duration', 'languages', 'education', 'certificate',
  'lastWorkingExperience', 'jobDescription', 'hasReferenceLetter', 'referenceLetterUrl',
  'profileComplete',
];

exports.updateMyProfile = async (req, res, next) => {
  try {
    const provider = req.provider;
    ALLOWED_PROFILE_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) provider[key] = req.body[key];
    });
    if (req.body.password) provider.password = req.body.password;
    await provider.save();
    res.json({ success: true, provider });
  } catch (error) {
    next(error);
  }
};

exports.updateProvider = async (req, res, next) => {
  try {
    if (req.provider._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: MESSAGES.provider.notAuthorizedToUpdate });
    }
    const provider = req.provider;
    ALLOWED_PROFILE_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) provider[key] = req.body[key];
    });
    if (req.body.password) provider.password = req.body.password;
    await provider.save();
    res.json({ success: true, provider });
  } catch (error) {
    next(error);
  }
};

exports.listProviders = async (req, res, next) => {
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
    const providers = await Provider.find(query)
      .select('-kyc.idNumber')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Provider.countDocuments(query);
    res.json({
      success: true,
      count: providers.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: providers,
    });
  } catch (error) {
    next(error);
  }
};
