const Provider = require('../models/Provider');
const generateToken = require('../utils/jwt');
const { uploadBufferToS3 } = require('../utils/s3Upload');
const MESSAGES = require('../config/errorMessages.json');
const normalizeCategoryIds = require('../utils/normalizeCategoryIds');

const serializeProvider = (provider) => ({
  id: provider._id,
  email: provider.email,
  fullName: provider.fullName,
  gender: provider.gender,
  nationality: provider.nationality,
  categoryIds: provider.categoryIds,
  area: provider.area,
  city: provider.city,
  state: provider.state,
  mobileNumber: provider.mobileNumber,
  whatsappNumber: provider.whatsappNumber,
  emirate: provider.emirate,
  visaStatus: provider.visaStatus,
  experienceYears: provider.experienceYears,
  monthlySalary: provider.monthlySalary,
  skills: provider.skills,
  imageUrl: provider.imageUrl,
  phone: provider.phone,
  whatsapp: provider.whatsapp,
  bio: provider.bio,
  kycDocuments: (provider.kycDocuments || []).map((doc) => ({
    idType: doc.idType,
    idDocumentUrl: doc.idDocumentUrl,
  })),
  introVideoUrl: provider.introVideoUrl,
  applicationStatus: provider.applicationStatus,
});

exports.register = async (req, res, next) => {
  try {
    const {
      fullName,
      firstName,
      lastName,
      gender,
      nationality,
      categoryIds,
      area,
      city,
      state,
      mobileNumber,
      whatsappNumber,
      email,
      password,
      agreedToTerms,
      // Photo/ID document are NOT collected at signup in the current
      // registration screen (that happens later, in the KYC step of
      // complete-profile) — these are only honored if a client does send
      // them, never required.
      idType,
      idNumber,
    } = req.body;

    // The signup screen collects firstName/lastName separately; fullName
    // stays the canonical stored field, composed from the two if needed.
    const resolvedFullName = (fullName || `${firstName || ''} ${lastName || ''}`).trim();

    if (!resolvedFullName || !email || !password) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.registerFieldsRequired });
    }

    const existingProvider = await Provider.findOne({ email });
    if (existingProvider) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.emailAlreadyRegistered });
    }

    const photoFile = req.files?.photo?.[0];
    const idDocumentFile = req.files?.idDocument?.[0];
    const [imageUrl, idDocumentUrl] = await Promise.all([
      photoFile ? uploadBufferToS3(photoFile.buffer, photoFile.mimetype, 'help-zone/photos') : null,
      idDocumentFile ? uploadBufferToS3(idDocumentFile.buffer, idDocumentFile.mimetype, 'help-zone/kyc') : null,
    ]);

    const provider = await Provider.create({
      email,
      password,
      fullName: resolvedFullName,
      gender,
      nationality,
      categoryIds: normalizeCategoryIds(categoryIds),
      area,
      city,
      state,
      mobileNumber,
      whatsappNumber,
      imageUrl: imageUrl || undefined,
      kycDocuments: idDocumentUrl ? [{ idType, idNumber, idDocumentUrl }] : [],
      agreedToTerms: Boolean(agreedToTerms),
      agreedToTermsAt: agreedToTerms ? new Date() : undefined,
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

// Full self-view for the logged-in provider's own "My Account" / "My
// Profile" screen — every field except password and the internal
// mobileNumberDigits index (unlike serializeProvider used for
// register/login responses, which only returns a curated subset).
// Also includes a derived `kyc` (first kycDocuments entry) alongside the
// real `kycDocuments` array, for any consumer still built against the old
// single-document shape.
const serializeProviderFull = (provider) => {
  const { _id, password, mobileNumberDigits, __v, ...rest } = provider.toObject();
  return { id: _id, ...rest, kyc: rest.kycDocuments?.[0] };
};

exports.getMe = async (req, res, next) => {
  try {
    res.json({ success: true, provider: serializeProviderFull(req.provider) });
  } catch (error) {
    next(error);
  }
};

exports.getProviderById = async (req, res, next) => {
  try {
    const provider = await Provider.findById(req.params.id).select('-kycDocuments.idNumber -mobileNumberDigits');
    if (!provider) {
      return res.status(404).json({ success: false, message: MESSAGES.provider.notFound });
    }
    res.json({ success: true, data: provider });
  } catch (error) {
    next(error);
  }
};

const ALLOWED_PROFILE_FIELDS = [
  'fullName', 'gender', 'nationality', 'categoryIds', 'area', 'city', 'state',
  'mobileNumber', 'whatsappNumber', 'emirate', 'visaStatus', 'experienceYears',
  'monthlySalary', 'skills', 'imageUrl', 'phone', 'whatsapp', 'bio',
  'age', 'panNumber', 'maritalStatus', 'religion', 'hasPassport', 'visaExpiryDate', 'availability',
  'preferredJob', 'duration', 'languages', 'education', 'certificate',
  'lastWorkingExperience', 'jobDescription', 'hasReferenceLetter', 'referenceLetterUrl',
  'profileComplete',
];

// categoryIds needs its comma-string-or-array normalization applied even
// through the generic field list, so it can't just be assigned as-is.
const applyAllowedFields = (provider, body) => {
  ALLOWED_PROFILE_FIELDS.forEach((key) => {
    if (body[key] === undefined) return;
    provider[key] = key === 'categoryIds' ? normalizeCategoryIds(body[key]) : body[key];
  });
};

exports.updateMyProfile = async (req, res, next) => {
  try {
    const provider = req.provider;
    applyAllowedFields(provider, req.body);
    if (req.body.password) provider.password = req.body.password;
    await provider.save();
    res.json({ success: true, provider: serializeProviderFull(provider) });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------
// Profile-completion: General info + Work preferences + Last job,
// submitted together in one call from the 4-step form on the frontend.
// ---------------------------------------------------------------------

const WORK_PREFERENCES_FIELDS = [
  'experienceYears', 'monthlySalary', 'duration', 'languages', 'skills', 'education',
];

const LAST_JOB_FIELDS = [
  'jobTitle', 'workingCity', 'familySize', 'employerNationality', 'duration', 'salary', 'reasonForLeaving',
];

// Resubmitting after a rejection sends it back for review; leave
// pending/approved providers' status untouched.
const markSubmittedForReview = (provider) => {
  provider.profileComplete = true;
  if (provider.applicationStatus === 'rejected') {
    provider.applicationStatus = 'pending';
    provider.rejectionReason = undefined;
  } else if (!provider.applicationStatus) {
    provider.applicationStatus = 'pending';
  }
};

// Accepts generalInfo/workPreferences/lastJob either as nested JSON
// objects (plain JSON request) or JSON-stringified form fields
// (multipart, needed when photo/idDocument files are also being sent).
exports.completeProfile = async (req, res, next) => {
  try {
    const provider = req.provider;

    const parseSection = (value) => {
      if (!value) return {};
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }
      return value;
    };

    const generalInfo = parseSection(req.body.generalInfo);
    const workPreferences = parseSection(req.body.workPreferences);
    const lastJob = parseSection(req.body.lastJob);

    if (generalInfo.age !== undefined) provider.age = generalInfo.age;
    if (generalInfo.maritalStatus !== undefined) provider.maritalStatus = generalInfo.maritalStatus;
    if (generalInfo.religion !== undefined) provider.religion = generalInfo.religion;
    if (generalInfo.panNumber !== undefined) provider.panNumber = generalInfo.panNumber;
    if (generalInfo.state !== undefined) provider.state = generalInfo.state;
    if (generalInfo.city !== undefined) provider.city = generalInfo.city;

    if (workPreferences.categoryIds !== undefined) {
      provider.categoryIds = normalizeCategoryIds(workPreferences.categoryIds);
    }
    WORK_PREFERENCES_FIELDS.forEach((key) => {
      if (workPreferences[key] !== undefined) provider[key] = workPreferences[key];
    });

    LAST_JOB_FIELDS.forEach((key) => {
      if (lastJob[key] !== undefined) provider.lastWorkingExperience[key] = lastJob[key];
    });
    if (lastJob.jobDescription !== undefined) provider.jobDescription = lastJob.jobDescription;

    const photoFile = req.files?.photo?.[0];
    const videoFile = req.files?.video?.[0];
    const [imageUrl, introVideoUrl] = await Promise.all([
      photoFile ? uploadBufferToS3(photoFile.buffer, photoFile.mimetype, 'help-zone/photos') : null,
      videoFile ? uploadBufferToS3(videoFile.buffer, videoFile.mimetype, 'help-zone/videos') : null,
    ]);
    if (imageUrl) provider.imageUrl = imageUrl;
    if (introVideoUrl) provider.introVideoUrl = introVideoUrl;

    // Multiple ID proofs: generalInfo.idProofs is an array of
    // { idType, idNumber }, paired by position with files uploaded under
    // the `idDocuments` field (same order). Sending either one replaces
    // the whole kycDocuments list — same full-replace behavior as
    // languages/skills above, not a per-entry merge.
    const idDocumentFiles = req.files?.idDocuments || [];
    if (generalInfo.idProofs !== undefined || idDocumentFiles.length) {
      const idProofsMeta = Array.isArray(generalInfo.idProofs) ? generalInfo.idProofs : [];
      const idDocumentUrls = await Promise.all(
        idDocumentFiles.map((file) => uploadBufferToS3(file.buffer, file.mimetype, 'help-zone/kyc'))
      );
      const count = Math.max(idProofsMeta.length, idDocumentUrls.length);
      provider.kycDocuments = Array.from({ length: count }, (_, i) => ({
        idType: idProofsMeta[i]?.idType,
        idNumber: idProofsMeta[i]?.idNumber,
        idDocumentUrl: idDocumentUrls[i],
      }));
    }

    markSubmittedForReview(provider);
    await provider.save();
    res.json({ success: true, provider: serializeProviderFull(provider) });
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
    applyAllowedFields(provider, req.body);
    if (req.body.password) provider.password = req.body.password;
    await provider.save();
    res.json({ success: true, provider: serializeProviderFull(provider) });
  } catch (error) {
    next(error);
  }
};

exports.listProviders = async (req, res, next) => {
  try {
    const { emirate, categoryId, minSalary, maxSalary, skills, page = 1, limit = 10 } = req.query;
    const query = { isActive: { $ne: false } };

    if (emirate) query.emirate = new RegExp(emirate, 'i');
    if (categoryId) {
      const categoryArr = normalizeCategoryIds(categoryId);
      if (categoryArr.length) query.categoryIds = { $in: categoryArr };
    }
    if (skills) {
      const skillArr = skills.split(',').map((s) => s.trim()).filter(Boolean);
      if (skillArr.length) query.skills = { $in: skillArr };
    }
    if (minSalary || maxSalary) {
      query.monthlySalary = {};
      if (minSalary) query.monthlySalary.$gte = Number(minSalary);
      if (maxSalary) query.monthlySalary.$lte = Number(maxSalary);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const providers = await Provider.find(query)
      .select('-kycDocuments.idNumber -mobileNumberDigits')
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
