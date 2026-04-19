require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');
const Room = require('./models/Room');
const http = require('http');
const { Server } = require('socket.io');
const { sanitizeRoomForPlayer, broadcastPersonalized, broadcastPhaseChange } = require('./utils/sanitize');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '10kb' })); // Rate limit payload size

let DB_READY = false;
let mockRooms = new Map();
let mockUsers = new Map();

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas');
  DB_READY = true;
})
.catch((err) => {
  console.error('❌ MongoDB Connection Error:', err.message);
  console.warn('⚠️  Switching to MEMORY MOCK MODE (Game state will reset on server restart)');
  DB_READY = false;
});

// ─── HELPERS ──────────────────────────────────────────────────────────

// Get room from DB or mock
async function getRoom(code) {
  if (!DB_READY) return mockRooms.get(code) || null;
  return await Room.findOne({ code });
}

// Save room to DB (no-op in mock mode)
async function saveRoom(room) {
  if (DB_READY && typeof room.save === 'function') {
    room.markModified('players');
    room.markModified('lastResult');
    room.markModified('pendingActions');
    room.markModified('roundHistory');
    await room.save();
  }
}

// ─── ROLES & GAME ENGINE ──────────────────────────────────────────────

const ROLE_DISTRIBUTIONS = {
  4: ['raja', 'rani', 'police', 'thief'],
  5: ['raja', 'rani', 'mantri', 'police', 'thief'],
  6: ['raja', 'rani', 'mantri', 'soldier', 'police', 'thief'],
  7: ['raja', 'rani', 'mantri', 'soldier', 'milkman', 'police', 'thief'],
  8: ['raja', 'rani', 'mantri', 'soldier', 'police', 'police', 'thief', 'thief'],
  9: ['raja', 'rani', 'mantri', 'soldier', 'milkman', 'police', 'police', 'thief', 'thief'],
  10: ['raja', 'rani', 'mantri', 'soldier', 'milkman', 'gardener', 'police', 'police', 'thief', 'thief']
};

const ROLE_POINTS = {
  'raja': 500,
  'rani': 350,
  'mantri': 250,
  'soldier': 200,
  'milkman': 150,
  'gardener': 100,
  'police': 400,
  'thief': 0
};

const BOT_PERSONALITIES = ['DETECTIVE', 'GAMBLER', 'ANALYST', 'ROOKIE'];

// Helper to assign roles
const assignRoles = (players) => {
  const count = players.length;
  const clamped = Math.min(Math.max(count, 4), 10);
  const roles = [...ROLE_DISTRIBUTIONS[clamped]];

  // Shuffle roles (Fisher-Yates)
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  return players.map((p, i) => ({
    ...p,
    role: roles[i],
    roleData: {
      points: ROLE_POINTS[roles[i]] || 0
    },
    isReady: false
  }));
};

// ─── BOT AI ───────────────────────────────────────────────────────────

const BOT_CLAIMS_TENDENCY = {
  DETECTIVE: ['Mantri', 'Soldier'],
  GAMBLER: ['Raja', 'Rani', 'Thief'],
  ANALYST: ['Milkman', 'Gardener', 'Soldier'],
  ROOKIE: ['Raja', 'Rani']
};

/**
 * Bot Police AI — uses Bayesian-like anomaly detection and personality matrices
 */
