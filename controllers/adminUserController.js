const AdminUser = require('../models/AdminUser');
const Country = require('../models/Country');

const MIN_PASSWORD = 8;

const countriesList = async () => Country.find().sort({ sortOrder: 1, name: 1 }).lean();
const activeCodes = async () => new Set((await Country.find({ isActive: true }).select('code').lean()).map((c) => c.code));

const serialize = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  countries: admin.countries,
  isActive: admin.isActive,
  lastLoginAt: admin.lastLoginAt ?? null,
  createdAt: admin.createdAt,
});

// Keep only real, active country codes, once each.
const cleanCountries = async (value) => {
  const allowed = await activeCodes();
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map((c) => String(c).trim().toUpperCase()).filter((c) => allowed.has(c)))];
};

const fail = (res, status, message) => res.status(status).json({ success: false, message });

// GET /admin/countries
exports.listCountries = async (req, res, next) => {
  try {
    res.json({ success: true, data: await countriesList() });
  } catch (error) {
    next(error);
  }
};

// POST /admin/auth/login: checks an admin's email and password (the panel does the session).
exports.verifyAdminLogin = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const admin = await AdminUser.findOne({ email }).select('+password');
    // Same answer for "no such admin" and "wrong password".
    if (!admin || !(await admin.comparePassword(password))) return fail(res, 401, 'Invalid email or password.');
    if (!admin.isActive) return fail(res, 403, 'This account has been disabled.');

    admin.lastLoginAt = new Date();
    await admin.save();
    res.json({ success: true, data: serialize(admin) });
  } catch (error) {
    next(error);
  }
};

exports.listAdmins = async (req, res, next) => {
  try {
    const admins = await AdminUser.find().sort({ createdAt: 1 });
    res.json({ success: true, data: admins.map(serialize) });
  } catch (error) {
    next(error);
  }
};

exports.createAdmin = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role === 'superadmin' ? 'superadmin' : 'subadmin';
    if (!name) return fail(res, 400, 'Enter a name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Enter a valid email.');
    if (password.length < MIN_PASSWORD) return fail(res, 400, `Password must be at least ${MIN_PASSWORD} characters.`);
    const countries = await cleanCountries(req.body.countries);
    if (role === 'subadmin' && countries.length === 0) return fail(res, 400, 'Choose at least one country for a subadmin.');

    const admin = await AdminUser.create({ name, email, password, role, countries });
    res.status(201).json({ success: true, data: serialize(admin) });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, 'An admin with this email already exists.');
    next(error);
  }
};

exports.updateAdmin = async (req, res, next) => {
  try {
    const admin = await AdminUser.findById(req.params.id).select('+password');
    if (!admin) return fail(res, 404, 'Admin not found.');

    if (typeof req.body.name === 'string' && req.body.name.trim()) admin.name = req.body.name.trim();
    if (req.body.role === 'superadmin' || req.body.role === 'subadmin') admin.role = req.body.role;
    if (req.body.countries !== undefined) admin.countries = await cleanCountries(req.body.countries);
    if (req.body.isActive !== undefined) admin.isActive = Boolean(req.body.isActive);
    if (req.body.password !== undefined && req.body.password !== '') {
      if (String(req.body.password).length < MIN_PASSWORD) return fail(res, 400, `Password must be at least ${MIN_PASSWORD} characters.`);
      admin.password = String(req.body.password);
    }
    if (admin.role === 'subadmin' && admin.countries.length === 0) return fail(res, 400, 'Choose at least one country for a subadmin.');

    await admin.save();
    res.json({ success: true, data: serialize(admin) });
  } catch (error) {
    next(error);
  }
};

exports.deleteAdmin = async (req, res, next) => {
  try {
    const admin = await AdminUser.findByIdAndDelete(req.params.id);
    if (!admin) return fail(res, 404, 'Admin not found.');
    res.json({ success: true, data: { id: req.params.id, email: admin.email } });
  } catch (error) {
    next(error);
  }
};

// POST /admin/admins/:id/change-password: the admin changes their own password.
exports.changeAdminPassword = async (req, res, next) => {
  try {
    const admin = await AdminUser.findById(req.params.id).select('+password');
    if (!admin) return fail(res, 404, 'Admin not found.');
    if (!(await admin.comparePassword(String(req.body.currentPassword || '')))) return fail(res, 401, 'Current password is incorrect.');
    const next_ = String(req.body.newPassword || '');
    if (next_.length < MIN_PASSWORD) return fail(res, 400, `Password must be at least ${MIN_PASSWORD} characters.`);
    admin.password = next_;
    await admin.save();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
