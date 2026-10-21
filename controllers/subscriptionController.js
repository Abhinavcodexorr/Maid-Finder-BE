const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const MESSAGES = require('../config/errorMessages.json');

const DAY_MS = 86_400_000;

// active = running now, upcoming = bought to start after the current one ends, expired, cancelled.
const statusOf = (sub, now = new Date()) => {
  if (sub.cancelledAt) return 'cancelled';
  if (new Date(sub.expiresAt) <= now) return 'expired';
  if (new Date(sub.startsAt) > now) return 'upcoming';
  return 'active';
};

const serializeSubscription = (sub, now = new Date()) => {
  const planDoc = sub.plan && typeof sub.plan === 'object' && sub.plan._id ? sub.plan : null;
  const planId = planDoc?._id || sub.plan || null;
  const name = sub.planName || planDoc?.name || 'Subscription Plan';
  const status = statusOf(sub, now);
  const daysLeft = Math.max(0, Math.ceil((new Date(sub.expiresAt) - now) / DAY_MS));

  return {
    id: sub._id,
    _id: sub._id,
    planId,
    plan: planDoc
      ? {
          id: planDoc._id,
          _id: planDoc._id,
          name: planDoc.name,
          planName: planDoc.name,
          description: planDoc.description,
          price: planDoc.price,
          durationDays: planDoc.durationDays,
          features: planDoc.features || [],
          isPopular: planDoc.isPopular,
          isActive: planDoc.isActive,
        }
      : {
          id: planId,
          _id: planId,
          name,
          planName: name,
          price: sub.price,
          durationDays: sub.durationDays,
        },
    name,
    planName: name,
    price: sub.price,
    originalPrice: sub.originalPrice ?? planDoc?.originalPrice ?? null,
    durationDays: sub.durationDays,
    startsAt: sub.startsAt,
    expiresAt: sub.expiresAt,
    status,
    daysLeft,
    isActive: status === 'active',
    paymentRef: sub.paymentRef ?? null,
    source: sub.source,
    boughtAt: sub.createdAt,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
  };
};

// The plan a customer is on now (`current`), and everything they bought, newest first (`history`).
const summarize = (subs, now = new Date()) => {
  const list = subs.map((s) => serializeSubscription(s, now));
  const activePlan =
    list.filter((s) => s.status === 'active').sort((a, b) => new Date(b.expiresAt) - new Date(a.expiresAt))[0] ??
    null;
  const upcomingPlan = list.find((s) => s.status === 'upcoming') ?? null;
  const latestPlan = list[0] ?? null;
  const current = activePlan || latestPlan;

  return {
    current,
    activePlan,
    latestPlan,
    upcoming: upcomingPlan,
    history: list,
  };
};

// subscriptions for a set of customers -> Map(userId -> summary)
const summariesFor = async (userIds) => {
  const subs = await Subscription.find({ user: { $in: userIds } })
    .populate('plan')
    .sort({ startsAt: -1, createdAt: -1 });

  const byUser = new Map();
  subs.forEach((s) => {
    const key = String(s.user?._id || s.user);
    byUser.set(key, [...(byUser.get(key) || []), s]);
  });
  const now = new Date();
  return new Map(userIds.map((id) => [String(id), summarize(byUser.get(String(id)) || [], now)]));
};

// Buying a plan. A plan bought while one is still running starts when the running one ends.
const createSubscription = async (userId, plan, { paymentRef, source }) => {
  const now = new Date();
  const running = await Subscription.find({
    user: userId,
    $or: [{ cancelledAt: { $exists: false } }, { cancelledAt: null }],
    expiresAt: { $gt: now },
  })
    .sort({ expiresAt: -1 })
    .limit(1);

  const startsAt = running[0] ? running[0].expiresAt : new Date(now.getTime() - 1000);
  const expiresAt = new Date(startsAt.getTime() + plan.durationDays * DAY_MS);

  const sub = await Subscription.create({
    user: userId,
    plan: plan._id,
    planName: plan.name,
    price: plan.price,
    originalPrice: plan.originalPrice,
    durationDays: plan.durationDays,
    startsAt,
    expiresAt,
    paymentRef: typeof paymentRef === 'string' ? paymentRef.trim().slice(0, 120) || undefined : undefined,
    source,
  });

  // Keep User model in sync with the plan name
  await User.updateOne({ _id: userId }, { $set: { planName: plan.name } }).catch(() => {});

  sub.plan = plan;
  return sub;
};