function botPoliceDecision(room, botPlayer) {
  const suspects = room.players.filter(p => p.id !== botPlayer.id && p.role !== 'police');
  if (suspects.length === 0) return null;

  const personality = botPlayer.personality || BOT_PERSONALITIES[Math.floor(Math.random() * BOT_PERSONALITIES.length)];
  const history = room.roundHistory || [];

  switch (personality) {
    case 'DETECTIVE': {
      // Tracks anomaly: Who hasn't been thief yet? ("Gambler's Fallacy" logic)
      const thiefCounts = {};
      suspects.forEach(s => { thiefCounts[s.id] = 0; });
      history.forEach(round => {
        if (round.targetId && suspects.find(s => s.id === round.targetId) && round.isCorrect) {
          thiefCounts[round.targetId] = (thiefCounts[round.targetId] || 0) + 1;
        }
      });
      // Sort ascending, pick the one who has been thief LEAST
      const sorted = suspects.sort((a, b) => (thiefCounts[a.id] || 0) - (thiefCounts[b.id] || 0));
      return sorted[0];
    }
    case 'ANALYST': {
      // Avoids whoever was targeted last round
      if (history.length > 0) {
        const lastTarget = history[history.length - 1]?.targetId;
        const filtered = suspects.filter(s => s.id !== lastTarget);
        if (filtered.length > 0) return filtered[Math.floor(Math.random() * filtered.length)];
      }
      return suspects[Math.floor(Math.random() * suspects.length)];
    }
    case 'GAMBLER': {
      // Always picks random, highly unpredictable
      return suspects[Math.floor(Math.random() * suspects.length)];
    }
    default: // ROOKIE
      // Tends to latch onto one person over and over
      if (history.length > 0 && Math.random() > 0.5) {
        const lastTarget = suspects.find(s => s.id === history[history.length - 1]?.targetId);
        if (lastTarget) return lastTarget;
      }
      return suspects[Math.floor(Math.random() * suspects.length)];
  }
}

// Triggers bots to participate in the Discussion phase
function simulateBotDiscussion(io, room) {
  const bots = room.players.filter(p => p.isBot);
  if (bots.length === 0) return;

  const rolesToClaim = ['Raja', 'Rani', 'Mantri', 'Soldier', 'Milkman', 'Gardener'];
  const humanPlayers = room.players.filter(p => !p.isBot);

  bots.forEach((bot, i) => {
    const personality = bot.personality || BOT_PERSONALITIES[i % BOT_PERSONALITIES.length];
    bot.personality = personality; // Lock it in

    // 1. Claim a Role after 2-5s
    setTimeout(() => {
      let claimPool = BOT_CLAIMS_TENDENCY[personality] || rolesToClaim;
      let claim = claimPool[Math.floor(Math.random() * claimPool.length)];
      io.to(room.code).emit('receive_claim', { playerId: bot.id, claim });
    }, 2000 + (Math.random() * 3000));

    // 2. Vote Trust/Accuse after 5-10s
    setTimeout(() => {
      if (humanPlayers.length > 0) {
        const target = humanPlayers[Math.floor(Math.random() * humanPlayers.length)];
        const isAccuse = Math.random() > (personality === 'ROOKIE' ? 0.3 : 0.6);
        io.to(room.code).emit('receive_vote', {
          playerId: bot.id,
          targetId: target.id,
          type: isAccuse ? 'ACCUSE' : 'TRUST'
        });
      }
    }, 5000 + (Math.random() * 5000));

    // 3. Send a Chat Message after 8-15s
    setTimeout(() => {
      const messages = [
        `I am definitely not the thief...`,
        `Trust me guys, I'm the ${rolesToClaim[Math.floor(Math.random() * rolesToClaim.length)]}`,
        `I have my eye on someone.`,
        `Anyone acting sus?`,
        `(Bot staring analytically)`
      ];
      const text = messages[Math.floor(Math.random() * messages.length)];
      io.to(room.code).emit('receive_message', {
        id: `msg-${Date.now()}-${Math.random()}`,
        senderId: bot.id,
        senderName: bot.name,
        text,
        isEmoji: false,
        time: new Date(),
        isSelf: false
      });
    }, 8000 + (Math.random() * 7000));
  });
}

// ─── ROUTES ───────────────────────────────────────────────────────────

// Test Route
app.get('/api/status', (req, res) => {
  res.json({ status: 'API is running' });
});

