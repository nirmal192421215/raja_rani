const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: true
  },
  hostId: {
    type: String,
    required: true
  },
  totalRounds: {
    type: Number,
    default: 5
  },
  currentRound: {
    type: Number,
    default: 0
  },
  botDifficulty: {
    type: String,
    enum: ['rookie', 'pro', 'expert'],
    default: 'rookie'
  },
  players: [{
    id: String,
    name: String,
    isBot: { type: Boolean, default: false },
    colorIndex: Number,
    role: String,
    roleData: Object,
    isReady: { type: Boolean, default: false },
    personality: String // Bot AI personality archetype
  }],
  status: {
    type: String,
    enum: ['lobby', 'playing', 'finished'],
    default: 'lobby'
  },
  // Tracks which players clicked "Continue" / "Next Round"
  phaseReadyPlayers: [String],
  currentPhase: {
    type: String,
    default: 'lobby' // lobby, roleReveal, discussion, action, resolving, result, money, leaderboard
  },
  // Round result data (was missing — caused silent drops in DB mode)
  lastResult: {
    type: Object,
    default: null
  },
  // Chat messages
  messages: [{
    id: String,
    senderId: String,
    senderName: String,
    text: String,
    isEmoji: Boolean,
    time: Date,
    isSelf: Boolean
  }],
  // Full round history for earnings tracking
  roundHistory: [{
    round: Number,
    earnings: Object,
    events: Array,
    isCorrect: Boolean,
    policeId: String,
    targetId: String
  }],
  // Pending police actions for the current round
  pendingActions: {
    type: Object,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Automatically delete rooms after 24 hours
  }
});

module.exports = mongoose.model('Room', RoomSchema);
