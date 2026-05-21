const express = require('express');
const InvestmentAccount = require('../models/investment.model');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const accounts = await InvestmentAccount.find({ isActive: true }).sort({ subHead: 1, accountName: 1 });
    res.json({ success: true, data: accounts });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const account = await InvestmentAccount.create(req.body);
    res.status(201).json({ success: true, data: account });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/:id/transaction', async (req, res) => {
  try {
    const { type, amount, description, reference } = req.body;
    const account = await InvestmentAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Not found' });
    const amt = parseFloat(amount) || 0;
    if (type === 'debit') account.balance += amt;
    else account.balance -= amt;
    account.transactions.push({ type, amount: amt, description, reference });
    await account.save();
    res.json({ success: true, data: account });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
