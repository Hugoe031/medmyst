import { questions, deckVersion } from "./data/questions.js";
import { buildPuzzle, dayKey, puzzleNumber } from "./core/scheduler.js";
import {
  advance,
  answer,
  createGame,
  currentQuestion,
  finish,
  grantHint,
  isLastQuestion,
  scoreOf,
  timeout,
  useHint,
  QUESTION_SECONDS
} from "./core/game.js";
import {
  accuracy,
  applyCompletion,
  calculateXp,
  readProfile,
  recordAdWatch,
  recordHighScore,
  recordHunt,
  recordPractice,
  recordQuiz,
  writeProfile,
  saveSession,
  readSession,
  clearSession
} from "./core/storage.js";
import {
  HUNT_LIVES,
  HUNT_POINTS,
  answerCells,
  buildHunt,
  currentRound,
  isLastRound,
  isRoundOver,
  multiplier,
  nextRound,
  selectCells,
  summary,
  finishHunt
} from "./core/hunt.js";
import { lineCells } from "./core/wordgrid.js";
import {
  BADGES,
  badgeById,
  freshBadges,
  isBadgeEarned,
  rankInfo,
  syncBadges
} from "./core/progress.js";
import { buildShareText, resultGrid } from "./core/share.js";
import { buildPractice } from "./core/practice.js";
import { buildReview, restorePuzzle } from "./core/review.js";
import { shuffle } from "./core/rng.js";
import { requestRewardedHint } from "./rewarded-overlay.js";
import { initializeAdMob, showPrivacyOptions } from "./core/rewarded.js";
import { getDailyMissions, updateMissionProgress } from "./core/missions.js";
const App = globalThis.Capacitor?.Plugins?.App;

// Global UI helpers
function showLoading(show = true) {
  if (ui.loadingOverlay) {
    ui.loadingOverlay.classList.toggle("is-hidden", !show);
  }
}

// Global error handling for debugging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // Ensure splash and loading are removed on fatal error
  const splash = document.getElementById("splash");
  if (splash) splash.remove();
  showLoading(false);
});

const SPECIALTIES = [
  { id: "Terminology", minLevel: 0, icon: "📖" },
  { id: "Safety", minLevel: 0, icon: "🛡️" },
  { id: "Anatomy", minLevel: 1, icon: "🫀" },
  { id: "Vitals", minLevel: 1, icon: "🩺" },
  { id: "Pharmacology", minLevel: 2, icon: "💊" },
  { id: "Infection Control", minLevel: 2, icon: "🧼" },
  { id: "Labs", minLevel: 3, icon: "🧪" },
  { id: "Med-Surg", minLevel: 3, icon: "🏥" }
];

function triggerHaptic(style = "MEDIUM") {
  const level = profile.settings?.haptics || "medium";
  if (level === "off") return;
  
  let actualStyle = style;
  if (level === "light") actualStyle = "LIGHT";
  if (level === "heavy") actualStyle = "HEAVY";

  const haptics = globalThis.Capacitor?.Plugins?.Haptics;
  if (haptics) {
    haptics.impact({ style: actualStyle }).catch(() => {});
  }
}

const SFX = {
  success: new Audio("./assets/audio/success.mp3"),
  explosion: new Audio("./assets/audio/explosion.mp3"),
  ambience: new Audio("./assets/audio/ambience.mp3"),
  applause: new Audio("./assets/audio/applause.mp3"),
  disappointment: new Audio("./assets/audio/disappointment.mp3")
};

// Preload audio
Object.values(SFX).forEach(audio => {
  audio.load();
});

SFX.ambience.loop = true;

function applySettings() {
  const vSuccess = (profile.settings?.volSuccess ?? 50) / 100;
  const vExplosion = (profile.settings?.volExplosion ?? 70) / 100;

  SFX.success.volume = Number.isFinite(vSuccess) ? Math.max(0, Math.min(1, vSuccess)) : 0.5;
  SFX.explosion.volume = Number.isFinite(vExplosion) ? Math.max(0, Math.min(1, vExplosion)) : 0.7;
  
  if (ui.ambienceToggle) {
    ui.ambienceToggle.checked = !!profile.settings?.ambience;
    if (ui.ambienceToggle.checked) {
      SFX.ambience.play().catch(() => {});
    } else {
      SFX.ambience.pause();
    }
  }

  // Appearance follows the system (prefers-color-scheme); there is no in-app override.
  document.documentElement.classList.remove("theme-dark", "theme-light");

  // Apply screenshot mode
  document.body.classList.toggle("screenshot-mode", !!profile.settings?.screenshotMode);
}

let isMuted = false;
let activeTimers = [];

function playSound(name, duration = 0) {
  if (isMuted) return;
  const sound = SFX[name];
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {});
    
    if (duration > 0) {
      const timer = setTimeout(() => {
        sound.pause();
        sound.currentTime = 0;
      }, duration);
      activeTimers.push(timer);
    }
  }
}

function stopSounds() {
  activeTimers.forEach(clearTimeout);
  activeTimers = [];
  Object.values(SFX).forEach(sound => {
    sound.pause();
    sound.currentTime = 0;
  });
}

function toggleMute() {
  isMuted = !isMuted;
  ui.muteBtn.textContent = isMuted ? "🔇" : "🔊";
  ui.muteBtn.setAttribute("aria-label", isMuted ? "Unmute sound" : "Mute sound");
}

function triggerExplosion() {
  playSound("explosion");
  const overlay = document.createElement("div");
  overlay.className = "explosion-overlay explosion-flash";
  document.body.appendChild(overlay);
  
  document.body.classList.add("shake");
  
  setTimeout(() => {
    overlay.remove();
    document.body.classList.remove("shake");
  }, 500);
}

function persistSession() {
  if (!storage) return;
  if ((game && game.phase === "playing") || (hunt && hunt.phase === "playing")) {
    saveSession(storage, {
      game,
      hunt,
      mode,
      lastSpecialty,
      huntHintUsed,
      day: today,
      version: deckVersion
    });
  } else {
    clearSession(storage);
  }
}

const storage = window.localStorage;
let now = new Date();
let today = dayKey(now);
let number = puzzleNumber(now);
let puzzle = buildPuzzle(questions, now, deckVersion);

function refreshDateContext() {
  now = new Date();
  today = dayKey(now);
  number = puzzleNumber(now);
  puzzle = buildPuzzle(questions, now, deckVersion);
}

let profile = readProfile(storage);
let game = null;
let hunt = null;
let huntStart = null;
let huntHintUsed = false;
let lastLives = HUNT_LIVES;
let drag = null;
let mode = "daily";
let activeRound = null;
let questionShownAt = 0;
let fastestThisRound = null;
let timer = null;
let lastSpecialty = null;

