const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const { generateTokens, verifyRefreshToken } = require("../utils/jwt");
const logger = require("../loaders/logger");
const generateUserId = require("../utils/generateId/generateUniqueUserID");

class AuthService {
  // Register new user
  async register(userData) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: userData.email }, { username: userData.username }],
      });

      if (existingUser) {
        throw new Error("User already exists with this email or username");
      }

      // Generate UserID by the user name
      const newUserId = await generateUserId(userData.username);

      // Create new user
      const user = new User({
        ...userData,
        userId: newUserId,
      });
      await user.save();

      // Generate tokens
      const tokens = generateTokens({ id: user._id, role: user.role });

      // Save refresh token
      user.refreshToken = tokens.refreshToken;
      await user.save();

      // Remove sensitive data
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.refreshToken;

      logger.info(`New user registered: ${user.email}`);

      return {
        user: userResponse,
        tokens,
      };
    } catch (error) {
      logger.error("Registration error:", error);
      throw error;
    }
  }

  // Login user
  async login(email, password) {
    try {
      // Find user with password
      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        throw new Error("Invalid credentials");
      }

      if (!user.isActive) {
        throw new Error("Account is deactivated");
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error("Invalid credentials");
      }

      // Generate tokens
      const tokens = generateTokens({ id: user._id, role: user.role });

      // Save refresh token and update last login
      user.refreshToken = tokens.refreshToken;
      await user.updateLastLogin();

      // Remove sensitive data
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.refreshToken;

      logger.info(`User logged in: ${user.email}`);

      return {
        user: userResponse,
        tokens,
      };
    } catch (error) {
      logger.error("Login error:", error);
      throw error;
    }
  }

  // Refresh access token
  async refreshToken(refreshToken) {
    try {
      console.log('🔄 Refresh token request received');
      
      if (!refreshToken) {
        throw new Error("Refresh token is required");
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      console.log('✅ Refresh token verified for user:', decoded.id);

      // Find user
      const user = await User.findById(decoded.id).select("+refreshToken");
      
      if (!user) {
        console.error('❌ User not found for refresh token');
        throw new Error("Invalid refresh token");
      }

      if (user.refreshToken !== refreshToken) {
        console.error('❌ Refresh token mismatch');
        throw new Error("Invalid refresh token");
      }

      if (!user.isActive) {
        console.error('❌ User account deactivated');
        throw new Error("Account is deactivated");
      }

      // Generate new tokens
      const tokens = generateTokens({ id: user._id, role: user.role });
      console.log('✅ New tokens generated');

      // Update refresh token - rotate refresh token for security
      user.refreshToken = tokens.refreshToken;
      await user.save();
      console.log('✅ Refresh token updated in database');

      return tokens;
    } catch (error) {
      console.error("❌ Token refresh error:", error);
      logger.error("Token refresh error:", error);
      throw error;
    }
  }

  // Logout user
  async logout(userId) {
    try {
      await User.findByIdAndUpdate(userId, { refreshToken: null });
      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error("Logout error:", error);
      throw error;
    }
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select("+password");

      if (!user) {
        throw new Error("User not found");
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(
        currentPassword
      );
      if (!isCurrentPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      // Update password
      user.password = newPassword;
      await user.save();

      logger.info(`Password changed for user: ${user.email}`);
    } catch (error) {
      logger.error("Change password error:", error);
      throw error;
    }
  }
}

module.exports = new AuthService();