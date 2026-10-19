// Run this against production BEFORE relying on the new unique index on
// Provider.mobileNumberDigits (see models/Provider.js) — Mongoose only
// builds that index in the background on connect, and if duplicates
// already exist the build silently fails, leaving the constraint
// unenforced with no error anywhere obvious.
//
//   node scripts/findDuplicateMobileNumbers.js
//
// Prints each phone number with more than one account and all matching
// provider ids/emails/names, so you can decide which to keep/merge before
// the index can actually be created.
require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('../models/Provider');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const duplicates = await Provider.aggregate([
    { $match: { mobileNumberDigits: { $exists: true, $ne: '' } } },
    { $group: { _id: '$mobileNumberDigits', count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (!duplicates.length) {
    console.log('No duplicate mobile numbers found — the unique index can be created safely.');
    process.exit(0);
  }

  console.log(`${duplicates.length} phone number(s) with more than one account:\n`);
  for (const dup of duplicates) {
    const providers = await Provider.find({ _id: { $in: dup.ids } }).select(
      'fullName email applicationStatus profileComplete createdAt'
    );
    console.log(`Phone digits: ${dup._id} (${dup.count} accounts)`);
    providers.forEach((p) => {
      console.log(
        `  - ${p._id}  name="${p.fullName || ''}"  email="${p.email || ''}"  status=${p.applicationStatus}  complete=${p.profileComplete}  created=${p.createdAt.toISOString()}`
      );
    });
    console.log('');
  }
  console.log('Resolve these (merge or delete the ones to drop) before the unique index will actually build.');
  process.exit(0);
})();
