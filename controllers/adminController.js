const Provider = require('../models/Provider');

const serializeProviderForAdmin = (provider) => ({
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
  experienceYears: provider.experienceYears,
  imageUrl: provider.imageUrl,
  kyc: provider.kyc,
  applicationStatus: provider.applicationStatus,
  rejectionReason: provider.rejectionReason,
  isActive: provider.isActive,
  createdAt: provider.createdAt,
});

exports.listProviders = async (req, res, next) => {
  try {
    const { status, categoryId, q, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'all') query.applicationStatus = status;
    if (categoryId) query.categoryId = categoryId;
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
      return res.status(404).json({ success: false, message: 'Provider not found' });
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
      return res.status(400).json({ success: false, message: 'A rejection reason is required' });
    }
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
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
  'categoryId',
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
      return res.status(404).json({ success: false, message: 'Provider not found' });
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
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};
