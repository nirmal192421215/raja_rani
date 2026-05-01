// =============================================
// RAJA RANI: MONEY WAR — XP & Progression Engine
// Shared between frontend and used as reference
// on the backend (server applies same logic)
// =============================================

// ─── Level Thresholds ─────────────────────────────────────────
// XP needed to reach each level (cumulative from level 1)
export const LEVEL_THRESHOLDS = [
  0,     // Level 1
  100,   // Level 2
  250,   // Level 3
  450,   // Level 4
  700,   // Level 5
  1000,  // Level 6
  1400,  // Level 7
  1900,  // Level 8
  2500,  // Level 9
  3200,  // Level 10
  4000,  // Level 11
  5000,  // Level 12
  6200,  // Level 13
  7600,  // Level 14
  9200,  // Level 15
  11000, // Level 16
  13000, // Level 17
  15500, // Level 18
  18500, // Level 19
  22000, // Level 20
  26000, // Level 21
  31000, // Level 22
  37000, // Level 23
  44000, // Level 24
  52000, // Level 25
  61000, // Level 26
  72000, // Level 27
  85000, // Level 28
  100000,// Level 29
  120000,// Level 30  — "Raja" rank
];

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

// ─── Level from XP ────────────────────────────────────────────
export function getLevelFromXP(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return Math.min(level, MAX_LEVEL);
}

// ─── XP progress within current level ────────────────────────
export function getLevelProgress(xp) {
  const level = getLevelFromXP(xp);
  if (level >= MAX_LEVEL) return { current: xp, needed: xp, pct: 100, level };

  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold    = LEVEL_THRESHOLDS[level];
  const current = xp - currentThreshold;
  const needed  = nextThreshold - currentThreshold;
  const pct     = Math.min(100, Math.round((current / needed) * 100));

  return { current, needed, pct, level };
}

// ─── Level Title / Rank ───────────────────────────────────────
export function getLevelTitle(level) {
  if (level >= 30) return { title: 'Maharaja', emoji: '👑', color: '#FFD700' };
  if (level >= 25) return { title: 'Raja',     emoji: '🏯', color: '#D4AF37' };
  if (level >= 20) return { title: 'Mantri',   emoji: '🧠', color: '#A855F7' };
  if (level >= 15) return { title: 'Soldier',  emoji: '⚔️', color: '#3B82F6' };
  if (level >= 10) return { title: 'Guard',    emoji: '🛡️', color: '#10B981' };
  if (level >= 5)  return { title: 'Scout',    emoji: '🔍', color: '#6B7280' };
  return                  { title: 'Rookie',   emoji: '🌱', color: '#9CA3AF' };
}

// ─── XP rewards ───────────────────────────────────────────────
export const XP_REWARDS = {
  GAME_PLAYED:      10,   // Finish any game
  WIN_GAME:         50,   // Win overall (most earnings)
  CATCH_THIEF:      30,   // Police correctly catches thief
  ESCAPE_AS_THIEF:  25,   // Thief survives the round
  ROUND_TOP_EARNER: 15,   // Earn the most in a single round
  DAILY_PLAY:       20,   // First game of the day
};

// ─── All Achievements ─────────────────────────────────────────
export const ACHIEVEMENTS = [
  {
    id: 'first_blood',
    name: 'First Blood',
    desc: 'Win your first game',
    emoji: '🏆',
    condition: (stats) => stats.wins >= 1,
  },
  {
    id: 'eagle_eye',
    name: 'Eagle Eye',
    desc: 'Catch the thief 3 times total',
    emoji: '🔍',
    condition: (stats) => stats.policeCorrect >= 3,
  },
  {
    id: 'ghost',
    name: 'Ghost',
    desc: 'Escape as Thief 5 times',
    emoji: '🥷',
    condition: (stats) => stats.thiefEscapes >= 5,
  },
  {
    id: 'money_magnet',
    name: 'Money Magnet',
    desc: 'Earn ₹5,000 total across all games',
    emoji: '💰',
    condition: (stats) => stats.totalEarnings >= 5000,
  },
  {
    id: 'veteran',
    name: 'Veteran',
    desc: 'Play 20 games',
    emoji: '🎖️',
    condition: (stats) => stats.gamesPlayed >= 20,
  },
  {
    id: 'champion',
    name: 'Champion',
    desc: 'Win 10 games',
    emoji: '👑',
    condition: (stats) => stats.wins >= 10,
  },
  {
    id: 'level_10',
    name: 'Rising Star',
    desc: 'Reach Level 10',
    emoji: '⭐',
    condition: (stats) => (stats.level || 1) >= 10,
  },
  {
    id: 'wealthy_merchant',
    name: 'Wealthy Merchant',
    desc: 'Earn ₹10,000 total',
    emoji: '🛡️',
    condition: (stats) => stats.totalEarnings >= 10000,
  },
  {
    id: 'raja_forever',
    name: 'Raja Forever',
    desc: 'Reach Level 25',
    emoji: '🏯',
    condition: (stats) => (stats.level || 1) >= 25,
  },
];

// Check which new achievements were unlocked
export function checkNewAchievements(stats, existingIds = []) {
  return ACHIEVEMENTS.filter(a =>
    !existingIds.includes(a.id) && a.condition(stats)
  );
}
