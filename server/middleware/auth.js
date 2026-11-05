const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "stayease_secure_jwt_dev_key_2026";

async function protect(req, res, next) {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found with this token" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token verification failed or expired", error: error.message });
  }
}

async function optionalAuth(req, res, next) {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (user) req.user = user;
  } catch (e) {
    // Continue as guest
  }
  next();
}

function adminOnly(req, res, next) {
  if (req.user && (req.user.role === "admin" || req.user.role === "staff")) {
    next();
  } else {
    res.status(403).json({ message: "Access forbidden: requires Staff or Administrator privileges" });
  }
}

function generateToken(userId, role) {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

module.exports = { protect, optionalAuth, adminOnly, generateToken, JWT_SECRET };
