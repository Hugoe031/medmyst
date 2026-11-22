import test from "node:test";
import assert from "node:assert/strict";

import { hashString, mulberry32, seededShuffle } from "../src/core/rng.js";
import {
  PUZZLE_SIZE,
  buildPuzzle,
  dayKey,
  dayNumber,
  previousDayKey,
  puzzleNumber
} from "../src/core/scheduler.js";
import {
  advance,
  answer,
  createGame,
  currentQuestion,
  finish,
  grantHint,
  isLastQuestion,
  scoreOf,
  useHint
} from "../src/core/game.js";
import { applyCompletion, emptyProfile } from "../src/core/storage.js";
import { buildShareText, resultGrid } from "../src/core/share.js";
import {
  getRewardedUnitId,
  hasNativeRewarded,
  nativeAds,
  REWARDED_PROD_UNIT,
  REWARDED_TEST_UNIT,
  showNativeRewarded
} from "../src/core/rewarded.js";
import { RELEASE_BUILD } from "../src/core/build-config.js";
import { questions, deckVersion } from "../src/data/questions.js";

const localDate = (year, month, day) => new Date(year, month - 1, day, 12, 0, 0);

test("hashString is stable and differs across inputs", () => {
  assert.equal(hashString("medmyst"), hashString("medmyst"));
  assert.notEqual(hashString("a"), hashString("b"));
});

test("mulberry32 stays in range and is reproducible", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 200; i += 1) {
    const value = a();
    assert.ok(value >= 0 && value < 1);
    assert.equal(value, b());
  }
});

test("seededShuffle is deterministic and a permutation", () => {
  const input = ["a", "b", "c", "d", "e", "f", "g"];
  const first = seededShuffle(input, "seed");
  const second = seededShuffle(input, "seed");
  assert.deepEqual(first, second);
  assert.deepEqual([...first].sort(), [...input].sort());
  assert.notDeepEqual(first, input);
});

test("dayKey formats a local date", () => {
  assert.equal(dayKey(localDate(2026, 3, 7)), "2026-03-07");
});

test("previousDayKey crosses month and year boundaries", () => {
  assert.equal(previousDayKey("2026-03-01"), "2026-02-28");
  assert.equal(previousDayKey("2026-01-01"), "2025-12-31");
  assert.equal(previousDayKey("2024-03-01"), "2024-02-29");
});

test("puzzleNumber increases by one per day", () => {
  const first = puzzleNumber(localDate(2026, 10, 21));
  const next = puzzleNumber(localDate(2026, 10, 22));
  assert.equal(next, first + 1);
});

test("dayNumber ignores time of day", () => {
  assert.equal(dayNumber(localDate(2026, 5, 9)), dayNumber(new Date(2026, 4, 9, 23, 59)));
});

test("buildPuzzle is deterministic for a given date", () => {
  const date = localDate(2026, 10, 21);
  const a = buildPuzzle(questions, date, deckVersion);
  const b = buildPuzzle(questions, date, deckVersion);
  assert.deepEqual(a, b);
});

test("buildPuzzle returns the requested size with unique questions", () => {
  const puzzle = buildPuzzle(questions, localDate(2026, 10, 21), deckVersion);
  assert.equal(puzzle.length, PUZZLE_SIZE);
  assert.equal(new Set(puzzle.map((item) => item.id)).size, PUZZLE_SIZE);
});

test("buildPuzzle keeps every original option after shuffling", () => {
  const source = new Map(questions.map((item) => [item.id, item.options]));
  const puzzle = buildPuzzle(questions, localDate(2026, 10, 21), deckVersion);
  puzzle.forEach((item) => {
    assert.deepEqual([...item.options].sort(), [...source.get(item.id)].sort());
    assert.ok(item.options.includes(item.answer), `${item.id} lost its answer`);
  });
});

test("different dates produce different puzzles", () => {
  const signatures = new Set();
  for (let day = 1; day <= 14; day += 1) {
    const puzzle = buildPuzzle(questions, localDate(2026, 10, day), deckVersion);
    signatures.add(puzzle.map((item) => item.id).join(","));
  }
  assert.ok(signatures.size > 10, `only ${signatures.size} distinct puzzles in 14 days`);
});

test("full game flow scores correctly", () => {
  let state = createGame(questions.slice(0, 5));
  assert.equal(state.phase, "playing");
  assert.equal(currentQuestion(state).id, questions[0].id);

  for (let index = 0; index < 5; index += 1) {
    const question = currentQuestion(state);
    state = answer(state, question.answer);
    assert.equal(state.revealed, true);
    if (index < 4) {
      assert.equal(isLastQuestion(state), false);
      state = advance(state);
      assert.equal(state.revealed, false);
      assert.equal(state.index, index + 1);
    }
  }

  assert.equal(isLastQuestion(state), true);
  assert.equal(scoreOf(state), 5);
  state = finish(state);
  assert.equal(state.phase, "finished");
});

