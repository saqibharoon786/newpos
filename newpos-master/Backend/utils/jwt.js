const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const { JWT_SETTINGS } = require("../middleware/constants")

// Generate JWT tokens
const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: JWT_SETTINGS.ACCESS_TOKEN_EXPIRE,
  })

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: JWT_SETTINGS.REFRESH_TOKEN_EXPIRE,
  })

  return { accessToken, refreshToken }
}

// Generate access token only
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: JWT_SETTINGS.ACCESS_TOKEN_EXPIRE,
  })
}

// Generate refresh token only
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: JWT_SETTINGS.REFRESH_TOKEN_EXPIRE,
  })
}

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    throw new Error("Invalid access token")
  }
}

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET)
  } catch (error) {
    throw new Error("Invalid refresh token")
  }
}

// Generate password reset token
const generateResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString("hex")
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex")

  return { resetToken, hashedToken }
}

// Hash reset token
const hashResetToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex")
}

module.exports = {
  generateTokens,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateResetToken,
  hashResetToken,
}