// Login / Register Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { id, name, email, picture, isGoogle } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    if (!DB_READY) {
      console.log(`[MOCK] Logging in user: ${name}`);
      const mockUser = {
        _id: id || `mock_${Date.now()}`,
        name: name.trim(),
        email,
        picture,
        googleId: isGoogle ? id : null,
        totalEarnings: 0,
        gamesPlayed: 0,
        wins: 0
      };
      return res.status(200).json({ success: true, user: mockUser });
    }

    // Handle Google Login
    if (isGoogle && email) {
      let user = await User.findOne({ email });

      if (!user) {
        // Create new user if they don't exist
        user = new User({
          googleId: id,
          name: name.trim(),
          email,
          picture
        });
        await user.save();
        console.log(`Created new Google user: ${name}`);
      } else {
        // Update existing user with Google ID just in case
        if (!user.googleId) {
          user.googleId = id;
        }
        if (!user.picture && picture) {
          user.picture = picture;
        }
        await user.save();
        console.log(`Logged in existing user: ${name}`);
      }

      return res.status(200).json({ success: true, user });
    }

    // Handle Guest Login
    let user = await User.findOne({ name: name.trim(), email: null }); // Look for guest with same name
    if (!user) {
       user = new User({
         name: name.trim()
       });
       await user.save();
       console.log(`Created new guest user: ${name}`);
    } else {
       console.log(`Logged in existing guest: ${name}`);
    }
    
    res.status(200).json({ success: true, user });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// Update match stats Route
app.post('/api/user/stats', async (req, res) => {
  try {
    const { userId, earnings, isWin } = req.body;
    
    if (!DB_READY) {
      return res.status(200).json({ success: true, message: "Stats mock updated" });
    }
    
    // userId will be custom Object ID or google sub
    let user = null;
    if (mongoose.isValidObjectId(userId)) {
      user = await User.findById(userId);
    }
    
    if (!user) {
        user = await User.findOne({ googleId: userId });
    }

    if (!user) return res.status(404).json({ message: "User not found" });

    user.totalEarnings += Number(earnings || 0);
    user.gamesPlayed += 1;
    if (isWin) {
      user.wins += 1;
    }

    await user.save();
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Stats update error:', error);
    res.status(500).json({ success: false, message: 'Server error updating stats' });
  }
});

// Get User Profile Route
app.get('/api/user/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!DB_READY) {
      return res.status(200).json({ 
        success: true, 
        user: { _id: userId, name: "Guest", totalEarnings: 0, gamesPlayed: 0, wins: 0 } 
      });
    }

    let user = null;
    
    if (mongoose.isValidObjectId(userId)) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      user = await User.findOne({ googleId: userId });
    }
    
    if (!user) return res.status(404).json({ message: "User not found" });
    
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});

// --- ROOM MANAGEMENT ROUTES ---