function showScreen(name) {
  if (name === "home") {
    refreshDateContext();
  }
  stopSounds();
  if (name !== "play") {
    stopTimer();
  }
  if (name === "profile") {
    renderProfile();
  }
  if (name === "settings") {
    renderSettings();
  }
  if (name === "specialties") {
    renderSpecialties();
  }

  const targetId = `screen-${name}`;
  const target = document.getElementById(targetId);
  if (!target) return;

  const allScreens = document.querySelectorAll(".screen");
  allScreens.forEach((s) => {
    if (!s.hidden && s.id !== targetId) {
      s.classList.add("is-leaving");
      setTimeout(() => {
        s.hidden = true;
        s.classList.remove("is-leaving");
      }, 280);
    }
  });

  setTimeout(() => {
    target.hidden = false;
    target.classList.add("is-entering");
    setTimeout(() => {
      target.classList.remove("is-entering");
    }, 400);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 280);
}

function startTimer() {
  stopTimer();
  ui.timerBar.style.transition = "none";
  ui.timerBar.style.transform = "scaleX(1)";
  ui.timerBar.classList.remove("is-low");

  // Force reflow and start transition in next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ui.timerBar.style.transition = `transform ${QUESTION_SECONDS}s linear`;
      ui.timerBar.style.transform = "scaleX(0)";
    });
  });

  let remaining = QUESTION_SECONDS;
  timer = setInterval(() => {
    remaining--;
    if (remaining <= 5) {
      ui.timerBar.classList.add("is-low");
    }
    if (remaining <= 0) {
      stopTimer();
      handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const computed = window.getComputedStyle(ui.timerBar);
  const matrix = new (window.DOMMatrix || window.WebKitCSSMatrix)(computed.transform);
  ui.timerBar.style.transition = "none";
  ui.timerBar.style.transform = `scaleX(${matrix.a})`;
}

const byId = (id) => document.getElementById(id);

const screens = ["home", "play", "hunt", "result", "review", "profile", "settings", "sources", "privacy"];

const ui = {
  loadingOverlay: byId("loading-overlay"),
  profileBtn: byId("profile-btn"),
  settingsBtn: byId("settings-btn"),
  streakCount: byId("streak-count"),
  homeDate: byId("home-date"),
  homeNumber: byId("home-number"),
  homeStatus: byId("home-status"),
  start: byId("start-btn"),
  startLabel: byId("start-label"),
  rankLabel: byId("rank-label"),
  rankXp: byId("rank-xp"),
  rankFill: byId("rank-fill"),
  rankHint: byId("rank-hint"),
  practice: byId("practice-btn"),
  sourcesBtn: byId("sources-btn"),
  privacyBtn: byId("privacy-btn"),
  privacyBack: byId("privacy-back"),
  huntBtn: byId("hunt-btn"),
  huntHearts: byId("hunt-hearts"),
  huntScore: byId("hunt-score"),
  huntCombo: byId("hunt-combo"),
  huntQuit: byId("hunt-quit"),
  huntCategory: byId("hunt-category"),
  huntCounter: byId("hunt-counter"),
  huntQuestion: byId("hunt-question"),
  huntGrid: byId("hunt-grid"),
  huntHint: byId("hunt-hint"),
  huntTip: byId("hunt-tip"),
  huntPreview: byId("hunt-preview"),
  huntBank: byId("hunt-bank"),
  huntFeedback: byId("hunt-feedback"),
  huntVerdict: byId("hunt-verdict"),
  huntExplanation: byId("hunt-explanation"),
  huntNext: byId("hunt-next"),
  toasts: byId("toasts"),
  confetti: byId("confetti"),
  statStreak: byId("stat-streak"),
  statBest: byId("stat-best"),
  statAccuracy: byId("stat-accuracy"),
  weekDays: byId("week-days"),
  weekNote: byId("week-note"),
  progress: byId("progress"),
  timerBar: byId("timer-bar"),
  modeChip: byId("mode-chip"),
  hint: byId("hint-btn"),
  hintLabel: byId("hint-label"),
  hintsLeft: byId("hints-left"),
  category: byId("category"),
  counter: byId("counter"),
  questionText: byId("question-text"),
  options: byId("options"),
  feedback: byId("feedback"),
  verdict: byId("feedback-verdict"),
  explanation: byId("feedback-explanation"),
  next: byId("next-btn"),
  resultEyebrow: byId("result-eyebrow"),
  resultScore: byId("result-score"),
  resultGrid: byId("result-grid"),
  resultStreak: byId("result-streak"),
  sum1v: byId("sum-1v"),
  sum1l: byId("sum-1l"),
  sum2v: byId("sum-2v"),
  sum2l: byId("sum-2l"),
  sum3v: byId("sum-3v"),
  sum3l: byId("sum-3l"),
  share: byId("share-btn"),
  review: byId("review-btn"),
  home: byId("home-btn"),
  reviewTitle: byId("review-title"),
  reviewBack: byId("review-back"),
  reviewList: byId("review-list"),
  profileBack: byId("profile-back"),
  categoryStats: byId("category-stats"),
  badgeGallery: byId("badge-gallery"),
  settingsBack: byId("settings-back"),
  volSuccess: byId("vol-success"),
  volExplosion: byId("vol-explosion"),
  hapticStrength: byId("haptic-strength"),
  sourcesBack: byId("sources-back"),
  comboTag: byId("combo-tag"),
  resultVerdict: byId("result-verdict"),
  perfectBadge: byId("perfect-badge"),
  questionCard: document.querySelector(".question-card"),
  ambienceToggle: byId("ambience-toggle"),
  specialtiesBtn: byId("specialties-btn"),
  specialtiesBack: byId("specialties-back"),
  specialtiesList: byId("specialties-list"),
  timeAttackBtn: byId("time-attack-btn"),
  attackQuit: byId("attack-quit"),
  attackTimer: byId("attack-timer"),
  attackScore: byId("attack-score"),
  attackQuestion: byId("attack-question"),
  attackOptions: byId("attack-options"),
  bestTimeAttack: byId("best-time-attack"),
  bestHuntScore: byId("best-hunt-score"),
  bestGlobalCombo: byId("best-global-combo"),
  screenshotMode: byId("screenshot-mode"),
  headAvatar: byId("head-avatar"),
  headName: byId("head-name"),
  currentAvatar: byId("current-avatar"),
  nicknameInput: byId("nickname-input"),
  missionsList: byId("missions-list"),
  missionsCount: byId("missions-count")
};

function toast(icon, title, note) {
  if (!ui.toasts) {
    return;
  }
  const item = document.createElement("div");
  item.className = "toast";
  const glyph = document.createElement("span");
  glyph.className = "toast-icon";
  glyph.textContent = icon;
  const body = document.createElement("div");
  body.className = "toast-body";
  const heading = document.createElement("b");
  heading.textContent = title;
  const caption = document.createElement("span");
  caption.textContent = note;
  body.append(heading, caption);
  item.append(glyph, body);
  ui.toasts.append(item);
  setTimeout(() => {
    item.classList.add("is-out");
    setTimeout(() => item.remove(), 320);
  }, 3400);
  return item;
}

function burst(count = 52) {
  if (!ui.confetti) {
    return;
  }
  const colors = ["#2dd4bf", "#22d3ee", "#8b5cf6", "#fbbf24", "#fb7185", "#34d399"];
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("i");
    piece.style.left = `${4 + Math.random() * 92}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty("--dx", `${Math.round((Math.random() - 0.5) * 240)}px`);
    piece.style.setProperty("--spin", `${Math.round(320 + Math.random() * 620)}deg`);
    piece.style.setProperty("--dur", `${(1.1 + Math.random() * 0.9).toFixed(2)}s`);
    piece.style.setProperty("--delay", `${Math.round(Math.random() * 200)}ms`);
    ui.confetti.append(piece);
    setTimeout(() => piece.remove(), 2800);
  }
}

function burstConfetti() {
  // Sound is now handled based on score in endRound/endHunt
  burst(36);
}

function burstLargeConfetti() {
  // Sound is now handled based on score in endRound/endHunt
  burst(64);
}

function showXpFloat(target, text) {
  const float = document.createElement("div");
  float.className = "xp-float";
  float.textContent = text;
  
  const rect = target.getBoundingClientRect();
  const randomX = (Math.random() - 0.5) * 40; // Random offset
  float.style.left = `${rect.left + rect.width / 2 + randomX}px`;
  float.style.top = `${rect.top}px`;
  
  document.body.appendChild(float);
  setTimeout(() => float.remove(), 800);
}

function trackMission(type, amount = 1) {
  const result = updateMissionProgress(profile, type, amount);
  if (result.completed) {
    toast("✨", "Mission Complete", "+50 XP earned!");
  }
  commitProfile(result.profile);
}

function commitProfile(next) {
  const before = profile;
  const beforeRank = rankInfo(before.xp);
  
  profile = syncBadges(next);
  const afterRank = rankInfo(profile.xp);
  
  writeProfile(storage, profile);
  applySettings();
  
  if (afterRank.level > beforeRank.level) {
    const rankToast = toast("🎓", "Rank Promoted!", `You are now a ${afterRank.name}`);
    if (rankToast) rankToast.classList.add("is-level-up");
    burstLargeConfetti();
  }
  
  freshBadges(before, profile).forEach((id) => {
    const badge = badgeById(id);
    if (badge) {
      toast("🏅", badge.name, badge.hint);
    }
  });
  renderHome();
}

function todaysEntry() {
  return profile.history[today] ?? null;
}

function timeUntilMidnight() {
  const target = new Date();
  target.setHours(24, 0, 0, 0);
  const remaining = target.getTime() - Date.now();
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function normalizedResults(entry) {
  return entry.results.map((value, index) => ({
    ok: value === 1 || value === true,
    chosen: entry.picks?.[index] ?? null
  }));
}

function getClinicalVerdict(score, total) {
  const ratio = score / total;
  if (ratio === 1) return "Exceptional Diagnosis";
  if (ratio >= 0.8) return "Strong Clinical Insight";
  if (ratio >= 0.6) return "Diligent Practitioner";
  if (ratio >= 0.4) return "Progressing Resident";
  return "Needs More Study";
}

function renderWeek() {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset));
  }
  ui.weekDays.replaceChildren();
  let done = 0;
  days.forEach((date) => {
    const key = dayKey(date);
    const filled = Boolean(profile.history[key]);
    if (filled) {
      done += 1;
    }
    const cell = document.createElement("div");
    cell.className = "week-day";
    if (filled) {
      cell.classList.add("is-done");
    }
    if (key === today) {
      cell.classList.add("is-today");
    }
    const box = document.createElement("i");
    box.textContent = filled ? "✓" : "";
    const label = document.createElement("span");
    label.textContent = date.toLocaleDateString(undefined, { weekday: "narrow" });
    cell.append(box, label);
    ui.weekDays.append(cell);
  });
  ui.weekNote.textContent = `${done} of 7`;
}

function celebrateStreak(streak) {
  const milestones = [3, 7, 14, 30];
  const milestone = milestones.find((m) => streak >= m);
  if (!milestone) {
    return;
  }
  // Show brief badge pulse and small confetti
  const badgeNames = { 3: "combo", 7: "week", 14: "detective", 30: "scholar" };
  const badge = badgeById(badgeNames[milestone]);
  if (badge) {
    toast("🏅", badge.name, badge.hint);
  }
  burst(24);
}

function todaysMissions() {
  const template = getDailyMissions(new Date());
  const saved = profile.missions;
  if (saved?.day === today && Array.isArray(saved.list) && saved.list.length === template.length) {
    return saved.list;
  }
  return template;
}

function renderMissions() {
  if (!ui.missionsList) return;
  const list = todaysMissions();
  const completed = list.filter((m) => m.completed).length;
  if (ui.missionsCount) ui.missionsCount.textContent = `${completed} / ${list.length}`;
  ui.missionsList.replaceChildren();
  list.forEach((m) => {
    const item = document.createElement("li");
    item.className = `missions-item${m.completed ? " is-done" : ""}`;
    const check = document.createElement("span");
    check.className = "mission-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = m.completed ? "✓" : "";
    const label = document.createElement("span");
    label.className = "mission-label";
    label.textContent = m.label;
    const progress = document.createElement("span");
    progress.className = "mission-progress";
    progress.textContent = `${m.progress ?? 0}/${m.target}`;
    item.append(check, label, progress);
    ui.missionsList.append(item);
  });
}

function renderHome() {
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
  const done = todaysEntry();
  const percent = accuracy(profile);
  const rank = rankInfo(profile.xp);

  ui.homeDate.textContent = dateLabel;
  ui.homeNumber.textContent = String(number);
  ui.streakCount.textContent = String(profile.streak);
  ui.statStreak.textContent = String(profile.streak);
  
  if (ui.headAvatar) ui.headAvatar.textContent = profile.avatar || "🩺";
  if (ui.headName) ui.headName.textContent = profile.nickname || "Clinician";
  
  const streakBadge = ui.streakCount.closest('.streak-badge');
  if (streakBadge) {
    streakBadge.classList.toggle('is-hot', profile.streak >= 3);
  }
  ui.statBest.textContent = String(profile.best);
  ui.statAccuracy.textContent = percent === null ? "—" : `${percent}%`;
  renderWeek();

  ui.rankLabel.textContent = rank.name;
  ui.rankXp.textContent = `${rank.xp} XP`;
  ui.rankFill.style.width = `${Math.round(rank.progress * 100)}%`;
  ui.rankHint.textContent = rank.next
    ? `${rank.next.xp - rank.xp} XP to ${rank.next.name}`
    : "Top rank reached";

  if (done) {
    ui.startLabel.textContent = "View today's result";
    ui.homeStatus.textContent = `You scored ${done.score}/${done.total} today. Next rounds in ${timeUntilMidnight()}.`;
  } else {
    ui.startLabel.textContent = "Start today's rounds";
    ui.homeStatus.textContent =
      profile.streak > 0 ? `Don't break your ${profile.streak} day streak.` : "";
  }

  // Celebrate streak milestones
  celebrateStreak(profile.streak);
  renderMissions();
  applySettings();
}

function renderProfile() {
  const stats = profile.stats || {};
  const categories = stats.categories || {};
  
  if (ui.nicknameInput) ui.nicknameInput.value = profile.nickname || "";
  if (ui.currentAvatar) ui.currentAvatar.textContent = profile.avatar || "🩺";
  
  document.querySelectorAll(".avatar-opt").forEach(opt => {
    opt.classList.toggle("is-selected", opt.dataset.avatar === profile.avatar);
  });

  ui.categoryStats.replaceChildren();
  Object.entries(categories).forEach(([name, data]) => {
    const item = document.createElement("div");
    item.className = "category-item";
    
    const info = document.createElement("div");
    info.className = "category-info";
    const label = document.createElement("span");
    label.textContent = name;
    const count = document.createElement("span");
    const acc = data.answered > 0 ? Math.round((data.correct / data.answered) * 100) : 0;
    count.textContent = `${data.correct}/${data.answered} (${acc}%)`;
    info.append(label, count);
    
    const bar = document.createElement("div");
    bar.className = "category-bar";
    const fill = document.createElement("div");
    fill.className = "category-fill";
    fill.style.width = `${acc}%`;
    bar.append(fill);
    
    item.append(info, bar);
    ui.categoryStats.append(item);
  });

  ui.badgeGallery.replaceChildren();
  BADGES.forEach(badge => {
    const item = document.createElement("div");
    const earned = isBadgeEarned(profile, badge.id);
    item.className = `badge-item ${earned ? "is-earned" : ""}`;
    
    const icon = document.createElement("div");
    icon.className = "badge-icon";
    icon.textContent = "🏅";
    
    const name = document.createElement("div");
    name.className = "badge-name";
    name.textContent = badge.name;
    
    item.append(icon, name);
    item.title = badge.hint;
    ui.badgeGallery.append(item);
  });

  // Render Leaderboard Best Scores
  if (ui.bestTimeAttack) ui.bestTimeAttack.textContent = `${stats.bestTimeAttack || 0} pts`;
  if (ui.bestHuntScore) ui.bestHuntScore.textContent = `${stats.bestHuntScore || 0} pts`;
  if (ui.bestGlobalCombo) ui.bestGlobalCombo.textContent = String(stats.bestCombo || 0);
}

function renderSettings() {
  const s = profile.settings || {};
  ui.volSuccess.value = s.volSuccess ?? 50;
  ui.volExplosion.value = s.volExplosion ?? 70;
  ui.hapticStrength.value = s.haptics || "medium";
  ui.ambienceToggle.checked = s.ambience ?? false;
  ui.screenshotMode.checked = document.body.classList.contains("screenshot-mode");
}

function updateSettings() {
  const volSuccess = Number(ui.volSuccess.value);
  const volExplosion = Number(ui.volExplosion.value);

  profile.settings = {
    volSuccess: Number.isFinite(volSuccess) ? volSuccess : 50,
    volExplosion: Number.isFinite(volExplosion) ? volExplosion : 70,
    haptics: ui.hapticStrength.value,
    ambience: ui.ambienceToggle.checked,
    screenshotMode: ui.screenshotMode.checked
  };
  
  document.body.classList.toggle("screenshot-mode", ui.screenshotMode.checked);
  commitProfile(profile);
}

function renderDots() {
  ui.progress.replaceChildren();
  for (let index = 0; index < game.puzzle.length; index += 1) {
    const dot = document.createElement("span");
    dot.className = "dot";
    const result = game.results[index];
    if (result) {
      dot.classList.add(result.ok ? "is-ok" : "is-bad");
    } else if (index === game.index && game.phase === "playing") {
      dot.classList.add("is-active");
    }
    ui.progress.append(dot);
  }
}

function renderHint() {
  const free = game.hintsLeft > 0;
  ui.hintLabel.textContent = free ? "50/50" : "Watch ad";
  ui.hintsLeft.textContent = free ? String(game.hintsLeft) : "+1";
  ui.hint.classList.toggle("is-ad", !free);
  ui.hint.disabled = game.revealed;
  ui.hint.setAttribute(
    "aria-label",
    free ? `Use a 50/50 hint, ${game.hintsLeft} left` : "Watch a rewarded ad for another hint"
  );
}

function renderQuestion() {
  const question = currentQuestion(game);
  ui.category.textContent = question.category;
  ui.counter.textContent = `${game.index + 1} / ${game.puzzle.length}`;
  ui.questionText.textContent = question.question;
  renderHint();
  ui.modeChip.hidden = mode !== "practice";
  
  if (ui.comboTag) {
    const mult = multiplier(game);
    ui.comboTag.hidden = mult <= 1;
    ui.comboTag.textContent = `x${mult.toFixed(1)}`;
  }

  if (ui.questionCard) {
    ui.questionCard.classList.remove("is-new");
    void ui.questionCard.offsetWidth; // Force reflow
    ui.questionCard.classList.add("is-new");
  }

  ui.feedback.hidden = true;
  ui.next.hidden = true;
  ui.options.replaceChildren();
  questionShownAt = Date.now();
  startTimer();

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option staggered-item";
    button.style.setProperty("--delay", `${index * 80}ms`);
    button.dataset.option = option;
    button.dataset.key = String(index + 1);
    const key = document.createElement("span");
    key.className = "option-key";
    key.textContent = String.fromCharCode(65 + index);
    const label = document.createElement("span");
    label.className = "option-text";
    label.textContent = option;
    button.append(key, label);
    if (game.eliminated.includes(option)) {
      button.classList.add("is-eliminated");
      button.disabled = true;
    }
    button.addEventListener("click", () => handleAnswer(option));
    ui.options.append(button);
  });

  renderDots();
}

