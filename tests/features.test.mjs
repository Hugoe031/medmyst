import test from "node:test";
import assert from "node:assert/strict";

import { buildPractice } from "../src/core/practice.js";
import { buildReview, restorePuzzle } from "../src/core/review.js";
import {
  accuracy,
  applyCompletion,
  emptyProfile,
  readProfile,
  recordAdWatch,
  recordHunt,
  recordPractice,
  recordQuiz,
  writeProfile
} from "../src/core/storage.js";
import { buildShareText } from "../src/core/share.js";
import { getDailyMissions, updateMissionProgress } from "../src/core/missions.js";
import { isBadgeEarned } from "../src/core/progress.js";
import { dayKey } from "../src/core/scheduler.js";
import { questions } from "../src/data/questions.js";

test("buildPractice is deterministic for a given seed", () => {
  const a = buildPractice(questions, 12345, 5);
  const b = buildPractice(questions, 12345, 5);
  assert.deepEqual(a, b);
});

test("buildPractice returns the requested number of unique questions", () => {
  const round = buildPractice(questions, 999, 5);
  assert.equal(round.length, 5);
  assert.equal(new Set(round.map((item) => item.id)).size, 5);
});

test("buildPractice keeps every option and the answer", () => {
  const round = buildPractice(questions, 7, 10);
  round.forEach((item) => {
    const source = questions.find((question) => question.id === item.id);
    assert.deepEqual([...item.options].sort(), [...source.options].sort());
    assert.ok(item.options.includes(item.answer));
  });
});

test("different practice seeds produce different rounds", () => {
  const signatures = new Set();
  for (let seed = 0; seed < 20; seed += 1) {
    signatures.add(buildPractice(questions, seed, 5).map((item) => item.id).join(","));
  }
  assert.ok(signatures.size > 15, `only ${signatures.size} distinct rounds`);
});

test("buildReview pairs results with the questions in order", () => {
  const round = questions.slice(0, 3);
  const review = buildReview(round, [
    { chosen: round[0].answer, ok: true },
    { chosen: "wrong answer", ok: false },
    { chosen: null, ok: false }
  ]);
  assert.equal(review.length, 3);
  assert.equal(review[0].correct, round[0].answer);
  assert.equal(review[0].ok, true);
  assert.equal(review[1].chosen, "wrong answer");
  assert.equal(review[2].chosen, null);
  assert.ok(review[0].explanation.length > 0);
});

test("buildReview tolerates missing results", () => {
  const review = buildReview(questions.slice(0, 2), []);
  assert.equal(review.length, 2);
  assert.equal(review[0].ok, false);
  assert.equal(review[0].chosen, null);
});

test("restorePuzzle rebuilds a stored round by question id", () => {
  const round = questions.slice(3, 6);
  const entry = {
    total: round.length,
    ids: round.map((question) => question.id),
    results: [1, 0, 1],
    picks: [round[0].answer, "something else", round[2].answer]
  };
  const restored = restorePuzzle(questions, entry);
  assert.deepEqual(
    restored.map((question) => question.id),
    round.map((question) => question.id)
  );
  const review = buildReview(restored, entry.results.map((value, index) => ({
    chosen: entry.picks[index],
    ok: value === 1
  })));
  assert.equal(review[0].chosen, round[0].answer);
  assert.equal(review[1].chosen, "something else");
});

test("restorePuzzle falls back when ids are missing or stale", () => {
  assert.equal(restorePuzzle(questions, { total: 2, results: [1, 0] }), null);
  assert.equal(
    restorePuzzle(questions, { total: 2, ids: ["gone-01", "gone-02"], results: [1, 0] }),
    null
  );
  assert.equal(
    restorePuzzle(questions, { total: 3, ids: ["anat-01", "anat-02"], results: [1, 0, 1] }),
    null
  );
});

test("applyCompletion stores the chosen answers and question ids", () => {
  const profile = applyCompletion(
    emptyProfile(),
    "2026-10-21",
    1,
    2,
    [
      { id: "anat-01", ok: true },
      { id: "anat-02", ok: false }
    ],
    ["correct", "wrong"]
  );
  const entry = profile.history["2026-10-21"];
  assert.deepEqual(entry.picks, ["correct", "wrong"]);
  assert.deepEqual(entry.ids, ["anat-01", "anat-02"]);
  assert.deepEqual(entry.results, [1, 0]);
});

