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
const io = new Server(server, {
  cors: {
    origin: ["https://raja-rani-game.vercel.app", "https://raja-rani-4dv1.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5001;

// Middleware
// Aggressive CORS for Vercel
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '10kb' })); // Rate limit payload size

let DB_READY = false;
let lastError = null;

// ─── ROUTES ───────────────────────────────────────────────────────────

// Enhanced Status Route
app.get('/api/status', async (req, res) => {
  const state = mongoose.connection.readyState;
  const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
  
  res.json({ 
    status: 'API is running',
    database: state === 1 ? 'Connected ✅' : 'Disconnected ❌',
    database_status: states[state],
    uri_preview: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 15) + '...' : 'MISSING',
    time: new Date().toISOString()
  });
});

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

// Helper to get user (handles both mock and DB mode)
async function getUser(id) {
  if (!DB_READY) {
    if (!mockUsers.has(id)) {
      mockUsers.set(id, {
        id,
        _id: id,
        name: "Guest",
        totalEarnings: 0,
        wins: 0,
        gamesPlayed: 0,
        xp: 0,
        level: 1
      });
    }
    return mockUsers.get(id);
  }
  
  if (mongoose.isValidObjectId(id)) {
    return await User.findById(id);
  }
  return await User.findOne({ googleId: id });
}

// Get room from DB or mock
async function getRoom(code) {
  if (!DB_READY) return mockRooms.get(code) || null;
  return await Room.findOne({ code });
}

// Save room to DB with retry mechanism for VersionErrors
async function saveRoom(room, retries = 3) {
  if (!DB_READY || typeof room.save !== 'function') return;
  
  try {
    room.markModified('players');
    room.markModified('lastResult');
    room.markModified('pendingActions');
    room.markModified('roundHistory');
    room.markModified('phaseReadyPlayers');
    await room.save();
  } catch (err) {
    if (err.name === 'VersionError' && retries > 0) {
      console.warn(`[RETRY] VersionError on room ${room.code}. Retrying... (${retries} left)`);
      // Re-fetch the latest version from DB
      const latest = await Room.findOne({ code: room.code });
      if (latest) {
        // Merge pending changes if necessary, or just apply logic again.
        // For simplicity here, we'll just try to save the current object 
        // after updating its version, but Mongoose usually requires a fresh object.
        // Better: let the caller handle retries if they are doing complex logic.
        // But for most cases, we'll just try once more after a small delay.
        await new Promise(resolve => setTimeout(resolve, 100));
        const freshRoom = await Room.findOne({ code: room.code });
        // Re-apply critical fields from the 'failed' room to the fresh one
        freshRoom.currentPhase = room.currentPhase;
        freshRoom.phaseReadyPlayers = room.phaseReadyPlayers;
        freshRoom.lastResult = room.lastResult;
        freshRoom.pendingActions = room.pendingActions;
        freshRoom.roundHistory = room.roundHistory;
        freshRoom.status = room.status;
        freshRoom.players = room.players;
        return await saveRoom(freshRoom, retries - 1);
      }
    }
    console.error(`❌ SaveRoom Failed: ${err.message}`);
    throw err;
  }
}

// ─── ROLES & GAME ENGINE ──────────────────────────────────────────────

