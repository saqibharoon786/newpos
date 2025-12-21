const mongoose = require("mongoose");
const env = require("../config/env");
const logger = require("./logger");

module.exports = async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI);
  logger.info("MongoDB connected");
};