// Create Room
app.post('/api/room/create', async (req, res) => {
  try {
    const { code, hostId, hostName, totalRounds } = req.body;

    if (!code || !hostId || !hostName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    if (!DB_READY) {
      const room = {
        code,
        hostId,
        totalRounds: totalRounds || 5,
        players: [{
          id: hostId,
          name: hostName,
          isBot: false,
          colorIndex: 0
        }],
        status: 'lobby',
        currentRound: 0,
        phaseReadyPlayers: [],
        currentPhase: 'lobby',
        messages: [],
        roundHistory: [],
        lastResult: null,
        pendingActions: {}
      };
      mockRooms.set(code, room);
      console.log(`[MOCK] Created room: ${code}`);
      return res.status(200).json({ success: true, room });
    }

    let room = await Room.findOne({ code });
    
    if (room) {
      return res.status(400).json({ success: false, message: 'Room code already exists' });
    }

    room = new Room({
      code,
      hostId,
      totalRounds: totalRounds || 5,
      players: [{
        id: hostId,
        name: hostName,
        isBot: false,
        colorIndex: 0
      }]
    });

    await room.save();
    console.log(`Created new room: ${code}`);
    res.status(200).json({ success: true, room });
  } catch (error) {
    console.error('Room creation error:', error);
    res.status(500).json({ success: false, message: 'Server error creating room' });
  }
});

// Join Room
app.post('/api/room/join', async (req, res) => {
  try {
    const { code, playerId, playerName } = req.body;

    if (!code || !playerId || !playerName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    if (!DB_READY) {
      const room = mockRooms.get(code);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
      
      const exists = room.players.find(p => p.id === playerId);
      if (!exists) {
        room.players.push({
          id: playerId,
          name: playerName,
          isBot: false,
          colorIndex: room.players.length
        });
      }
      // FIX BUG-01: Sanitize room data before sending
      const sanitized = sanitizeRoomForPlayer(room, playerId);
      return res.status(200).json({ success: true, room: sanitized });
    }

    const room = await Room.findOne({ code });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.status !== 'lobby') {
      return res.status(400).json({ success: false, message: 'Game already in progress' });
    }

    // Check if player already in room
    const exists = room.players.find(p => p.id === playerId);
    if (!exists) {
      room.players.push({
        id: playerId,
        name: playerName,
        isBot: false,
        colorIndex: room.players.length
      });
      await room.save();
      console.log(`Player ${playerName} joined room ${code}`);
    }

    // FIX BUG-01: Sanitize room data before sending
    const sanitized = sanitizeRoomForPlayer(room, playerId);
    res.status(200).json({ success: true, room: sanitized });
  } catch (error) {
    console.error('Room join error:', error);
    res.status(500).json({ success: false, message: 'Server error joining room' });
  }
});

// Get Room Status (for polling)
// FIX BUG-01: Now requires playerId query param for sanitization
app.get('/api/room/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { playerId } = req.query;

    const room = await getRoom(code);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    // Sanitize based on who's asking
    const sanitized = playerId 
      ? sanitizeRoomForPlayer(room, playerId) 
      : sanitizeRoomForPlayer(room, '__spectator__'); // Strip all roles if no ID
    
    res.status(200).json({ success: true, room: sanitized });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching room' });
  }
});

// Start Game
app.post('/api/room/start', async (req, res) => {
  try {
    const { code } = req.body;

    if (!DB_READY) {
      let room = mockRooms.get(code);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
      room.status = 'playing';
      room.currentRound = 1;
      room.currentPhase = 'roleReveal';
      room.players = assignRoles(room.players);
      room.roundHistory = [];
      room.pendingActions = {};
      console.log(`[MOCK] Game started in room: ${code}`);
      
      // Broadcast personalized data to each player
      broadcastPersonalized(io, code, room, 'roleReveal');
      
      // Return sanitized for the requester (host)
      const sanitized = sanitizeRoomForPlayer(room, room.hostId, 'roleReveal');
      return res.status(200).json({ success: true, room: sanitized });
    }

    let room = await Room.findOne({ code });
    if (!room) return res.status(404).json({ message: 'Room not found' }); // FIX BUG-04: was status(44)

    room.status = 'playing';
    room.currentRound = 1;
    room.currentPhase = 'roleReveal';
    room.roundHistory = [];
    room.pendingActions = {};
    // Convert Mongoose subdocs to plain objects for the helper
    const plainPlayers = room.players.map(p => p.toObject());
    room.players = assignRoles(plainPlayers);
    
    await room.save();
    console.log(`Game started in room: ${code}`);
    
    // Broadcast personalized data
    broadcastPersonalized(io, code, room, 'roleReveal');
    
    const sanitized = sanitizeRoomForPlayer(room, room.hostId, 'roleReveal');
    res.status(200).json({ success: true, room: sanitized });
  } catch (error) {
    console.error('Room start error:', error);
    res.status(500).json({ success: false, message: 'Server error starting room' });
  }
});

