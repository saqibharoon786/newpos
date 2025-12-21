require("dotenv").config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 5000),
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/gymdb",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:3000",

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || "15m",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || "30d",
  REFRESH_COOKIE_NAME: process.env.COOKIE_NAME || "rt",
};

if (!env.JWT_SECRET || !env.JWT_REFRESH_SECRET) {
  throw new Error("JWT secrets are required in .env");
}

module.exports = env;
