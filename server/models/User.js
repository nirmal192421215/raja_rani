const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true, unique: true },
  name:     { type: String, required: true },
  email:    { type: String },
  picture:  { type: String },

  // Core stats
  totalEarnings: { type: Number, default: 0 },
  gamesPlayed:   { type: Number, default: 0 },
  wins:          { type: Number, default: 0 },
  elo:           { type: Number, default: 1200 },

  // Phase 2: Progression
  xp:    { type: Number, default: 0 },
  level: { type: Number, default: 1 },

  // Phase 2: Role stats
  policeCorrect: { type: Number, default: 0 },
  thiefEscapes:  { type: Number, default: 0 },
  highestRoundEarning: { type: Number, default: 0 },

  // Phase 2: Achievements
  achievements: [{ type: String }],

  // Phase 4: Virtual Currency
  rajaCoins:       { type: Number, default: 200 },   // Start with 200 coins
  ownedCosmetics:  [{ type: String }],               // IDs of owned store items
  equippedCosmetic: { type: String, default: null }, // Currently active item ID
  lastDailyBonus:  { type: Date, default: null },    // For daily coin reward

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