// Player Ready / Next Round
app.post('/api/room/ready', async (req, res) => {
  try {
    const { code, playerId } = req.body;

    if (!DB_READY) {
      const room = mockRooms.get(code);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
      const player = room.players.find(p => p.id === playerId);
      if (player) player.isReady = true;
      const allReady = room.players.every(p => p.isReady || p.isBot);
      if (allReady) {
        if (room.currentRound < room.totalRounds) {
          room.currentRound += 1;
          room.players = assignRoles(room.players);
        } else {
          room.status = 'finished';
        }
      }
      const sanitized = sanitizeRoomForPlayer(room, playerId);
      return res.status(200).json({ success: true, room: sanitized, allReady });
    }

    let room = await Room.findOne({ code });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // Mark player as ready
    const player = room.players.find(p => p.id === playerId);
    if (player) player.isReady = true;

    // Check if everyone is ready
    const allReady = room.players.every(p => p.isReady || p.isBot);

    if (allReady) {
      if (room.currentRound < room.totalRounds) {
        // Start next round
        room.currentRound += 1;
        const plainPlayers = room.players.map(p => p.toObject());
        room.players = assignRoles(plainPlayers);
        console.log(`Round ${room.currentRound} started in room: ${code}`);
      } else {
        // Game finished
        room.status = 'finished';
      }
    }

    await room.save();
    const sanitized = sanitizeRoomForPlayer(room, playerId);
    res.status(200).json({ success: true, room: sanitized, allReady });
  } catch (error) {
    console.error('Ready error:', error);
    res.status(500).json({ success: false, message: 'Server error marking ready' });
  }
});

