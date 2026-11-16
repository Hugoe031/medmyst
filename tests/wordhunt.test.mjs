import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  GRID_SIZE,
  MAX_WORD,
  MIN_WORD,
  buildGrid,
  lineCells,
  lineText,
  matchesWord,
  placementCells
} from "../src/core/wordgrid.js";
import {
  HUNT_CASES,
  HUNT_CLEAN_BONUS,
  HUNT_LIVES,
  HUNT_POINTS,
  answerCells,
  buildHunt,
  currentRound,
  finishHunt,
  isRoundOver,
  nextRound,
  selectCells,
  summary
} from "../src/core/hunt.js";
import { wordHuntCases, wordHuntVersion } from "../src/data/wordhunt.js";
import { parseCsv } from "../scripts/csv.mjs";
import { rowsToCases, validateCases } from "../scripts/wordhunt-utils.mjs";

const words = ["INSULIN", "HEPARIN", "SEPSIS", "EDEMA"];

function cellsFor(round, word) {
  const placement = round.grid.placements.find((entry) => entry.word === word);
  assert.ok(placement, `${word} was not placed`);
  const cells = placementCells(placement);
  return { start: cells[0], end: cells[cells.length - 1] };
}

function play(state, word) {
  const { start, end } = cellsFor(currentRound(state), word);
  return selectCells(state, start, end);
}

test("grid building is deterministic for a seed", () => {
  const a = buildGrid({ words, seed: "grid-a" });
  const b = buildGrid({ words, seed: "grid-a" });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.letters, buildGrid({ words, seed: "grid-b" }).letters);
});

test("every word is placed on the grid and readable in order", () => {
  const grid = buildGrid({ words, seed: "place" });
  assert.equal(grid.size, GRID_SIZE);
  assert.equal(grid.letters.length, GRID_SIZE);
  grid.letters.forEach((row) => assert.equal(row.length, GRID_SIZE));

  words.forEach((word) => {
    const placement = grid.placements.find((entry) => entry.word === word);
    assert.ok(placement, `${word} missing`);
    assert.equal(lineText(grid, placementCells(placement)), word);
  });
});

test("placements stay inside the grid", () => {
  const grid = buildGrid({ words, seed: "bounds" });
  grid.placements.forEach((placement) => {
    placementCells(placement).forEach(({ row, col }) => {
      assert.ok(row >= 0 && row < GRID_SIZE);
      assert.ok(col >= 0 && col < GRID_SIZE);
    });
  });
});

test("lineCells accepts straight and diagonal lines only", () => {
  const size = 11;
  assert.equal(lineCells(size, { row: 0, col: 0 }, { row: 0, col: 4 }).length, 5);
  assert.equal(lineCells(size, { row: 0, col: 0 }, { row: 3, col: 0 }).length, 4);
  assert.equal(lineCells(size, { row: 0, col: 4 }, { row: 4, col: 0 }).length, 5);
  assert.equal(lineCells(size, { row: 4, col: 0 }, { row: 0, col: 4 }).length, 5);
  assert.deepEqual(lineCells(size, { row: 2, col: 2 }, { row: 2, col: 2 }), []);
  assert.deepEqual(lineCells(size, { row: 1, col: 1 }, { row: 3, col: 2 }), []);
});

test("matchesWord accepts reversed spellings", () => {
  assert.ok(matchesWord("INSULIN", "INSULIN"));
  assert.ok(matchesWord("NILUSNI", "INSULIN"));
  assert.ok(!matchesWord("INSULIX", "INSULIN"));
});

test("content file is valid and every case fits the grid", () => {
  assert.equal(wordHuntVersion, 1);
  assert.ok(wordHuntCases.length >= 30);

  const words = wordHuntCases.flatMap((item) => [item.answer, ...item.decoys]);
  words.forEach((word) => {
    assert.match(word, /^[A-Z]+$/);
    assert.ok(word.length >= MIN_WORD && word.length <= MAX_WORD, `${word} is out of range`);
  });

  wordHuntCases.forEach((item) => {
    const grid = buildGrid({ words: [item.answer, ...item.decoys], seed: `test:${item.id}` });
    [item.answer, ...item.decoys].forEach((word) => {
      assert.ok(grid.placements.some((placement) => placement.word === word));
    });
  });
});

test("builder validation rejects malformed rows", () => {
  const { cases } = rowsToCases(parseCsv(
    [
      "id,category,difficulty,question,answer,decoy_1,decoy_2,decoy_3,explanation",
      'hunt-01,Terminology,2,Which term means itching?,PRURITUS,EDEMA,ASCITES,PALLOR,"Short"'
    ].join("\n")
  ));
  const problems = validateCases(cases);
  assert.ok(problems.some((problem) => problem.includes("explanation")));
});

