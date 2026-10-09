const Provider = require('../models/Provider');
const MESSAGES = require('../config/errorMessages.json');
const normalizeCategoryIds = require('../utils/normalizeCategoryIds');

// Admin is a trusted, internal-only view, so this returns the full provider
// document (unlike the public listMaids/getProviderById in providerController,
// which deliberately hide kyc.idNumber) — only the password hash and the
// internal mobileNumberDigits index field are stripped.
const serializeProviderForAdmin = (provider) => {
  const { _id, password, mobileNumberDigits, __v, ...rest } = provider.toObject();
  return { id: _id, ...rest };
};

exports.listProviders = async (req, res, next) => {
  try {
    const { status, categoryId, q, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'all') query.applicationStatus = status;
    if (categoryId) {
      const categoryArr = normalizeCategoryIds(categoryId);
      if (categoryArr.length) query.categoryIds = { $in: categoryArr };
    }
    if (q && q.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ fullName: regex }, { email: regex }, { city: regex }, { 'kyc.idNumber': regex }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [providers, total] = await Promise.all([
      Provider.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Provider.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: providers.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: providers.map(serializeProviderForAdmin),
    });
  } catch (error) {
    next(error);
  }
};

exports.approveProvider = async (req, res, next) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: MESSAGES.admin.providerNotFound });
    }
    provider.applicationStatus = 'approved';
    provider.rejectionReason = undefined;
    await provider.save();
    res.json({ success: true, data: serializeProviderForAdmin(provider) });
  } catch (error) {
    next(error);
  }
};

exports.rejectProvider = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: MESSAGES.admin.rejectionReasonRequired });
    }
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: MESSAGES.admin.providerNotFound });
    }
    provider.applicationStatus = 'rejected';
    provider.rejectionReason = reason.trim();
    await provider.save();
    res.json({ success: true, data: serializeProviderForAdmin(provider) });
  } catch (error) {
    next(error);
  }
};

const EDITABLE_FIELDS = [
  'fullName',
  'gender',
  'nationality',
  'area',
  'city',
  'mobileNumber',
  'whatsappNumber',
  'email',
  'experienceYears',
];

exports.updateProvider = async (req, res, next) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: MESSAGES.admin.providerNotFound });
    }

    if (req.body.categoryIds !== undefined) {
      provider.categoryIds = normalizeCategoryIds(req.body.categoryIds);
    }
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) provider[field] = req.body[field];
    }
    if (req.body.kyc && typeof req.body.kyc === 'object') {
      if (req.body.kyc.idType !== undefined) provider.kyc.idType = req.body.kyc.idType;
      if (req.body.kyc.idNumber !== undefined) provider.kyc.idNumber = req.body.kyc.idNumber;
    }

    await provider.save();
    res.json({ success: true, data: serializeProviderForAdmin(provider) });
  } catch (error) {
    next(error);
  }
};

exports.deleteProvider = async (req, res, next) => {
  try {
    const provider = await Provider.findByIdAndDelete(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: MESSAGES.admin.providerNotFound });
    }
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};