// ─── Phase Sync: Player marks ready for a phase ──────────────────────
// FIX BUG-05: Uses atomic $addToSet in DB mode to prevent race conditions
app.post('/api/room/phase-ready', async (req, res) => {
  try {
    const { code, playerId, phase } = req.body;

    if (!code || !playerId || !phase) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    let room;
    if (!DB_READY) {
      room = mockRooms.get(code);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
      
      // Reset if phase changed
      if (room.currentPhase !== phase) {
        room.phaseReadyPlayers = [];
        room.currentPhase = phase;
      }

      // Add player if not already in list (mock $addToSet)
      if (!room.phaseReadyPlayers.includes(playerId)) {
        room.phaseReadyPlayers.push(playerId);
      }
    } else {
      // FIX BUG-05: Atomic operation prevents race condition
      // First, reset phase if it changed
      const currentRoom = await Room.findOne({ code });
      if (!currentRoom) return res.status(404).json({ success: false, message: 'Room not found' });
      
      if (currentRoom.currentPhase !== phase) {
        await Room.updateOne({ code }, { $set: { phaseReadyPlayers: [], currentPhase: phase } });
      }
      
      // Atomic addToSet — even if two requests hit simultaneously,
      // $addToSet guarantees no duplicates and correct count
      room = await Room.findOneAndUpdate(
        { code },
        { $addToSet: { phaseReadyPlayers: playerId } },
        { new: true }
      );
      
      if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Count only human (non-bot) players
    const humanPlayers = room.players.filter(p => !p.isBot);
    const allReady = room.phaseReadyPlayers.length >= humanPlayers.length;

    // If everyone is ready for 'result' phase, transition to 'money' phase
    if (allReady && phase === 'result') {
      console.log(`All players ready for money board in room: ${code}. Transitioning...`);
      room.currentPhase = 'money';
      room.phaseReadyPlayers = [];
      await saveRoom(room);
    }

    // Broadcast personalized update
    broadcastPersonalized(io, code, room);

    // If everyone is ready for 'money' phase, automatically advance to next round
    if (allReady && phase === 'money') {
      console.log(`All players ready for next round in room: ${code}. Advancing...`);
      setTimeout(() => triggerAdvanceRound(code), 500);
    }

    // If everyone is ready for 'leaderboard', mark game as finished
    if (allReady && phase === 'leaderboard') {
      room.status = 'finished';
      await saveRoom(room);
    }

    res.status(200).json({
      success: true,
      allReady: allReady || (phase === 'result' && room.currentPhase === 'money'),
      readyCount: room.phaseReadyPlayers.length,
      totalCount: humanPlayers.length
    });
  } catch (error) {
    console.error('Phase ready error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Phase Status: Poll to check if all players are ready ────────────
app.get('/api/room/:code/phase-status', async (req, res) => {
  try {
    const { code } = req.params;
    const { phase } = req.query;

    const room = await getRoom(code);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const humanPlayers = room.players.filter(p => !p.isBot);
    const isCurrentPhase = room.currentPhase === phase;
    const readyCount = isCurrentPhase ? (room.phaseReadyPlayers || []).length : 0;
    const allReady = isCurrentPhase && readyCount >= humanPlayers.length;

    res.status(200).json({
      success: true,
      allReady,
      readyCount,
      totalCount: humanPlayers.length
    });
  } catch (error) {
    console.error('Phase status error:', error);
    res.status(500).json({ success: false });
  }
});


// ─── Advance Round: Server reshuffles roles ──────────────────────────
app.post('/api/room/advance-round', async (req, res) => {
  try {
    const { code } = req.body;
    const room = await triggerAdvanceRound(code);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.status(200).json({ success: true, room });
  } catch (error) {
    console.error('Advance round error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Extracted internal helper to trigger round advancement
const triggerAdvanceRound = async (code) => {
  try {
    let room = await getRoom(code);
    if (!room) return null;

    // Prevent multiple advancements
    if (room.currentPhase === 'roleReveal' && room.phaseReadyPlayers.length === 0) {
      return room;
    }

    if (room.currentRound >= (room.totalRounds || 5)) {
      room.status = 'finished';
      room.currentPhase = 'leaderboard';
    } else {
      room.currentRound += 1;
      const plainPlayers = DB_READY && room.players[0]?.toObject
        ? room.players.map(p => p.toObject()) 
        : room.players.map(p => ({ ...p }));
      room.players = assignRoles(plainPlayers);
      room.currentPhase = 'roleReveal';
    }

    // Reset phase ready for the new round
    room.phaseReadyPlayers = [];
    room.pendingActions = {};

    await saveRoom(room);
    
    console.log(`Advanced to round ${room.currentRound} in room: ${code}`);
    
    // Broadcast personalized room data (each player sees only their own role)
    broadcastPersonalized(io, code, room, room.currentPhase);
    
    // Also emit new_round with personalized data
    const sockets = io.sockets.adapter.rooms.get(code);
    if (sockets) {
      for (const socketId of sockets) {
        const socket = io.sockets.sockets.get(socketId);
        const playerId = socket?.data?.playerId;
        if (playerId) {
          const sanitized = sanitizeRoomForPlayer(room, playerId, room.currentPhase);
          socket.emit('new_round', { room: sanitized });
        }
      }
    }
    
    return room;
  } catch (error) {
    console.error('Trigger advance round error:', error);
    return null;
  }
};

// ─── CHAT SYNC ───────────────────────────────────────────────────────
app.post('/api/room/chat', async (req, res) => {
  try {
    const { code, message } = req.body;
    
    const room = await getRoom(code);
    if (!room) return res.status(404).json({ success: false });
    
    if (!room.messages) room.messages = [];
    room.messages.push(message);
    if (room.messages.length > 100) room.messages = room.messages.slice(-100);
    
    await saveRoom(room);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Chat post error:', error);
    res.status(500).json({ success: false });
  }
});

app.get('/api/room/:code/chat', async (req, res) => {
  try {
    const { code } = req.params;
    
    const room = await getRoom(code);
    if (!room) return res.status(404).json({ success: false });

    res.status(200).json({ success: true, messages: room.messages || [] });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ─── GAME ACTION (Police Guess) ──────────────────────────────────────
// Unified handler for both mock and DB mode (FIX D04: was duplicated)
app.post('/api/room/action', async (req, res) => {
  try {
    const { code, policeId, targetId } = req.body;

    if (!code || !policeId || !targetId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    let room = await getRoom(code);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    // Validate action
    const police = room.players.find(p => p.id === policeId);
    const target = room.players.find(p => p.id === targetId);

    if (!police || police.role !== 'police') {
      return res.status(400).json({ success: false, message: 'Player is not police' });
    }
    if (!target) {
      return res.status(400).json({ success: false, message: 'Target not found' });
    }
    if (target.role === 'police') {
      return res.status(400).json({ success: false, message: 'Cannot investigate fellow police' });
    }
    if (target.id === policeId) {
      return res.status(400).json({ success: false, message: 'Cannot investigate self' });
    }

    // Store the action
    if (!room.pendingActions) room.pendingActions = {};
    room.pendingActions[policeId] = targetId;

    // Check if all police (human + bot) have acted
    const allPolice = room.players.filter(p => p.role === 'police');
    const humanPolice = allPolice.filter(p => !p.isBot);
    const humanPoliceActed = humanPolice.every(p => room.pendingActions[p.id]);

    if (humanPoliceActed) {
      // Auto-resolve bot police actions
      const botPolice = allPolice.filter(p => p.isBot);
      for (const bot of botPolice) {
        if (!room.pendingActions[bot.id]) {
          const botTarget = botPoliceDecision(room, bot);
          if (botTarget) {
            room.pendingActions[bot.id] = botTarget.id;
          }
        }
      }

      // Now resolve the round
      const result = resolveAction(room);
      room.lastResult = result;
      room.currentPhase = 'result';

      // Add to round history
      if (!room.roundHistory) room.roundHistory = [];
      room.roundHistory.push({ round: room.currentRound, ...result });

      await saveRoom(room);

      // Broadcast result to everyone (result phase = roles revealed)
      broadcastPersonalized(io, code, room, 'result');
      io.to(code).emit('round_result', result);

      return res.status(200).json({ success: true, result });
    }

    // Not all police have acted yet — just save
    await saveRoom(room);
    res.status(200).json({ success: true, waiting: true, message: 'Action recorded, waiting for other police' });
    
  } catch(error) {
    console.error('Action error', error);
    res.status(500).json({ success: false });
  }
});

/**
 * Resolve the round action — computes earnings and events.
 * Shared logic for both mock and DB mode (FIX D04).
 */
function resolveAction(room) {
  const allPolice = room.players.filter(p => p.role === 'police');
  const allThieves = room.players.filter(p => p.role === 'thief');
  
  const earnings = {};
  const events = [];

  // Sprint 3: Round Multiplier
  // Round 1 = 1x, Round 2 = 1.2x, Round 3 = 1.4x ...
  const multiplier = 1 + ((room.currentRound - 1) * 0.2);

  // Fixed income for non-police, non-thief roles
  room.players.forEach(p => {
    if (p.role !== 'thief' && p.role !== 'police') {
      earnings[p.id] = Math.round((ROLE_POINTS[p.role] || 0) * multiplier);
    }
  });

  // Process each police action
  const caughtThieves = new Set();
  const failedPolice = new Set();

  allPolice.forEach(police => {
    const targetId = room.pendingActions[police.id];
    const target = room.players.find(p => p.id === targetId);
    const policeName = police.name || 'Police';
    const targetName = target?.name || '?';

    if (!targetId || !target) {
      failedPolice.add(police.id);
      earnings[police.id] = 0;
      events.push({
        type: 'police_skip',
        text: `Police (${policeName}) didn't investigate anyone!`,
        color: '#3B82F6'
      });
      return;
    }

    if (target.role === 'thief') {
      // Correct guess!
      caughtThieves.add(target.id);
      const policeReward = Math.round(400 * multiplier);
      earnings[police.id] = policeReward;
      earnings[target.id] = 0;
      events.push({
        type: 'police_correct',
        text: `Police (${policeName}) caught ${targetName} the Thief! Earned ₹${policeReward}`,
        color: '#059669'
      });
      events.push({
        type: 'thief_caught',
        text: `The Thief (${targetName}) was caught! Earned ₹0`,
        color: '#DC2626'
      });
    } else {
      // Wrong guess
      failedPolice.add(police.id);
      earnings[police.id] = 0;
      events.push({
        type: 'police_wrong',
        text: `Police (${policeName}) falsely accused ${targetName}!`,
        color: '#DC2626'
      });
    }
  });

  // Award uncaught thieves
  const anyPoliceFailed = failedPolice.size > 0;
  allThieves.forEach(thief => {
    if (!caughtThieves.has(thief.id)) {
      if (anyPoliceFailed) {
        const thiefReward = Math.round(400 * multiplier);
        earnings[thief.id] = thiefReward;
        events.push({
          type: 'thief_escape',
          text: `The real Thief (${thief.name}) escaped with ₹${thiefReward}!`,
          color: '#059669'
        });
      } else {
        earnings[thief.id] = 0;
        events.push({
          type: 'thief_hidden',
          text: `${thief.name} (Thief) was trapped — all Police succeeded!`,
          color: '#6B7280'
        });
      }
    }
  });

  // Determine overall correctness (for the primary police action)
  const primaryPolice = allPolice[0];
  const primaryTarget = room.pendingActions[primaryPolice?.id];
  const isCorrect = allThieves.some(t => t.id === primaryTarget);

  return {
    policeId: primaryPolice?.id,
    targetId: primaryTarget,
    isCorrect,
    earnings,
    events
  };
}

// ─── DISCUSSION PHASE ENTER ──────────────────────────────────────────
app.post('/api/room/enter-discussion', async (req, res) => {
  try {
    const { code } = req.body;
    let room = await getRoom(code);
    if (!room) return res.status(404).json({ success: false });

    // Ensure we only trigger bots once per round
    if (room.currentPhase !== 'discussion') {
      room.currentPhase = 'discussion';
      await saveRoom(room);
      broadcastPhaseChange(io, code, room, 'discussion');
      
      // Ignite AI bots!
      simulateBotDiscussion(io, room);
    }
    
    res.status(200).json({ success: true });
  } catch(error) {
    res.status(500).json({ success: false });
  }
});

// ─── FORCE PHASE ADVANCE (Host or Timer) ─────────────────────────────
app.post('/api/room/force-action', async (req, res) => {
  try {
    const { code } = req.body;
    let room = await getRoom(code);
    if (!room) return res.status(404).json({ success: false });

    // Transition from discussion to action
    room.currentPhase = 'action';
    await saveRoom(room);
    
    // Broadcast transition
    broadcastPhaseChange(io, code, room, 'action');
    res.status(200).json({ success: true, phase: 'action' });
  } catch(error) {
    res.status(500).json({ success: false });
  }
});

// ─── SOCKET.IO SYNC LOGIC ───────────────────────────────────────────
io.on('connection', (socket) => {
  // Join a specific room's channel + store playerId on socket
  socket.on('join_room', (data) => {
    // Support both string (legacy) and object format
    const code = typeof data === 'string' ? data : data?.code;
    const playerId = typeof data === 'object' ? data?.playerId : null;
    
    if (code) {
      socket.join(code);
      if (playerId) {
        socket.data.playerId = playerId;
      }
      console.log(`Socket ${socket.id} joined room ${code}${playerId ? ` as ${playerId}` : ''}`);
    }
  });

  // Handle live chat
  socket.on('send_message', (data) => {
    // Broadcast to everyone else in the room
    io.to(data.code).emit('receive_message', data.message);
  });

  // Handle new game mechanics (Sprint 8: Discussion)
  socket.on('game:claim', (data) => {
    // Broadcast claim to all players
    io.to(data.code).emit('receive_claim', {
      playerId: socket.data.playerId,
      claim: data.claimedRole
    });
  });

  socket.on('game:vote', (data) => {
    // Record accusation/trust locally in memory for now, or just notify others
    io.to(data.code).emit('receive_vote', {
      playerId: socket.data.playerId,
      targetId: data.targetId,
      type: data.type
    });
  });

  // Handle disconnect — mark player as disconnected
  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server & Sockets running on http://localhost:${PORT}`);
});