const ROLE_DISTRIBUTIONS = {
  2: ['raja', 'thief'],
  3: ['raja', 'police', 'thief'],
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
  const clamped = Math.min(Math.max(count, 2), 10);
  const roles = [...ROLE_DISTRIBUTIONS[clamped]];


  // 1. Shuffle roles (Fisher-Yates)
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  // 2. Shuffle players list as well to double-randomize
  const shuffledPlayers = [...players];
  for (let i = shuffledPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
  }

  return shuffledPlayers.map((p, i) => ({
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
 * Bot Police AI — uses difficulty settings to make smarter decisions
 */
function botPoliceDecision(room, botPlayer) {
  const difficulty = room.botDifficulty || 'rookie';
  let suspects = room.players.filter(p => p.id !== botPlayer.id && p.role !== 'police');
  if (suspects.length === 0) return null;

  // Pro/Expert bots are smart enough to know the Raja is never the thief
  if (difficulty === 'pro' || difficulty === 'expert') {
    suspects = suspects.filter(p => p.role !== 'raja');
  }

  if (suspects.length === 0) return room.players.find(p => p.id !== botPlayer.id); // fallback

  if (difficulty === 'expert') {
    // Expert bots target the richest players (who likely win a lot)
    // or players who have been thief often.
    const history = room.roundHistory || [];
    const thiefCounts = {};
    suspects.forEach(s => { thiefCounts[s.id] = 0; });
    
    history.forEach(round => {
      if (round.targetId && suspects.find(s => s.id === round.targetId) && round.isCorrect) {
        thiefCounts[round.targetId] = (thiefCounts[round.targetId] || 0) + 1;
      }
    });

    // We also look at their overall score for the current match if available
    const scores = room.totals || {};
    
    suspects.sort((a, b) => {
      const aDanger = (thiefCounts[a.id] || 0) * 1000 + (scores[a.id] || 0);
      const bDanger = (thiefCounts[b.id] || 0) * 1000 + (scores[b.id] || 0);
      return bDanger - aDanger; // Descending order of danger
    });

    // 80% chance to pick the most "dangerous" suspect
    if (Math.random() < 0.8) return suspects[0];
  }

  // Default/Rookie/Fallback behavior: random selection among valid suspects
  return suspects[Math.floor(Math.random() * suspects.length)];
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
    
    const user = await getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.totalEarnings = (user.totalEarnings || 0) + Number(earnings || 0);
    user.gamesPlayed = (user.gamesPlayed || 0) + 1;
    if (isWin) user.wins = (user.wins || 0) + 1;

    if (DB_READY && typeof user.save === 'function') {
      await user.save();
    } else {
      mockUsers.set(userId, user);
    }
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
    
    const user = await getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});

// ─── Phase 3: Global Leaderboard ─────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const tab = req.query.tab || 'earnings';
    let sortField = { totalEarnings: -1 };
    if (tab === 'wins')  sortField = { wins: -1 };
    if (tab === 'level') sortField = { level: -1, xp: -1 };

    const users = await User.find({})
      .sort(sortField)
      .limit(20)
      .select('name picture totalEarnings wins gamesPlayed elo xp level policeCorrect thiefEscapes createdAt')
      .lean();

    const ranked = users.map((u, i) => ({
      rank:          i + 1,
      id:            u._id.toString(),
      name:          u.name,
      picture:       u.picture || null,
      totalEarnings: u.totalEarnings || 0,
      wins:          u.wins || 0,
      gamesPlayed:   u.gamesPlayed || 0,
      elo:           u.elo || 1200,
      xp:            u.xp || 0,
      level:         u.level || 1,
      policeCorrect: u.policeCorrect || 0,
      thiefEscapes:  u.thiefEscapes || 0,
      winRate:       u.gamesPlayed > 0 ? Math.round((u.wins / u.gamesPlayed) * 100) : 0,
    }));

    res.json({ success: true, tab, players: ranked });
  } catch (err) {
    console.error('[LEADERBOARD] Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Phase 4: Store & Monetization ───────────────────────────
app.post('/api/store/purchase', async (req, res) => {
  try {
    const { userId, itemId, price } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.rajaCoins < price) {
      return res.status(400).json({ message: "Not enough Raja Coins" });
    }

    if (user.ownedCosmetics.includes(itemId)) {
      return res.status(400).json({ message: "Item already owned" });
    }

    user.rajaCoins -= price;
    user.ownedCosmetics.push(itemId);
    await user.save();

    res.json({ success: true, coins: user.rajaCoins, owned: user.ownedCosmetics });
  } catch (err) {
    console.error('[STORE] Purchase Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/store/equip', async (req, res) => {
  try {
    const { userId, itemId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.ownedCosmetics.includes(itemId)) {
      return res.status(400).json({ message: "Item not owned" });
    }

    user.equippedCosmetic = itemId;
    await user.save();

    res.json({ success: true, equipped: user.equippedCosmetic });
  } catch (err) {
    console.error('[STORE] Equip Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- ROOM MANAGEMENT ROUTES ---

// Create Room
app.post('/api/room/create', async (req, res) => {
  try {
    const { code, hostId, hostName, totalRounds, botDifficulty } = req.body;

    if (!code || !hostId || !hostName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    if (!DB_READY) {
      const room = {
        code,
        hostId,
        totalRounds: totalRounds || 5,
        botDifficulty: botDifficulty || 'rookie',
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
      botDifficulty: botDifficulty || 'rookie',
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

// Add Bot to Room
app.post('/api/room/add-bot', async (req, res) => {
  try {
    const { code, bot } = req.body;
    if (!code || !bot) return res.status(400).json({ success: false, message: 'Missing fields' });

    let room = await getRoom(code);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    if (room.players.length >= 10) {
      return res.status(400).json({ success: false, message: 'Room full' });
    }

    // Ensure unique name
    let name = bot.name;
    let nameCounter = 1;
    while (room.players.find(p => p.name === name)) {
      const baseName = bot.name.split(' ')[0];
      name = `${baseName} ${nameCounter++}`;
    }

    // Add bot to players list
    room.players.push({
      ...bot,
      name,
      isBot: true,
      isReady: true // Bots are always ready
    });

    await saveRoom(room);
    
    // Broadcast update
    broadcastPersonalized(io, code, room);
    
    res.status(200).json({ success: true, room: sanitizeRoomForPlayer(room, room.hostId) });
  } catch (err) {
    console.error('Add bot error:', err);
    res.status(500).json({ success: false });
  }
});

// ─── QUICK MATCH (Matchmaking - Sprint 5) ───────────────────────────
app.post('/api/room/quick-match', async (req, res) => {
  try {
    const { playerId, playerName } = req.body;
    console.log(`[QUICK-MATCH] Request from ${playerName} (${playerId})`);
    if (!playerId) return res.status(400).json({ success: false, message: 'Missing playerId' });

    let roomCode = null;
    
    // Find an open room that is still in "lobby" and has space
    if (DB_READY) {
      const openRoom = await Room.findOne({ status: 'lobby', 'players.3': { $exists: false } }).sort({ createdAt: -1 });
      if (openRoom) roomCode = openRoom.code;
    } else {
      for (const [code, r] of mockRooms.entries()) {
        if (r.status === 'lobby' && r.players.length < 4) {
          roomCode = code;
          break;
        }
      }
    }

    // If no room found, CREATE ONE instead of failing! (FIX Q01)
    if (!roomCode) {
      console.log(`No open lobby for Quick Play. Creating new one for ${playerName}`);
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      let newRoomData = {
        code: roomCode,
        hostId: playerId,
        hostName: playerName,
        status: 'playing', // Start immediately
        players: [{ id: playerId, name: playerName, isHost: true, isReady: true, colorIndex: 0 }],
        currentRound: 1,
        totalRounds: 5,
        currentPhase: 'roleReveal',
        createdAt: new Date(),
        roundHistory: [],
        pendingActions: {}
      };

      // Auto-add 3 bots for an instant 4-player game (Sprint 5 Feature)
      const botNames = ["Arjun", "Zara", "Vikram", "Ishita", "Rahul", "Priya"];
      for (let i = 0; i < 3; i++) {
        const botName = botNames[Math.floor(Math.random() * botNames.length)] + " (AI)";
        newRoomData.players.push({
          id: `bot_${Math.random().toString(36).substr(2, 9)}`,
          name: botName,
          isBot: true,
          isReady: true,
          colorIndex: i + 1
        });
      }

      // Assign roles authoritatively
      newRoomData.players = assignRoles(newRoomData.players);

      if (DB_READY) {
        await new Room(newRoomData).save();
      } else {
        mockRooms.set(roomCode, newRoomData);
      }
    }

    res.status(200).json({ success: true, code: roomCode });
  } catch (err) {
    console.error('Quick match error:', err);
    res.status(500).json({ success: false, message: 'Matchmaking failed' });
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

        // --- MATCHMAKING & ELO ENGINE (Sprint 4 & 5) ---
        if (DB_READY) {
          try {
            // Calculate totals from history
            const totals = {};
            room.roundHistory.forEach(rh => {
              if (rh.earnings) {
                Object.entries(rh.earnings).forEach(([id, amt]) => {
                  totals[id] = (totals[id] || 0) + amt;
                });
              }
            });
            
            // Sort to find winners
            const sorted = Object.keys(totals)
              .map(id => ({ id, score: totals[id] }))
              .sort((a,b) => b.score - a.score);
            
          // Apply standard +/- Elo based on rank + Phase 2 XP
          const XP_REWARDS = { GAME_PLAYED: 10, WIN_GAME: 50, CATCH_THIEF: 30, ESCAPE_AS_THIEF: 25 };
          const LEVEL_THRESHOLDS = [0,100,250,450,700,1000,1400,1900,2500,3200,4000,5000,6200,7600,9200,11000,13000,15500,18500,22000,26000,31000,37000,44000,52000,61000,72000,85000,100000,120000];
          const getLevelFromXP = (xp) => {
            let level = 1;
            for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
              if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
              else break;
            }
            return Math.min(level, LEVEL_THRESHOLDS.length);
          };

          // Build per-round catch/escape tallies
          const policeCatches  = {};
          const thiefEscapes   = {};
          room.roundHistory.forEach(rh => {
            if (rh.isCorrect && rh.policeId && !rh.policeId.startsWith('bot_')) {
              policeCatches[rh.policeId] = (policeCatches[rh.policeId] || 0) + 1;
            }
            if (!rh.isCorrect && rh.thiefId && !rh.thiefId.startsWith('bot_')) {
              thiefEscapes[rh.thiefId] = (thiefEscapes[rh.thiefId] || 0) + 1;
            }
          });

          for (let i = 0; i < sorted.length; i++) {
             const player = sorted[i];
             if (player.id.startsWith('bot_')) continue;

             const user = await User.findById(player.id).catch(() => null);
             if (user) {
               const rank = i + 1;
               let eloChange = -20;
               if (rank === 1) eloChange = 30;
               else if (rank === 2) eloChange = 10;
               else if (rank === 3) eloChange = -5;

               user.elo = (user.elo || 1200) + eloChange;
               if (rank === 1) user.wins = (user.wins || 0) + 1;
               user.gamesPlayed    = (user.gamesPlayed || 0) + 1;
               user.totalEarnings  = (user.totalEarnings || 0) + player.score;
               user.policeCorrect  = (user.policeCorrect || 0) + (policeCatches[player.id] || 0);
               user.thiefEscapes   = (user.thiefEscapes || 0) + (thiefEscapes[player.id] || 0);
               user.highestRoundEarning = Math.max(user.highestRoundEarning || 0, player.score);

               // Award XP & Coins
               let gainedXP = XP_REWARDS.GAME_PLAYED;
               let gainedCoins = 15; // GAME_PLAYED
               
               if (rank === 1) {
                 gainedXP += XP_REWARDS.WIN_GAME;
                 gainedCoins += 50; // WIN_GAME
               }
               
               const catches = (policeCatches[player.id] || 0);
               const escapes = (thiefEscapes[player.id] || 0);
               
               gainedXP += catches * XP_REWARDS.CATCH_THIEF;
               gainedXP += escapes * XP_REWARDS.ESCAPE_AS_THIEF;
               gainedCoins += catches * 20; // CATCH_THIEF
               gainedCoins += escapes * 25; // ESCAPE_AS_THIEF

               user.xp = (user.xp || 0) + gainedXP;
               user.level = getLevelFromXP(user.xp);
               user.rajaCoins = (user.rajaCoins || 0) + gainedCoins;

               await user.save();
               console.log(`[REWARDS] ${user.name}: +${gainedXP} XP → Lv ${user.level} | +${gainedCoins} Coins`);
             }
          }
          } catch (eloErr) {
            console.error('Elo calculation failed:', eloErr);
          }
        }
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
        console.log(`[PHASE-RESET] Room ${code} moving from ${currentRoom.currentPhase} to ${phase}. Clearing ready players.`);
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
    const readyCount = room.phaseReadyPlayers.length;
    const allReady = readyCount >= humanPlayers.length;

    console.log(`[PHASE-READY] Room: ${code}, Phase: ${phase}, Ready: ${readyCount}/${humanPlayers.length}, AllReady: ${allReady}`);

    // If everyone is ready for 'action' phase (meaning non-police clicked Continue),
    // and all human police have acted, trigger resolution.
    if (allReady && phase === 'action') {
      const allPolice = room.players.filter(p => p.role === 'police');
      const humanPolice = allPolice.filter(p => !p.isBot);
      
      // A human police has "acted" if they submitted an action OR if they just clicked Continue (skip)
      const humanPoliceActed = humanPolice.every(p => {
        const hasAction = room.pendingActions && room.pendingActions[p.id];
        const isReady = room.phaseReadyPlayers.includes(p.id);
        return hasAction || isReady;
      });

      if (humanPoliceActed) {
        console.log(`All humans ready/acted in action phase for room: ${code}. Resolving...`);
        
        // Auto-resolve bot police
        const botPolice = allPolice.filter(p => p.isBot);
        for (const bot of botPolice) {
          if (!room.pendingActions[bot.id]) {
            const botTarget = botPoliceDecision(room, bot);
            if (botTarget) room.pendingActions[bot.id] = botTarget.id;
          }
        }

        const result = resolveAction(room);
        room.lastResult = result;
        room.currentPhase = 'result';
        room.phaseReadyPlayers = [];
        if (!room.roundHistory) room.roundHistory = [];
        room.roundHistory.push({ round: room.currentRound, ...result });

        await saveRoom(room);
        broadcastPersonalized(io, code, room, 'result');
        io.to(code).emit('round_result', result);
      }
    }

    // If everyone is ready for 'result' phase, automatically advance to next round
    if (allReady && phase === 'result') {
      console.log(`All players ready for next round in room: ${code}. Advancing from result...`);
      // Double check if we should go to leaderboard instead
      if (room.currentRound >= (room.totalRounds || 5)) {
         room.currentPhase = 'leaderboard';
         room.status = 'finished';
         await saveRoom(room);
         broadcastPhaseChange(io, code, room, 'leaderboard');
         broadcastPersonalized(io, code, room, 'leaderboard');

      } else {
         setTimeout(async () => {
           await triggerAdvanceRound(code);
         }, 500);
      }
    }

    // Handle leaderboard finish
    if (allReady && phase === 'leaderboard') {
      room.status = 'finished';
      await saveRoom(room);
    }

    res.status(200).json({
      success: true,
      allReady: allReady,
      readyCount: readyCount,
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

const advancingRooms = new Set();

// Extracted internal helper to trigger round advancement
const triggerAdvanceRound = async (code) => {
  if (advancingRooms.has(code)) return null;
  advancingRooms.add(code);

  try {
    let room = await getRoom(code);
    if (!room) {
      advancingRooms.delete(code);
      return null;
    }

    // Prevent multiple advancements
    if (room.currentPhase === 'roleReveal' && room.phaseReadyPlayers.length === 0) {
      return room;
    }

    if (room.currentRound >= (room.totalRounds || 5)) {
      room.status = 'finished';
      room.currentPhase = 'leaderboard';
      await saveRoom(room);
      broadcastPhaseChange(io, code, room, 'leaderboard');
      broadcastPersonalized(io, code, room, 'leaderboard');
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
    
    advancingRooms.delete(code);
    return room;
  } catch (error) {
    console.error('Trigger advance round error:', error);
    advancingRooms.delete(code);
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

    if (target && target.role === 'thief') {
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

// Only start server if not in a serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`🚀 Server & Sockets running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
