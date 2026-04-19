// =============================================
// RAJA RANI: MONEY WAR — Bot Simulator
// =============================================
// Simulates other players' actions with AI behavior

export function simulatePoliceAction(policePlayer, allPlayers) {
  // Bot police picks a random non-police player to investigate
  const targets = allPlayers.filter(p => p.id !== policePlayer.id && p.role !== 'police');
  if (targets.length === 0) return null;
  const pick = targets[Math.floor(Math.random() * targets.length)];
  return pick.id;
}

export function generateBotActions(players) {
  const actions = {};

  players.forEach(player => {
    if (player.isBot && player.role === 'police') {
      actions[player.id] = simulatePoliceAction(player, players);
    }
  });

  return actions;
}

// Simulate bot delay (returns ms)
export function getBotDelay() {
  return 1000 + Math.random() * 2000; // 1-3 seconds
}
