const Provider = require('../models/Provider');
const OtpRequest = require('../models/OtpRequest');
const generateToken = require('../utils/jwt');
const { uploadBufferToS3 } = require('../utils/s3Upload');
const { makeThumbnail, makeWebVideo, stageBuffer } = require('../utils/videoProcess');
const MESSAGES = require('../config/errorMessages.json');
const formatMessage = require('../utils/formatMessage');
const normalizeCategoryIds = require('../utils/normalizeCategoryIds');
const { generateOtp, deliverOtp } = require('../utils/otp');
const { OTP_EXPIRY_MS, OTP_RESEND_COOLDOWN_MS } = require('../config/constants');

const serializeProvider = (provider) => ({
  id: provider._id,
  email: provider.email,
  fullName: provider.fullName,
  firstName: provider.firstName,
  lastName: provider.lastName,
  gender: provider.gender,
  nationality: provider.nationality,
  categoryIds: provider.categoryIds,
  subCategoryIds: provider.subCategoryIds,
  area: provider.area,
  city: provider.city,
  state: provider.state,
  countryCode: provider.countryCode,
  mobileNumber: provider.mobileNumber,
  whatsappNumber: provider.whatsappNumber,
  emirate: provider.emirate,
  experienceYears: provider.experienceYears,
  monthlySalary: provider.monthlySalary,
  skills: provider.skills,
  imageUrl: provider.imageUrl,
  phone: provider.phone,
  whatsapp: provider.whatsapp,
  bio: provider.bio,
  panNumber: provider.panNumber,
  panCardUrl: provider.panCardUrl,
  aadhaarNumber: provider.aadhaarNumber,
  aadhaarFrontUrl: provider.aadhaarFrontUrl,
  aadhaarBackUrl: provider.aadhaarBackUrl,
  kycDocuments: (provider.kycDocuments || []).map((doc) => ({
    idType: doc.idType,
    idNumber: doc.idNumber,
    idDocumentUrl: doc.idDocumentUrl,
  })),
  introVideoUrl: provider.introVideoUrl,
  introVideoThumbnailUrl: provider.introVideoThumbnailUrl,
  applicationStatus: provider.applicationStatus,
});

// Background job after an intro video upload: make a thumbnail first (quick), then a
// web-friendly copy (slow). Never blocks or fails the request; without ffmpeg the
// original upload simply stays as it is.
const processIntroVideo = async (providerId, buffer, originalUrl) => {
  let staged;
  try {
    staged = await stageBuffer(buffer);
    const thumbnail = await makeThumbnail(staged.path);
    await Provider.updateOne({ _id: providerId, introVideoUrl: originalUrl }, { introVideoThumbnailUrl: thumbnail });
    const webUrl = await makeWebVideo(staged.path);
    await Provider.updateOne(
      { _id: providerId, introVideoUrl: originalUrl },
      { introVideoUrl: webUrl, introVideoOriginalUrl: originalUrl }
    );
  } catch (error) {
    console.error('Intro video processing skipped:', error.message);
  } finally {
    staged?.cleanup();
  }
};

// ---------------------------------------------------------------------
// Step 1 — Mobile Verification. Phone + OTP, no password at this stage.
// Works for both first-time signup and returning providers logging back
// in: verifyOtp finds-or-creates, so the same two calls serve both.
// ---------------------------------------------------------------------