test("recordPractice accumulates rounds and answers", () => {
  let profile = emptyProfile();
  profile = recordPractice(profile, 3, 5);
  profile = recordPractice(profile, 5, 5);
  assert.equal(profile.practice.rounds, 2);
  assert.equal(profile.practice.correct, 8);
  assert.equal(profile.practice.answered, 10);
});

test("accuracy is null with no data and blends daily and practice", () => {
  let profile = emptyProfile();
  assert.equal(accuracy(profile), null);

  profile = recordPractice(profile, 3, 5);
  assert.equal(accuracy(profile), 60);

  profile = applyCompletion(profile, "2026-10-21", 5, 5, [{ ok: true }]);
  assert.equal(accuracy(profile), 80);
});

test("buildShareText accepts a custom title for practice rounds", () => {
  const text = buildShareText({
    title: "MedMyst practice",
    number: 1,
    score: 4,
    total: 5,
    results: [{ ok: true }, { ok: true }, { ok: true }, { ok: true }, { ok: false }],
    streak: 0
  });
  assert.match(text, /^MedMyst practice {2}4\/5/);
  assert.match(text, /🟩🟩🟩🟩🟥/);
  assert.doesNotMatch(text, /streak/);
});

test("recordAdWatch counts rewarded views and survives storage", () => {
  let profile = recordAdWatch(emptyProfile());
  profile = recordAdWatch(profile);
  assert.equal(profile.ads.watched, 2);
  assert.equal(recordAdWatch({}).ads.watched, 1);
});

test("recordHunt accumulates experience, hunt totals, and stats", () => {
  let profile = emptyProfile();
  profile = recordHunt(profile, { score: 400, solved: 4, cases: 5 });
  profile = recordHunt(profile, { score: 250, solved: 5, cases: 5, flawless: true });

  assert.equal(profile.xp, 130);
  assert.deepEqual(profile.hunt, { rounds: 2, solved: 9, cases: 10, best: 5 });
  assert.deepEqual(profile.mystery, { solved: 9 });
  assert.equal(profile.stats.rounds, 2);
  assert.equal(profile.stats.perfect, 1);
  assert.equal(profile.stats.flawless, 1);
  assert.equal(profile.stats.bestCombo, 5);
  assert.equal(profile.stats.answered, 10);

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value)
  };
  writeProfile(storage, profile);
  const restored = readProfile(storage);
  assert.equal(restored.xp, 130);
  assert.equal(restored.hunt.rounds, 2);
  assert.equal(restored.hunt.best, 5);
  assert.equal(restored.mystery.solved, 9);
  assert.equal(restored.stats.answered, 10);
  assert.equal(restored.stats.fastestMs, null);
});

test("word hunts earn the Detective badge", () => {
  let profile = emptyProfile();
  assert.equal(isBadgeEarned(profile, "detective"), false);
  profile = recordHunt(profile, { score: 100, solved: 1, cases: 5 });
  assert.equal(isBadgeEarned(profile, "detective"), true);
});

test("recordQuiz awards experience and round stats", () => {
  let profile = recordQuiz(emptyProfile(), { score: 3, total: 5, fastestMs: 4200 });
  assert.equal(profile.xp, 45);
  assert.equal(profile.stats.rounds, 1);
  assert.equal(profile.stats.perfect, 0);
  assert.equal(profile.stats.fastestMs, 4200);
  assert.equal(profile.stats.answered, 5);

  profile = recordQuiz(profile, { score: 5, total: 5, fastestMs: 9000 });
  assert.equal(profile.xp, 170);
  assert.equal(profile.stats.perfect, 1);
  assert.equal(profile.stats.flawless, 1);
  assert.equal(profile.stats.fastestMs, 4200);
  assert.equal(profile.stats.answered, 10);
});

test("readProfile fills in hunt and stats defaults for older saves", () => {
  const storage = {
    getItem: () => JSON.stringify({ streak: 2, history: {} })
  };
  const profile = readProfile(storage);
  assert.equal(profile.xp, 0);
  assert.deepEqual(profile.hunt, { rounds: 0, solved: 0, cases: 0, best: 0 });
  assert.deepEqual(profile.stats, {
    rounds: 0,
    perfect: 0,
    flawless: 0,
    bestCombo: 0,
    bestTimeAttack: 0,
    bestHuntScore: 0,
    fastestMs: null,
    answered: 0,
    categories: {},
    leaderboards: { daily: [], practice: [], hunt: [], attack: [] }
  });
  assert.deepEqual(profile.badges, []);
  assert.deepEqual(profile.mystery, { solved: 0 });
});

