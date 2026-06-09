const mongoose = require("mongoose");
const env = require("../config/env");
const logger = require("./logger");

async function repairCustomerEmptyUniqueFields() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const coll = db.collection("customers");
    const emailFix = await coll.updateMany(
      { $or: [{ email: "" }, { email: null }] },
      { $unset: { email: "" } }
    );
    const cnicFix = await coll.updateMany(
      { $or: [{ cnicNo: "" }, { cnicNo: null }] },
      { $unset: { cnicNo: "" } }
    );
    if (emailFix.modifiedCount || cnicFix.modifiedCount) {
      logger.info(
        `Customer repair: cleared empty email (${emailFix.modifiedCount}), cnicNo (${cnicFix.modifiedCount})`
      );
    }
  } catch (err) {
    logger.warn(`Customer empty-field repair skipped: ${err.message}`);
  }
}

module.exports = async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI);
  logger.info("MongoDB connected");
  await repairCustomerEmptyUniqueFields();
};
