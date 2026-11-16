export const HINTS_PER_PUZZLE = 1;
export const QUESTION_SECONDS = 20;
export const LIVES = 3;
export const BASE_POINTS = 100;
export const SPEED_POINTS = 50;
export const FLAWLESS_BONUS = 250;
export const MAX_MULTIPLIER = 3;

export function createGame(puzzle, hints = HINTS_PER_PUZZLE) {
  return {
    puzzle,
    index: 0,
    results: [],
    hintsLeft: hints,
    eliminated: [],
    revealed: false,
    phase: "playing",
    lives: LIVES,
    combo: 0,
    bestCombo: 0,
    score: 0
  };
}

export function currentQuestion(state) {
  return state.puzzle[state.index];
}

export function isLastQuestion(state) {
  return state.index === state.puzzle.length - 1;
}

export function multiplier(state) {
  return Math.min(MAX_MULTIPLIER, 1 + state.combo * 0.5);
}

export function pointsFor(state, secondsLeft = 0) {
  const clamped = Math.max(0, Math.min(QUESTION_SECONDS, secondsLeft));
  const speed = Math.round((clamped / QUESTION_SECONDS) * SPEED_POINTS);
  return Math.round((BASE_POINTS + speed) * multiplier(state));
}

export function answer(state, option, timing = {}) {
  if (state.revealed || state.phase !== "playing") {
    return state;
  }
  const question = currentQuestion(state);
  const ok = option === question.answer;
  const result = {
    id: question.id,
    category: question.category,
    chosen: option,
    ok,
    gained: 0,
    ms: Number.isFinite(timing.ms) ? timing.ms : null,
    secondsLeft: Number.isFinite(timing.secondsLeft) ? timing.secondsLeft : null
  };

  if (!ok) {
    return {
      ...state,
      lives: Math.max(0, state.lives - 1),
      combo: 0,
      results: [...state.results, result],
      revealed: true
    };
  }

  const gained = pointsFor(state, result.secondsLeft ?? 0);
  const combo = state.combo + 1;
  return {
    ...state,
    score: state.score + gained,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    results: [...state.results, { ...result, gained }],
    revealed: true
  };
}

export function timeout(state) {
  if (state.revealed || state.phase !== "playing") {
    return state;
  }
  const question = currentQuestion(state);
  return {
    ...state,
    lives: Math.max(0, state.lives - 1),
    combo: 0,
    results: [
      ...state.results,
      { id: question.id, category: question.category, chosen: null, ok: false, gained: 0, timedOut: true, ms: null, secondsLeft: 0 }
    ],
    revealed: true
  };
}

export function useHint(state) {
  if (state.revealed || state.hintsLeft <= 0) {
    return state;
  }
  const question = currentQuestion(state);
  const wrong = question.options.filter(
    (option) => option !== question.answer && !state.eliminated.includes(option)
  );
  if (wrong.length === 0) {
    return { ...state, hintsLeft: state.hintsLeft - 1 };
  }
  return {
    ...state,
    hintsLeft: state.hintsLeft - 1,
    eliminated: [...state.eliminated, ...wrong.slice(0, 2)]
  };
}

export function grantHint(state) {
  if (state.phase !== "playing") {
    return state;
  }
  return { ...state, hintsLeft: state.hintsLeft + 1 };
}

export function advance(state) {
  if (!state.revealed || isLastQuestion(state)) {
    return state;
  }
  return {
    ...state,
    index: state.index + 1,
    eliminated: [],
    revealed: false
  };
}

export function finish(state) {
  return { ...state, phase: "finished" };
}

export function scoreOf(state) {
  return state.results.filter((result) => result.ok).length;
}

export function isFlawless(state) {
  return state.lives === LIVES && state.results.length === state.puzzle.length;
}

export function finalPoints(state) {
  return state.score + (isFlawless(state) ? FLAWLESS_BONUS : 0);
}

export function fastestAnswerMs(state) {
  const times = state.results
    .filter((result) => Number.isFinite(result.ms))
    .map((result) => result.ms);
  return times.length ? Math.min(...times) : null;
}
