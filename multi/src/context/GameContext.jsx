// =============================================
// RAJA RANI: MONEY WAR — Game Context
// =============================================

import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import { io } from 'socket.io-client';
import {
  generateRoomCode, assignRoles, resolveRound,
  calculateTotals, getRankings, getRoleById, BOT_NAMES, getAvatarColor,
} from '../engine/GameEngine';
import { generateBotActions } from '../engine/BotSimulator';
import {
  API_BASE, API_LOGIN, API_USER_STATS,
  API_ROOM_CREATE, API_ROOM_JOIN, API_ROOM_GET,
  API_ROOM_START, API_ROOM_ACTION,
  API_ROOM_PHASE_READY, API_ROOM_PHASE_STATUS,
} from '../services/api';

// ─── Shared Socket (singleton — FIX BUG-03) ─────────────────────────
// Both GameContext and ChatBox must use the SAME socket connection.
let sharedSocket = null;

export function getSharedSocket() {
  if (!sharedSocket) {
    sharedSocket = io(API_BASE, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      autoConnect: false, // Don't connect until login
    });
  }
  return sharedSocket;
}

const GameContext = createContext(null);

// --- Initial State ---
const getInitialUser = () => {
  try {
    const saved = localStorage.getItem('rr_user');
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.warn("Failed to parse user from localStorage", e);
    return null;
  }
};

const initialState = {
  // Auth
  user: getInitialUser(),

  // Room
  room: null, // { code, hostId, totalRounds, maxPlayers }
  players: [],

  // Game
  phase: 'idle', // idle, lobby, roleReveal, action, waiting, result, money, leaderboard
  currentRound: 0,
  totalRounds: 5,

  // Round data
  policeActions: {},
  roundResult: null,
  roundHistory: [],
  totals: {},
  rankings: [],

  // UI
  isHost: false,
  myPlayerId: null,
  reshuffleNotice: false,
};

// --- Action Types ---
const ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE_ROOM: 'CREATE_ROOM',
  JOIN_ROOM: 'JOIN_ROOM',
  ADD_BOT: 'ADD_BOT',
  REMOVE_PLAYER: 'REMOVE_PLAYER',
  // FIX BUG-02: Removed START_GAME (client-side role assignment).
  // Only SYNC_GAME_START (server-assigned roles) should be used.
  SYNC_GAME_START: 'SYNC_GAME_START',
  SYNC_NEXT_ROUND: 'SYNC_NEXT_ROUND',
  SET_PHASE: 'SET_PHASE',
  SUBMIT_ACTION: 'SUBMIT_ACTION',
  RESOLVE_ROUND: 'RESOLVE_ROUND',
  NEXT_ROUND: 'NEXT_ROUND',
  RESHUFFLE: 'RESHUFFLE',
  END_GAME: 'END_GAME',
  RESET: 'RESET',
  SYNC_ROOM: 'SYNC_ROOM',
};

// Enrich players with full roleData from the frontend ROLES constant
function enrichPlayers(players) {
  return players.map(p => ({
    ...p,
    roleData: p.role ? (getRoleById(p.role) || p.roleData) : p.roleData,
  }));
}

