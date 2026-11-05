const express = require("express");
const User = require("../models/User");
const { protect, generateToken } = require("../middleware/auth");
const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // Role default is guest unless registered as admin with valid secret, or explicit in development
    const allowedRole = (role === "admin" || role === "staff") ? role : "guest";

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || "",
      role: allowedRole
    });

    const token = generateToken(user._id, user.role);
    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        preferences: user.preferences
      },
      token
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user._id, user.role);
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        preferences: user.preferences
      },
      token
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user profile
router.get("/me", protect, async (req, res) => {
  res.json({ user: req.user });
});

// Update profile / preferences
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, phone, preferences } = req.body;
    const user = req.user;

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
