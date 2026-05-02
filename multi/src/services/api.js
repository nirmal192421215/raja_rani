// =============================================
// RAJA RANI: MONEY WAR — API Configuration
// Single source of truth for all API URLs
// =============================================

// HARDCODED FOR PRODUCTION STABILITY
export const API_BASE = 'https://raja-rani-nirmal192421215s-projects.vercel.app';

// Auth
export const API_LOGIN = `${API_BASE}/api/auth/login`;

// User
export const API_USER_STATS = `${API_BASE}/api/user/stats`;
export const API_USER_PROFILE = (userId) => `${API_BASE}/api/user/profile/${userId}`;

// Room
export const API_ROOM_CREATE      = `${API_BASE}/api/room/create`;
export const API_ROOM_JOIN        = `${API_BASE}/api/room/join`;
export const API_ROOM_QUICK_MATCH = `${API_BASE}/api/room/quick-match`;
export const API_ROOM_GET         = (code, playerId) =>
  `${API_BASE}/api/room/${code}${playerId ? `?playerId=${playerId}` : ''}`;
export const API_ROOM_START       = `${API_BASE}/api/room/start`;
export const API_ROOM_READY       = `${API_BASE}/api/room/ready`;
export const API_ROOM_ACTION      = `${API_BASE}/api/room/action`;
export const API_ROOM_ADVANCE     = `${API_BASE}/api/room/advance-round`;
export const API_ROOM_PHASE_READY = `${API_BASE}/api/room/phase-ready`;
export const API_ROOM_PHASE_STATUS = (code, phase) =>
  `${API_BASE}/api/room/${code}/phase-status?phase=${phase}`;
export const API_ROOM_ADD_BOT     = `${API_BASE}/api/room/add-bot`;

// Chat
export const API_CHAT_SEND = `${API_BASE}/api/room/chat`;
export const API_CHAT_GET  = (code) => `${API_BASE}/api/room/${code}/chat`;

// Phase 3: Social
export const API_GLOBAL_LEADERBOARD = (tab = 'earnings') => `${API_BASE}/api/leaderboard?tab=${tab}`;

// Phase 4: Store & Monetization
export const API_STORE_PURCHASE = `${API_BASE}/api/store/purchase`;
export const API_STORE_EQUIP    = `${API_BASE}/api/store/equip`;
