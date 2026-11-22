// Spaced-repetition queue for cases the player answered incorrectly.
//
// A miss schedules the case for tomorrow. Each later correct answer moves it
// through 3 days and 7 days; a third correct answer retires it from the queue.
// Answering it wrong again restarts at tomorrow.

import { dayKey, shiftDayKey } from "./scheduler.js";
import { seededShuffle } from "./rng.js";

export const MISSED_INTERVALS = [1, 3, 7];
export const MISSED_LIMIT = 5;

export function emptyMissed() {
  return {
    cases: {},
    mistakes: 0,
    reviews: 0,
    recovered: 0
  };
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function nonNegativeInt(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function validDay(value, fallback) {
  return typeof value === "string" && datePattern.test(value) ? value : fallback;
}

export function sanitizeMissed(value, fallbackDay = dayKey()) {
  const source = value && typeof value === "object" ? value : {};
  const cases = {};
  const rawCases = source.cases && typeof source.cases === "object" ? source.cases : {};

  Object.entries(rawCases).forEach(([id, item]) => {
    if (typeof id !== "string" || id.length === 0 || !item || typeof item !== "object") {
      return;
    }
    const stage = Math.min(MISSED_INTERVALS.length - 1, nonNegativeInt(item.stage));
    cases[id] = {
      id,
      category: typeof item.category === "string" ? item.category : "Unknown",
      stage,
      misses: Math.max(1, nonNegativeInt(item.misses)),
      correct: nonNegativeInt(item.correct),
      due: validDay(item.due, fallbackDay),
      lastMissed: validDay(item.lastMissed, null),
      lastSeen: validDay(item.lastSeen, null)
    };
  });

  return {
    cases,
    mistakes: nonNegativeInt(source.mistakes),
    reviews: nonNegativeInt(source.reviews),
    recovered: nonNegativeInt(source.recovered)
  };
}

export function recordMissedResults(state, results = [], day = dayKey()) {
  const current = sanitizeMissed(state, day);
  const cases = { ...current.cases };
  let { mistakes, reviews, recovered } = current;

  results.forEach((result) => {
    if (!result || typeof result.id !== "string" || result.id.length === 0) {
      return;
    }
    const id = result.id;

    if (result.ok) {
      const item = cases[id];
      if (!item) {
        return;
      }
      reviews += 1;
      const nextStage = nonNegativeInt(item.stage) + 1;
      if (nextStage >= MISSED_INTERVALS.length) {
        delete cases[id];
        recovered += 1;
        return;
      }
      cases[id] = {
        ...item,
        stage: nextStage,
        correct: nonNegativeInt(item.correct) + 1,
        due: shiftDayKey(day, MISSED_INTERVALS[nextStage]),
        lastSeen: day
      };
      return;
    }

    const previous = cases[id];
    mistakes += 1;
    cases[id] = {
      id,
      category: typeof result.category === "string" ? result.category : previous?.category ?? "Unknown",
      stage: 0,
      misses: nonNegativeInt(previous?.misses) + 1,
      // A fresh miss resets the successful streak for this case.
      correct: 0,
      due: shiftDayKey(day, MISSED_INTERVALS[0]),
      lastMissed: day,
      lastSeen: day
    };
  });

  return { ...current, cases, mistakes, reviews, recovered };
}

export function dueMissedCases(state, day = dayKey(), limit = MISSED_LIMIT) {
  const cases = sanitizeMissed(state, day).cases;
  return Object.values(cases)
    .filter((item) => item.due <= day)
    .sort((a, b) => a.due.localeCompare(b.due) || b.misses - a.misses || a.id.localeCompare(b.id))
    .slice(0, Number.isFinite(limit) ? Math.max(0, limit) : MISSED_LIMIT);
}

export function missedSummary(state, day = dayKey()) {
  const current = sanitizeMissed(state, day);
  const entries = Object.values(current.cases);
  return {
    due: entries.filter((item) => item.due <= day).length,
    queued: entries.length,
    reviews: current.reviews,
    recovered: current.recovered
  };
}

export function nextDueDay(state, day = dayKey()) {
  const entries = Object.values(sanitizeMissed(state, day).cases);
  const upcoming = entries
    .map((item) => item.due)
    .filter((due) => due > day)
    .sort();
  return upcoming[0] ?? null;
}

export function buildMissedRound(questions, state, day = dayKey(), seed = Date.now(), limit = MISSED_LIMIT) {
  const lookup = new Map(questions.map((question) => [question.id, question]));
  return dueMissedCases(state, day, limit)
    .map((item) => lookup.get(item.id))
    .filter(Boolean)
    .map((question) => ({
      ...question,
      options: seededShuffle(question.options, `options:${question.id}:${seed}`)
    }));
}
