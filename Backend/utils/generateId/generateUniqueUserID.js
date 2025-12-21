const User = require("../../models/user.model");

async function generateUserId(username) {
  // Take first 3 letters of username, uppercase
  const prefix = username.substring(0, 3).toUpperCase();

  // Find the last user whose ID starts with this prefix
  const lastUser = await User.findOne({ userId: new RegExp(`^${prefix}-\\d+$`) })
    .sort({ createdAt: -1 })
    .select("userId");

  let newIdNumber = 1;
  if (lastUser && lastUser.userId) {
    const lastNumber = parseInt(lastUser.userId.split("-")[1], 10);
    newIdNumber = lastNumber + 1;
  }

  // Format: XXX-001
  return `${prefix}-${String(newIdNumber).padStart(3, "0")}`;
}

module.exports = generateUserId;
