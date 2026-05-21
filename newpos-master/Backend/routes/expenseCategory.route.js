const express = require('express');
const ExpenseCategory = require('../models/expenseCategory.model');
const { cmsProtect } = require('../middleware/cmsAuth');
const router = express.Router();

router.use(cmsProtect);

const DEFAULTS = ['Electricity', 'Rent', 'LPG Gas', 'Transport', 'Maintenance', 'Salaries'];

router.get('/', async (req, res) => {
  let items = await ExpenseCategory.find({ isActive: true }).sort({ name: 1 });
  if (items.length === 0) {
    await ExpenseCategory.insertMany(DEFAULTS.map((name) => ({ name })));
    items = await ExpenseCategory.find({ isActive: true });
  }
  res.json({ success: true, data: items });
});

router.post('/', async (req, res) => {
  const item = await ExpenseCategory.create(req.body);
  res.status(201).json({ success: true, data: item });
});

router.delete('/:id', async (req, res) => {
  await ExpenseCategory.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true });
});

module.exports = router;
