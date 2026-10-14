const Provider = require('../models/Provider');
const MESSAGES = require('../config/errorMessages.json');
const normalizeCategoryIds = require('../utils/normalizeCategoryIds');
const formatMessage = require('../utils/formatMessage');
const { APPLICATION_STATUS } = require('../config/constants');

// Admin is a trusted, internal-only view, so this returns the full provider
// document (unlike the public listMaids/getProviderById in providerController,
// which deliberately hide kycDocuments.idNumber) — only the password hash
// and the internal mobileNumberDigits index field are stripped. Also
// includes a derived `kyc` (first kycDocuments entry) alongside the real
// kycDocuments array, for any consumer still built against the old
// single-document shape.
const serializeProviderForAdmin = (provider) => {
  const { _id, password, mobileNumberDigits, __v, ...rest } = provider.toObject();
  return { id: _id, ...rest, kyc: rest.kycDocuments?.[0] };
};

exports.listProviders = async (req, res, next) => {
  try {
    const { status, categoryId, q, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      if (!APPLICATION_STATUS.includes(status)) {
        return res.status(400).json({
          success: false,
          message: formatMessage(MESSAGES.admin.invalidStatus, { allowed: APPLICATION_STATUS.join(', ') }),
        });
      }
      query.applicationStatus = status;
    }
    if (categoryId) {
      const categoryArr = normalizeCategoryIds(categoryId);
      if (categoryArr.length) query.categoryIds = { $in: categoryArr };
    }
    if (q && q.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ fullName: regex }, { email: regex }, { city: regex }, { 'kycDocuments.idNumber': regex }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [providers, total, grouped] = await Promise.all([
      Provider.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Provider.countDocuments(query),
      // Per-stage totals across all providers, regardless of the filters
      // above, so stage badges stay accurate when the list is paginated.
      Provider.aggregate([{ $group: { _id: '$applicationStatus', count: { $sum: 1 } } }]),
    ]);
    const counts = Object.fromEntries(APPLICATION_STATUS.map((name) => [name, 0]));
    grouped.forEach(({ _id, count }) => {
      if (_id in counts) counts[_id] = count;
    });

    res.json({
      success: true,
      count: providers.length,
      total,
      counts,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: providers.map(serializeProviderForAdmin),
    });
  } catch (error) {
    next(error);
  }
};

// Cheap snapshot for the admin panel's 3-second notification poll: per-stage
// totals plus the most recent registrations, so the panel can spot a provider
// it hasn't seen yet without downloading the full list every time.
exports.providersSummary = async (req, res, next) => {
  try {
    const [grouped, latest] = await Promise.all([
      Provider.aggregate([{ $group: { _id: '$applicationStatus', count: { $sum: 1 } } }]),
      Provider.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('fullName city state imageUrl applicationStatus createdAt'),
    ]);
    const counts = Object.fromEntries(APPLICATION_STATUS.map((name) => [name, 0]));
    grouped.forEach(({ _id, count }) => {
      if (_id in counts) counts[_id] = count;
    });
    res.json({
      success: true,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
      counts,
      latest: latest.map((p) => ({
        id: p._id,
        fullName: p.fullName,
        city: p.city,
        state: p.state,
        imageUrl: p.imageUrl,
        applicationStatus: p.applicationStatus,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// The review pipeline is strictly pending -> verification -> approved|rejected.
// Each step is a single conditional update (the status check is part of the
// query), so two admins acting on the same provider can't both succeed or
// skip a stage; a refused step answers 409 with the provider's current status.
const transition = async (req, res, next, { from, to, update = {}, conflictMessage }) => {
  try {
    const provider = await Provider.findOneAndUpdate(
      { _id: req.params.id, applicationStatus: from },
      { $set: { applicationStatus: to, ...update.set }, ...(update.unset && { $unset: update.unset }) },
      { new: true, runValidators: true }
    );
    if (provider) return res.json({ success: true, data: serializeProviderForAdmin(provider) });

    const existing = await Provider.findById(req.params.id).select('applicationStatus');
    if (!existing) {
      return res.status(404).json({ success: false, message: MESSAGES.admin.providerNotFound });
    }
    return res.status(409).json({
      success: false,
      message: formatMessage(conflictMessage, { status: existing.applicationStatus }),
      currentStatus: existing.applicationStatus,
    });
  } catch (error) {
    next(error);
  }
};

// New request -> verification (the admin is checking the documents).
exports.verifyProvider = (req, res, next) =>
  transition(req, res, next, {
    from: 'pending',
    to: 'verification',
    conflictMessage: MESSAGES.admin.verifyRequiresPending,
  });

// Verification -> approved.
exports.approveProvider = (req, res, next) =>
  transition(req, res, next, {
    from: 'verification',
    to: 'approved',
    update: { unset: { rejectionReason: 1 } },
    conflictMessage: MESSAGES.admin.decisionRequiresVerification,
  });

// Verification -> rejected, with a mandatory reason.
exports.rejectProvider = (req, res, next) => {
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) {
    return res.status(400).json({ success: false, message: MESSAGES.admin.rejectionReasonRequired });
  }
  return transition(req, res, next, {
    from: 'verification',
    to: 'rejected',
    update: { set: { rejectionReason: reason } },
    conflictMessage: MESSAGES.admin.decisionRequiresVerification,
  });
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
    if (Array.isArray(req.body.kycDocuments)) {
      provider.kycDocuments = req.body.kycDocuments.map((doc) => ({
        idType: doc.idType,
        idNumber: doc.idNumber,
        idDocumentUrl: doc.idDocumentUrl,
      }));
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
