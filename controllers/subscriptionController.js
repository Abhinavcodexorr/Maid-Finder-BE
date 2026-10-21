const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const MESSAGES = require('../config/errorMessages.json');

const DAY_MS = 86_400_000;

// active = running now, upcoming = bought to start after the current one ends, expired, cancelled.
const statusOf = (sub, now = new Date()) => {
  if (sub.cancelledAt) return 'cancelled';
  if (sub.expiresAt <= now) return 'expired';
  if (sub.startsAt > now) return 'upcoming';
  return 'active';
};

const serializeSubscription = (sub, now = new Date()) => ({
  id: sub._id,
  planId: sub.plan ?? null,
  planName: sub.planName,
  price: sub.price,
  originalPrice: sub.originalPrice ?? null,
  durationDays: sub.durationDays,
  startsAt: sub.startsAt,
  expiresAt: sub.expiresAt,
  status: statusOf(sub, now),
  daysLeft: Math.max(0, Math.ceil((sub.expiresAt - now) / DAY_MS)),
  paymentRef: sub.paymentRef ?? null,
  source: sub.source,
  boughtAt: sub.createdAt,
});

// The plan a customer is on now (`current`), and everything they bought, newest first (`history`).
const summarize = (subs, now = new Date()) => {
  const list = subs.map((s) => serializeSubscription(s, now));
  const current = list.filter((s) => s.status === 'active').sort((a, b) => new Date(b.expiresAt) - new Date(a.expiresAt))[0] ?? null;
  const upcoming = list.find((s) => s.status === 'upcoming') ?? null;
  return { current, upcoming, history: list };
};

// subscriptions for a set of customers -> Map(userId -> summary)
const summariesFor = async (userIds) => {
  const subs = await Subscription.find({ user: { $in: userIds } }).sort({ startsAt: -1 });
  const byUser = new Map();
  subs.forEach((s) => {
    const key = String(s.user);
    byUser.set(key, [...(byUser.get(key) || []), s]);
  });
  const now = new Date();
  return new Map(userIds.map((id) => [String(id), summarize(byUser.get(String(id)) || [], now)]));
};

// Buying a plan. A plan bought while one is still running starts when the running one ends.
const createSubscription = async (userId, plan, { paymentRef, source }) => {
  const now = new Date();
  const running = await Subscription.find({ user: userId, cancelledAt: { $exists: false }, expiresAt: { $gt: now } }).sort({ expiresAt: -1 }).limit(1);
  const startsAt = running[0] ? running[0].expiresAt : now;
  return Subscription.create({
    user: userId,
    plan: plan._id,
    planName: plan.name,
    price: plan.price,
    originalPrice: plan.originalPrice,
    durationDays: plan.durationDays,
    startsAt,
    expiresAt: new Date(startsAt.getTime() + plan.durationDays * DAY_MS),
    paymentRef: typeof paymentRef === 'string' ? paymentRef.trim().slice(0, 120) || undefined : undefined,
    source,
  });
};

const findActivePlan = async (planId) => {
  if (!planId || !/^[0-9a-fA-F]{24}$/.test(String(planId))) return null;
  const plan = await Plan.findById(planId);
  return plan && plan.isActive ? plan : null;
};

// Customer app: buy a plan (call after the payment succeeds; send the gateway reference as paymentRef).
exports.subscribe = async (req, res, next) => {
  try {
    const plan = await findActivePlan(req.body.planId);
    if (!plan) return res.status(404).json({ success: false, message: MESSAGES.subscription.planUnavailable });
    const sub = await createSubscription(req.user._id, plan, { paymentRef: req.body.paymentRef, source: 'app' });
    res.status(201).json({ success: true, data: serializeSubscription(sub) });
  } catch (error) {
    next(error);
  }
};

// Customer app: my current plan and past purchases.
exports.getMySubscription = async (req, res, next) => {
  try {
    const summaries = await summariesFor([req.user._id]);
    res.json({ success: true, data: summaries.get(String(req.user._id)) });
  } catch (error) {
    next(error);
  }
};

// Admin: give a customer a plan (support, goodwill, testing).
exports.grantSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: MESSAGES.auth.userNotFound });
    const plan = await findActivePlan(req.body.planId);
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
    const sub = await Subscription.findOne({ _id: req.params.subId, user: req.params.id });
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

exports.summariesFor = summariesFor;