// --- Reducer ---
function gameReducer(state, action) {
  switch (action.type) {
    case ACTIONS.LOGIN: {
      const user = action.payload;
      localStorage.setItem('rr_user', JSON.stringify(user));
      return { ...state, user };
    }

    case ACTIONS.LOGOUT: {
      localStorage.removeItem('rr_user');
      return { ...initialState, user: null };
    }

    case ACTIONS.CREATE_ROOM: {
      const { room } = action.payload;
      return {
        ...state,
        room: room,
        players: room.players,
        phase: 'lobby',
        isHost: true,
        myPlayerId: state.user.id || state.user._id || state.user.googleId,
        totalRounds: room.totalRounds,
        currentRound: 0,
        roundHistory: [],
        totals: {},
        rankings: [],
      };
    }

    case ACTIONS.JOIN_ROOM: {
      const { room } = action.payload;
      const myId = state.user.id || state.user._id || state.user.googleId;
      return {
        ...state,
        room: room,
        players: room.players,
        phase: 'lobby',
        isHost: room.hostId === myId,
        myPlayerId: myId,
      };
    }

    case ACTIONS.ADD_BOT: {
      if (state.players.length >= 10) return state;
      const botIndex = state.players.filter(p => p.isBot).length;
      const bot = {
        id: 'bot_' + Date.now() + '_' + botIndex,
        name: BOT_NAMES[botIndex % BOT_NAMES.length],
        isBot: true,
        isHost: false,
        colorIndex: state.players.length,
      };
      return {
        ...state,
        players: [...state.players, bot],
      };
    }

    case ACTIONS.REMOVE_PLAYER: {
      return {
        ...state,
        players: state.players.filter(p => p.id !== action.payload.playerId),
      };
    }

    // Used when server assigns roles — guarantees all tabs see the SAME roles
    case ACTIONS.SYNC_GAME_START: {
      const { room } = action.payload;
      const myId = state.user?.id || state.user?._id || state.user?.googleId;
      return {
        ...state,
        room,
        players: enrichPlayers(room.players),
        phase: 'roleReveal',
        currentRound: room.currentRound || 1,
        totalRounds: room.totalRounds || state.totalRounds,
        isHost: room.hostId === myId,
        myPlayerId: myId,
        roundHistory: [],
        totals: {},
        policeActions: {},
        reshuffleNotice: false,
      };
    }

    // Used after a round ends — server reshuffles, all tabs sync
    case ACTIONS.SYNC_NEXT_ROUND: {
      const { room } = action.payload;
      return {
        ...state,
        room,
        players: enrichPlayers(room.players),
        phase: 'roleReveal',
        currentRound: room.currentRound,
        roundResult: null,
        policeActions: {},
        reshuffleNotice: true,
      };
    }

    case ACTIONS.SET_PHASE: {
      return { ...state, phase: action.payload.phase };
    }

    case ACTIONS.SUBMIT_ACTION: {
      const { playerId, targetId } = action.payload;
      const newActions = { ...state.policeActions, [playerId]: targetId };
      return { ...state, policeActions: newActions };
    }

    case ACTIONS.RESOLVE_ROUND: {
      const serverResult = action.payload; // { isCorrect, earnings, policeId, targetId }
      
      const newHistory = [...state.roundHistory, { round: state.currentRound, ...serverResult }];
      const newTotals = calculateTotals(newHistory);

      return {
        ...state,
        roundResult: serverResult,
        roundHistory: newHistory,
        totals: newTotals,
        policeActions: {},
        phase: 'result',
      };
    }

    case ACTIONS.NEXT_ROUND: {
      const nextRound = state.currentRound + 1;

      if (nextRound > state.totalRounds) {
        // Game over
        const rankings = getRankings(state.players, state.totals);
        return {
          ...state,
          phase: 'leaderboard',
          rankings,
        };
      }

      let newPlayers = state.players;
      newPlayers = assignRoles(state.players.map(p => ({
        ...p, role: undefined, roleData: undefined,
      })));

      return {
        ...state,
        players: newPlayers,
        currentRound: nextRound,
        roundResult: null,
        policeActions: {},
        phase: 'roleReveal',
        reshuffleNotice: true,
      };
    }

    case ACTIONS.END_GAME: {
      const rankings = getRankings(state.players, state.totals);
      return {
        ...state,
        phase: 'leaderboard',
        rankings,
      };
    }

    case ACTIONS.RESET: {
      return {
        ...initialState,
        user: state.user,
      };
    }

    case ACTIONS.SYNC_ROOM: {
      const { room } = action.payload;
      const myId = state.user?.id || state.user?._id || state.user?.googleId;
      
      return {
        ...state,
        room,
        players: enrichPlayers(room.players),
        phase: room.currentPhase || state.phase,
        currentRound: room.currentRound || state.currentRound,
        totalRounds: room.totalRounds || state.totalRounds,
        isHost: room.hostId === myId,
        myPlayerId: state.myPlayerId || myId,
      };
    }

    default:
      return state;
  }
}

