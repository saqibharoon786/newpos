const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/owner.controller');
const {
  previewProfitDistribution,
  saveProfitDistributionDraft,
  payProfitDistribution,
  listProfitDistributions,
} = require('../utils/profitDistribution.service');

router.get('/finance-list', ownerController.getOwnersForFinance);
router.get('/share-summary', ownerController.getOwnerShareSummary);

router.get('/profit-distribution/preview', async (req, res) => {
  try {
    const result = await previewProfitDistribution({
      year: req.query.year,
      month: req.query.month,
      reserveAmount: req.query.reserveAmount,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    res.json({ success: true, data: result.preview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/profit-distribution', async (req, res) => {
  try {
    const data = await listProfitDistributions(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/profit-distribution/draft', async (req, res) => {
  try {
    const result = await saveProfitDistributionDraft(req.body);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    res.json({ success: true, message: 'Draft save ho gaya', data: result.distribution });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/profit-distribution/:id/pay', async (req, res) => {
  try {
    const result = await payProfitDistribution({
      distributionId: req.params.id,
      method: req.body.method,
      linePayments: req.body.linePayments,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    res.json({ success: true, message: result.message, data: result.distribution });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', ownerController.getOwners);
router.get('/:id', ownerController.getOwnerById);
router.post('/', ownerController.createOwner);
router.put('/:id', ownerController.updateOwner);
router.delete('/:id', ownerController.deleteOwner);
router.post('/:id/advance', ownerController.recordOwnerAdvanceForOwner);
router.post('/:id/repayment', ownerController.recordOwnerRepaymentForOwner);

module.exports = router;
