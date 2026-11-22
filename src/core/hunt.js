import { wordHuntCases } from "../data/wordhunt.js";
import { GRID_SIZE, MAX_WORD, MIN_WORD, buildGrid, lineCells, lineText, matchesWord } from "./wordgrid.js";
import { seededShuffle } from "./rng.js";

export const HUNT_CASES = 5;
export const HUNT_LIVES = 3;
export const HUNT_POINTS = 150;
export const HUNT_CLEAN_BONUS = 50;
export const MAX_MULTIPLIER = 3;

function buildRound(item, seed) {
  const words = [item.answer, ...item.decoys];
  let grid = null;

  for (let attempt = 0; attempt < 5 && grid === null; attempt += 1) {
    try {
      grid = buildGrid({ words, seed: `${seed}:${item.id}:${attempt}` });
    } catch {
      grid = null;
    }
  }

  if (grid === null) {
    return null;
  }

  return {
    case: item,
    grid,
    bank: seededShuffle(words, `${seed}:bank:${item.id}`),
    found: [],
    misses: 0,
    solved: false,
    failed: false,
    gained: 0
  };
}

export function buildHunt(seed, cases = wordHuntCases) {
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error("buildHunt needs at least one case");
  }

  const pool = seededShuffle(cases, `hunt:${seed}`);
  const rounds = [];

  for (const item of pool) {
    if (rounds.length >= HUNT_CASES) {
      break;
    }
    const round = buildRound(item, seed);
    if (round) {
      rounds.push(round);
    }
  }

  if (rounds.length === 0) {
    throw new Error("could not build any word hunt rounds");
  }

  return {
    seed,
    size: GRID_SIZE,
    rounds,
    index: 0,
    lives: HUNT_LIVES,
    score: 0,
    combo: 0,
    bestCombo: 0,
    phase: "playing"
  };
}

export function currentRound(state) {
  return state.rounds[state.index] ?? null;
}

export function isRoundOver(round) {
  return Boolean(round && (round.solved || round.failed));
}

export function isLastRound(state) {
  return state.index >= state.rounds.length - 1;
}

export function multiplier(state) {
  return Math.min(MAX_MULTIPLIER, 1 + state.combo * 0.5);
}

export function pointsFor(state, clean) {
  const base = HUNT_POINTS + (clean ? HUNT_CLEAN_BONUS : 0);
  return Math.round(base * multiplier(state));
}

function replaceRound(state, next) {
  const rounds = state.rounds.slice();
  rounds[state.index] = next;
  return rounds;
}

export function selectCells(state, start, end) {
  const round = currentRound(state);
  const idle = { state, outcome: "idle", word: null, cells: [] };

  if (!round || state.phase !== "playing" || isRoundOver(round)) {
    return idle;
  }

  const cells = lineCells(state.size, start, end);

  if (cells.length < MIN_WORD || cells.length > MAX_WORD) {
    return { state, outcome: "invalid", word: null, cells };
  }

  const text = lineText(round.grid, cells);
  const word = round.bank.find((entry) => matchesWord(text, entry)) ?? null;

  if (!word) {
    return { state, outcome: "invalid", word: null, cells };
  }

  if (round.found.includes(word)) {
    return { state, outcome: "repeat", word, cells };
  }

  if (word === round.case.answer) {
    const gained = pointsFor(state, round.misses === 0);
    const combo = state.combo + 1;
    const next = {
      ...round,
      found: [...round.found, word],
      solved: true,
      gained
    };
    return {
      state: {
        ...state,
        rounds: replaceRound(state, next),
        score: state.score + gained,
        combo,
        bestCombo: Math.max(state.bestCombo, combo)
      },
      outcome: "answer",
      word,
      gained,
      cells
    };
  }

  const lives = Math.max(0, state.lives - 1);
  const next = {
    ...round,
    found: [...round.found, word],
    misses: round.misses + 1,
    failed: lives === 0
  };
  return {
    state: {
      ...state,
      rounds: replaceRound(state, next),
      lives,
      combo: 0
    },
    outcome: "decoy",
    word,
    cells
  };
}

export function nextRound(state) {
  if (state.phase !== "playing") {
    return state;
  }
  const round = currentRound(state);
  if (!isRoundOver(round)) {
    return state;
  }
  if (isLastRound(state) || state.lives <= 0) {
    return finishHunt(state);
  }
  return { ...state, index: state.index + 1 };
}

export function finishHunt(state) {
  const solved = state.rounds.filter((round) => round.solved).length;
  const phase = state.lives > 0 && solved === state.rounds.length ? "finished" : "failed";
  return { ...state, phase };
}

export function solvedCount(state) {
  return state.rounds.filter((round) => round.solved).length;
}

export function summary(state) {
  return {
    solved: solvedCount(state),
    cases: state.rounds.length,
    score: state.score,
    bestCombo: state.bestCombo,
    lives: state.lives,
    results: state.rounds.map((round) => ({
      id: round.case.id,
      category: round.case.category,
      ok: round.solved
    }))
  };
}

export function answerCells(round) {
  const placement = round.grid.placements.find((entry) => entry.word === round.case.answer);
  if (!placement) {
    return [];
  }
  const cells = [];
  for (let index = 0; index < placement.word.length; index += 1) {
    cells.push({
      row: placement.row + placement.dr * index,
      col: placement.col + placement.dc * index
    });
  }
  return cells;
}
