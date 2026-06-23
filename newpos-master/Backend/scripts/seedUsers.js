/**
 * Run once: node scripts/seedUsers.js
 * Seeds default Owner and Accountant users for Mara Ha International Plastic CMS
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/user.model');
const CompanySettings = require('../models/settings.model');
const InvestmentAccount = require('../models/investment.model');

const users = [
  {
    username: 'owner',
    email: 'owner@maraha.com',
    password: 'owner123',
    role: 'owner',
    firstName: 'Owner',
    lastName: 'Admin',
    phone: '+92000000001',
  },
  {
    username: 'accountant1',
    email: 'accountant1@maraha.com',
    password: 'acc123',
    role: 'accountant1',
    firstName: 'Accountant',
    lastName: 'One',
    phone: '+92000000002',
  },
  {
    username: 'accountant2',
    email: 'accountant2@maraha.com',
    password: 'acc123',
    role: 'accountant2',
    firstName: 'Accountant',
    lastName: 'Two',
    phone: '+92000000003',
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/newpos');
  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      await User.create(u);
      console.log('Created user:', u.email, u.role);
    }
  }
  const settings = await CompanySettings.findOne();
  if (!settings) {
    await CompanySettings.create({ companyName: 'International Plastic' });
    console.log('Company settings created');
  }
  const invHead = await InvestmentAccount.findOne({ subHead: 'Loan/Advance to Owner' });
  if (!invHead) {
    await InvestmentAccount.create({
      head: 'Investment',
      subHead: 'Loan/Advance to Owner',
      accountName: 'Owner Advances',
      accountType: 'advance_to_owner',
    });
    console.log('Investment head created');
  }
  console.log('Seed complete');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
