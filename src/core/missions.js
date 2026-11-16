import { dayKey } from "./scheduler.js";

export function getDailyMissions(seedDate) {
  const day = dayKey(seedDate);
  // Deterministic missions based on the date
  const missionPool = [
    { id: "play_daily", label: "Complete Daily Rounds", target: 1, type: "daily_count" },
    { id: "get_perfect", label: "Get a Perfect 5/5", target: 1, type: "perfect_count" },
    { id: "play_practice", label: "Complete 2 Practice Rounds", target: 2, type: "practice_count" },
    { id: "play_hunt", label: "Complete 1 Word Hunt", target: 1, type: "hunt_count" },
    { id: "use_hint", label: "Use 2 Hints", target: 2, type: "hint_count" },
    { id: "watch_ad", label: "Watch 1 Reward Ad", target: 1, type: "ad_count" }
  ];

  // Select 3 missions based on day string hash
  const hash = day.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const selected = [];
  const indices = new Set();
  while (indices.size < 3) {
    indices.add(Math.abs((hash + indices.size * 7) % missionPool.length));
  }
  
  indices.forEach(i => selected.push({ ...missionPool[i], progress: 0, completed: false }));
  return selected;
}

export function updateMissionProgress(profile, type, amount = 1) {
  const today = dayKey(new Date());
  let missions = profile.missions;
  if (!missions || missions.day !== today) {
    missions = {
      day: today,
      list: getDailyMissions(new Date())
    };
  }

  let changed = false;
  let xpBonus = 0;
  const list = missions.list.map(m => {
    if (m.type === type && !m.completed) {
      const progress = Math.min(m.target, m.progress + amount);
      const completed = progress >= m.target;
      if (completed !== m.completed || progress !== m.progress) changed = true;
      if (completed) xpBonus = 50;
      return { ...m, progress, completed };
    }
    return m;
  });

  const updatedProfile = {
    ...profile,
    missions: { ...missions, list },
    xp: (profile.xp ?? 0) + xpBonus
  };

  return { profile: updatedProfile, changed, completed: xpBonus > 0 };
}