function revealOptions(chosen) {
  const question = currentQuestion(game);
  ui.options.querySelectorAll(".option").forEach((button) => {
    button.disabled = true;
    const option = button.dataset.option;
    if (option === question.answer) {
      button.classList.add("is-correct");
    } else if (option === chosen) {
      button.classList.add("is-wrong");
    }
  });
}

function handleAnswer(option) {
  if (game.revealed || game.phase !== "playing") {
    return;
  }
  stopTimer();
  const elapsed = Date.now() - questionShownAt;
  const secondsLeft = Math.max(0, QUESTION_SECONDS - elapsed / 1000);

  game = answer(game, option, { ms: elapsed, secondsLeft });
  persistSession();
  const result = game.results[game.results.length - 1];
  const question = currentQuestion(game);
  if (elapsed > 0 && (fastestThisRound === null || elapsed < fastestThisRound)) {
    fastestThisRound = elapsed;
  }

  if (result.ok) {
    playSound("success");
    triggerHaptic("LIGHT");
    const correctBtn = ui.options.querySelector(`[data-option="${question.answer}"]`);
    if (correctBtn) {
      correctBtn.classList.add("is-correct-pop");
      showXpFloat(correctBtn, "+15 XP");
    }
  } else {
    triggerExplosion();
    triggerHaptic("MEDIUM");
    document.body.classList.remove("shake");
    void document.body.offsetWidth; // Force reflow
    document.body.classList.add("shake");
  }

  highlightOption(option);
  revealOptions(option);
  ui.verdict.textContent = result.ok ? "Correct" : `Not quite. Answer: ${question.answer}`;
  ui.verdict.className = `verdict ${result.ok ? "is-ok" : "is-bad"}`;
  ui.explanation.textContent = question.explanation;
  ui.feedback.hidden = false;
  ui.feedback.classList.remove("pop-in");
  // Force reflow
  ui.feedback.getBoundingClientRect();
  ui.feedback.classList.add("pop-in");
  ui.next.hidden = false;
  ui.next.textContent = isLastQuestion(game) ? "Results" : "Next";
  ui.hint.disabled = true;
  renderDots();
  
  if (isLastQuestion(game)) {
    const score = scoreOf(game);
    if (score === game.puzzle.length) {
      trackMission("perfect_count");
    }
  }
}

