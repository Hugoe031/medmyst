import { previousDayKey } from "./scheduler.js";

const STORAGE_KEY = "medmyst.v1";

export function emptyStats() {
  return {
    rounds: 0,
    perfect: 0,
    flawless: 0,
    bestCombo: 0,
    bestTimeAttack: 0,
    bestHuntScore: 0,
    fastestMs: null,
    answered: 0,
    categories: {},
    leaderboards: {
      daily: [],
      practice: [],
      hunt: [],
      attack: []
    }
  };
}

export function calculateXp({ mode, score, total, points }) {
  const perfect = total > 0 && score === total;
  if (mode === "hunt") {
    // Hunt rounds are short (5 cases), so points convert at 5:1
    return Math.round((points ?? score ?? 0) / 5);
  }
  if (mode === "attack") {
    // Time Attack racks up points quickly, so points convert at 10:1
    return Math.round((points ?? score ?? 0) / 10);
  }
  // For daily and practice, score is the number of correct answers
  return (score ?? 0) * 15 + (perfect ? 50 : 0);
}

export function recordHighScore(profile, type, score) {
  const stats = profile.stats ?? emptyStats();
  const leaderboards = stats.leaderboards ?? { daily: [], practice: [], hunt: [], attack: [] };
  const list = leaderboards[type] ?? [];
  
  const entry = { score, date: new Date().toISOString() };
  const newList = [...list, entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const bestKey = type === "attack" ? "bestTimeAttack" : type === "hunt" ? "bestHuntScore" : null;
  const updatedStats = {
    ...stats,
    leaderboards: {
      ...leaderboards,
      [type]: newList
    }
  };

  if (bestKey) {
    updatedStats[bestKey] = Math.max(stats[bestKey] ?? 0, score);
  }

  return {
    ...profile,
    stats: updatedStats
  };
}

export function emptyProfile() {
  return {
    nickname: "Clinician",
    avatar: "🩺",
    streak: 0,
    best: 0,
    lastDay: null,
    history: {},
    practice: { rounds: 0, correct: 0, answered: 0 },
    ads: { watched: 0 },
    xp: 0,
    stats: emptyStats(),
    hunt: { rounds: 0, solved: 0, cases: 0, best: 0 },
    mystery: { solved: 0 },
    badges: [],
    missions: { day: null, list: [] },
    settings: {
      volSuccess: 50,
      volExplosion: 70,
      haptics: "medium",
      ambience: false,
      screenshotMode: false
    }
  };
}

export function applyCompletion(profile, day, score, total, results, picks = []) {
  if (profile.history[day]) {
    return profile;
  }
  const continues = profile.lastDay === previousDayKey(day);
  const streak = continues ? profile.streak + 1 : 1;
  return {
    ...profile,
    streak,
    best: Math.max(profile.best, streak),
    lastDay: day,
    history: {
      ...profile.history,
      [day]: {
        score,
        total,
        ids: results.map((result) => (typeof result.id === "string" ? result.id : null)),
        results: results.map((result) => (result.ok ? 1 : 0)),
        picks: picks.map((pick) => (typeof pick === "string" ? pick : null))
      }
    }
  };
}

export function recordPractice(profile, score, total) {
  const current = profile.practice ?? { rounds: 0, correct: 0, answered: 0 };
  return {
    ...profile,
    practice: {
      rounds: current.rounds + 1,
      correct: current.correct + score,
      answered: current.answered + total
    }
  };
}

export function recordAdWatch(profile) {
  const watched = profile.ads?.watched ?? 0;
  return { ...profile, ads: { watched: watched + 1 } };
}

function updateCategoryStats(categories, results) {
  const next = { ...categories };
  results.forEach((result) => {
    const cat = result.category || "Unknown";
    const current = next[cat] ?? { correct: 0, answered: 0 };
    next[cat] = {
      correct: current.correct + (result.ok ? 1 : 0),
      answered: current.answered + 1
    };
  });
  return next;
}

export function recordQuiz(profile, { score = 0, total = 0, fastestMs = null, results = [], type = "practice", bestCombo = 0 } = {}) {
  const stats = profile.stats ?? emptyStats();
  const perfect = total > 0 && score === total ? 1 : 0;
  const fastest =
    Number.isFinite(fastestMs) && fastestMs > 0
      ? Math.min(Number.isFinite(stats.fastestMs) ? stats.fastestMs : Infinity, fastestMs)
      : stats.fastestMs;
  
  const xpGained = calculateXp({ mode: type, score, total });

  const updatedProfile = {
    ...profile,
    xp: (profile.xp ?? 0) + xpGained,
    stats: {
      ...stats,
      rounds: (stats.rounds ?? 0) + 1,
      perfect: (stats.perfect ?? 0) + perfect,
      flawless: (stats.flawless ?? 0) + perfect,
      bestCombo: Math.max(stats.bestCombo ?? 0, bestCombo),
      fastestMs: Number.isFinite(fastest) ? fastest : null,
      answered: (stats.answered ?? 0) + Math.max(0, total),
      categories: updateCategoryStats(stats.categories ?? {}, results)
    }
  };

  return recordHighScore(updatedProfile, type, score);
}

export function recordHunt(profile, { score = 0, solved = 0, cases = 0, flawless = false, results = [], bestCombo = 0 } = {}) {
  const hunt = profile.hunt ?? { rounds: 0, solved: 0, cases: 0, best: 0 };
  const stats = profile.stats ?? emptyStats();
  const clean = cases > 0 && solved === cases;
  const mystery = profile.mystery ?? { solved: 0 };
  const combo = Math.max(Number(bestCombo) || 0, solved);
  
  const xpGained = calculateXp({ mode: "hunt", points: score });

  let updatedProfile = {
    ...profile,
    xp: (profile.xp ?? 0) + xpGained,
    stats: {
      ...stats,
      rounds: (stats.rounds ?? 0) + 1,
      perfect: (stats.perfect ?? 0) + (clean ? 1 : 0),
      flawless: (stats.flawless ?? 0) + (clean && flawless ? 1 : 0),
      bestCombo: Math.max(stats.bestCombo ?? 0, combo),
      fastestMs: stats.fastestMs ?? null,
      answered: (stats.answered ?? 0) + Math.max(0, cases),
      categories: updateCategoryStats(stats.categories ?? {}, results)
    },
    hunt: {
      rounds: hunt.rounds + 1,
      solved: hunt.solved + solved,
      cases: hunt.cases + cases,
      best: Math.max(hunt.best, solved)
    },
    mystery: {
      solved: (mystery.solved ?? 0) + Math.max(0, solved)
    }
  };

  return recordHighScore(updatedProfile, "hunt", score);
}

export function accuracy(profile) {
  const days = Object.values(profile.history);
  const correct = days.reduce((sum, entry) => sum + entry.score, 0) + (profile.practice?.correct ?? 0);
  const answered = days.reduce((sum, entry) => sum + entry.total, 0) + (profile.practice?.answered ?? 0);
  if (answered === 0) {
    return null;
  }
  return Math.round((correct / answered) * 100);
}

function sanitizeLeaderboards(value) {
  const empty = { daily: [], practice: [], hunt: [], attack: [] };
  if (!value || typeof value !== "object") {
    return empty;
  }
  const clean = { ...empty };
  Object.keys(empty).forEach((type) => {
    const list = Array.isArray(value[type]) ? value[type] : [];
    clean[type] = list
      .filter((entry) => entry && Number.isFinite(Number(entry.score)))
      .map((entry) => ({
        score: Number(entry.score),
        date: typeof entry.date === "string" ? entry.date : null
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  });
  return clean;
}

function sanitizeHistory(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const history = {};
  Object.entries(value).forEach(([day, entry]) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const results = Array.isArray(entry.results) ? entry.results.map((item) => (item ? 1 : 0)) : [];
    const picks = Array.isArray(entry.picks)
      ? entry.picks.map((pick) => (typeof pick === "string" ? pick : null))
      : [];
    history[day] = {
      score: Number(entry.score) || 0,
      total: Number(entry.total) || results.length,
      ids: Array.isArray(entry.ids)
        ? entry.ids.map((id) => (typeof id === "string" ? id : null))
        : [],
      results,
      picks
    };
  });
  return history;
}

export function readProfile(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyProfile();
    }
    const parsed = JSON.parse(raw);
    const practice = parsed.practice ?? {};
    const ads = parsed.ads ?? {};
    const hunt = parsed.hunt ?? {};
    const stats = parsed.stats ?? {};
    const mystery = parsed.mystery ?? {};
    const settings = parsed.settings ?? {};
    const missions = parsed.missions ?? { day: null, list: [] };
    const fastest = Number(stats.fastestMs);
    return {
      nickname: typeof parsed.nickname === "string" ? parsed.nickname : "Clinician",
      avatar: typeof parsed.avatar === "string" ? parsed.avatar : "🩺",
      streak: Number(parsed.streak) || 0,
      best: Number(parsed.best) || 0,
      lastDay: typeof parsed.lastDay === "string" ? parsed.lastDay : null,
      history: sanitizeHistory(parsed.history),
      practice: {
        rounds: Number(practice.rounds) || 0,
        correct: Number(practice.correct) || 0,
        answered: Number(practice.answered) || 0
      },
      ads: { watched: Number(ads.watched) || 0 },
      xp: Number(parsed.xp) || 0,
      stats: {
        rounds: Number(stats.rounds) || 0,
        perfect: Number(stats.perfect) || 0,
        flawless: Number(stats.flawless) || 0,
        bestCombo: Number(stats.bestCombo) || 0,
        bestTimeAttack: Number(stats.bestTimeAttack) || 0,
        bestHuntScore: Number(stats.bestHuntScore) || 0,
        fastestMs: Number.isFinite(fastest) && fastest > 0 ? fastest : null,
        answered: Number(stats.answered) || 0,
        categories: stats.categories ?? {},
        leaderboards: sanitizeLeaderboards(stats.leaderboards)
      },
      hunt: {
        rounds: Number(hunt.rounds) || 0,
        solved: Number(hunt.solved) || 0,
        cases: Number(hunt.cases) || 0,
        best: Number(hunt.best) || 0
      },
      mystery: { solved: Number(mystery.solved) || 0 },
      badges: Array.isArray(parsed.badges)
        ? parsed.badges.filter((id) => typeof id === "string")
        : [],
      missions: {
        day: typeof missions.day === "string" ? missions.day : null,
        list: Array.isArray(missions.list) ? missions.list : []
      },
      settings: {
        volSuccess: Number.isFinite(Number(settings.volSuccess)) ? Number(settings.volSuccess) : 50,
        volExplosion: Number.isFinite(Number(settings.volExplosion)) ? Number(settings.volExplosion) : 70,
        haptics: typeof settings.haptics === "string" ? settings.haptics : "medium",
        ambience: Boolean(settings.ambience),
        screenshotMode: Boolean(settings.screenshotMode)
      }
    };
  } catch {
    return emptyProfile();
  }
}

const SESSION_KEY = "medmyst.session";

export function saveSession(storage, session) {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    return false;
  }
  return true;
}

export function readSession(storage) {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession(storage) {
  storage.removeItem(SESSION_KEY);
}

export function writeProfile(storage, profile) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    return false;
  }
  return true;
}