test("answering twice does not double count", () => {
  let state = createGame(questions.slice(0, 5));
  state = answer(state, "definitely not an option");
  state = answer(state, questions[0].answer);
  assert.equal(state.results.length, 1);
  assert.equal(scoreOf(state), 0);
});

test("useHint removes two wrong options and spends one hint", () => {
  let state = createGame(questions.slice(0, 5), 1);
  state = useHint(state);
  assert.equal(state.hintsLeft, 0);
  assert.equal(state.eliminated.length, 2);
  assert.ok(state.eliminated.every((option) => option !== currentQuestion(state).answer));
  assert.equal(useHint(state), state);
});

test("grantHint adds a hint and ignores finished games", () => {
  let state = createGame(questions.slice(0, 5), 0);
  state = grantHint(state);
  assert.equal(state.hintsLeft, 1);
  state = useHint(state);
  assert.equal(state.hintsLeft, 0);
  assert.equal(grantHint(finish(state)).hintsLeft, 0);
});

test("stacked hints never eliminate the answer or repeat options", () => {
  let state = createGame(questions.slice(0, 1), 2);
  state = useHint(state);
  state = useHint(state);
  assert.equal(state.hintsLeft, 0);
  assert.equal(new Set(state.eliminated).size, state.eliminated.length);
  assert.equal(state.eliminated.length, 3);
  assert.ok(state.eliminated.every((option) => option !== currentQuestion(state).answer));
  assert.deepEqual(useHint(state).eliminated, state.eliminated);
});

test("cannot advance before answering", () => {  const state = createGame(questions.slice(0, 5));
  assert.equal(advance(state), state);
});

test("streak increments on consecutive days", () => {
  let profile = emptyProfile();
  profile = applyCompletion(profile, "2026-10-20", 4, 5, [{ ok: true }, { ok: false }, { ok: true }, { ok: true }, { ok: true }]);
  assert.equal(profile.streak, 1);
  profile = applyCompletion(profile, "2026-10-21", 5, 5, [{ ok: true }]);
  assert.equal(profile.streak, 2);
  assert.equal(profile.best, 2);
});

test("streak resets after a missed day", () => {
  let profile = emptyProfile();
  profile = applyCompletion(profile, "2026-10-18", 3, 5, [{ ok: true }]);
  profile = applyCompletion(profile, "2026-10-21", 3, 5, [{ ok: true }]);
  assert.equal(profile.streak, 1);
  assert.equal(profile.best, 1);
});

test("replaying the same day does not change the streak", () => {
  let profile = emptyProfile();
  profile = applyCompletion(profile, "2026-10-21", 3, 5, [{ ok: true }]);
  const replay = applyCompletion(profile, "2026-10-21", 5, 5, [{ ok: true }]);
  assert.equal(replay, profile);
  assert.equal(replay.streak, 1);
  assert.equal(replay.history["2026-10-21"].score, 3);
});

test("share text contains the score and emoji grid", () => {
  const text = buildShareText({
    number: 12,
    score: 3,
    total: 5,
    results: [{ ok: true }, { ok: false }, { ok: true }, { ok: true }, { ok: false }],
    streak: 4,
    url: "https://example.com"
  });
  assert.match(text, /MedMyst #12 {2}3\/5/);
  assert.match(text, /🟩🟥🟩🟩🟥/);
  assert.match(text, /4 day streak/);
  assert.equal(resultGrid([{ ok: true }, { ok: false }]), "🟩🟥");
});

test("deck is well formed", () => {
  const ids = new Set();
  questions.forEach((item) => {
    assert.ok(!ids.has(item.id), `duplicate id ${item.id}`);
    ids.add(item.id);
    assert.equal(item.options.length, 4);
    assert.equal(new Set(item.options).size, 4);
    assert.ok(item.options.includes(item.answer));
    assert.ok(item.explanation.length >= 20);
    assert.ok(item.difficulty >= 1 && item.difficulty <= 3);
  });
  assert.ok(questions.length >= 30);
});

test("rewarded bridge is inert without a native plugin", () => {
  assert.equal(nativeAds(), null);
  assert.equal(hasNativeRewarded(), false);
});

test("native rewarded resolves false when the bridge is missing", async () => {
  assert.equal(await showNativeRewarded(), false);
});

test("rewarded ad unit follows the build configuration", () => {
  assert.equal(RELEASE_BUILD, false, "source builds must not use live ad IDs");
  assert.equal(getRewardedUnitId(), REWARDED_TEST_UNIT);
  assert.equal(getRewardedUnitId(false), REWARDED_TEST_UNIT);
  assert.equal(getRewardedUnitId(true), REWARDED_PROD_UNIT);
});

