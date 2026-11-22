import assert from "node:assert/strict";
import test from "node:test";

import {
  MISSED_INTERVALS,
  buildMissedRound,
  dueMissedCases,
  emptyMissed,
  missedSummary,
  nextDueDay,
  recordMissedResults,
  sanitizeMissed
} from "../src/core/missed.js";
import { shiftDayKey } from "../src/core/scheduler.js";
import { emptyProfile, readProfile, recordQuiz, writeProfile } from "../src/core/storage.js";
import { questions } from "../src/data/questions.js";

const DAY = "2026-11-22";

function miss(id, category = "Testing", ok = false) {
  return { id, category, ok };
}

test("shiftDayKey handles month and year boundaries", () => {
  assert.equal(shiftDayKey("2026-01-31", 1), "2026-02-01");
  assert.equal(shiftDayKey("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftDayKey("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDayKey("not-a-day", 1), "not-a-day");
});

test("a wrong answer schedules the case one day later", () => {
  const next = recordMissedResults(emptyMissed(), [miss("anat-01", "Anatomy")], DAY);

  assert.equal(next.mistakes, 1);
  assert.deepEqual(next.cases["anat-01"], {
    id: "anat-01",
    category: "Anatomy",
    stage: 0,
    misses: 1,
    correct: 0,
    due: "2026-11-23",
    lastMissed: DAY,
    lastSeen: DAY
  });
  assert.equal(dueMissedResultsFor(next, DAY), 0);
  assert.equal(dueMissedResultsFor(next, "2026-11-23"), 1);
});

function dueMissedResultsFor(state, day) {
  return dueMissedCases(state, day, Infinity).length;
}

test("correct answers move through 3 and 7 days, then graduate", () => {
  let state = recordMissedResults(emptyMissed(), [miss("anat-02", "Anatomy")], DAY);
  assert.deepEqual(MISSED_INTERVALS, [1, 3, 7]);

  state = recordMissedResults(state, [miss("anat-02", "Anatomy", true)], "2026-11-23");
  assert.equal(state.cases["anat-02"].stage, 1);
  assert.equal(state.cases["anat-02"].due, "2026-11-26");
  assert.equal(state.reviews, 1);

  state = recordMissedResults(state, [miss("anat-02", "Anatomy", true)], "2026-11-26");
  assert.equal(state.cases["anat-02"].stage, 2);
  assert.equal(state.cases["anat-02"].due, "2026-12-03");
  assert.equal(state.reviews, 2);

  state = recordMissedResults(state, [miss("anat-02", "Anatomy", true)], "2026-12-03");
  assert.equal(state.cases["anat-02"], undefined);
  assert.equal(state.recovered, 1);
  assert.equal(state.reviews, 3);
});

test("a new miss resets the stage and successful streak", () => {
  let state = recordMissedResults(emptyMissed(), [miss("anat-03")], DAY);
  state = recordMissedResults(state, [miss("anat-03", "Anatomy", true)], "2026-11-23");
  assert.equal(state.cases["anat-03"].stage, 1);

  state = recordMissedResults(state, [miss("anat-03")], "2026-11-26");
  assert.equal(state.cases["anat-03"].stage, 0);
  assert.equal(state.cases["anat-03"].misses, 2);
  assert.equal(state.cases["anat-03"].correct, 0);
  assert.equal(state.cases["anat-03"].due, "2026-11-27");
  assert.equal(state.mistakes, 2);
});

test("correct answers for cases not in the queue are ignored", () => {
  const state = recordMissedResults(emptyMissed(), [miss("anat-04", "Anatomy", true)], DAY);
  assert.deepEqual(state, emptyMissed());
});

test("dueMissedCases filters future cases, sorts, and enforces the limit", () => {
  const state = {
    cases: {
      later: { id: "later", stage: 0, misses: 1, due: "2026-11-30" },
      old: { id: "old", stage: 0, misses: 1, due: "2026-11-20" },
      frequent: { id: "frequent", stage: 0, misses: 4, due: DAY },
      today: { id: "today", stage: 0, misses: 2, due: DAY }
    }
  };

  assert.deepEqual(
    dueMissedCases(state, DAY, Infinity).map((item) => item.id),
    ["old", "frequent", "today"]
  );
  assert.deepEqual(dueMissedCases(state, DAY, 2).map((item) => item.id), ["old", "frequent"]);
  assert.equal(missedSummary(state, DAY).due, 3);
  assert.equal(missedSummary(state, DAY).queued, 4);
  assert.equal(nextDueDay(state, DAY), "2026-11-30");
});

test("sanitizeMissed drops malformed cases and clamps values", () => {
  const clean = sanitizeMissed({
    cases: {
      good: { id: "good", category: "Labs", stage: 99, misses: -2, correct: "3", due: "2026-11-23" },
      bad: null,
      "": { due: DAY }
    },
    mistakes: -5,
    reviews: "4",
    recovered: 2.9
  }, DAY);

  assert.deepEqual(Object.keys(clean.cases), ["good"]);
  assert.equal(clean.cases.good.stage, MISSED_INTERVALS.length - 1);
  assert.equal(clean.cases.good.misses, 1);
  assert.equal(clean.cases.good.correct, 3);
  assert.equal(clean.mistakes, 0);
  assert.equal(clean.reviews, 4);
  assert.equal(clean.recovered, 2);
});

test("buildMissedRound returns only due questions that still exist", () => {
  const due = questions.slice(0, 2);
  const state = {
    cases: {
      [due[0].id]: { id: due[0].id, due: DAY, misses: 1, stage: 0 },
      [due[1].id]: { id: due[1].id, due: "2026-12-01", misses: 1, stage: 0 },
      "removed-question": { id: "removed-question", due: DAY, misses: 1, stage: 0 }
    }
  };

  const round = buildMissedRound(questions, state, DAY, "seed");
  assert.deepEqual(round.map((question) => question.id), [due[0].id]);
  assert.ok(round[0].options.includes(round[0].answer));
});

test("recordQuiz updates the missed queue and survives a storage round-trip", () => {
  const profile = recordQuiz(emptyProfile(), {
    score: 1,
    total: 2,
    type: "daily",
    day: DAY,
    results: [miss("anat-01", "Anatomy", false), miss("anat-02", "Anatomy", true)]
  });

  assert.equal(profile.missed.mistakes, 1);
  assert.equal(profile.missed.cases["anat-01"].due, "2026-11-23");
  assert.equal(profile.stats.leaderboards.missed.length, 0);

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value)
  };
  writeProfile(storage, profile);
  const restored = readProfile(storage);
  assert.equal(restored.missed.cases["anat-01"].due, "2026-11-23");
  assert.equal(restored.missed.mistakes, 1);
});
