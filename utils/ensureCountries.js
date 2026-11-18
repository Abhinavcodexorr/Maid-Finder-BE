const Country = require('../models/Country');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Service = require('../models/Service');
const { COUNTRIES, DEFAULT_COUNTRY } = require('../config/countries');

// Runs once at start-up and is safe to repeat:
//  1. makes sure every supported country exists,
//  2. gives records created before countries existed to the default country (India),
//  3. swaps the old "service key/name unique everywhere" indexes for "unique within a country".
const ensureCountries = async () => {
  for (const country of COUNTRIES) {
    await Country.updateOne({ code: country.code }, { $setOnInsert: country }, { upsert: true });
  }

  for (const Model of [Provider, User, Plan, Service]) {
    await Model.updateMany({ $or: [{ country: { $exists: false } }, { country: null }, { country: '' }] }, { $set: { country: DEFAULT_COUNTRY } });
  }

  try {
    const indexes = await Service.collection.indexes();
    for (const index of indexes) {
      const onlyKey = index.unique && Object.keys(index.key).length === 1;
      if (onlyKey && (index.key.key === 1 || index.key.name === 1)) {
        await Service.collection.dropIndex(index.name);
      }
    }
    await Service.syncIndexes();
  } catch (error) {
    console.error('Service index update skipped:', error.message);
  }
};

module.exports = ensureCountries;
