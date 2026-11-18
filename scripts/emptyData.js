// Empties the app's data so you can start fresh: providers (new registrations and every stage), customers,
// and everything that belongs to them (bookings, plans they bought, favourites, reviews, sign-up OTPs).
//
// KEPT: services, plans, countries and admin users.
// Files already uploaded to S3 (photos, ID documents, videos) are NOT removed.
//
//   node scripts/emptyData.js                    dry run: shows what would be deleted, deletes nothing
//   node scripts/emptyData.js --confirm          deletes it (all countries)
//   node scripts/emptyData.js --country=IN --confirm   only that country's providers and customers
//
// Deleting is permanent. Take a database backup first.
require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Favourite = require('../models/Favourite');
const Review = require('../models/Review');
const Subscription = require('../models/Subscription');
const OtpRequest = require('../models/OtpRequest');

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const countryArg = args.find((a) => a.startsWith('--country='));
const country = countryArg ? countryArg.split('=')[1].trim().toUpperCase() : null;

(async () => {
  const uri = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/maidfinder').trim();
  await mongoose.connect(uri, { directConnection: true, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection;
  console.log(`Database: ${db.name} on ${db.host}`);
  console.log(country ? `Scope: country ${country} only` : 'Scope: ALL countries');
  console.log(confirm ? '*** DELETING ***' : 'Dry run (nothing is deleted). Add --confirm to delete.');

  const filter = country ? { country } : {};
  const providerIds = (await Provider.find(filter).select('_id').lean()).map((p) => p._id);
  const userIds = (await User.find(filter).select('_id').lean()).map((u) => u._id);

  const targets = [
    ['Providers', Provider, filter],
    ['Customers', User, filter],
    ['Bookings', Booking, country ? { $or: [{ user: { $in: userIds } }, { maid: { $in: providerIds } }] } : {}],
    ['Favourites', Favourite, country ? { $or: [{ user: { $in: userIds } }, { maid: { $in: providerIds } }] } : {}],
    ['Reviews', Review, country ? { $or: [{ user: { $in: userIds } }, { provider: { $in: providerIds } }] } : {}],
    ['Plans bought (subscriptions)', Subscription, country ? { user: { $in: userIds } } : {}],
    // Sign-up OTPs are not tied to a country, so they are only cleared when everything is.
    ...(country ? [] : [['Sign-up OTPs', OtpRequest, {}]]),
  ];

  for (const [label, Model, query] of targets) {
    const count = await Model.countDocuments(query);
    if (confirm) {
      const result = await Model.deleteMany(query);
      console.log(`${label.padEnd(30)} ${count} found, ${result.deletedCount} deleted`);
    } else {
      console.log(`${label.padEnd(30)} ${count} would be deleted`);
    }
  }
  console.log('Kept: services, plans, countries, admin users.');
  await mongoose.disconnect();
})().catch((error) => {
  console.error('Failed:', error.message);
  process.exit(1);
});
