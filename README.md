# 👑 Raja Rani: Money War (Ultra-Premium Edition)
**AI Knowledge Base & Developer Documentation**

Welcome to the central architectural document for **Raja Rani: Money War**. This manual is explicitly designed to be read by future iterations of AI Assistants to quickly gain deep project context for implementing future features, scaling the backend, or adding new animations.

---

## 🎨 1. General Aesthetic & Design Philosophy
This application operates strictly under a "Casino Table / Dark Mode Glassmorphism" aesthetic. 
* **DO NOT** use generic flat colors.
* **Core Palette:** Navy/Black backgrounds (`#0a0c10`), Royal Gold accents (`#D4AF37`, `#FFD700`), glowing drop shadows, and heavily blurred translucent cards (Glassmorphism).
* **Animations:** All cards and screen entrances rely on GPU-accelerated **Framer Motion**. Do not use standard CSS transitions for complex 3D flips or bounces.
* **CSS System:** Vanilla CSS strictly. **No Tailwind CSS**. We use explicit variable-based class architectures (e.g., `game-card--lg`, `btn--gold`) stored globally in `index.css`.

---

## 🏗️ 2. Tech Stack Setup
* **Frontend Workflow:** React 18 / Vite (`npm run dev` running on `:5173`)
* **Animation Library:** `framer-motion` (for physics, springs, and SVG drawing)
* **Backend Runtime:** Node.js / Express (`nodemon` running on `:5001`)
* **Database / ORM:** MongoDB Atlas / Mongoose
* **Auth:** Google OAuth 2.0 (`@react-oauth/google`) + Custom Guest Auth

---

## ⚙️ 3. Backend Architecture 
The backend handles real-time lobby and phase synchronization through **Short-Polling REST APIs** rather than WebSockets. Since Vercel/Serverless deployment was kept in mind, standard polling ensures zero broken pipe errors.

### Failures & Fallback (Mock Mode)
The server contains an ultra-robust **Memory Mock Mode** (`DB_READY` flag). If MongoDB Atlas fails to cluster or the string is broken, `index.js` transparently falls back to storing Users and Rooms inside Node's native `Map()` memory limitlessly. 

**Critical Core Endpoints:**
* `POST /api/auth/login`: Handles Google OAuth tokens or issues temporary Guest ID tokens.
* `POST /api/room/create` | `POST /api/room/join`: Instantiates the game array (`assignRoles()`).
* `GET /api/room/:code`: (Polled at `2500ms`) Fetches the overall array of players/metadata.
* `POST /api/room/phase-ready`: The universal "Continue" pipeline. Determines when humans are ready for the next screen.
* `GET /api/room/:code/phase-status`: Polls `allReady` status dynamically.
* `POST /api/room/advance-round`: Instructs the server to physically execute `assignRoles()` and increment round loops.
* `POST /api/room/chat` | `GET /api/room/:code/chat`: Networked Live-Chat (polled).

---

## ⚛️ 4. Frontend Architecture & Game Loop
The entire logic is wrapped in `GameContext.jsx` which functions as a Redux-lite global store. 
All math, ranking, and point distribution resides immutably in `GameEngine.js`.

### The Client Phase Flow (`App.jsx` + `GameContext.jsx`)
1. **`/login`** – Guest/Google Auth.
2. **`/home`** – Main Dashboard (Room creation, user profile stats fetched here).
3. **`/lobby`** – Room gathering. Players array is synced via polling from `index.js`.
4. **`/role-reveal`** – Uses Framer Motion to 3D flip card roles. Displays standard "Raja, Rani, Police, Thief..."
5. **`/action`** – Only the "Police" actor makes a choice guessing who the Thief is. Triggers local CSS Screen Shake.
6. **`/result`** – Wait screen displaying the immediate results of the Police guess.
7. **`/money`** – Computes Round earnings vs. Total Earnings. Waits for every tab to click "Next" before triggering `advance-round` via the Server.
8. **`/leaderboard`** – Dispatched only when `currentRound >= totalRounds`. Renders the 3D staggered Podium UI.

---

## 🎴 5. The Cards & Roles Data Object
We utilize 7 customized graphic cards situated in `multi/public/cards/*.png`. 

**The Hierarchy:**
1. **Raja** (👑 1000 pts)
2. **Rani** (👸 800 pts)
3. **Mantri** (🛡️ 700 pts)
4. **Soldier** (⚔️ 600 pts)
5. **Milkman** (🥛 500 pts)
6. **Gardener** (🌿 400 pts)
7. **Police** (👮 300 pts)
    * **Crucial Rule:** If Police guesses who the Thief is correctly, Police gets 300 points and Thief receives 0. If Police fails, Thief steals the 300 points.
8. **Thief** (🦹 0 pts)

**Role Distributions (`index.js:ROLE_DISTRIBUTIONS`):**
Math dictates that smaller lobbies receive fewer core roles. 4 Players = Raja, Rani, Police, Thief. Additional players unlock the Mantri, Soldier, Milkman respectively.

---

## 🛠️ 6. Guidelines for Future AI Extensions
If you (the next AI Model interacting with this workspace) are asked to expand the app, use these exact rules:
1. **Never break `GameContext.jsx` Reducer loop:** Modifying `state` directly will wreck React Reactivity. Strictly use dispatched `ACTIONS`.
2. **When scaling Realtime:** If upgrading to `Socket.io`, remember to obliterate the `interval` blocks in `ChatBox.jsx` and `MoneyScreen.jsx`, replacing them with `socket.on()`.
3. **Card Modals:** If users want new cards, you *must* add them linearly to `GameEngine.js`, the `ROLES` object, mapping it accurately in `CardComponent.jsx`, and updating `ROLE_DISTRIBUTIONS` on the server so it doesn't crash player arrays.
4. **Check CSS Global Values First:** Always examine `:root` in `index.css` before writing hardcoded colors or box-shadows.

> *End of document. Happy Coding.* 🚀
