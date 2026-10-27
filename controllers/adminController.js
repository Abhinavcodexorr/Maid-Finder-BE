const Provider = require('../models/Provider');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Favourite = require('../models/Favourite');
const MESSAGES = require('../config/errorMessages.json');
const normalizeCategoryIds = require('../utils/normalizeCategoryIds');
const formatMessage = require('../utils/formatMessage');
const { APPLICATION_STATUS } = require('../config/constants');
const { releaseExpiredBlock, releaseAllExpiredBlocks } = require('../utils/customerBlock');
const { summariesFor } = require('./subscriptionController');

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

// Filter keys the admin list understands (the panel sends the key, the server does the filtering):
//   status        pending | verification | approved | rejected | all
//   q             text search: name, email, phone, city, PAN, ID numbers
//   categoryId    one or several service keys (comma separated), any match
//   city, gender  exact match
//   experience    comma list of buckets: 0-1, 2-4, 5-9, 10+
//   applied       today | 7d | 30d | older30   (relative to registration time; `tz` = admin's IANA time zone)
//   sort          newest | oldest | name | experience
//   page, limit
const EXPERIENCE_BUCKETS = {
  '0-1': { $lt: 2 },
  '2-4': { $gte: 2, $lt: 5 },
  '5-9': { $gte: 5, $lt: 10 },
  '10+': { $gte: 10 },
};
const PROVIDER_SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { fullName: 1, createdAt: -1 },
  experience: { experienceYears: -1, createdAt: -1 },
};
const DAY_MS = 86_400_000;

// Start of "today" in the admin's time zone (falls back to UTC for an unknown zone).
const startOfTodayIn = (timeZone, now = new Date()) => {
  try {
    const local = new Date(now.toLocaleString('en-US', { timeZone }));
    const startOfLocal = new Date(local);
    startOfLocal.setHours(0, 0, 0, 0);
    return new Date(now.getTime() - (local.getTime() - startOfLocal.getTime()));
  } catch {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }
};

const appliedRange = (key, timeZone) => {
  const now = new Date();
  if (key === 'today') return { $gte: startOfTodayIn(timeZone, now) };
  if (key === '7d') return { $gte: new Date(now - 7 * DAY_MS) };
  if (key === '30d') return { $gte: new Date(now - 30 * DAY_MS) };
  if (key === 'older30') return { $lt: new Date(now - 30 * DAY_MS) };
  return null;
};