// --- Provider ---
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const socketRef = useRef(null);

  // ─── Socket Lifecycle (FIX BUG-03 + D01) ───────────────────────────
  // Connect socket when user logs in, disconnect on logout
  useEffect(() => {
    if (state.user) {
      const socket = getSharedSocket();
      if (!socket.connected) {
        socket.connect();
      }
      socketRef.current = socket;
    } else {
      // Disconnect on logout
      if (sharedSocket && sharedSocket.connected) {
        sharedSocket.disconnect();
      }
    }
  }, [state.user]);

  // --- Real-time Polling for Lobby & System ---
  useEffect(() => {
    let interval;
    if (state.phase === 'lobby' && state.room) {
      const myId = state.user?.id || state.user?._id || state.user?.googleId;
      interval = setInterval(async () => {
        try {
          // FIX BUG-01: Pass playerId for server-side sanitization
          const res = await fetch(API_ROOM_GET(state.room.code, myId));
          const data = await res.json();
          if (data.success) {
            // 1. Sync players
            if (JSON.stringify(data.room.players) !== JSON.stringify(state.players)) {
              dispatch({ type: ACTIONS.JOIN_ROOM, payload: { room: data.room } });
            }
            
            // 2. Sync game start (for non-hosts) using SERVER roles
            if (!state.isHost && data.room.status === 'playing') {
              dispatch({ type: ACTIONS.SYNC_GAME_START, payload: { room: data.room } });
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 2500); 
    }
    return () => clearInterval(interval);
  }, [state.phase, state.room, state.players, state.user]);

  // --- Real-Time Sockets for Gameplay ---
  useEffect(() => {
    const socket = getSharedSocket();
    if (!socket || !state.room) return;

    const myId = state.user?.id || state.user?._id || state.user?.googleId;
    
    // Join with playerId so server can track socket → player mapping
    socket.emit('join_room', { code: state.room.code, playerId: myId });

    const handleRoundResult = (result) => {
      dispatch({ type: ACTIONS.RESOLVE_ROUND, payload: result });
    };

    const handleNewRound = (data) => {
      dispatch({ type: ACTIONS.SYNC_NEXT_ROUND, payload: { room: data.room } });
    };

    const handleRoomUpdate = (room) => {
      dispatch({ type: ACTIONS.SYNC_ROOM, payload: { room } });
    };

    const handlePhaseChange = (data) => {
      if (data.phase === 'roleReveal' && data.room) {
        dispatch({ type: ACTIONS.SYNC_NEXT_ROUND, payload: { room: data.room } });
      } else if (data.room) {
        dispatch({ type: ACTIONS.SYNC_ROOM, payload: { room: data.room } });
      }
    };

    socket.on('round_result', handleRoundResult);
    socket.on('new_round', handleNewRound);
    socket.on('room_update', handleRoomUpdate);
    socket.on('phase_change', handlePhaseChange);
    
    return () => {
      socket.off('round_result', handleRoundResult);
      socket.off('new_round', handleNewRound);
      socket.off('room_update', handleRoomUpdate);
      socket.off('phase_change', handlePhaseChange);
    };
  }, [state.room, state.user]);

  const login = useCallback(async (name) => {
    try {
      const res = await fetch(API_LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        dispatch({ type: ACTIONS.LOGIN, payload: data.user });
        return true;
      }
      return false;
    } catch (err) {
      console.error("Login failed", err);
      // Fallback for demo/offline
      const fallbackUser = { name, id: 'guest_' + Date.now() };
      dispatch({ type: ACTIONS.LOGIN, payload: fallbackUser });
      return true;
    }
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: ACTIONS.LOGOUT });
  }, []);

  const createRoom = useCallback(async (totalRounds) => {
    try {
      const code = generateRoomCode();
      const res = await fetch(API_ROOM_CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          hostId: state.user.id || state.user._id || state.user.googleId,
          hostName: state.user.name,
          totalRounds
        })
      });
      const data = await res.json();
      if (data.success) {
        dispatch({ type: ACTIONS.CREATE_ROOM, payload: { room: data.room } });
        return true;
      }
    } catch (err) {
      console.error("Create room failed", err);
    }
    return false;
  }, [state.user]);

  const joinRoom = useCallback(async (roomCode) => {
    try {
      const res = await fetch(API_ROOM_JOIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: roomCode,
          playerId: state.user.id || state.user._id || state.user.googleId,
          playerName: state.user.name
        })
      });
      const data = await res.json();
      if (data.success) {
        dispatch({ type: ACTIONS.JOIN_ROOM, payload: { room: data.room } });
        return true;
      }
    } catch (err) {
      console.error("Join room failed", err);
    }
    return false;
  }, [state.user]);

  const addBot = useCallback(() => {
    dispatch({ type: ACTIONS.ADD_BOT });
  }, []);

  const removePlayer = useCallback((playerId) => {
    dispatch({ type: ACTIONS.REMOVE_PLAYER, payload: { playerId } });
  }, []);

  // FIX BUG-02: startGame no longer calls client-side assignRoles.
  // It ONLY sends the request to the server, which assigns roles authoritatively.
  const startGame = useCallback(async () => {
    try {
      const res = await fetch(API_ROOM_START, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: state.room.code })
      });
      const data = await res.json();
      if (data.success) {
        // Use server-assigned roles so all tabs get identical assignments
        dispatch({ type: ACTIONS.SYNC_GAME_START, payload: { room: data.room } });
      }
    } catch (err) {
      console.error("Start game failed", err);
    }
  }, [state.room]);

  const setPhase = useCallback((phase) => {
    dispatch({ type: ACTIONS.SET_PHASE, payload: { phase } });
  }, []);

  const submitAction = useCallback(async (playerId, targetId) => {
    dispatch({ type: ACTIONS.SUBMIT_ACTION, payload: { playerId, targetId } });
    
    try {
      await fetch(API_ROOM_ACTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: state.room.code, policeId: playerId, targetId })
      });
    } catch (e) {
      console.error(e);
    }
  }, [state.room]);

  const resolveCurrentRound = useCallback(() => {
    dispatch({ type: ACTIONS.RESOLVE_ROUND });
  }, []);

  const nextRound = useCallback(() => {
    dispatch({ type: ACTIONS.NEXT_ROUND });
  }, []);

  // Called from MoneyScreen after server advances the round with new server roles
  const syncNextRound = useCallback((room) => {
    dispatch({ type: ACTIONS.SYNC_NEXT_ROUND, payload: { room } });
  }, []);

  const endGame = useCallback(() => {
    dispatch({ type: ACTIONS.END_GAME });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: ACTIONS.RESET });
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    try {
      const decoded = jwtDecode(credential);
      const res = await fetch(API_LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: decoded.sub,
          name: decoded.name,
          email: decoded.email,
          picture: decoded.picture,
          isGoogle: true
        })
      });
      
      if (!res.ok) throw new Error("Server responded with error");
      
      const data = await res.json();
      if (data.success) {
        dispatch({ type: ACTIONS.LOGIN, payload: data.user });
        return true;
      }
      return false;
    } catch (err) {
      console.error("Google Login failed", err);
      return false;
    }
  }, []);

  // Signal that this player is ready for the next phase.
  const phaseReady = useCallback(async (phase) => {
    if (!state.room) return { allReady: false };
    const myId = state.user?.id || state.user?._id || state.user?.googleId;
    try {
      const res = await fetch(API_ROOM_PHASE_READY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: state.room.code, playerId: myId, phase })
      });
      return await res.json();
    } catch {
      return { allReady: false };
    }
  }, [state.room, state.user]);

  // Poll whether all players are ready for a phase.
  const pollPhaseStatus = useCallback(async (phase) => {
    if (!state.room) return { allReady: false };
    try {
      const res = await fetch(API_ROOM_PHASE_STATUS(state.room.code, phase));
      return await res.json();
    } catch {
      return { allReady: false };
    }
  }, [state.room]);

  const updateStats = useCallback(async (earnings, isWin = false) => {
    if (!state.user || !state.user._id) return;
    try {
      await fetch(API_USER_STATS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: state.user.googleId || state.user._id,
          earnings,
          isWin
        })
      });
    } catch (err) {
      console.error("Stats update failed", err);
    }
  }, [state.user]);

  const value = {
    ...state,
    login,
    loginWithGoogle,
    updateStats,
    logout,
    createRoom,
    joinRoom,
    addBot,
    removePlayer,
    startGame,
    setPhase,
    submitAction,
    resolveCurrentRound,
    nextRound,
    syncNextRound,
    endGame,
    reset,
    phaseReady,
    pollPhaseStatus,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

export default GameContext;
