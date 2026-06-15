export function xpRequiredForLevel(level: number): number {
  return Math.round(80 * Math.pow(level, 1.3));
}

export function getLevelInfo(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
} {
  let level = 1;
  let xpConsumed = 0;

  while (true) {
    const needed = xpRequiredForLevel(level);
    if (xpConsumed + needed > totalXp) {
      return {
        level,
        currentLevelXp: totalXp - xpConsumed,
        nextLevelXp: needed,
      };
    }
    xpConsumed += needed;
    level++;
  }
}
