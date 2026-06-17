const Owner = require('../models/owner.model');
const InvestmentAccount = require('../models/investment.model');
const { ensureOwnerInvestmentAccount, isProfitPartner } = require('../utils/profitDistribution.service');
const {
  listOwnerAdvanceAccounts,
  getOwnerLinkedProfile,
  recordOwnerAdvance,
  recordOwnerRepayment,
} = require('../utils/ownerFinance.service');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function syncOwnerAdvanceFromAccount(owner) {
  if (!owner.investmentAccountId) return 0;
  const acc = await InvestmentAccount.findById(owner.investmentAccountId).lean();
  return round2(num(acc?.balance));
}

exports.getOwners = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === 'true') filter.isActive = true;
    const owners = await Owner.find(filter).sort({ name: 1 }).lean();

    const data = await Promise.all(
      owners.map(async (o) => ({
        ...o,
        advanceBalance: await syncOwnerAdvanceFromAccount(o),
      }))
    );

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOwnerById = async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id).lean();
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }
    const advanceBalance = await syncOwnerAdvanceFromAccount(owner);
    let financeHistory = [];
    if (owner.investmentAccountId) {
      const linked = await getOwnerLinkedProfile(String(owner.investmentAccountId), req.query);
      financeHistory = linked?.history || [];
    }
    res.json({
      success: true,
      data: { ...owner, advanceBalance, financeHistory },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOwner = async (req, res) => {
  try {
    const { name, phone, email, cnic, address, profitSharePercent, participatesInProfitShare } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Owner name required' });
    }

    const participates = participatesInProfitShare === true || participatesInProfitShare === 'true';
    const sharePct = participates ? num(profitSharePercent) : 0;

    const owner = await Owner.create({
      name: name.trim(),
      phone: phone || '',
      email: email || '',
      cnic: cnic || '',
      address: address || '',
      profitSharePercent: sharePct,
      participatesInProfitShare: participates,
    });

    await ensureOwnerInvestmentAccount(owner);
    const fresh = await Owner.findById(owner._id).lean();

    res.status(201).json({
      success: true,
      message: `Owner ${owner.name} add ho gaya`,
      data: fresh,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOwner = async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }

    const fields = ['name', 'phone', 'email', 'cnic', 'address', 'isActive'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        owner[f] = req.body[f];
      }
    }

    if (req.body.participatesInProfitShare !== undefined) {
      owner.participatesInProfitShare =
        req.body.participatesInProfitShare === true ||
        req.body.participatesInProfitShare === 'true';
    }
    if (req.body.profitSharePercent !== undefined) {
      owner.profitSharePercent = num(req.body.profitSharePercent);
    }
    if (!owner.participatesInProfitShare) {
      owner.profitSharePercent = 0;
    }

    await owner.save();
    await ensureOwnerInvestmentAccount(owner);

    if (owner.investmentAccountId && owner.name) {
      await InvestmentAccount.findByIdAndUpdate(owner.investmentAccountId, {
        ownerName: owner.name,
        accountName: `${owner.name} — Owner Advance`,
      });
    }

    res.json({ success: true, message: 'Owner update ho gaya', data: owner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteOwner = async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }

    const advanceBalance = await syncOwnerAdvanceFromAccount(owner);
    if (advanceBalance > 0) {
      return res.status(400).json({
        success: false,
        message: `Outstanding advance Rs. ${advanceBalance.toLocaleString('en-PK')} — pehle clear karen`,
      });
    }

    owner.isActive = false;
    await owner.save();

    if (owner.investmentAccountId) {
      await InvestmentAccount.findByIdAndUpdate(owner.investmentAccountId, { isActive: false });
    }

    res.json({ success: true, message: 'Owner deactivate ho gaya' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Finance dropdown — active owners with investment account */
exports.getOwnersForFinance = async (req, res) => {
  try {
    const accounts = await listOwnerAdvanceAccounts();
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOwnerShareSummary = async (req, res) => {
  try {
    const owners = await Owner.find({ isActive: true }).lean();
    const profitPartners = owners.filter(isProfitPartner);
    const totalShare = profitPartners.reduce((s, o) => s + num(o.profitSharePercent), 0);
    res.json({
      success: true,
      data: {
        owners: owners.map((o) => ({
          _id: o._id,
          name: o.name,
          profitSharePercent: o.profitSharePercent,
          participatesInProfitShare: isProfitPartner(o),
          totalProfitReceived: o.totalProfitReceived,
        })),
        profitPartnerCount: profitPartners.length,
        advanceOnlyCount: owners.length - profitPartners.length,
        totalSharePercent: round2(totalShare),
        isValid:
          profitPartners.length === 0 || Math.abs(totalShare - 100) < 0.01,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recordOwnerAdvanceForOwner = async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }
    await ensureOwnerInvestmentAccount(owner);
    const result = await recordOwnerAdvance({
      ...req.body,
      accountId: owner.investmentAccountId,
      ownerName: owner.name,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    res.json({ success: true, message: result.message, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recordOwnerRepaymentForOwner = async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }
    await ensureOwnerInvestmentAccount(owner);
    const result = await recordOwnerRepayment({
      ...req.body,
      accountId: owner.investmentAccountId,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }
    res.json({ success: true, message: result.message, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
