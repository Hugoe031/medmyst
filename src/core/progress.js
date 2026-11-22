export const RANKS = [
  { name: "Intern", xp: 0 },
  { name: "Junior Resident", xp: 200 },
  { name: "Senior Resident", xp: 600 },
  { name: "Chief Resident", xp: 1200 },
  { name: "Fellow", xp: 2500 },
  { name: "Senior Registrar", xp: 5000 },
  { name: "Attending", xp: 10000 },
  { name: "Consultant", xp: 18000 },
  { name: "Chief of Medicine", xp: 30000 }
];

export const BADGES = [
  { id: "first", name: "First Case", hint: "Finish your first round" },
  { id: "perfect", name: "Perfect Five", hint: "Score 5/5 in one round" },
  { id: "flawless", name: "Flawless", hint: "Finish with all three hearts" },
  { id: "combo", name: "Combo Master", hint: "Reach a x3 combo" },
  { id: "speed", name: "Quick Draw", hint: "Answer in under 5 seconds" },
  { id: "hundred", name: "Centurion", hint: "Answer 100 questions" },
  { id: "week", name: "Week Warrior", hint: "Hold a 7 day streak" },
  { id: "detective", name: "Detective", hint: "Solve a diagnosis mystery" },
  { id: "scholar", name: "Scholar", hint: "Earn 3,000 XP" },
  { id: "speed_demon", name: "Speed Demon", hint: "Score 1,500+ in Time Attack" }
];

export function rankInfo(xp) {
  const value = Math.max(0, Number(xp) || 0);
  let index = 0;
  RANKS.forEach((rank, position) => {
    if (value >= rank.xp) {
      index = position;
    }
  });
  const current = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const span = next ? next.xp - current.xp : 1;
  const progress = next ? Math.min(1, (value - current.xp) / span) : 1;
  const xpToNext = next ? next.xp - value : 0;
  return { 
    name: current.name, 
    level: index + 1, 
    xp: value, 
    next, 
    progress,
    xpToNext
  };
}

export function badgeById(id) {
  return BADGES.find((badge) => badge.id === id) ?? null;
}

export function isBadgeEarned(profile, id) {
  const stats = profile.stats ?? {};
  const mystery = profile.mystery ?? {};
  const xp = Number(profile.xp) || 0;
  switch (id) {
    case "first":
      return (stats.rounds ?? 0) >= 1;
    case "perfect":
      return (stats.perfect ?? 0) >= 1;
    case "flawless":
      return (stats.flawless ?? 0) >= 1;
    case "combo":
      return (stats.bestCombo ?? 0) >= 4;
    case "speed":
      return Number.isFinite(stats.fastestMs) && stats.fastestMs <= 5000;
    case "hundred":
      return (stats.answered ?? 0) >= 100;
    case "week":
      return (profile.best ?? 0) >= 7;
    case "detective":
      return (mystery.solved ?? 0) >= 1;
    case "scholar":
      return xp >= 3000;
    case "speed_demon":
      return (stats.bestTimeAttack ?? 0) >= 1500;
    default:
      return false;
  }
}

export function earnedBadges(profile) {
  return BADGES.filter((badge) => isBadgeEarned(profile, badge.id)).map((badge) => badge.id);
}

export function syncBadges(profile) {
  const earned = earnedBadges(profile);
  const known = Array.isArray(profile.badges) ? profile.badges.filter((id) => badgeById(id)) : [];
  const merged = [...known];
  earned.forEach((id) => {
    if (!merged.includes(id)) {
      merged.push(id);
    }
  });
  return { ...profile, badges: merged };
}

export function freshBadges(before, after) {
  const previous = new Set(Array.isArray(before.badges) ? before.badges : []);
  return (after.badges ?? []).filter((id) => !previous.has(id));
}
