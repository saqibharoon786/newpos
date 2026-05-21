const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const COLLECTIONS = [
  'purchases', 'sales', 'expenses', 'customers', 'transactions',
  'productiondatas', 'processingmaterials', 'employees', 'assets',
  'vendors', 'companysettings', 'activitylogs', 'notifications',
  'investmentaccounts', 'users',
];

async function exportCollection(db, name) {
  const docs = await db.collection(name).find({}).toArray();
  return docs;
}

async function runDailyBackup() {
  const db = mongoose.connection.db;
  if (!db) {
    console.error('Backup skipped: DB not connected');
    return;
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const internalDir = path.join(__dirname, '../backups', dateStr);
  const externalDir = process.env.EXTERNAL_BACKUP_PATH
    ? path.join(process.env.EXTERNAL_BACKUP_PATH, dateStr)
    : null;

  [internalDir, externalDir].filter(Boolean).forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const backup = { date: dateStr, collections: {} };

  for (const col of COLLECTIONS) {
    try {
      const exists = (await db.listCollections({ name: col }).toArray()).length > 0;
      if (exists) {
        backup.collections[col] = await exportCollection(db, col);
      }
    } catch (err) {
      console.error(`Backup collection ${col}:`, err.message);
    }
  }

  const filename = `backup-${dateStr}.json`;
  const internalPath = path.join(internalDir, filename);
  fs.writeFileSync(internalPath, JSON.stringify(backup, null, 2));

  if (externalDir) {
    fs.writeFileSync(path.join(externalDir, filename), JSON.stringify(backup, null, 2));
  }

  console.log(`Daily backup completed: ${internalPath}`);
  return internalPath;
}

module.exports = { runDailyBackup };
