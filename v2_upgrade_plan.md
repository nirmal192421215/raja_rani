# 👑 Raja Rani: Money War (V2 Architecture)
**Master Production Roadmap & Architecture Blueprint**

---

As a senior backend architect and game designer, I’ve analyzed the current `Raja Rani: Money War` system. While the MVP is visually striking with its Framer Motion physical cards and Glassmorphism UI, a polling-based, client-trusting architecture will collapse under production scale.

To scale to 1M+ users, we must migrate from **Client-Authoritative Polling** to **Server-Authoritative WebSockets**. 

Here is your complete production-level upgrade plan.

---

## 🚨 PART 1: Fixing Current Critical Bugs

### BUG 1: Result Sync Issue (Police Guess Desync)
**The Problem:** Currently, the "Police" action (guessing the thief) is handled locally. Only the person guessing (or the host) calculates the result, leading to massive desyncs where other players never see the outcome.
**The Fix:** Move `resolveRound` entirely to the Backend. The client only sends the "Action". The Server broadcasts the "Result".

```javascript
// SERVER-SIDE: index.js (Action Handler)
app.post('/api/room/action', async (req, res) => {
  const { code, policeId, targetId } = req.body;
  let room = await Room.findOne({ code });
  
  // 1. Backend resolves the logic
  const thief = room.players.find(p => p.role === 'thief');
  const isCorrect = (targetId === thief.id);

  // 2. Compute Earnings
  const earnings = isCorrect ? { [policeId]: +300, [thief.id]: 0 } : { [policeId]: 0, [thief.id]: +300 };

  // 3. Store result firmly in the Room object
  room.lastResult = {
    policeId,
    targetId,
    isCorrect,
    earnings
  };
  room.currentPhase = 'result';
  await room.save();
  
  res.json({ success: true, result: room.lastResult });
});
```

### BUG 2: Game Earnings Not Saving
**The Problem:** Relying on the React frontend to run `updateStats()` loop is insecure (hackable) and unreliable (users close the tab before it fires).
**The Fix:** The Server updates Mongoose when the game officially hits `currentRound > totalRounds`.

```javascript
// SERVER-SIDE: Room Advance Logic
if (room.currentRound >= room.totalRounds) {
  room.status = 'finished';
  // Compute final leaderboard array map...
  
  // Batch update Mongoose Users securely
  const bulkOps = rankings.map(player => ({
    updateOne: {
      filter: { googleId: player.id },
      update: { 
        $inc: { totalEarnings: player.totalMoney, gamesPlayed: 1 },
        $inc: { wins: player.rank === 1 ? 1 : 0 } // Win tracking
      }
    }
  }));
  await User.bulkWrite(bulkOps);
}
```

### BUG 3 & 4: Chat Sync & Leaderboard Fails
**The Problem:** Unidirectional HTTP polling causes missed messages (race conditions) and slow UI updates. Unsynchronized sorting algorithms on the frontend cause leaderboard splits.
**The Fix:** Moving to **Socket.IO** (detailed below) instantly obliterates both issues by maintaining a single source of truth.

---

## ⚡ PART 2: Realtime Architecture Upgrade (Socket.IO)

HTTP polling (`setInterval`) destroys batteries, consumes massive server RAM, and caps your CCU (Concurrent Users). You must swap to `Socket.IO`.

### 1. Server Setup
```bash
npm install socket.io
```
```javascript
// server.js
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  // 1. Join Room
  socket.on('join_room', (code) => {
    socket.join(code);
  });

  // 2. Chat Sync (Instantly broadcasts to everyone else)
  socket.on('send_message', (data) => {
    io.to(data.code).emit('receive_message', data.message);
  });

  // 3. Game Action
  socket.on('police_action', async (data) => {
    const result = await processActionInDB(data);
    io.to(data.code).emit('round_result', result); // Everyone sees it at the exact same ms
  });
});
```

### 2. Event Flow
1. **Connect:** React mounts `const newSocket = io("http://localhost:5001");`
2. **Phase Shift:** Host clicks 'Next Round' -> Server computes -> emits `phase_change` -> All local React states update simultaneously.

---

## 🛡️ PART 3: Gameplay Enhancements

To retain users past the first 3 days, the core loop needs evolution:
1. **The 'Spy' Role:** A new role that knows who the Thief is, but if the Thief figures out who the Spy is, the Spy loses all their points.
2. **Discussion Phase (Voting):** Add a 30-second timer where everyone debates in chat before the Police locks in a guess. (Among Us style).
3. **Double or Nothing Events:** At Round 3, trigger a random global event ("Market Crash: All roles are worth half points") to break gameplay monotony.

---

## 📈 PART 4: Feature Additions (Scale to 1M)

1. **Global Elo Ranking System (SBMM):** 
   Replace basic "earnings" with an Elo rating (Bronze, Silver, Gold, Raja Tier). Standard Matchmaking (queueing without code) pits players against similar Elo.
2. **Anti-Cheat Validation:**
   Never send the identity of the 'Thief' to the clients of other players. Only the backend knows it. Erase `role: 'thief'` from the broadcasted `players` array for everyone except the Thief to prevent players inspecting Network Requests to cheat.
3. **Player Progression (The Kingdom Level):**
   Earn XP per game to upgrade your Kingdom (a visually upgrading 3D Castle on the home screen).

---

## 🎨 PART 5: UI/UX & Game Feel

* **Hit-Stop & Screen Shake:** Using `framer-motion`, when the Police guesses wrong, pause all animations for 0.4s (hit-stop), play a heavy bass shatter sound, and physically shake the entire DOM.
* **Card Peeking:** Allow players to "drag down" slightly on their role card to peek at it dynamically using Framer Motion `drag="y" dragConstraints={{top: 0, bottom: 50}}`.
* **Particle Exhaustions:** When money is lost, spawn minus-red particle text floating upwards off the podium avatars.

---

## 💰 PART 6: Monetization Strategy

1. **The Casino Chip Economy:** 
   Rename "Earnings" to actual Chips. Players get 5,000 free chips a day. To play in "High Roller Rooms", you must wager your own chips. Run out? Watch an Ad or buy chips via Stripe.
2. **Custom Card Backs:** 
   Allow players to buy premium neon, hologram, and dark-matter card skins.
3. **Animated Emojis/Voices:**
   Monetize the Chat Box by selling custom voice-line packs ("Raja commands it!" audio clip) and animated VIP emojis.

---

## 🚀 PART 7: Viral Growth Mechanisms

1. **Discord Webhooks:** Allow users to instantly pipe room codes to discord channels directly from the lobby via OAuth.
2. **Bounty System:** If a player is on a 5-win streak, they get a "Bounty" crown. Anyone in matchmaking who gets in their game and beats them gets double points, incentivizing highly contested games.

---

## 📂 Implementation Guidance & Folder Structure

Refactor your Vite React structure to scale:
```text
/src
  /hooks       (useSocket.js, useAudio.js)
  /context     (AuthContext.js, RealmContext.js)
  /services    (api.js, socketEvents.js)
  /components
    /ui        (Buttons, Modals, Inputs)
    /game      (Card3D.jsx, Podium.jsx)
  /screens
  /assets      (SFX, Lotties)
```

**Next Immediate Steps:**
1. Do not add any more features until **Socket.IO** replaces HTTP polling. 
2. Shift the **Police logic** entirely to the backend route to permanently fix Desyncs. 
3. Launch Version 2.0.