exports.listProviders = async (req, res, next) => {
  try {
    const { status, categoryId, city, gender, experience, applied, sort, q, tz } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
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
    if (city && city.trim()) query.city = city.trim();
    if (gender === 'Male' || gender === 'Female') query.gender = gender;
    if (experience) {
      const ranges = experience.split(',').map((key) => EXPERIENCE_BUCKETS[key.trim()]).filter(Boolean);
      // Providers with no experience entered count as 0 years.
      if (ranges.length) query.$and = [...(query.$and || []), { $or: ranges.map((range) => ({ experienceYears: range })) }];
    }
    const createdRange = appliedRange(applied, tz);
    if (createdRange) query.createdAt = createdRange;
    if (q && q.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { fullName: regex },
            { email: regex },
            { city: regex },
            { mobileNumber: regex },
            { panNumber: regex },
            { aadhaarNumber: regex },
            { 'kycDocuments.idNumber': regex },
          ],
        },
      ];
    }

    const skip = (page - 1) * limit;
    // Facets describe the whole stage (not the current filters) so the panel can list real options with counts.
    const facetMatch = query.applicationStatus ? { applicationStatus: query.applicationStatus } : {};
    const [providers, total, grouped, facets] = await Promise.all([
      Provider.find(query).sort(PROVIDER_SORTS[sort] || PROVIDER_SORTS.newest).skip(skip).limit(limit),
      Provider.countDocuments(query),
      // Per-stage totals across all providers, regardless of the filters
      // above, so stage badges stay accurate when the list is paginated.
      Provider.aggregate([{ $group: { _id: '$applicationStatus', count: { $sum: 1 } } }]),
      Provider.aggregate([
        { $match: facetMatch },
        {
          $facet: {
            services: [
              { $unwind: '$categoryIds' },
              { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
              { $sort: { count: -1, _id: 1 } },
            ],
            cities: [
              { $match: { city: { $type: 'string', $ne: '' } } },
              { $group: { _id: { $trim: { input: '$city' } }, count: { $sum: 1 } } },
              { $sort: { _id: 1 } },
            ],
            gender: [{ $match: { gender: { $in: ['Male', 'Female'] } } }, { $group: { _id: '$gender', count: { $sum: 1 } } }],
          },
        },
      ]),
    ]);
    const counts = Object.fromEntries(APPLICATION_STATUS.map((name) => [name, 0]));
    grouped.forEach(({ _id, count }) => {
      if (_id in counts) counts[_id] = count;
    });
    const f = facets[0] || { services: [], cities: [], gender: [] };

    res.json({
      success: true,
      count: providers.length,
      total,
      counts,
      page,
      pages: Math.ceil(total / limit),
      facets: {
        services: f.services.map(({ _id, count }) => ({ key: _id, count })),
        cities: f.cities.map(({ _id, count }) => ({ name: _id, count })),
        gender: Object.fromEntries(f.gender.map(({ _id, count }) => [_id, count])),
      },
      data: providers.map(serializeProviderForAdmin),
    });
  } catch (error) {
    next(error);
  }
};

