// =============================================
// RAJA RANI: MONEY WAR — Game Engine
// =============================================

export const ROLES = {
  RAJA: { id: 'raja', name: 'Raja', emoji: '👑', color: '#F59E0B', value: 500, description: 'The King. Earns the highest income every round.' },
  RANI: { id: 'rani', name: 'Rani', emoji: '👸', color: '#EC4899', value: 350, description: 'The Queen. Earns a royal income every round.' },
  MANTRI: { id: 'mantri', name: 'Mantri', emoji: '🧠', color: '#A855F7', value: 250, description: 'The Minister. Earns a strong income every round.' },
  SOLDIER: { id: 'soldier', name: 'Soldier', emoji: '⚔️', color: '#10B981', value: 200, description: 'The Soldier. Guards the kingdom faithfully.' },
  MILKMAN: { id: 'milkman', name: 'Milkman', emoji: '🥛', color: '#06B6D4', value: 150, description: 'The Milkman. Serves the community every round.' },
  GARDENER: { id: 'gardener', name: 'Gardener', emoji: '🌿', color: '#84CC16', value: 100, description: 'The Gardener. Tends to the kingdom\'s gardens.' },
  POLICE: { id: 'police', name: 'Police', emoji: '👮', color: '#3B82F6', value: 400, description: 'The Police. Must find the Thief to earn income!' },
  THIEF: { id: 'thief', name: 'Thief', emoji: '🕵️', color: '#EF4444', value: 0, description: 'The Thief. Earns nothing unless the Police fails!' },
};

// Role distribution by player count
const ROLE_DISTRIBUTIONS = {
  4: ['raja', 'rani', 'police', 'thief'],
  5: ['raja', 'rani', 'mantri', 'police', 'thief'],
  6: ['raja', 'rani', 'mantri', 'soldier', 'police', 'thief'],
  7: ['raja', 'rani', 'mantri', 'soldier', 'milkman', 'police', 'thief'],
  8: ['raja', 'rani', 'mantri', 'soldier', 'police', 'police', 'thief', 'thief'],
  9: ['raja', 'rani', 'mantri', 'soldier', 'milkman', 'police', 'police', 'thief', 'thief'],
  10: ['raja', 'rani', 'mantri', 'soldier', 'milkman', 'gardener', 'police', 'police', 'thief', 'thief'],
};

export function getRoleById(roleId) {
  return Object.values(ROLES).find(r => r.id === roleId);
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Shuffle array (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Assign roles to players based on count
export function assignRoles(players) {
  const count = players.length;
  const clamped = Math.min(Math.max(count, 4), 10);
  const roleIds = shuffle([...ROLE_DISTRIBUTIONS[clamped]]);

  return players.map((player, i) => ({
    ...player,
    role: roleIds[i],
    roleData: getRoleById(roleIds[i]),
  }));
}

// Resolve a round: takes players + police actions, returns round result
export function resolveRound(players, policeActions) {
  const events = [];
  const earnings = {};
  const thiefIds = players.filter(p => p.role === 'thief').map(p => p.id);
  const policeIds = players.filter(p => p.role === 'police').map(p => p.id);

  // Initialize earnings for all
  players.forEach(p => {
    const role = getRoleById(p.role);
    if (p.role === 'police' || p.role === 'thief') {
      earnings[p.id] = 0; // Conditional
    } else {
      earnings[p.id] = role.value; // Fixed income
    }
  });

  // Process each police action independently
  const caughtThieves = new Set();
  const failedPoliceIds = new Set();

  policeIds.forEach(policeId => {
    const targetId = policeActions[policeId];
    const policeName = players.find(p => p.id === policeId)?.name || 'Police';

    if (!targetId) {
      // Police didn't act — counts as fail
      failedPoliceIds.add(policeId);
      events.push({
        type: 'police_skip',
        icon: '👮',
        text: `${policeName} (Police) didn't investigate anyone! Earns ₹0`,
        color: '#3B82F6',
      });
      return;
    }

    const targetPlayer = players.find(p => p.id === targetId);
    const targetName = targetPlayer?.name || 'Unknown';

    if (thiefIds.includes(targetId)) {
      // ✅ Correct! Police found the thief
      caughtThieves.add(targetId);
      earnings[policeId] = 300;
      earnings[targetId] = 0;

      events.push({
        type: 'police_correct',
        icon: '✅',
        text: `${policeName} (Police) correctly identified ${targetName} as the Thief!`,
        color: '#10B981',
      });
      events.push({
        type: 'thief_caught',
        icon: '🚨',
        text: `${targetName} (Thief) was caught! Earns ₹0`,
        color: '#EF4444',
      });
    } else {
      // ❌ Wrong guess — police fails
      failedPoliceIds.add(policeId);
      earnings[policeId] = 0;

      events.push({
        type: 'police_wrong',
        icon: '❌',
        text: `${policeName} (Police) investigated ${targetName} — Wrong guess! Earns ₹0`,
        color: '#EF4444',
      });
    }
  });

  // Award uncaught thieves if at least one police failed
  const anyPoliceFailed = failedPoliceIds.size > 0;
  thiefIds.forEach(thiefId => {
    if (!caughtThieves.has(thiefId)) {
      if (anyPoliceFailed) {
        earnings[thiefId] = 300;
        const thiefName = players.find(p => p.id === thiefId)?.name || 'Thief';
        events.push({
          type: 'thief_escape',
          icon: '🕵️',
          text: `${thiefName} (Thief) escaped! Earns ₹300`,
          color: '#F59E0B',
        });
      } else {
        // All police succeeded — thief earns nothing even if not directly caught
        earnings[thiefId] = 0;
        const thiefName = players.find(p => p.id === thiefId)?.name || 'Thief';
        events.push({
          type: 'thief_hidden',
          icon: '🕵️',
          text: `${thiefName} (Thief) hid — but Police was too smart! Earns ₹0`,
          color: '#6B7280',
        });
      }
    }
  });

  return { events, earnings };
}


// Calculate total money from round history
export function calculateTotals(roundHistory) {
  const totals = {};
  roundHistory.forEach(round => {
    Object.entries(round.earnings).forEach(([playerId, amount]) => {
      totals[playerId] = (totals[playerId] || 0) + amount;
    });
  });
  return totals;
}

// Get final rankings
export function getRankings(players, totals) {
  return players
    .map(p => ({
      ...p,
      totalMoney: totals[p.id] || 0,
    }))
    .sort((a, b) => b.totalMoney - a.totalMoney)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

// Bot names for simulation
export const BOT_NAMES = [
  'Arjun', 'Priya', 'Rahul', 'Ananya', 'Vikram',
  'Sneha', 'Karan', 'Divya', 'Aditya', 'Meera',
  'Rohan', 'Ishita', 'Amit', 'Pooja', 'Nikhil',
];

// Avatar colors
export const AVATAR_COLORS = [
  '#6C2BD9', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#8B5CF6',
];

export function getAvatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function getInitials(name) {
  return name.charAt(0).toUpperCase();
}