test("the shipped CSV passes its own validation", async () => {
  const csvText = await readFile(new URL("../content/wordhunt.csv", import.meta.url), "utf8");
  const { cases, errors } = rowsToCases(parseCsv(csvText));
  assert.deepEqual(errors, []);
  assert.deepEqual(validateCases(cases), []);
  assert.equal(cases.length, wordHuntCases.length);
});

test("a hunt is deterministic and picks unique cases", () => {
  const a = buildHunt(2026);
  const b = buildHunt(2026);
  assert.equal(a.rounds.length, HUNT_CASES);
  assert.deepEqual(a.rounds.map((round) => round.case.id), b.rounds.map((round) => round.case.id));
  assert.equal(new Set(a.rounds.map((round) => round.case.id)).size, a.rounds.length);
  assert.equal(a.lives, HUNT_LIVES);
  assert.equal(a.phase, "playing");
});

test("every round lists the answer and three decoys in the bank", () => {
  const hunt = buildHunt(77);
  hunt.rounds.forEach((round) => {
    assert.equal(round.bank.length, 4);
    assert.ok(round.bank.includes(round.case.answer));
    assert.deepEqual([...round.bank].sort(), [round.case.answer, ...round.case.decoys].sort());
  });
});

test("an invalid line is free", () => {
  const hunt = buildHunt(5);
  const before = JSON.stringify(hunt);
  const result = selectCells(hunt, { row: 0, col: 0 }, { row: 0, col: 1 });
  assert.equal(result.outcome, "invalid");
  assert.equal(JSON.stringify(result.state), before);
});

test("finding the answer scores a clean bonus and extends the combo", () => {
  const hunt = buildHunt(11);
  const round = currentRound(hunt);
  const result = play(hunt, round.case.answer);

  assert.equal(result.outcome, "answer");
  assert.equal(result.gained, HUNT_POINTS + HUNT_CLEAN_BONUS);
  assert.equal(result.state.score, HUNT_POINTS + HUNT_CLEAN_BONUS);
  assert.equal(result.state.combo, 1);
  assert.ok(isRoundOver(currentRound(result.state)));

  const next = nextRound(result.state);
  assert.equal(next.index, 1);
  const second = play(next, currentRound(next).case.answer);
  assert.equal(second.gained, Math.round((HUNT_POINTS + HUNT_CLEAN_BONUS) * 1.5));
});

test("a decoy costs a heart and resets the combo", () => {
  const hunt = buildHunt(13);
  const round = currentRound(hunt);
  const decoy = round.case.decoys[0];
  const result = play(hunt, decoy);

  assert.equal(result.outcome, "decoy");
  assert.equal(result.state.lives, HUNT_LIVES - 1);
  assert.equal(result.state.combo, 0);
  assert.equal(result.state.score, 0);
  assert.ok(currentRound(result.state).found.includes(decoy));
  assert.ok(!isRoundOver(currentRound(result.state)));

  const again = play(result.state, decoy);
  assert.equal(again.outcome, "repeat");
  assert.equal(again.state.lives, HUNT_LIVES - 1);
});

test("three decoys end the round as failed", () => {
  let hunt = buildHunt(17);
  const round = currentRound(hunt);
  round.case.decoys.forEach((decoy) => {
    hunt = play(hunt, decoy).state;
  });

  assert.equal(hunt.lives, 0);
  assert.equal(currentRound(hunt).failed, true);
  assert.equal(play(hunt, round.case.answer).outcome, "idle");

  const done = finishHunt(nextRound(hunt));
  assert.equal(done.phase, "failed");
});

test("solving every round finishes the hunt", () => {
  let hunt = buildHunt(23);
  for (let index = 0; index < HUNT_CASES; index += 1) {
    hunt = play(hunt, currentRound(hunt).case.answer).state;
    hunt = nextRound(hunt);
  }

  assert.equal(hunt.phase, "finished");
  assert.equal(summary(hunt).solved, HUNT_CASES);
  assert.ok(summary(hunt).score > 0);
});

test("answerCells points at the placed answer", () => {
  const hunt = buildHunt(31);
  const round = currentRound(hunt);
  const cells = answerCells(round);
  assert.equal(cells.length, round.case.answer.length);
  assert.equal(lineText(round.grid, cells), round.case.answer);
});

test("hunt boards and the stylesheet agree on the grid size", async () => {
  const hunt = buildHunt(41);
  assert.equal(hunt.size, GRID_SIZE);
  assert.equal(hunt.size, 10);

  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, new RegExp(`--hunt-size,\\s*${GRID_SIZE}\\)`));
});