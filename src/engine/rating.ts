// Rating <-> difficulty mapping. (Not a chess engine — just the ELO ladder
// used to pick the coach's strength and to display levels.)

const LEVEL_ELOS = [600, 700, 850, 1000, 1100, 1250, 1400, 1550, 1700, 1900];

export function levelToElo(level: number): number {
  return LEVEL_ELOS[Math.min(Math.max(level, 1) - 1, LEVEL_ELOS.length - 1)];
}

// Pick the level whose rating is closest to the given Elo, so the coach plays
// at roughly the same strength as the player.
export function eloToLevel(elo: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < LEVEL_ELOS.length; i++) {
    const diff = Math.abs(LEVEL_ELOS[i] - elo);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best + 1;
}
