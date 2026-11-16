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
  assert.equal(restored.stats.answered, 10);
  assert.equal(restored.stats.fastestMs, null);
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
    fastestMs: null,
    answered: 0,
    categories: {}
  });
  assert.deepEqual(profile.badges, []);
  assert.deepEqual(profile.mystery, { solved: 0 });
});


