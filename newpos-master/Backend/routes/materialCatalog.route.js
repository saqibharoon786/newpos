const express = require('express');
const MaterialCatalog = require('../models/materialCatalog.model');
const { cmsProtect } = require('../middleware/cmsAuth');
const router = express.Router();

router.use(cmsProtect);

router.get('/', async (req, res) => {
  const items = await MaterialCatalog.find({ isActive: true }).sort({ name: 1 });
  res.json({ success: true, data: items });
});

router.post('/', async (req, res) => {
  const item = await MaterialCatalog.create(req.body);
  res.status(201).json({ success: true, data: item });
});

router.put('/:id', async (req, res) => {
  const item = await MaterialCatalog.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: item });
});

router.delete('/:id', async (req, res) => {
  await MaterialCatalog.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true });
});

module.exports = router;
