const Provider = require('../models/Provider');
const Service = require('../models/Service');
const MESSAGES = require('../config/errorMessages.json');
const formatMessage = require('../utils/formatMessage');

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// How many providers reference each category id (and how many of those are approved).
const providerCountsByKey = async () => {
  const rows = await Provider.aggregate([
    { $unwind: '$categoryIds' },
    {
      $group: {
        _id: '$categoryIds',
        total: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ['$applicationStatus', 'approved'] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, { total: row.total, approved: row.approved }]));
};

const serialize = (service, counts) => {
  const { _id, __v, ...rest } = service.toObject();
  const count = counts?.get(service.key);
  return {
    id: _id,
    ...rest,
    providerCount: count?.total ?? 0,
    approvedProviderCount: count?.approved ?? 0,
  };
};

const notFound = (res) => res.status(404).json({ success: false, message: MESSAGES.service.notFound });

// Public: what the apps should offer. Inactive services are hidden.
exports.listPublicServices = async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ name: 1 }).collation({ locale: 'en' });
    res.json({
      success: true,
      count: services.length,
      data: services.map(({ _id, key, name, description, icon }) => ({ id: _id, key, name, description, icon })),
    });
  } catch (error) {
    next(error);
  }
};

// Admin: the full catalog with usage, plus categories providers already use
// that aren't in the catalog yet ("detected"), so they can be added in one click.
exports.listServices = async (req, res, next) => {
  try {
    const [services, counts] = await Promise.all([
      Service.find().sort({ name: 1 }).collation({ locale: 'en' }),
      providerCountsByKey(),
    ]);
    const known = new Set(services.map((s) => s.key));
    const detected = [...counts.entries()]
      .filter(([key]) => !known.has(key))
      .map(([key, count]) => ({ key, providerCount: count.total, approvedProviderCount: count.approved }))
      .sort((a, b) => b.providerCount - a.providerCount);

    res.json({
      success: true,
      count: services.length,
      active: services.filter((s) => s.isActive).length,
      data: services.map((s) => serialize(s, counts)),
      detected,
    });
  } catch (error) {
    next(error);
  }
};

exports.createService = async (req, res, next) => {
  try {
    const { name, description, icon, isActive } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: MESSAGES.service.nameRequired });
    }
    const customKey = typeof req.body.key === 'string' && req.body.key.trim();
    const key = customKey ? req.body.key.trim().toLowerCase() : `cat-${slugify(name)}`;
    if (!/^cat-[a-z0-9]+(-[a-z0-9]+)*$/.test(key)) {
      return res.status(400).json({ success: false, message: MESSAGES.service.invalidKey });
    }

    const service = await Service.create({
      key,
      name,
      ...(description !== undefined && { description }),
      ...(icon !== undefined && { icon }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    });
    res.status(201).json({ success: true, data: serialize(service, await providerCountsByKey()) });
  } catch (error) {
    if (error.code === 11000) {
      // A key made from the name clashing is, from the admin's side, a name clash.
      const message = error.keyPattern?.key && req.body.key ? MESSAGES.service.keyTaken : MESSAGES.service.nameTaken;
      return res.status(409).json({ success: false, message });
    }
    next(error);
  }
};

// The key is intentionally not editable (providers reference it).
exports.updateService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return notFound(res);

    ['name', 'description', 'icon'].forEach((field) => {
      if (req.body[field] !== undefined) service[field] = req.body[field];
    });
    if (req.body.isActive !== undefined) service.isActive = Boolean(req.body.isActive);

    await service.save();
    res.json({ success: true, data: serialize(service, await providerCountsByKey()) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: MESSAGES.service.nameTaken });
    }
    next(error);
  }
};

const setActive = (isActive) => async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!service) return notFound(res);
    res.json({ success: true, data: serialize(service, await providerCountsByKey()) });
  } catch (error) {
    next(error);
  }
};

exports.activateService = setActive(true);
exports.deactivateService = setActive(false);

// Deleting a service that providers still reference would leave them with a
// category that no longer exists, so that case is refused: deactivate instead.
exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return notFound(res);

    const inUse = await Provider.countDocuments({ categoryIds: service.key });
    if (inUse > 0) {
      return res.status(409).json({
        success: false,
        message: formatMessage(MESSAGES.service.inUse, { count: inUse }),
        providerCount: inUse,
      });
    }

    await service.deleteOne();
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};
