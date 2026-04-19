// =============================================
// RAJA RANI: MONEY WAR — Room Sanitization
// Prevents role data from leaking to clients
// =============================================

/**
 * Visibility rules — what each player can see during each phase.
 * This is the CORE anti-cheat mechanism.
 */
const VISIBILITY_RULES = {
  lobby:      { ownRole: false, otherRoles: false, result: false },
  roleReveal: { ownRole: true,  otherRoles: false, result: false },
  discussion: { ownRole: true,  otherRoles: false, result: false },
  action:     { ownRole: true,  otherRoles: false, result: false },
  resolving:  { ownRole: true,  otherRoles: false, result: false },
  result:     { ownRole: true,  otherRoles: true,  result: true  },
  money:      { ownRole: true,  otherRoles: true,  result: true  },
  leaderboard:{ ownRole: true,  otherRoles: true,  result: true  },
  playing:    { ownRole: true,  otherRoles: false, result: false },
};

/**
 * Sanitize a room object for a specific player.
 * Strips role data from other players when they shouldn't see it.
 * 
 * @param {Object} room - The full room object
 * @param {string} requesterId - The ID of the player requesting the data
 * @param {string} [phaseOverride] - Force a specific phase for visibility rules
 * @returns {Object} Sanitized room safe to send to the client
 */
function sanitizeRoomForPlayer(room, requesterId, phaseOverride) {
  // Deep clone to avoid mutating the original
  const roomObj = typeof room.toObject === 'function' ? room.toObject() : JSON.parse(JSON.stringify(room));
  
  const phase = phaseOverride || roomObj.currentPhase || 'lobby';
  const rules = VISIBILITY_RULES[phase] || VISIBILITY_RULES.lobby;

  // Sanitize players array
  roomObj.players = roomObj.players.map(p => {
    // Player can always see their own role (if the phase allows)
    if (p.id === requesterId && rules.ownRole) {
      return p;
    }

    // Other players' roles visible during result/money/leaderboard phases
    if (p.id !== requesterId && rules.otherRoles) {
      return p;
    }

    // Strip sensitive role information
    const { role, roleData, ...safePlayer } = p;
    return safePlayer;
  });

  // Strip result data if not in result phase
  if (!rules.result) {
    delete roomObj.lastResult;
  }

  return roomObj;
}

/**
 * Broadcast personalized room data to each player via Socket.IO.
 * Each player receives a sanitized view showing only their own role.
 */
function broadcastPersonalized(io, code, room, phaseOverride) {
  const sockets = io.sockets.adapter.rooms.get(code);
  if (!sockets) return;

  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    const playerId = socket?.data?.playerId;
    if (playerId) {
      const sanitized = sanitizeRoomForPlayer(room, playerId, phaseOverride);
      socket.emit('room_update', sanitized);
    }
  }
}

/**
 * Broadcast personalized phase change to each player.
 */
function broadcastPhaseChange(io, code, room, phase) {
  const sockets = io.sockets.adapter.rooms.get(code);
  if (!sockets) return;

  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    const playerId = socket?.data?.playerId;
    if (playerId) {
      const sanitized = sanitizeRoomForPlayer(room, playerId, phase);
      socket.emit('phase_change', { phase, room: sanitized });
    }
  }
}

module.exports = { sanitizeRoomForPlayer, broadcastPersonalized, broadcastPhaseChange };
