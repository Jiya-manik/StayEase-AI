const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, default: "" },
  role: { type: String, enum: ["guest", "staff", "admin"], default: "guest" },
  preferences: {
    budget: { type: Number, default: 8000 },
    roomCategory: { type: String, default: "DELUXE" },
    amenities: { type: [String], default: ["Wi-Fi", "Breakfast"] },
    travelType: { type: String, default: "Leisure" },
    language: { type: String, default: "en" }
  }
}, { timestamps: true });

userSchema.pre("save", async function() {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