exports.sendOtp = async (req, res, next) => {
  try {
    const mobileNumber = (req.body.mobileNumber || '').toString().trim();
    const mobileNumberDigits = mobileNumber.replace(/\D/g, '');
    // Display/delivery only — NOT part of the matching key (see
    // mobileNumberDigits' comment on the Provider model for why).
    const countryCode = (req.body.countryCode || '+91').toString().trim();
    if (!mobileNumberDigits) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.mobileNumberRequired });
    }

    const existing = await OtpRequest.findOne({ mobileNumberDigits });
    if (existing) {
      const elapsedMs = Date.now() - existing.sentAt.getTime();
      if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        return res.status(429).json({
          success: false,
          message: formatMessage(MESSAGES.provider.otpResendTooSoon, { seconds: waitSeconds }),
        });
      }
    }

    const otp = generateOtp();
    const now = new Date();
    await OtpRequest.findOneAndUpdate(
      { mobileNumberDigits },
      { otp, sentAt: now, expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS), attempts: 0 },
      { upsert: true }
    );
    await deliverOtp(`${countryCode}${mobileNumber}`, otp);

    const alreadyRegistered = Boolean(await Provider.exists({ mobileNumberDigits }));
    res.json({
      success: true,
      alreadyRegistered,
      expiresInSeconds: OTP_EXPIRY_MS / 1000,
      // Dev-mode only: the real OTP is never returned once actual SMS
      // sending replaces utils/otp.js's deliverOtp stub.
      devOtp: otp,
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const mobileNumber = (req.body.mobileNumber || '').toString().trim();
    const mobileNumberDigits = mobileNumber.replace(/\D/g, '');
    const countryCode = (req.body.countryCode || '+91').toString().trim();
    const otp = (req.body.otp || '').toString().trim();
    if (!mobileNumberDigits) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.mobileNumberRequired });
    }
    if (!otp) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.otpRequired });
    }

    const otpRequest = await OtpRequest.findOne({ mobileNumberDigits });
    if (!otpRequest || otpRequest.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.otpNotRequested });
    }
    if (otpRequest.otp !== otp) {
      otpRequest.attempts += 1;
      await otpRequest.save();
      return res.status(400).json({ success: false, message: MESSAGES.provider.otpInvalid });
    }

    await OtpRequest.deleteOne({ _id: otpRequest._id });

    let provider = await Provider.findOne({ mobileNumberDigits });
    const isNewAccount = !provider;
    if (!provider) {
      provider = await Provider.create({
        mobileNumber,
        countryCode,
        applicationStatus: 'pending',
      });
    }

    const token = generateToken(provider._id, 'provider');
    res.json({
      success: true,
      token,
      isNewAccount,
      provider: serializeProvider(provider),
    });
  } catch (error) {
    next(error);
  }
};