// One provider by id (e.g. opening a new registration from a notification).
exports.getProvider = async (req, res, next) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: MESSAGES.admin.providerNotFound });
    }
    res.json({ success: true, data: serializeProviderForAdmin(provider) });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: MESSAGES.admin.providerNotFound });
    }
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
  'pincode',
  'city',
  'state',
  'mobileNumber',
  'whatsappNumber',
  'email',
  'experienceYears',
  'serviceRadiusKm',
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
    if (req.body.subCategoryIds !== undefined) {
      provider.subCategoryIds = normalizeCategoryIds(req.body.subCategoryIds) ?? [];
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

// ---------------------------------------------------------------------
// Customers (the User model — families, not providers). The admin panel's
// account column reuses `isActive` as its status: there is no separate
// "suspended" state in the User model, so the admin UI is expected to treat
// "Suspended" as a disabled account the same as "Inactive" rather than this
// API inventing a third status that nothing writes.
// ---------------------------------------------------------------------

// Notes and history only travel with the single-customer detail, not the list.
const serializeCustomerForAdmin = (user, bookingCountsByUserId, { detail = false } = {}) => {
  const { _id, password, __v, adminNotes = [], moderationLog = [], ...rest } = user.toObject();
  return {
    id: _id,
    ...rest,
    bookingCount: bookingCountsByUserId.get(String(_id)) ?? 0,
    noteCount: adminNotes.length,
    ...(detail && { adminNotes, moderationLog: [...moderationLog].reverse() }),
  };
};

exports.listCustomers = async (req, res, next) => {
  try {
    const { status, q, plan, planId, page = 1, limit = 20 } = req.query;
    const query = {};
    await releaseAllExpiredBlocks();

    if (status === 'active') query.isActive = true;
    else if (status === 'inactive' || status === 'suspended') query.isActive = false;

    if (q && q.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: regex }, { email: regex }, { phone: regex }, { emirate: regex }, { address: regex }];
    }

    if (plan || planId) {
      const Subscription = require('../models/Subscription');
      const planFilter = {};
      if (planId && /^[0-9a-fA-F]{24}$/.test(String(planId))) {
        planFilter.plan = planId;
      } else if (plan) {
        planFilter.planName = new RegExp(plan.trim(), 'i');
      }
      const matchedUserIds = await Subscription.distinct('user', planFilter);
      query._id = { $in: matchedUserIds };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total, allActiveCount, bookingCounts] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(query),
      User.countDocuments({ isActive: true }),
      Booking.aggregate([{ $group: { _id: '$user', count: { $sum: 1 }, lastBookingAt: { $max: '$createdAt' } } }]),
    ]);
    const bookingCountsByUserId = new Map(bookingCounts.map((row) => [String(row._id), row.count]));
    const lastBookingByUserId = new Map(bookingCounts.map((row) => [String(row._id), row.lastBookingAt]));
    const totalCustomers = await User.countDocuments();
    const plans = await summariesFor(users.map((u) => u._id));

    res.json({
      success: true,
      count: users.length,
      total,
      counts: { active: allActiveCount, inactive: totalCustomers - allActiveCount, total: totalCustomers },
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: users.map((u) => {
        const summary = plans.get(String(u._id)) || { current: null, activePlan: null, latestPlan: null, history: [] };
        const activeSub = summary.activePlan || null;
        const latestSub = summary.latestPlan || summary.current || null;
        const chosenSub = activeSub || latestSub;
        const planName = chosenSub?.planName || chosenSub?.name || u.planName || null;

        return {
          ...serializeCustomerForAdmin(u, bookingCountsByUserId),
          lastBookingAt: lastBookingByUserId.get(String(u._id)) ?? null,
          currentPlan: chosenSub,
          plan: chosenSub?.plan || chosenSub || (planName ? { name: planName, planName } : null),
          planName,
          planDetails: chosenSub,
          subscription: summary,
          subscriptions: summary.history || [],
          latestSubscription: latestSub,
          activeSubscription: activeSub,
          hasActivePlan: Boolean(activeSub),
          subscriptionStatus: chosenSub?.status || 'none',
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

const text = (value, max = 300) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const customerNotFound = (res) => res.status(404).json({ success: false, message: MESSAGES.auth.userNotFound });

// Block: optional reason, optional end date (`until`, ISO). No end date = until an admin unblocks.
exports.deactivateCustomer = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return customerNotFound(res);

    const reason = text(req.body?.reason);
    let until;
    if (req.body?.until) {
      until = new Date(req.body.until);
      if (Number.isNaN(until.getTime()) || until <= new Date()) {
        return res.status(400).json({ success: false, message: MESSAGES.admin.invalidBlockDate });
      }
    }

    user.isActive = false;
    user.blockedAt = new Date();
    user.blockReason = reason || undefined;
    user.blockedUntil = until;
    user.moderationLog.push({ action: 'blocked', reason: reason || undefined, until, at: new Date() });
    await user.save();
    res.json({ success: true, data: serializeCustomerForAdmin(user, new Map()) });
  } catch (error) {
    next(error);
  }
};

exports.activateCustomer = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return customerNotFound(res);

    user.isActive = true;
    user.blockedAt = undefined;
    user.blockReason = undefined;
    user.blockedUntil = undefined;
    user.moderationLog.push({ action: 'unblocked', at: new Date() });
    await user.save();
    res.json({ success: true, data: serializeCustomerForAdmin(user, new Map()) });
  } catch (error) {
    next(error);
  }
};

// Watch list: mark (or clear) an account for attention without blocking it.
exports.flagCustomer = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return customerNotFound(res);

    const flagged = Boolean(req.body?.flagged);
    const reason = text(req.body?.reason);
    user.flagged = flagged;
    user.flagReason = flagged ? reason || undefined : undefined;
    user.moderationLog.push({ action: flagged ? 'flagged' : 'unflagged', reason: flagged ? reason || undefined : undefined, at: new Date() });
    await user.save();
    res.json({ success: true, data: serializeCustomerForAdmin(user, new Map()) });
  } catch (error) {
    next(error);
  }
};

