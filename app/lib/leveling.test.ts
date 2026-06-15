import { describe, it, expect } from "vitest";
import { xpRequiredForLevel, getLevelInfo } from "./leveling";

describe("xpRequiredForLevel", () => {
  it("requires 80 XP for level 1", () => {
    expect(xpRequiredForLevel(1)).toBe(80);
  });

  it("requires ~197 XP for level 2", () => {
    expect(xpRequiredForLevel(2)).toBe(197);
  });

  it("scales exponentially", () => {
    const level5 = xpRequiredForLevel(5);
    const level10 = xpRequiredForLevel(10);
    expect(level10).toBeGreaterThan(level5 * 1.5);
  });
});

describe("getLevelInfo", () => {
  it("returns level 1 with 0 XP", () => {
    const info = getLevelInfo(0);
    expect(info.level).toBe(1);
    expect(info.currentLevelXp).toBe(0);
    expect(info.nextLevelXp).toBe(80);
  });

  it("returns level 1 with 79 XP", () => {
    const info = getLevelInfo(79);
    expect(info.level).toBe(1);
    expect(info.currentLevelXp).toBe(79);
    expect(info.nextLevelXp).toBe(80);
  });

  it("advances to level 2 at exactly 80 XP", () => {
    const info = getLevelInfo(80);
    expect(info.level).toBe(2);
    expect(info.currentLevelXp).toBe(0);
    expect(info.nextLevelXp).toBe(197);
  });

  it("advances to level 3 at 80 + 197 = 277 XP", () => {
    const info = getLevelInfo(277);
    expect(info.level).toBe(3);
    expect(info.currentLevelXp).toBe(0);
  });

  it("tracks partial progress within a level", () => {
    const info = getLevelInfo(130);
    expect(info.level).toBe(2);
    expect(info.currentLevelXp).toBe(50);
    expect(info.nextLevelXp).toBe(197);
  });
});