exports.register = async (req, res, next) => {
  try {
    const {
      fullName,
      firstName,
      lastName,
      gender,
      nationality,
      categoryIds,
      categoryId, // legacy pre-rename name, used as a fallback below
      subCategoryIds,
      area,
      city,
      state,
      countryCode,
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

    // Mobile number is the real unique identity in the OTP-first flow — an
    // account may already exist for this number (created by verify-otp, or
    // a previous partial register() call) with no email/password yet. If
    // so, this call completes THAT account instead of blocking with
    // "already registered" or silently creating a duplicate for the same
    // phone number.
    const mobileNumberDigits = mobileNumber ? String(mobileNumber).replace(/\D/g, '') : '';
    let provider = mobileNumberDigits ? await Provider.findOne({ mobileNumberDigits }) : null;
    const isNewAccount = !provider;

    // Email still has to be unique, but only against a DIFFERENT provider —
    // reusing your own email to complete your own (mobile-matched) account
    // is not a conflict.
    const emailOwner = await Provider.findOne({ email });
    if (emailOwner && (!provider || emailOwner._id.toString() !== provider._id.toString())) {
      return res.status(400).json({ success: false, message: MESSAGES.provider.emailAlreadyRegistered });
    }

    const photoFile =
      req.files?.photo?.[0] ||
      req.files?.image?.[0] ||
      req.files?.file?.[0] ||
      req.files?.profilePhoto?.[0];
    const idDocumentFile = req.files?.idDocument?.[0];
    const aadhaarFrontFile = req.files?.aadhaarFront?.[0];
    const aadhaarBackFile = req.files?.aadhaarBack?.[0];
    const panCardFile = req.files?.panCard?.[0] || req.files?.pan?.[0];

    const [uploadedImageUrl, uploadedIdDocumentUrl, uploadedAadhaarFrontUrl, uploadedAadhaarBackUrl, uploadedPanCardUrl] =
      await Promise.all([
        photoFile ? uploadBufferToS3(photoFile.buffer, photoFile.mimetype, 'help-zone/photos') : null,
        idDocumentFile ? uploadBufferToS3(idDocumentFile.buffer, idDocumentFile.mimetype, 'help-zone/kyc') : null,
        aadhaarFrontFile ? uploadBufferToS3(aadhaarFrontFile.buffer, aadhaarFrontFile.mimetype, 'help-zone/kyc') : null,
        aadhaarBackFile ? uploadBufferToS3(aadhaarBackFile.buffer, aadhaarBackFile.mimetype, 'help-zone/kyc') : null,
        panCardFile ? uploadBufferToS3(panCardFile.buffer, panCardFile.mimetype, 'help-zone/kyc') : null,
      ]);

    const resolvedImageUrl =
      uploadedImageUrl ||
      req.body.imageUrl ||
      req.body.photoUrl ||
      (typeof req.body.photo === 'string' ? req.body.photo : null) ||
      (typeof req.body.image === 'string' ? req.body.image : null) ||
      req.body.profilePhoto ||
      req.body.profilePhotoUrl ||
      req.body.avatarUrl ||
      (typeof req.body.avatar === 'string' ? req.body.avatar : null) ||
      req.body.url;

    const resolvedIdDocumentUrl =
      uploadedIdDocumentUrl ||
      req.body.idDocumentUrl ||
      (typeof req.body.idDocument === 'string' ? req.body.idDocument : null);

    const resolvedAadhaarFrontUrl =
      uploadedAadhaarFrontUrl ||
      req.body.aadhaarFrontUrl ||
      (typeof req.body.aadhaarFront === 'string' ? req.body.aadhaarFront : null) ||
      req.body.aadhaarFrontPhoto;

    const resolvedAadhaarBackUrl =
      uploadedAadhaarBackUrl ||
      req.body.aadhaarBackUrl ||
      (typeof req.body.aadhaarBack === 'string' ? req.body.aadhaarBack : null) ||
      req.body.aadhaarBackPhoto;

    const resolvedPanCardUrl =
      uploadedPanCardUrl ||
      req.body.panCardUrl ||
      (typeof req.body.panCard === 'string' ? req.body.panCard : null) ||
      req.body.panUrl ||
      req.body.panCardPhoto;

    const resolvedIntroVideoUrl =
      req.body.introVideoUrl ||
      req.body.videoUrl ||
      (typeof req.body.introVideo === 'string' ? req.body.introVideo : null) ||
      (typeof req.body.video === 'string' ? req.body.video : null);

    const fields = {
      email,
      password,
      fullName: resolvedFullName,
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      gender,
      nationality,
      categoryIds: normalizeCategoryIds(categoryIds ?? categoryId),
      subCategoryIds: normalizeCategoryIds(subCategoryIds),
      area,
      city,
      state,
      countryCode,
      mobileNumber,
      whatsappNumber,
      ...(req.body.aadhaarNumber && { aadhaarNumber: req.body.aadhaarNumber }),
      ...(req.body.panNumber && { panNumber: req.body.panNumber }),
      ...(resolvedImageUrl && { imageUrl: resolvedImageUrl }),
      ...(resolvedAadhaarFrontUrl && { aadhaarFrontUrl: resolvedAadhaarFrontUrl }),
      ...(resolvedAadhaarBackUrl && { aadhaarBackUrl: resolvedAadhaarBackUrl }),
      ...(resolvedPanCardUrl && { panCardUrl: resolvedPanCardUrl }),
      ...(resolvedIntroVideoUrl && { introVideoUrl: resolvedIntroVideoUrl }),
      ...(resolvedIdDocumentUrl && { kycDocuments: [{ idType, idNumber, idDocumentUrl: resolvedIdDocumentUrl }] }),
      agreedToTerms: Boolean(agreedToTerms),
      ...(agreedToTerms && { agreedToTermsAt: new Date() }),
    };

    if (provider) {
      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined) provider[key] = value;
      });
      await provider.save();
    } else {
      provider = await Provider.create({ ...fields, applicationStatus: 'pending' });
    }

    const token = generateToken(provider._id, 'provider');
    res.status(isNewAccount ? 201 : 200).json({
      success: true,
      token,
      isNewAccount,
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

// Self-service account deletion — the provider deleting their own account,
// not the admin's deleteProvider. No confirmation/reason body is required;
// the auth token alone (protectProvider) is the proof this is their account.
exports.deleteMyAccount = async (req, res, next) => {
  try {
    await Provider.findByIdAndDelete(req.provider._id);
    res.json({ success: true, message: MESSAGES.provider.accountDeleted });
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
  'fullName', 'firstName', 'lastName', 'gender', 'nationality', 'categoryIds', 'subCategoryIds', 'area', 'city', 'state',
  'countryCode', 'mobileNumber', 'whatsappNumber', 'emirate', 'experienceYears',
  'monthlySalary', 'skills', 'imageUrl', 'phone', 'whatsapp', 'bio',
  'age', 'dateOfBirth', 'panNumber', 'panCardUrl', 'aadhaarNumber', 'aadhaarFrontUrl', 'aadhaarBackUrl',
  'introVideoUrl', 'introVideoThumbnailUrl', 'introVideoOriginalUrl', 'kycDocuments',
  'maritalStatus', 'religion', 'availability',
  'preferredJob', 'duration', 'languages', 'education', 'certificate',
  'lastWorkingExperience', 'jobDescription',
  'profileComplete',
];

// categoryIds needs its comma-string-or-array normalization applied even
// through the generic field list, so it can't just be assigned as-is.
// Also falls back to the pre-rename field names (categoryId,
// monthlySalaryAed) and URL aliases if the current ones aren't present in the body.
const applyAllowedFields = (provider, body) => {
  const resolvedCategoryIds = body.categoryIds ?? body.categoryId;
  if (resolvedCategoryIds !== undefined) provider.categoryIds = normalizeCategoryIds(resolvedCategoryIds);
  if (body.subCategoryIds !== undefined) provider.subCategoryIds = normalizeCategoryIds(body.subCategoryIds) ?? [];
  if (body.monthlySalary === undefined && body.monthlySalaryAed !== undefined) {
    body.monthlySalary = body.monthlySalaryAed;
  }
  if (!body.imageUrl && (body.photoUrl || typeof body.photo === 'string' || typeof body.image === 'string' || body.profilePhoto)) {
    body.imageUrl = body.photoUrl || (typeof body.photo === 'string' ? body.photo : null) || (typeof body.image === 'string' ? body.image : null) || body.profilePhoto;
  }
  if (!body.aadhaarFrontUrl && (typeof body.aadhaarFront === 'string' || body.aadhaarFrontPhoto)) {
    body.aadhaarFrontUrl = typeof body.aadhaarFront === 'string' ? body.aadhaarFront : body.aadhaarFrontPhoto;
  }
  if (!body.aadhaarBackUrl && (typeof body.aadhaarBack === 'string' || body.aadhaarBackPhoto)) {
    body.aadhaarBackUrl = typeof body.aadhaarBack === 'string' ? body.aadhaarBack : body.aadhaarBackPhoto;
  }
  if (!body.panCardUrl && (typeof body.panCard === 'string' || typeof body.panUrl === 'string' || body.panCardPhoto)) {
    body.panCardUrl = typeof body.panCard === 'string' ? body.panCard : body.panUrl || body.panCardPhoto;
  }
  if (!body.introVideoUrl && (typeof body.video === 'string' || typeof body.videoUrl === 'string' || typeof body.introVideo === 'string')) {
    body.introVideoUrl = typeof body.video === 'string' ? body.video : body.videoUrl || body.introVideo;
  }
  ALLOWED_PROFILE_FIELDS.forEach((key) => {
    if (key === 'categoryIds' || key === 'subCategoryIds' || body[key] === undefined) return;
    provider[key] = body[key];
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
    let provider = req.provider;
    if (!provider) {
      const identifier = req.body.providerId || req.body.id || req.body._id || req.body.userId;
      if (identifier) {
        provider = await Provider.findById(identifier);
      } else if (req.body.mobileNumber) {
        const digits = String(req.body.mobileNumber).replace(/\D/g, '');
        if (digits) provider = await Provider.findOne({ mobileNumberDigits: digits });
      } else if (req.body.email) {
        provider = await Provider.findOne({ email: req.body.email.toLowerCase().trim() });
      }
    }
    if (!provider) {
      return res.status(401).json({ success: false, message: MESSAGES.auth.notAuthorized });
    }

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
    const kycSection = parseSection(req.body.kyc);

    // Read flexibly from section or top-level body
    const getVal = (section, ...keys) => {
      for (const k of keys) {
        if (section && section[k] !== undefined) return section[k];
        if (req.body && req.body[k] !== undefined) return req.body[k];
      }
      return undefined;
    };

    const firstName = getVal(generalInfo, 'firstName');
    const lastName = getVal(generalInfo, 'lastName');
    const fullName = getVal(generalInfo, 'fullName');
    if (firstName !== undefined) provider.firstName = firstName;
    if (lastName !== undefined) provider.lastName = lastName;
    if (fullName !== undefined) {
      provider.fullName = fullName;
    } else if (firstName !== undefined || lastName !== undefined) {
      provider.fullName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim();
    }

    const gender = getVal(generalInfo, 'gender');
    if (gender !== undefined) provider.gender = gender;
    const nationality = getVal(generalInfo, 'nationality');
    if (nationality !== undefined) provider.nationality = nationality;
    const age = getVal(generalInfo, 'age');
    if (age !== undefined) provider.age = age;
    const dateOfBirth = getVal(generalInfo, 'dateOfBirth');
    if (dateOfBirth !== undefined) provider.dateOfBirth = dateOfBirth;
    const maritalStatus = getVal(generalInfo, 'maritalStatus');
    if (maritalStatus !== undefined) provider.maritalStatus = maritalStatus;
    const religion = getVal(generalInfo, 'religion');
    if (religion !== undefined) provider.religion = religion;
    const panNumber = getVal(generalInfo, 'panNumber', 'pan');
    if (panNumber !== undefined) provider.panNumber = panNumber;
    const aadhaarNumber = getVal(generalInfo, 'aadhaarNumber', 'aadhaar');
    if (aadhaarNumber !== undefined) provider.aadhaarNumber = aadhaarNumber;
    const state = getVal(generalInfo, 'state');
    if (state !== undefined) provider.state = state;
    const city = getVal(generalInfo, 'city');
    if (city !== undefined) provider.city = city;
    const area = getVal(generalInfo, 'area');
    if (area !== undefined) provider.area = area;
    const emirate = getVal(generalInfo, 'emirate');
    if (emirate !== undefined) provider.emirate = emirate;
    const bio = getVal(generalInfo, 'bio');
    if (bio !== undefined) provider.bio = bio;
    const phone = getVal(generalInfo, 'phone');
    if (phone !== undefined) provider.phone = phone;
    const whatsapp = getVal(generalInfo, 'whatsapp', 'whatsappNumber');
    if (whatsapp !== undefined) {
      provider.whatsapp = whatsapp;
      provider.whatsappNumber = whatsapp;
    }

    // Work preferences
    const resolvedCategoryIds =
      workPreferences.categoryIds ??
      workPreferences.categoryId ??
      req.body.categoryIds ??
      req.body.categoryId;
    if (resolvedCategoryIds !== undefined) {
      provider.categoryIds = normalizeCategoryIds(resolvedCategoryIds);
    }
    const resolvedSubCategoryIds =
      workPreferences.subCategoryIds ?? req.body.subCategoryIds;
    if (resolvedSubCategoryIds !== undefined) {
      provider.subCategoryIds = normalizeCategoryIds(resolvedSubCategoryIds) ?? [];
    }
    const resolvedMonthlySalary =
      workPreferences.monthlySalary ??
      workPreferences.monthlySalaryAed ??
      req.body.monthlySalary ??
      req.body.monthlySalaryAed;
    if (resolvedMonthlySalary !== undefined) {
      provider.monthlySalary = resolvedMonthlySalary;
    }

    WORK_PREFERENCES_FIELDS.forEach((key) => {
      if (key === 'monthlySalary') return;
      const val = getVal(workPreferences, key);
      if (val !== undefined) provider[key] = val;
    });

    // Last job
    LAST_JOB_FIELDS.forEach((key) => {
      const val = getVal(lastJob, key);
      if (val !== undefined) {
        if (!provider.lastWorkingExperience) provider.lastWorkingExperience = {};
        provider.lastWorkingExperience[key] = val;
      }
    });
    const jobDescription = getVal(lastJob, 'jobDescription') ?? getVal(workPreferences, 'jobDescription');
    if (jobDescription !== undefined) provider.jobDescription = jobDescription;

    // Files uploaded in this request
    const photoFile =
      req.files?.photo?.[0] ||
      req.files?.image?.[0] ||
      req.files?.file?.[0] ||
      req.files?.profilePhoto?.[0];
    const videoFile = req.files?.video?.[0] || req.files?.introVideo?.[0];
    const aadhaarFrontFile = req.files?.aadhaarFront?.[0];
    const aadhaarBackFile = req.files?.aadhaarBack?.[0];
    const panCardFile = req.files?.panCard?.[0] || req.files?.pan?.[0];

    const [uploadedImageUrl, uploadedIntroVideoUrl, uploadedAadhaarFrontUrl, uploadedAadhaarBackUrl, uploadedPanCardUrl] =
      await Promise.all([
        photoFile ? uploadBufferToS3(photoFile.buffer, photoFile.mimetype, 'help-zone/photos') : null,
        videoFile ? uploadBufferToS3(videoFile.buffer, videoFile.mimetype, 'help-zone/videos') : null,
        aadhaarFrontFile ? uploadBufferToS3(aadhaarFrontFile.buffer, aadhaarFrontFile.mimetype, 'help-zone/kyc') : null,
        aadhaarBackFile ? uploadBufferToS3(aadhaarBackFile.buffer, aadhaarBackFile.mimetype, 'help-zone/kyc') : null,
        panCardFile ? uploadBufferToS3(panCardFile.buffer, panCardFile.mimetype, 'help-zone/kyc') : null,
      ]);

    // Resolve Image URL: uploaded file takes priority, then string URLs from body or generalInfo
    const resolvedImageUrl =
      uploadedImageUrl ||
      req.body.imageUrl ||
      req.body.photoUrl ||
      (typeof req.body.photo === 'string' ? req.body.photo : null) ||
      (typeof req.body.image === 'string' ? req.body.image : null) ||
      req.body.profilePhoto ||
      req.body.profilePhotoUrl ||
      req.body.avatarUrl ||
      (typeof req.body.avatar === 'string' ? req.body.avatar : null) ||
      generalInfo.imageUrl ||
      generalInfo.photoUrl ||
      (typeof generalInfo.photo === 'string' ? generalInfo.photo : null) ||
      (typeof generalInfo.image === 'string' ? generalInfo.image : null) ||
      generalInfo.profilePhoto ||
      generalInfo.profilePhotoUrl ||
      generalInfo.avatarUrl ||
      (typeof generalInfo.avatar === 'string' ? generalInfo.avatar : null) ||
      (req.body.url && !req.body.aadhaarFrontUrl && !req.body.introVideoUrl ? req.body.url : null);

    if (resolvedImageUrl) provider.imageUrl = resolvedImageUrl;

    // Resolve Aadhaar Front URL
    const resolvedAadhaarFrontUrl =
      uploadedAadhaarFrontUrl ||
      req.body.aadhaarFrontUrl ||
      (typeof req.body.aadhaarFront === 'string' ? req.body.aadhaarFront : null) ||
      req.body.aadhaarFrontPhoto ||
      req.body.aadhaarFrontImage ||
      generalInfo.aadhaarFrontUrl ||
      (typeof generalInfo.aadhaarFront === 'string' ? generalInfo.aadhaarFront : null) ||
      generalInfo.aadhaarFrontPhoto ||
      kycSection?.aadhaarFrontUrl ||
      (typeof kycSection?.aadhaarFront === 'string' ? kycSection?.aadhaarFront : null);

    if (resolvedAadhaarFrontUrl) provider.aadhaarFrontUrl = resolvedAadhaarFrontUrl;

    // Resolve Aadhaar Back URL
    const resolvedAadhaarBackUrl =
      uploadedAadhaarBackUrl ||
      req.body.aadhaarBackUrl ||
      (typeof req.body.aadhaarBack === 'string' ? req.body.aadhaarBack : null) ||
      req.body.aadhaarBackPhoto ||
      req.body.aadhaarBackImage ||
      generalInfo.aadhaarBackUrl ||
      (typeof generalInfo.aadhaarBack === 'string' ? generalInfo.aadhaarBack : null) ||
      generalInfo.aadhaarBackPhoto ||
      kycSection?.aadhaarBackUrl ||
      (typeof kycSection?.aadhaarBack === 'string' ? kycSection?.aadhaarBack : null);

    if (resolvedAadhaarBackUrl) provider.aadhaarBackUrl = resolvedAadhaarBackUrl;

    // Resolve PAN Card URL
    const resolvedPanCardUrl =
      uploadedPanCardUrl ||
      req.body.panCardUrl ||
      (typeof req.body.panCard === 'string' ? req.body.panCard : null) ||
      req.body.panUrl ||
      req.body.panCardPhoto ||
      req.body.panCardImage ||
      generalInfo.panCardUrl ||
      (typeof generalInfo.panCard === 'string' ? generalInfo.panCard : null) ||
      generalInfo.panUrl ||
      generalInfo.panCardPhoto ||
      kycSection?.panCardUrl ||
      (typeof kycSection?.panCard === 'string' ? kycSection?.panCard : null);

    if (resolvedPanCardUrl) provider.panCardUrl = resolvedPanCardUrl;

    // Resolve Intro Video URL
    const resolvedIntroVideoUrl =
      uploadedIntroVideoUrl ||
      req.body.introVideoUrl ||
      req.body.videoUrl ||
      (typeof req.body.introVideo === 'string' ? req.body.introVideo : null) ||
      (typeof req.body.video === 'string' ? req.body.video : null) ||
      generalInfo.introVideoUrl ||
      generalInfo.videoUrl ||
      (typeof generalInfo.introVideo === 'string' ? generalInfo.introVideo : null) ||
      (typeof generalInfo.video === 'string' ? generalInfo.video : null);

    if (resolvedIntroVideoUrl) {
      provider.introVideoUrl = resolvedIntroVideoUrl;
      const customThumbnail =
        req.body.introVideoThumbnailUrl ||
        req.body.thumbnailUrl ||
        generalInfo.introVideoThumbnailUrl ||
        generalInfo.thumbnailUrl;
      if (customThumbnail) {
        provider.introVideoThumbnailUrl = customThumbnail;
      }
      if (videoFile?.buffer) {
        provider.introVideoThumbnailUrl = customThumbnail || undefined;
        provider.introVideoOriginalUrl = undefined;
        processIntroVideo(provider._id, videoFile.buffer, resolvedIntroVideoUrl);
      }
    }

    // KYC Documents / ID proofs
    const legacyIdDocumentFile = req.files?.idDocument?.[0];
    const idDocumentFiles = [...(req.files?.idDocuments || []), ...(legacyIdDocumentFile ? [legacyIdDocumentFile] : [])];

    let idProofsMeta = Array.isArray(generalInfo.idProofs)
      ? generalInfo.idProofs
      : Array.isArray(req.body.idProofs)
      ? req.body.idProofs
      : Array.isArray(generalInfo.kycDocuments)
      ? generalInfo.kycDocuments
      : Array.isArray(req.body.kycDocuments)
      ? req.body.kycDocuments
      : [];

    const singleIdDocUrl =
      (typeof req.body.idDocument === 'string' ? req.body.idDocument : null) ||
      req.body.idDocumentUrl ||
      (typeof generalInfo.idDocument === 'string' ? generalInfo.idDocument : null) ||
      generalInfo.idDocumentUrl;

    if (
      !idProofsMeta.length &&
      (generalInfo.idType !== undefined ||
        generalInfo.idNumber !== undefined ||
        req.body.idType !== undefined ||
        req.body.idNumber !== undefined ||
        singleIdDocUrl)
    ) {
      idProofsMeta = [
        {
          idType: generalInfo.idType ?? req.body.idType,
          idNumber: generalInfo.idNumber ?? req.body.idNumber,
          idDocumentUrl: singleIdDocUrl,
        },
      ];
    }

    if (idProofsMeta.length || idDocumentFiles.length) {
      const uploadedIdUrls = await Promise.all(
        idDocumentFiles.map((file) => uploadBufferToS3(file.buffer, file.mimetype, 'help-zone/kyc'))
      );
      const count = Math.max(idProofsMeta.length, uploadedIdUrls.length);
      provider.kycDocuments = Array.from({ length: count }, (_, i) => {
        const meta = idProofsMeta[i] || {};
        const docUrl =
          uploadedIdUrls[i] ||
          meta.idDocumentUrl ||
          meta.url ||
          meta.documentUrl ||
          meta.idProofUrl ||
          (typeof meta === 'string' ? meta : undefined);
        return {
          idType: meta.idType,
          idNumber: meta.idNumber,
          idDocumentUrl: docUrl,
        };
      });
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