const findActivePlan = async (planIdentifier) => {
  if (!planIdentifier) return null;
  const raw = String(planIdentifier).trim();
  if (/^[0-9a-fA-F]{24}$/.test(raw)) {
    const plan = await Plan.findById(raw);
    if (plan) return plan;
  }
  const planByName = await Plan.findOne({ name: new RegExp(`^${raw}$`, 'i') });
  if (planByName) return planByName;
  return null;
};

// Customer app: buy a plan (call after the payment succeeds; send the gateway reference as paymentRef).
exports.subscribe = async (req, res, next) => {
  try {
    const planIdentifier =
      req.body.planId ||
      req.body.plan_id ||
      req.body.plan ||
      req.body.id ||
      req.params.id ||
      req.params.planId ||
      req.body.planName ||
      req.body.name;

    const plan = await findActivePlan(planIdentifier);
    if (!plan) return res.status(404).json({ success: false, message: MESSAGES.subscription.planUnavailable });

    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: MESSAGES.auth.notAuthorized });

    const paymentRef =
      req.body.paymentRef || req.body.payment_id || req.body.transactionId || req.body.razorpay_payment_id;

    const sub = await createSubscription(userId, plan, { paymentRef, source: 'app' });
    res.status(201).json({ success: true, data: serializeSubscription(sub) });
  } catch (error) {
    next(error);
  }
};

// Customer app: my current plan and past purchases.
exports.getMySubscription = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const summaries = await summariesFor([userId]);
    const summary = summaries.get(String(userId));
    res.json({
      success: true,
      data: summary,
      currentPlan: summary?.current || null,
      plan: summary?.current?.plan || summary?.current || null,
      planName: summary?.current?.planName || null,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: give a customer a plan (support, goodwill, testing).
exports.grantSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: MESSAGES.auth.userNotFound });

    const planIdentifier =
      req.body.planId ||
      req.body.plan_id ||
      req.body.plan ||
      req.body.id ||
      req.params.planId ||
      req.body.planName ||
      req.body.name;

    const plan = await findActivePlan(planIdentifier);
    if (!plan) return res.status(404).json({ success: false, message: MESSAGES.subscription.planUnavailable });

    const sub = await createSubscription(user._id, plan, { paymentRef: req.body.paymentRef, source: 'admin' });
    res.status(201).json({ success: true, data: serializeSubscription(sub) });
  } catch (error) {
    next(error);
  }
};

// Admin: stop a plan now (e.g. refunded).
exports.cancelSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ _id: req.params.subId, user: req.params.id }).populate('plan');
    if (!sub) return res.status(404).json({ success: false, message: MESSAGES.subscription.notFound });
    if (!sub.cancelledAt) {
      sub.cancelledAt = new Date();
      await sub.save();
    }
    res.json({ success: true, data: serializeSubscription(sub) });
  } catch (error) {
    next(error);
  }
};

// Admin: get all subscriptions across all customers (with customer & plan details)
exports.listAllSubscriptionsAdmin = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status === 'active') {
      const now = new Date();
      query.startsAt = { $lte: now };
      query.expiresAt = { $gt: now };
      query.$or = [{ cancelledAt: { $exists: false } }, { cancelledAt: null }];
    } else if (req.query.status === 'expired') {
      query.expiresAt = { $lte: new Date() };
    } else if (req.query.status === 'cancelled') {
      query.cancelledAt = { $exists: true, $ne: null };
    }

    if (req.query.userId || req.query.customerId) {
      query.user = req.query.userId || req.query.customerId;
    }

    const [subs, total] = await Promise.all([
      Subscription.find(query)
        .populate('user', 'name email phone emirate')
        .populate('plan')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments(query),
    ]);

    const now = new Date();
    res.json({
      success: true,
      count: subs.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: subs.map((s) => ({
        ...serializeSubscription(s, now),
        user: s.user
          ? {
              id: s.user._id,
              _id: s.user._id,
              name: s.user.name,
              email: s.user.email,
              phone: s.user.phone,
              emirate: s.user.emirate,
            }
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// Admin: get single customer subscriptions
exports.getCustomerSubscriptionsAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: MESSAGES.auth.userNotFound });

    const summaryMap = await summariesFor([user._id]);
    const summary = summaryMap.get(String(user._id)) || {
      current: null,
      activePlan: null,
      latestPlan: null,
      history: [],
    };

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
        ...summary,
        currentPlan: summary.current,
        plan: summary.current?.plan || summary.current || null,
        planName: summary.current?.planName || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.summariesFor = summariesFor;
exports.summarize = summarize;
exports.serializeSubscription = serializeSubscription;
