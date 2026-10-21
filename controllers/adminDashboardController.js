const Provider = require('../models/Provider');
const Service = require('../models/Service');
const { APPLICATION_STATUS } = require('../config/constants');

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 180; // covers the admin charts: 14 days, 13 weeks, 6 months
// Thresholds for the "needs attention" counts; returned so the panel can label them.
const STALE_NEW_DAYS = 2;
const STALE_VERIFICATION_DAYS = 3;

// IANA zone ("Asia/Kolkata") or fixed offset ("+05:30"); anything else falls back to UTC.
const TIMEZONE_PATTERN = /^([A-Za-z_]+(\/[A-Za-z_+\-0-9]+)*|[+-]\d{2}:?\d{2})$/;

const hasText = (expr) => ({ $gt: [{ $strLenCP: { $ifNull: [expr, ''] } }, 0] });
// ID proof = the Aadhaar front from the new KYC step, or the first legacy kycDocuments file.
const idDocument = { $ifNull: ['$aadhaarFrontUrl', { $arrayElemAt: ['$kycDocuments.idDocumentUrl', 0] }] };
const has = (cond) => ({ $cond: [cond, 1, 0] });
const inStage = (...names) => ({ $in: ['$applicationStatus', names] });
const experience = { $ifNull: ['$experienceYears', 0] };

const buildFacets = ({ timezone, since, staleNewBefore, staleVerificationBefore }) => ({
  stages: [{ $group: { _id: '$applicationStatus', count: { $sum: 1 } } }],

  // Registrations per local calendar day and stage, for the last HISTORY_DAYS days.
  daily: [
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone } },
          status: '$applicationStatus',
        },
        count: { $sum: 1 },
      },
    },
  ],

  // Open = still waiting on a decision (new request or verification).
  open: [
    { $match: { applicationStatus: { $in: ['pending', 'verification'] } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avgSubmittedMs: { $avg: { $toLong: '$createdAt' } },
        staleNew: { $sum: has({ $and: [inStage('pending'), { $lt: ['$createdAt', staleNewBefore] }] }) },
        staleVerification: {
          $sum: has({ $and: [inStage('verification'), { $lt: ['$updatedAt', staleVerificationBefore] }] }),
        },
        missingId: { $sum: has({ $not: [hasText(idDocument)] }) },
        missingVideo: { $sum: has({ $not: [hasText('$introVideoUrl')] }) },
        incomplete: { $sum: has({ $ne: ['$profileComplete', true] }) },
      },
    },
  ],
  oldestNew: [
    { $match: { applicationStatus: 'pending' } },
    { $group: { _id: null, oldest: { $min: '$createdAt' } } },
  ],

  // Profile quality and mix across every provider.
  profile: [
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        photo: { $sum: has(hasText('$imageUrl')) },
        idProof: { $sum: has(hasText(idDocument)) },
        // PAN card = the new KYC step's file, or a legacy kycDocuments entry typed as PAN.
        panCard: {
          $sum: has({
            $or: [
              hasText('$panCardUrl'),
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ['$kycDocuments', []] },
                        as: 'doc',
                        cond: {
                          $and: [
                            { $regexMatch: { input: { $ifNull: ['$$doc.idType', ''] }, regex: /pan/i } },
                            hasText('$$doc.idDocumentUrl'),
                          ],
                        },
                      },
                    },
                  },
                  0,
                ],
              },
            ],
          }),
        },
        introVideo: { $sum: has(hasText('$introVideoUrl')) },
        profileComplete: { $sum: has({ $eq: ['$profileComplete', true] }) },
        male: { $sum: has({ $eq: ['$gender', 'Male'] }) },
        female: { $sum: has({ $eq: ['$gender', 'Female'] }) },
        exp0to1: { $sum: has({ $lt: [experience, 2] }) },
        exp2to4: { $sum: has({ $and: [{ $gte: [experience, 2] }, { $lt: [experience, 5] }] }) },
        exp5to9: { $sum: has({ $and: [{ $gte: [experience, 5] }, { $lt: [experience, 10] }] }) },
        exp10plus: { $sum: has({ $gte: [experience, 10] }) },
      },
    },
  ],

  cities: [
    { $match: { city: { $type: 'string', $ne: '' } } },
    { $group: { _id: { $trim: { input: '$city' } }, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 5 },
  ],

  // How many providers list each service key.
  services: [
    { $unwind: '$categoryIds' },
    { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ],
});

