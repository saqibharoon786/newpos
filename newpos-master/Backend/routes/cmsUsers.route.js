const express = require('express');
const User = require('../models/user.model');
const { cmsProtect, requireOwner } = require('../middleware/cmsAuth');
const router = express.Router();

router.use(cmsProtect, requireOwner);

router.get('/', async (req, res) => {
  const users = await User.find().select('-password -refreshToken').sort({ createdAt: -1 });
  res.json({ success: true, data: users });
});

router.post('/', async (req, res) => {
  const { username, email, password, role, firstName, lastName, phone } = req.body;
  const exists = await User.findOne({ $or: [{ email }, { username }] });
  if (exists) return res.status(409).json({ success: false, message: 'User already exists' });
  const user = await User.create({ username, email, password, role, firstName, lastName, phone });
  const out = user.toObject();
  delete out.password;
  res.status(201).json({ success: true, data: out });
});

router.put('/:id', async (req, res) => {
  const { password, ...rest } = req.body;
  const update = { ...rest };
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'Not found' });
  Object.assign(user, update);
  if (password) user.password = password;
  await user.save();
  const out = user.toObject();
  delete out.password;
  res.json({ success: true, data: out });
});

module.exports = router;