exports.addCustomerNote = async (req, res, next) => {
  try {
    const note = text(req.body?.text, 1000);
    if (!note) return res.status(400).json({ success: false, message: MESSAGES.admin.noteRequired });
    const user = await User.findByIdAndUpdate(req.params.id, { $push: { adminNotes: { $each: [{ text: note, at: new Date() }], $position: 0 } } }, { new: true });
    if (!user) return customerNotFound(res);
    res.status(201).json({ success: true, data: user.adminNotes });
  } catch (error) {
    next(error);
  }
};

exports.deleteCustomerNote = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $pull: { adminNotes: { _id: req.params.noteId } } }, { new: true });
    if (!user) return customerNotFound(res);
    res.json({ success: true, data: user.adminNotes });
  } catch (error) {
    next(error);
  }
};

// Fix a customer's profile details (name, phone, city, address).
exports.updateCustomer = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return customerNotFound(res);

    const changed = [];
    [['name', 100], ['phone', 30], ['emirate', 60], ['address', 300]].forEach(([field, max]) => {
      if (req.body[field] !== undefined) {
        const value = text(req.body[field], max);
        if (value !== (user[field] || '')) changed.push(field);
        user[field] = value;
      }
    });
    if (changed.length) user.moderationLog.push({ action: 'edited', reason: `Changed ${changed.join(', ')}`, at: new Date() });
    await user.save();
    res.json({ success: true, data: serializeCustomerForAdmin(user, new Map()) });
  } catch (error) {
    next(error);
  }
};

// Permanent. Refused while the customer has bookings that are still going ahead.
exports.deleteCustomer = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return customerNotFound(res);

    const open = await Booking.countDocuments({ user: user._id, status: { $in: ['pending', 'confirmed', 'in_progress'] } });
    if (open > 0) {
      return res.status(409).json({
        success: false,
        message: formatMessage(MESSAGES.admin.customerHasOpenBookings, { count: open }),
        openBookings: open,
      });
    }
    await Booking.deleteMany({ user: user._id });
    await user.deleteOne();
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};

// One customer with their booking history, for the admin "user details" panel.
exports.getCustomer = async (req, res, next) => {
  try {
    const user = await releaseExpiredBlock(await User.findById(req.params.id));
    if (!user) {
      return res.status(404).json({ success: false, message: MESSAGES.auth.userNotFound });
    }
    const favouriteCount = await Favourite.countDocuments({ user: user._id });
    const [byStatus, recent] = await Promise.all([
      Booking.aggregate([{ $match: { user: user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Booking.find({ user: user._id }).sort({ scheduledDate: -1 }).limit(10).populate('maid', 'fullName city'),
    ]);
    const stats = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
    const total = byStatus.reduce((sum, row) => sum + row.count, 0);
    const summary = (await summariesFor([user._id])).get(String(user._id)) || {
      current: null,
      activePlan: null,
      latestPlan: null,
      history: [],
    };
    const activeSub = summary.activePlan || null;
    const latestSub = summary.latestPlan || summary.current || null;
    const chosenSub = activeSub || latestSub;
    const planName = chosenSub?.planName || chosenSub?.name || user.planName || null;

    res.json({
      success: true,
      data: {
        ...serializeCustomerForAdmin(user, new Map([[String(user._id), total]]), { detail: true }),
        favouriteCount,
        currentPlan: chosenSub,
        plan: chosenSub?.plan || chosenSub || (planName ? { name: planName, planName } : null),
        planName,
        planDetails: chosenSub,
        subscription: summary,
        subscriptions: summary.history || [],
        latestSubscription: latestSub,
        activeSubscription: activeSub,
        hasActivePlan: Boolean(activeSub),
        subscriptionStatus: chosenSub?.status || 'none',
        bookingStats: { total, ...stats },
        recentBookings: recent.map((b) => ({
          id: b._id,
          status: b.status,
          scheduledDate: b.scheduledDate,
          providerName: b.maid?.fullName || null,
          providerCity: b.maid?.city || null,
          monthlySalary: b.monthlySalary,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