function handleTimeout() {
  if (game.revealed || game.phase !== "playing") {
    return;
  }
  game = timeout(game);
  persistSession();
  const question = currentQuestion(game);

  triggerExplosion();
  triggerHaptic("MEDIUM");
  revealOptions(null);
  ui.verdict.textContent = "Time's up!";
  ui.verdict.className = "verdict is-bad";
  ui.explanation.textContent = `The correct answer was: ${question.answer}. ${question.explanation}`;
  ui.feedback.hidden = false;
  ui.feedback.classList.remove("pop-in");
  // Force reflow
  ui.feedback.getBoundingClientRect();
  ui.feedback.classList.add("pop-in");
  ui.next.hidden = false;
  ui.next.textContent = isLastQuestion(game) ? "Results" : "Next";
  ui.hint.disabled = true;
  renderDots();
}

async function handleHint() {
  if (!game || game.revealed || game.phase !== "playing" || ui.hint.disabled) {
    return;
  }
  if (game.hintsLeft > 0) {
    game = useHint(game);
    persistSession();
    renderHint();
    trackMission("hint_count");
    ui.options.querySelectorAll(".option").forEach((button) => {
      if (game.eliminated.includes(button.dataset.option)) {
        button.classList.add("is-eliminated");
        button.disabled = true;
      }
    });
    return;
  }
  ui.hint.disabled = true;
  ui.hintLabel.textContent = "Loading";
  ui.hintsLeft.textContent = "";
  const earned = await requestRewardedHint();
  if (earned) {
    game = grantHint(game);
    persistSession();
    trackMission("ad_count");
    commitProfile(recordAdWatch(profile));
  }
  renderHint();
  if (earned) {
    handleHint();
  }
}

function renderSpecialties() {
  const rank = rankInfo(profile.xp);
  ui.specialtiesList.replaceChildren();

  SPECIALTIES.forEach((spec) => {
    const card = document.createElement("button");
    card.className = "specialty-card";
    const isLocked = rank.level < spec.minLevel;
    if (isLocked) card.classList.add("is-locked");

    card.innerHTML = `
      <span class="spec-name">${spec.icon} ${spec.id}</span>
      <span class="spec-meta">${isLocked ? `Unlocks at ${rankInfo(spec.minLevel * 400).name}` : "Available"}</span>
      ${isLocked ? '<span class="lock-icon">🔒</span>' : ""}
    `;

    if (!isLocked) {
      card.addEventListener("click", () => startSpecialtyRound(spec.id));
    }
    ui.specialtiesList.appendChild(card);
  });
}

