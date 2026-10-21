const Plan = require('../models/Plan');
const MESSAGES = require('../config/errorMessages.json');

const serialize = (plan) => {
  const { _id, __v, ...rest } = plan.toObject();
  return { id: _id, ...rest };
};

const notFound = (res) => res.status(404).json({ success: false, message: MESSAGES.plan.notFound });

const WRITABLE_FIELDS = ['name', 'description', 'price', 'originalPrice', 'durationDays', 'features', 'isPopular', 'sortOrder'];

// Public: what the pricing page should offer. Inactive plans are hidden.
exports.listPublicPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });
    res.json({ success: true, count: plans.length, data: plans.map(serialize) });
  } catch (error) {
    next(error);
  }
};

// Admin: every plan, active or not.
exports.listPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find().sort({ sortOrder: 1, price: 1 });
    res.json({
      success: true,
      count: plans.length,
      active: plans.filter((p) => p.isActive).length,
      data: plans.map(serialize),
    });
  } catch (error) {
    next(error);
  }
};

exports.createPlan = async (req, res, next) => {
  try {
    const { name, price, durationDays } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: MESSAGES.plan.nameRequired });
    }
    if (price === undefined || Number(price) < 0) {
      return res.status(400).json({ success: false, message: MESSAGES.plan.priceRequired });
    }
    if (!durationDays || Number(durationDays) < 1) {
      return res.status(400).json({ success: false, message: MESSAGES.plan.durationRequired });
    }

    const payload = {};
    WRITABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) payload[field] = req.body[field];
    });
    if (req.body.isActive !== undefined) payload.isActive = Boolean(req.body.isActive);

    const plan = await Plan.create(payload);
    res.status(201).json({ success: true, data: serialize(plan) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.updatePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return notFound(res);

    WRITABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) plan[field] = req.body[field];
    });
    if (req.body.isActive !== undefined) plan.isActive = Boolean(req.body.isActive);

    await plan.save();
    res.json({ success: true, data: serialize(plan) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const setActive = (isActive) => async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, { isActive }, { new: true, runValidators: true });
    if (!plan) return notFound(res);
    res.json({ success: true, data: serialize(plan) });
  } catch (error) {
    next(error);
  }
};

exports.activatePlan = setActive(true);
exports.deactivatePlan = setActive(false);

exports.deletePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return notFound(res);
    await plan.deleteOne();
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};