// GET /admin/dashboard?tz=Asia/Kolkata
// Everything the admin dashboard shows, aggregated in the database in one round
// trip, so it stays exact (and tiny) however many providers there are.
exports.getAdminDashboard = async (req, res, next) => {
  try {
    const timezone = TIMEZONE_PATTERN.test(String(req.query.tz || '')) ? String(req.query.tz) : 'UTC';
    const now = Date.now();
    const facets = buildFacets({
      timezone,
      since: new Date(now - HISTORY_DAYS * DAY_MS),
      staleNewBefore: new Date(now - STALE_NEW_DAYS * DAY_MS),
      staleVerificationBefore: new Date(now - STALE_VERIFICATION_DAYS * DAY_MS),
    });

    let result;
    try {
      [result] = await Provider.aggregate([{ $facet: facets }]);
    } catch (error) {
      // An unknown time zone name is the only expected failure; retry in UTC.
      if (timezone === 'UTC') throw error;
      return exports.getAdminDashboard({ ...req, query: { ...req.query, tz: 'UTC' } }, res, next);
    }

    const catalog = await Service.find().select('key name isActive').lean();
    const byKey = new Map(catalog.map((s) => [s.key, s]));

    const stages = Object.fromEntries(APPLICATION_STATUS.map((name) => [name, 0]));
    result.stages.forEach(({ _id, count }) => {
      if (_id in stages) stages[_id] = count;
    });

    const daily = {};
    result.daily.forEach(({ _id, count }) => {
      if (!_id.status || !(_id.status in stages)) return;
      daily[_id.date] ??= Object.fromEntries(APPLICATION_STATUS.map((name) => [name, 0]));
      daily[_id.date][_id.status] = count;
    });

    const open = result.open[0] || {};
    const profile = result.profile[0] || {};

    res.json({
      success: true,
      generatedAt: new Date(now).toISOString(),
      timezone,
      total: Object.values(stages).reduce((sum, n) => sum + n, 0),
      stages,
      daily: Object.entries(daily)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, counts]) => ({ date, ...counts })),
      wait: {
        openCount: open.count || 0,
        avgSubmittedAt: open.avgSubmittedMs ? new Date(open.avgSubmittedMs).toISOString() : null,
        oldestNewAt: result.oldestNew[0]?.oldest ? result.oldestNew[0].oldest.toISOString() : null,
      },
      attention: {
        staleNewDays: STALE_NEW_DAYS,
        staleVerificationDays: STALE_VERIFICATION_DAYS,
        staleNew: open.staleNew || 0,
        staleVerification: open.staleVerification || 0,
        missingId: open.missingId || 0,
        missingVideo: open.missingVideo || 0,
        incomplete: open.incomplete || 0,
      },
      profile: {
        total: profile.total || 0,
        photo: profile.photo || 0,
        idProof: profile.idProof || 0,
        panCard: profile.panCard || 0,
        introVideo: profile.introVideo || 0,
        profileComplete: profile.profileComplete || 0,
        gender: { male: profile.male || 0, female: profile.female || 0 },
        experience: [
          { label: '0–1 yr', count: profile.exp0to1 || 0 },
          { label: '2–4 yrs', count: profile.exp2to4 || 0 },
          { label: '5–9 yrs', count: profile.exp5to9 || 0 },
          { label: '10+ yrs', count: profile.exp10plus || 0 },
        ],
      },
      topCities: result.cities.map(({ _id, count }) => ({ name: _id, count })),
      topServices: result.services
        .filter(({ _id }) => byKey.has(_id))
        .slice(0, 5)
        .map(({ _id, count }) => ({ key: _id, name: byKey.get(_id).name, count, isActive: byKey.get(_id).isActive })),
      services: { active: catalog.filter((s) => s.isActive).length, total: catalog.length },
    });
  } catch (error) {
    next(error);
  }
};