test("readProfile keeps leaderboards, hunt bests, and audio settings", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value)
  };

  let profile = emptyProfile();
  profile = recordHunt(profile, { score: 900, solved: 5, cases: 5, bestCombo: 5 });
  profile.stats.bestTimeAttack = 1400;
  profile.settings.ambience = true;
  writeProfile(storage, profile);

  const restored = readProfile(storage);
  assert.equal(restored.stats.bestHuntScore, 900);
  assert.equal(restored.stats.bestTimeAttack, 1400);
  assert.equal(restored.settings.ambience, true);
  assert.equal(restored.stats.leaderboards.hunt[0].score, 900);
  assert.equal(restored.stats.leaderboards.attack.length, 0);
});

test("readProfile discards malformed leaderboard entries", () => {
  const storage = {
    getItem: () =>
      JSON.stringify({
        stats: {
          leaderboards: {
            hunt: [{ score: "nope" }, { score: 120, date: "2026-01-01" }],
            attack: "broken"
          }
        }
      })
  };
  const profile = readProfile(storage);
  assert.deepEqual(profile.stats.leaderboards.hunt, [{ score: 120, date: "2026-01-01" }]);
  assert.deepEqual(profile.stats.leaderboards.attack, []);
});

test("recordHunt prefers the real combo over the solved count", () => {
  const profile = recordHunt(emptyProfile(), {
    score: 300,
    solved: 5,
    cases: 5,
    bestCombo: 2
  });
  assert.equal(profile.stats.bestCombo, 5);
  const lower = recordHunt(emptyProfile(), {
    score: 300,
    solved: 2,
    cases: 5,
    bestCombo: 4
  });
  assert.equal(lower.stats.bestCombo, 4);
});

test("getDailyMissions is deterministic and picks 3 unique missions", () => {
  const missions = getDailyMissions(new Date());
  assert.equal(missions.length, 3);
  assert.equal(new Set(missions.map((m) => m.id)).size, 3);
  missions.forEach((m) => {
    assert.equal(m.progress, 0);
    assert.equal(m.completed, false);
    assert.ok(m.target >= 1);
    assert.ok(typeof m.label === "string" && m.label.length > 0);
  });
  const again = getDailyMissions(new Date());
  assert.deepEqual(missions, again);
});

test("shipped deck spreads correct answers across all four option positions", () => {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  questions.forEach((item) => {
    const index = item.options.indexOf(item.answer);
    assert.notEqual(index, -1, `question "${item.id}" answer is not in its options`);
    counts["ABCD"[index]] += 1;
  });
  Object.entries(counts).forEach(([letter, count]) => {
    assert.ok(count > 0, `option ${letter} never holds a correct answer`);
    assert.ok(count / questions.length <= 0.4, `option ${letter} holds ${count}/${questions.length} answers`);
  });
});

test("updateMissionProgress accumulates and pays 50 XP on completion", () => {
  const fresh = emptyProfile();
  const day = dayKey(new Date());
  const list = getDailyMissions(new Date());
  const target = list[0];
  const result = updateMissionProgress({ ...fresh, missions: { day, list } }, target.type, target.target);
  const updated = result.profile.missions.list.find((m) => m.type === target.type);
  assert.equal(updated.completed, true);
  assert.equal(result.completed, true);
  assert.equal(result.profile.xp, fresh.xp + 50);
});

test("updateMissionProgress keeps the profile immutable and persists progress", () => {
  const fresh = emptyProfile();
  const target = getDailyMissions(new Date())[0];
  const first = updateMissionProgress(fresh, target.type, 1);
  assert.notEqual(first.profile, fresh);
  const saved = first.profile.missions.list.find((m) => m.type === target.type);
  assert.equal(saved.progress, 1);

  const storage = {
    getItem: () => JSON.stringify(first.profile),
    setItem: () => {}
  };
  const restored = readProfile(storage);
  const restoredMission = restored.missions.list.find((m) => m.type === target.type);
  assert.equal(restoredMission.progress, 1);
});


