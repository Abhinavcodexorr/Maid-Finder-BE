const Maid = require('../models/Maid');

const serializeMaidForAdmin = (maid) => ({
  id: maid._id,
  email: maid.email,
  fullName: maid.fullName,
  gender: maid.gender,
  nationality: maid.nationality,
  categoryId: maid.categoryId,
  area: maid.area,
  city: maid.city,
  mobileNumber: maid.mobileNumber,
  whatsappNumber: maid.whatsappNumber,
  experienceYears: maid.experienceYears,
  imageUrl: maid.imageUrl,
  kyc: maid.kyc,
  applicationStatus: maid.applicationStatus,
  rejectionReason: maid.rejectionReason,
  isActive: maid.isActive,
  createdAt: maid.createdAt,
});

exports.listMaids = async (req, res, next) => {
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
    const [maids, total] = await Promise.all([
      Maid.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Maid.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: maids.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: maids.map(serializeMaidForAdmin),
    });
  } catch (error) {
    next(error);
  }
};

exports.approveMaid = async (req, res, next) => {
  try {
    const maid = await Maid.findById(req.params.id);
    if (!maid) {
      return res.status(404).json({ success: false, message: 'Maid not found' });
    }
    maid.applicationStatus = 'approved';
    maid.rejectionReason = undefined;
    await maid.save();
    res.json({ success: true, data: serializeMaidForAdmin(maid) });
  } catch (error) {
    next(error);
  }
};

exports.rejectMaid = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'A rejection reason is required' });
    }
    const maid = await Maid.findById(req.params.id);
    if (!maid) {
      return res.status(404).json({ success: false, message: 'Maid not found' });
    }
    maid.applicationStatus = 'rejected';
    maid.rejectionReason = reason.trim();
    await maid.save();
    res.json({ success: true, data: serializeMaidForAdmin(maid) });
  } catch (error) {
    next(error);
  }
};