function startSpecialtyRound(category) {
  const filtered = questions.filter((q) => q.category === category);
  if (filtered.length < 5) {
    toast("⚠️", "Not enough cases", `Only ${filtered.length} cases available in ${category}`);
    return;
  }
  // Shuffle and pick 5
  const picked = shuffle(filtered).slice(0, 5);
  game = createGame(picked);
  persistSession();
  mode = "practice";
  lastSpecialty = category;
  ui.modeChip.hidden = false;
  ui.modeChip.textContent = category;
  showScreen("play");
  renderQuestion();
}

let attackTimer = null;
let attackSeconds = 60;
let attackScore = 0;

function startTimeAttack() {
  lastSpecialty = null;
  mode = "attack";
  attackSeconds = 60;
  attackScore = 0;
  ui.attackTimer.textContent = String(attackSeconds);
  ui.attackScore.textContent = String(attackScore);
  showScreen("time-attack");
  
  nextAttackQuestion();
  
  if (attackTimer) clearInterval(attackTimer);
  attackTimer = setInterval(() => {
    attackSeconds--;
    ui.attackTimer.textContent = String(attackSeconds);
    if (attackSeconds <= 0) {
      finishTimeAttack();
    }
  }, 1000);
}

function nextAttackQuestion() {
  if (attackSeconds <= 0) return;
  const q = questions[Math.floor(Math.random() * questions.length)];
  ui.attackQuestion.textContent = q.question;
  ui.attackOptions.replaceChildren();
  
  shuffle(q.options).forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-option";
    btn.textContent = opt;
    btn.addEventListener("click", () => {
      if (attackSeconds <= 0) return;
      const correct = opt === q.answer;
      if (correct) {
        attackScore += 100;
        playSound("success");
      } else {
        attackSeconds -= 5; // Penalty
        playSound("explosion");
        triggerHaptic("HEAVY");
      }
      ui.attackScore.textContent = String(attackScore);
      nextAttackQuestion();
    });
    ui.attackOptions.appendChild(btn);
  });
}

function finishTimeAttack() {
  if (attackTimer) clearInterval(attackTimer);
  attackTimer = null;
  
  const xpGained = calculateXp({ mode: "attack", points: attackScore });
  const updatedProfile = {
    ...profile,
    xp: profile.xp + xpGained
  };
  
  commitProfile(recordHighScore(updatedProfile, "attack", attackScore));
  
  activeRound = {
    mode: "attack",
    score: attackScore,
    total: 1,
    results: [{ ok: true }],
    points: attackScore,
    eyebrow: "Time Attack"
  };
  renderResult(activeRound);
  showScreen("result");

  if (attackScore >= 500) {
    playSound("success");
    playSound("applause", attackScore >= 1500 ? 4000 : 2000);
    if (attackScore >= 1000) {
      burstLargeConfetti();
    } else {
      burstConfetti();
    }
  } else {
    playSound("disappointment", 3000);
  }
}

function openProfile() {
  renderProfile();
  
  if (ui.bestTimeAttack) ui.bestTimeAttack.textContent = `${profile.stats?.bestTimeAttack || 0} pts`;
  if (ui.bestHuntScore) ui.bestHuntScore.textContent = `${profile.stats?.bestHuntScore || 0} pts`;
  if (ui.bestGlobalCombo) ui.bestGlobalCombo.textContent = String(profile.stats?.bestCombo || 0);
  
  showScreen("profile");
}

function handleNext() {
  stopSounds();
  if (isLastQuestion(game)) {
    endRound();
    return;
  }
  game = advance(game);
  persistSession();
  renderQuestion();
}

function renderHearts() {
  ui.huntHearts.replaceChildren();
  for (let index = 0; index < HUNT_LIVES; index += 1) {
    const heart = document.createElement("span");
    heart.className = "heart";
    heart.textContent = "♥";
    if (index >= hunt.lives) {
      heart.classList.add("is-lost");
      if (index === hunt.lives && hunt.lives < lastLives) {
        heart.classList.add("is-pulse");
      }
    }
    ui.huntHearts.append(heart);
  }
  lastLives = hunt.lives;
  ui.huntHearts.setAttribute("aria-label", `${hunt.lives} of ${HUNT_LIVES} lives left`);
}

function renderHuntHud() {
  renderHearts();
  ui.huntScore.textContent = String(hunt.score);
  const factor = multiplier(hunt);
  ui.huntCombo.hidden = hunt.combo === 0;
  ui.huntCombo.textContent = `×${Number(factor.toFixed(1))}`;
}

function cellButton(cell) {
  return ui.huntGrid.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
}

function markCells(cells, className, stagger = 0) {
  cells.forEach((cell, index) => {
    const button = cellButton(cell);
    if (!button) {
      return;
    }
    if (stagger > 0) {
      button.style.animationDelay = `${index * stagger}ms`;
    }
    button.classList.add(className);
  });
}

function clearMarks(className) {
  ui.huntGrid.querySelectorAll(`.${className}`).forEach((element) => {
    element.classList.remove(className);
  });
}

function renderHuntGrid(round) {
  ui.huntGrid.replaceChildren();
  ui.huntGrid.style.setProperty("--hunt-size", String(hunt.size));
  round.grid.letters.forEach((row, rowIndex) => {
    row.forEach((letter, colIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hunt-cell";
      button.textContent = letter;
      button.dataset.row = String(rowIndex);
      button.dataset.col = String(colIndex);
      button.style.setProperty("--i", String(rowIndex + colIndex));
      button.setAttribute(
        "aria-label",
        `${letter}, row ${rowIndex + 1}, column ${colIndex + 1}`
      );
      if (huntStart && huntStart.row === rowIndex && huntStart.col === colIndex) {
        button.classList.add("is-start");
      }
      button.addEventListener("click", (event) => {
        if (event.detail === 0) {
          handleHuntCell({ row: rowIndex, col: colIndex });
        }
      });
      button.addEventListener("pointerdown", (event) => onCellDown(event, { row: rowIndex, col: colIndex }));
      button.addEventListener("pointermove", onCellMove);
      button.addEventListener("pointerup", onCellUp);
      button.addEventListener("pointercancel", onCellCancel);
      ui.huntGrid.append(button);
    });
  });
}

function renderHuntBank(round) {
  ui.huntBank.replaceChildren();
  round.bank.forEach((word) => {
    const item = document.createElement("li");
    item.dataset.word = word;
    const label = document.createElement("span");
    label.textContent = word;
    const size = document.createElement("span");
    size.className = "word-length";
    size.textContent = String(word.length);
    item.append(label, size);
    if (round.found.includes(word)) {
      item.classList.add(word === round.case.answer ? "is-found" : "is-lost");
    }
    ui.huntBank.append(item);
  });
}

function clearPreview() {
  clearMarks("is-preview");
  ui.huntPreview.textContent = "";
}

function updatePreview(start, end) {
  clearMarks("is-preview");
  const cells = lineCells(hunt.size, start, end);
  if (cells.length < 2) {
    ui.huntPreview.textContent = "";
    return;
  }
  const round = currentRound(hunt);
  const letters = [];
  cells.forEach((cell, index) => {
    letters.push(round.grid.letters[cell.row][cell.col]);
    if (index > 0) {
      cellButton(cell)?.classList.add("is-preview");
    }
  });
  ui.huntPreview.textContent = letters.join(" ");
}

function resetSelection() {
  huntStart = null;
  drag = null;
  clearMarks("is-start");
  clearPreview();
  ui.huntTip.textContent = "Drag from the first letter to the last, or tap both.";
}

function renderHunt() {
  const round = currentRound(hunt);
  ui.huntCategory.textContent = round.case.category;
  ui.huntCounter.textContent = `${hunt.index + 1} / ${hunt.rounds.length}`;
  ui.huntQuestion.textContent = round.case.question;
  ui.huntFeedback.hidden = true;
  ui.huntNext.hidden = true;
  ui.huntHint.disabled = false;
  huntHintUsed = false;
  lastLives = hunt.lives;
  resetSelection();
  renderHuntHud();
  renderHuntGrid(round);
  renderHuntBank(round);
}

function revealHuntNext() {
  ui.huntNext.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function showHuntRoundEnd(round) {
  ui.huntVerdict.className = "verdict is-bad";
  ui.huntVerdict.textContent = hunt.lives === 0 
    ? `Out of lives. The answer was ${round.case.answer}.`
    : `Round over. The answer was ${round.case.answer}.`;
  ui.huntExplanation.textContent = round.case.explanation;
  ui.huntFeedback.hidden = false;
  ui.huntNext.hidden = false;
  ui.huntNext.textContent = (isLastRound(hunt) || hunt.lives === 0) ? "Results" : "Next";
  ui.huntTip.textContent = "Word Hunt rounds do not affect your streak.";
  ui.huntHint.disabled = true;
  markCells(answerCells(round), "is-answer", 40);
  revealHuntNext();
}

function commitLine(start, end) {
  const result = selectCells(hunt, start, end);

  if (result.outcome === "idle") {
    return;
  }

  if (result.outcome === "invalid") {
    ui.huntTip.textContent = "That line is not one of the words. Hearts are safe.";
    return;
  }

  if (result.outcome === "repeat") {
    ui.huntTip.textContent = "You already found that word.";
    return;
  }

  hunt = result.state;
  persistSession();
  const round = currentRound(hunt);
  renderHuntHud();
  renderHuntBank(round);

  if (result.outcome === "answer") {
        playSound("success");
        triggerHaptic("LIGHT");
      markCells(result.cells, "is-word", 45);
      const lastCell = result.cells[result.cells.length - 1];
      const target = cellButton(lastCell);
      if (target) showXpFloat(target, `+${Math.round(result.gained / 5)} XP`);
    ui.huntVerdict.className = "verdict is-ok";
    ui.huntVerdict.textContent = `Found it. +${result.gained} points.`;
    ui.huntExplanation.textContent = round.case.explanation;
    ui.huntFeedback.hidden = false;
    ui.huntHint.disabled = true;
    ui.huntTip.textContent = "Find the term, not the distractor. Decoys cost a heart.";
    ui.huntNext.hidden = false;
    ui.huntNext.textContent = (isLastRound(hunt) || hunt.lives === 0) ? "Results" : "Next";
    if (round.misses === 0 && result.gained >= HUNT_POINTS * 1.5) {
      burst(36);
    }
    revealHuntNext();
    return;
  }

  markCells(result.cells, "is-wrong", 35);
  triggerExplosion();
  triggerHaptic("MEDIUM");
  ui.huntVerdict.className = "verdict is-bad";
  ui.huntVerdict.textContent =
    hunt.lives > 0
      ? `"${result.word}" is a decoy. ${hunt.lives} ${hunt.lives === 1 ? "heart" : "hearts"} left.`
      : `"${result.word}" is a decoy.`;
  ui.huntExplanation.textContent =
    hunt.lives > 0 ? "Look for the term that answers the question." : round.case.explanation;
  ui.huntFeedback.hidden = false;
  ui.huntTip.textContent = "The answer is still hidden in the grid.";

  if (hunt.lives === 0) {
    showHuntRoundEnd(round);
  }
}

function handleHuntCell(cell) {
  if (!hunt) {
    return;
  }
  const round = currentRound(hunt);
  if (hunt.phase !== "playing" || isRoundOver(round)) {
    return;
  }

  if (!huntStart) {
    huntStart = cell;
    cellButton(cell)?.classList.add("is-start");
    ui.huntTip.textContent = "Now tap the last letter of the word.";
    return;
  }

  if (huntStart.row === cell.row && huntStart.col === cell.col) {
    resetSelection();
    return;
  }

  const start = huntStart;
  resetSelection();
  commitLine(start, cell);
}

function hoveredCell(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const cell = element?.closest?.(".hunt-cell");
  if (!cell || !ui.huntGrid.contains(cell)) {
    return null;
  }
  return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
}

function onCellDown(event, cell) {
  if (!hunt || isRoundOver(currentRound(hunt)) || event.button > 0) {
    return;
  }
  event.preventDefault();

  if (huntStart && (huntStart.row !== cell.row || huntStart.col !== cell.col)) {
    const start = huntStart;
    resetSelection();
    commitLine(start, cell);
    return;
  }

  huntStart = cell;
  drag = { id: event.pointerId };
  clearMarks("is-start");
  cellButton(cell)?.classList.add("is-start");
  ui.huntTip.textContent = "Now tap the last letter of the word.";
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function onCellMove(event) {
  if (!drag || drag.id !== event.pointerId || !huntStart) {
    return;
  }
  const cell = hoveredCell(event);
  if (!cell || (cell.row === huntStart.row && cell.col === huntStart.col)) {
    clearPreview();
    return;
  }
  updatePreview(huntStart, cell);
}

function onCellUp(event) {
  if (!drag || drag.id !== event.pointerId) {
    return;
  }
  const start = huntStart;
  drag = null;
  if (!start) {
    return;
  }
  const cell = hoveredCell(event);
  if (!cell || (cell.row === start.row && cell.col === start.col)) {
    clearPreview();
    return;
  }
  resetSelection();
  commitLine(start, cell);
}

function onCellCancel() {
  drag = null;
  clearPreview();
}

function handleHuntHint() {
  if (!hunt || huntHintUsed || isRoundOver(currentRound(hunt))) {
    return;
  }
  const cells = answerCells(currentRound(hunt));
  if (cells.length === 0) {
    return;
  }
  huntHintUsed = true;
  persistSession();
  ui.huntHint.disabled = true;
  cellButton(cells[0])?.classList.add("is-hint");
  ui.huntTip.textContent = "The answer starts on the highlighted letter.";
}

function handleHuntNext() {
  stopSounds();
  if (!hunt || !isRoundOver(currentRound(hunt))) {
    return;
  }
  hunt = nextRound(hunt);
  persistSession();
  if (hunt.phase !== "playing") {
    endHunt();
    return;
  }
  renderHunt();
}

function startHunt() {
  lastSpecialty = null;
  hunt = buildHunt(`${today}:${Date.now()}`);
  persistSession();
  huntStart = null;
  huntHintUsed = false;
  lastLives = HUNT_LIVES;
  renderHunt();
  showScreen("hunt");
  trackMission("hunt_count");
}

function endHunt() {
  const stats = summary(hunt);
  commitProfile(
    recordHunt(profile, {
      score: stats.score,
      solved: stats.solved,
      cases: stats.cases,
      flawless: stats.lives === HUNT_LIVES,
      results: stats.results
    })
  );

  activeRound = {
    mode: "hunt",
    score: stats.solved,
    total: stats.cases,
    points: stats.score,
    bestCombo: stats.bestCombo,
    results: hunt.rounds.map((round) => ({ ok: round.solved, chosen: round.case.answer }))
  };
  hunt = finishHunt(hunt);
  persistSession();
  renderResult(activeRound);
  showScreen("result");
  
  if (stats.solved >= 3) {
    playSound("success");
    playSound("applause", stats.solved === stats.cases ? 4000 : 2000);
    if (stats.solved === stats.cases) {
      burstLargeConfetti();
    } else {
      burstConfetti();
    }
  } else {
    playSound("disappointment", 3000);
  }
}

function endRound() {
  const score = scoreOf(game);
  const total = game.puzzle.length;

  if (mode === "daily") {
    profile = applyCompletion(
      profile,
      today,
      score,
      total,
      game.results,
      game.results.map((result) => result.chosen)
    );
  } else {
    profile = recordPractice(profile, score, total);
  }
  commitProfile(recordQuiz(profile, { 
    score, 
    total, 
    fastestMs: fastestThisRound, 
    results: game.results,
    bestCombo: game.bestCombo
  }));

  activeRound = {
    mode,
    number,
    puzzle: game.puzzle,
    score,
    total,
    results: game.results
  };
  game = finish(game);
  persistSession();
  renderResult(activeRound);
  showScreen("result");

  if (score >= 3) {
    playSound("success");
    playSound("applause", score === total ? 4000 : 2000);
    if (score === total) {
      burstLargeConfetti();
    } else {
      burstConfetti();
    }
  } else {
    playSound("disappointment", 3000);
  }
}

function shareTitle() {
  if (activeRound?.mode === "hunt") {
    return "MedMyst Word Hunt";
  }
  return activeRound?.mode === "practice" ? "MedMyst Practice Round" : `MedMyst Case #${number}`;
}

function renderResult(round) {
  const isHunt = round.mode === "hunt";
  const isAttack = round.mode === "attack";
  
  ui.resultEyebrow.textContent = isHunt
    ? "Word Hunt"
    : isAttack
      ? "Time Attack"
      : round.mode === "practice"
        ? "Practice round"
        : `Case ${round.number ?? number}`;
  
  const isPerfect = round.score === round.total && round.total > 0;
  
  if (ui.resultVerdict) {
    ui.resultVerdict.textContent = isHunt 
      ? (round.points > 1000 ? "Master Tracker" : "Clinical Observer")
      : isAttack
        ? (round.points > 1500 ? "Speed Demon" : "Rapid Responder")
        : getClinicalVerdict(round.score, round.total);
  }

  if (ui.perfectBadge) {
    ui.perfectBadge.hidden = isAttack || !isPerfect;
  }

  ui.resultScore.textContent = isAttack ? String(round.score) : `${round.score}/${round.total}`;
  ui.resultGrid.textContent = isAttack ? "⚡⚡⚡" : resultGrid(round.results);
  
  ui.streakCount.textContent = String(profile.streak);
  ui.review.hidden = isHunt || isAttack;
  ui.resultStreak.textContent = isHunt || isAttack
    ? `${round.points} points earned. ${isHunt ? "Word Hunt" : "Time Attack"} never changes your streak.`
    : round.mode === "practice"
      ? "Practice rounds do not change your streak."
      : profile.streak > 1
        ? `🔥 ${profile.streak} day streak`
        : profile.streak === 1
          ? "Streak started."
          : "Play tomorrow to start a streak.";
  ui.share.textContent = "Share result";
  ui.share.disabled = false;
  ui.home.textContent = lastSpecialty ? "Back to Specialties" : "Back to Home";

  const earnedXp = calculateXp({ 
    mode: round.mode, 
    score: round.score, 
    total: round.total, 
    points: round.points 
  });
  ui.sum1v.textContent = (isHunt || isAttack) ? String(round.points ?? 0) : `${round.score}/${round.total}`;
  ui.sum1l.textContent = (isHunt || isAttack) ? "points" : "correct";
  ui.sum2v.textContent = `+${earnedXp}`;
  ui.sum2l.textContent = "XP earned";
  ui.sum3v.textContent = isHunt ? String(round.bestCombo ?? 0) : String(profile.streak);
  ui.sum3l.textContent = isHunt ? "best combo" : "day streak";
}

function openReview() {
  if (!activeRound) {
    return;
  }
  const items = buildReview(activeRound.puzzle, activeRound.results);
  ui.reviewTitle.textContent =
    activeRound.mode === "practice" ? "Practice review" : `Case ${activeRound.number} review`;
  ui.reviewList.replaceChildren();

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card review-item";

    const top = document.createElement("div");
    top.className = "card-top";
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = item.category;
    const mark = document.createElement("span");
    mark.className = `mark ${item.ok ? "is-ok" : "is-bad"}`;
    mark.textContent = item.ok ? "✓" : "✗";
    top.append(chip, mark);

    const heading = document.createElement("h3");
    heading.textContent = item.question;

    const chosen = document.createElement("p");
    chosen.className = "review-line";
    const chosenLabel = document.createElement("span");
    chosenLabel.textContent = "Your answer";
    const chosenValue = document.createElement("b");
    chosenValue.textContent = item.chosen ?? "Not recorded";
    chosen.append(chosenLabel, chosenValue);

    const why = document.createElement("p");
    why.className = "explanation";
    why.textContent = item.explanation;

    card.append(top, heading, chosen);

    if (!item.ok) {
      const correct = document.createElement("p");
      correct.className = "review-line";
      const correctLabel = document.createElement("span");
      correctLabel.textContent = "Correct";
      const correctValue = document.createElement("b");
      correctValue.textContent = item.correct;
      correct.append(correctLabel, correctValue);
      card.append(correct);
    }

    card.append(why);

    const searchLink = document.createElement("a");
    searchLink.className = "link-btn source-link";
    searchLink.href = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(item.question)}`;
    searchLink.target = "_blank";
    searchLink.rel = "noopener";
    searchLink.textContent = "Search PubMed";
    searchLink.style.marginTop = "8px";
    searchLink.style.display = "inline-block";
    card.append(searchLink);

    ui.reviewList.append(card);
  });

  showScreen("review");
}

async function handleShare() {
  if (!activeRound) {
    return;
  }
  const text = buildShareText({
    title: shareTitle(),
    number,
    score: activeRound.score,
    total: activeRound.total,
    results: activeRound.results,
    streak: activeRound.mode === "practice" ? 0 : profile.streak,
    url: location.href
  });

  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch {
      return;
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    ui.share.textContent = "Copied to clipboard";
    setTimeout(() => {
      ui.share.textContent = "Share result";
    }, 1800);
  } catch {
    const fallback = document.createElement("p");
    fallback.className = "share-fallback";
    fallback.textContent = text;
    ui.share.after(fallback);
  }
}

function startRound(nextMode) {
  refreshDateContext();
  lastSpecialty = null;
  mode = nextMode;
  fastestThisRound = null;

  if (mode === "daily") {
    const entry = todaysEntry();
    if (entry) {
      activeRound = {
        mode,
        number,
        puzzle: restorePuzzle(questions, entry) ?? puzzle,
        score: entry.score,
        total: entry.total,
        results: normalizedResults(entry)
      };
      renderResult(activeRound);
    showScreen("result");
    if (activeRound.score === activeRound.total) {
      burstLargeConfetti();
    } else {
      burstConfetti();
    }
    return;
    }
    game = createGame(puzzle);
    persistSession();
    trackMission("daily_count");
  } else {
    game = createGame(buildPractice(questions, Date.now()));
    persistSession();
    trackMission("practice_count");
  }

  renderQuestion();
  showScreen("play");
}

function highlightOption(option) {
  const button = ui.options.querySelector(`[data-option="${option}"]`);
  if (!button) {
    return;
  }
  button.classList.add("is-highlighted");
  setTimeout(() => {
    button.classList.remove("is-highlighted");
  }, 160);
}

if (ui.nicknameInput) {
  ui.nicknameInput.addEventListener("input", (e) => {
    profile.nickname = e.target.value || "Clinician";
    writeProfile(storage, profile);
    if (ui.headName) ui.headName.textContent = profile.nickname;
  });
}

document.addEventListener("click", (e) => {
  const avatarOpt = e.target.closest(".avatar-opt");
  if (avatarOpt) {
    profile.avatar = avatarOpt.dataset.avatar;
    writeProfile(storage, profile);
    if (ui.currentAvatar) ui.currentAvatar.textContent = profile.avatar;
    if (ui.headAvatar) ui.headAvatar.textContent = profile.avatar;
    
    document.querySelectorAll(".avatar-opt").forEach(opt => {
      opt.classList.toggle("is-selected", opt.dataset.avatar === profile.avatar);
    });
    
    triggerHaptic("LIGHT");
    playSound("success");
  }
});

ui.profileBtn.addEventListener("click", openProfile);
ui.settingsBtn.addEventListener("click", () => showScreen("settings"));
ui.start.addEventListener("click", () => startRound("daily"));
ui.practice.addEventListener("click", () => startRound("practice"));
ui.specialtiesBtn.addEventListener("click", () => showScreen("specialties"));
ui.specialtiesBack.addEventListener("click", () => showScreen("home"));
ui.timeAttackBtn.addEventListener("click", startTimeAttack);
ui.attackQuit.addEventListener("click", () => {
  clearInterval(attackTimer);
  showScreen("home");
});
ui.ambienceToggle.addEventListener("change", updateSettings);
ui.screenshotMode.addEventListener("change", updateSettings);
  const privacyBtn = document.getElementById("privacy-options-btn");
  if (privacyBtn) {
    privacyBtn.addEventListener("click", showPrivacyOptions);
  }
  ui.huntBtn.addEventListener("click", startHunt);
ui.huntNext.addEventListener("click", handleHuntNext);
ui.huntHint.addEventListener("click", handleHuntHint);
ui.huntQuit.addEventListener("click", () => {
  hunt = null;
  huntStart = null;
  drag = null;
  renderHome();
  showScreen("home");
});
ui.hint.addEventListener("click", handleHint);
ui.next.addEventListener("click", handleNext);
ui.share.addEventListener("click", handleShare);
ui.review.addEventListener("click", openReview);
ui.reviewBack.addEventListener("click", () => showScreen("result"));
ui.profileBack.addEventListener("click", () => showScreen("home"));
ui.settingsBack.addEventListener("click", () => showScreen("home"));
ui.volSuccess.addEventListener("input", updateSettings);
ui.volExplosion.addEventListener("input", updateSettings);
ui.hapticStrength.addEventListener("change", updateSettings);
ui.sourcesBtn.addEventListener("click", () => showScreen("sources"));
ui.sourcesBack.addEventListener("click", () => {
  renderHome();
  showScreen("home");
});
ui.privacyBtn.addEventListener("click", () => showScreen("privacy"));
ui.privacyBack.addEventListener("click", () => {
  renderHome();
  showScreen("home");
});
ui.home.addEventListener("click", () => {
  if (lastSpecialty) {
    showScreen("specialties");
    lastSpecialty = null;
  } else {
    renderHome();
    showScreen("home");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !byId("screen-hunt").hidden && !ui.huntNext.hidden) {
    ui.huntNext.click();
    return;
  }
  if (byId("screen-play").hidden || game === null) {
    return;
  }
  if (event.key >= "1" && event.key <= "4" && !game.revealed) {
    const button = ui.options.querySelector(`[data-key="${event.key}"]`);
    if (button && !button.disabled) {
      button.click();
    }
  }
  if (event.key === "Enter" && !ui.next.hidden) {
    ui.next.click();
  }
});

try {
  renderHome();
  showScreen("home");
  initializeAdMob();

  const savedSession = readSession(storage);
  if (savedSession && savedSession.version === deckVersion) {
    const isStaleDaily = savedSession.mode === "daily" && savedSession.day !== today;
    const isAlreadyDoneDaily = savedSession.mode === "daily" && todaysEntry();

    if (isStaleDaily || isAlreadyDoneDaily) {
      clearSession(storage);
    } else {
      game = savedSession.game;
      hunt = savedSession.hunt;
      mode = savedSession.mode;
      lastSpecialty = savedSession.lastSpecialty;
      huntHintUsed = savedSession.huntHintUsed || false;
      
      const sessionLabel = mode === "daily" ? "Daily Rounds" : mode === "practice" ? "Practice" : "Word Hunt";
      toast("⏱️", "Session Resumed", `Continuing your ${sessionLabel} progress`);

      if (game && game.phase === "playing") {
        showScreen("play");
        renderQuestion();
        if (game.revealed) {
          stopTimer();
          const question = currentQuestion(game);
          const result = game.results[game.results.length - 1];
          revealOptions(result.chosen);
          ui.verdict.textContent = result.ok
            ? "Correct"
            : result.timedOut
              ? "Time's up!"
              : `Not quite. Answer: ${question.answer}`;
          ui.verdict.className = `verdict ${result.ok ? "is-ok" : "is-bad"}`;
          ui.explanation.textContent = question.explanation;
          ui.feedback.hidden = false;
          ui.next.hidden = false;
          ui.next.textContent = isLastQuestion(game) ? "Results" : "Next";
          ui.hint.disabled = true;
          renderDots();
        }
      } else if (hunt && hunt.phase === "playing") {
        showScreen("hunt");
        renderHunt();
        const round = currentRound(hunt);
        if (isRoundOver(round)) {
          if (round.solved) {
            markCells(answerCells(round), "is-word");
            ui.huntVerdict.className = "verdict is-ok";
            ui.huntVerdict.textContent = `Found it. +${round.gained} points.`;
            ui.huntExplanation.textContent = round.case.explanation;
            ui.huntFeedback.hidden = false;
            ui.huntHint.disabled = true;
            ui.huntNext.hidden = false;
            ui.huntNext.textContent = isLastRound(hunt) ? "Results" : "Next";
          } else if (round.failed) {
            showHuntRoundEnd(round);
          }
        } else if (huntHintUsed) {
          const cells = answerCells(round);
          if (cells.length > 0) {
            cellButton(cells[0])?.classList.add("is-hint");
          }
          ui.huntHint.disabled = true;
        }
      }
    }
  }
} catch (e) {
  console.error("Initialization error:", e);
}

let lastBackPress = 0;
if (App) {
  App.addListener('backButton', () => {
    const activeScreen = screens.find(s => !byId(`screen-${s}`).hidden);
    
    if (activeScreen === 'home') {
      const now = Date.now();
      if (now - lastBackPress < 2000) {
        App.exitApp();
      } else {
        lastBackPress = now;
        toast("👋", "Press back again to exit", "Tap twice to close MedMyst");
      }
    } else if (activeScreen === 'play') {
      // Play is mid-round; require a double press instead of silently killing it
      const now = Date.now();
      if (now - lastBackPress < 2000) {
        clearSession(storage);
        renderHome();
        showScreen('home');
      } else {
        lastBackPress = now;
        toast("↩️", "Quit this round?", "Press back again to exit the round");
      }
    } else if (activeScreen === 'hunt') {
      ui.huntQuit.click();
    } else if (activeScreen === 'time-attack') {
      ui.attackQuit.click();
    } else if (activeScreen === 'review') {
      ui.reviewBack.click();
    } else if (activeScreen === 'profile') {
      ui.profileBack.click();
    } else if (activeScreen === 'settings') {
      ui.settingsBack.click();
    } else if (activeScreen === 'specialties') {
      ui.specialtiesBack.click();
    } else if (activeScreen === 'sources') {
      ui.sourcesBack.click();
    } else if (activeScreen === 'privacy') {
      ui.privacyBack.click();
    } else {
      renderHome();
      showScreen('home');
    }
  });
}

setInterval(() => {
  if (dayKey(new Date()) !== today) {
    if (byId("screen-play").hidden) {
      location.reload();
    }
    return;
  }
  if (!byId("screen-home").hidden) {
    renderHome();
  }
}, 30000);

const SPLASH_MIN_MS = 400;
let splashShownAt = performance.now();

function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash) {
    showLoading(false);
    return;
  }

  // Hide as soon as the home screen has painted, but never faster than
  // SPLASH_MIN_MS so the splash doesn't flash on cold starts.
  const elapsed = performance.now() - splashShownAt;
  const delay = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(() => {
    splash.classList.add("is-hidden");
    setTimeout(() => {
      splash.remove();
      showLoading(false);
    }, 450);
  }, delay);
}

hideSplash();

if (
  "serviceWorker" in navigator &&
  location.protocol === "https:" &&
  !window.Capacitor?.isNativePlatform?.()
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
