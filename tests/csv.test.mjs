import test from "node:test";
import assert from "node:assert/strict";

import { parseCsv, toCsv } from "../scripts/csv.mjs";
import {
  HEADERS,
  MIN_EXPLANATION_LENGTH,
  questionsToRows,
  renderDeckModule,
  rowsToQuestions,
  validateQuestions
} from "../scripts/deck-utils.mjs";
import { isModuleInSync, loadDeck } from "../scripts/deck-source.mjs";

const header = HEADERS.join(",");
const goodRow = (overrides = {}) => {
  const base = {
    id: "anat-99",
    category: "Anatomy",
    difficulty: "2",
    question: "Which structure is this test question about?",
    option_a: "First",
    option_b: "Second",
    option_c: "Third",
    option_d: "Fourth",
    answer: "B",
    explanation: "This explanation is long enough to satisfy the minimum length rule."
  };
  const merged = { ...base, ...overrides };
  return HEADERS.map((name) => merged[name]).join(",");
};

test("parseCsv reads plain rows", () => {
  assert.deepEqual(parseCsv("a,b\r\n1,2\r\n"), [
    ["a", "b"],
    ["1", "2"]
  ]);
});

test("parseCsv handles quoted commas and newlines", () => {
  const rows = parseCsv('id,text\r\nx,"one, two"\r\ny,"line one\nline two"\r\n');
  assert.deepEqual(rows, [
    ["id", "text"],
    ["x", "one, two"],
    ["y", "line one\nline two"]
  ]);
});

test("parseCsv unescapes doubled quotes", () => {
  assert.deepEqual(parseCsv('a,b\n1,"say ""hi"""\n'), [
    ["a", "b"],
    ["1", 'say "hi"']
  ]);
});

test("parseCsv strips a byte order mark", () => {
  assert.deepEqual(parseCsv("\ufeffa,b\n1,2\n"), [
    ["a", "b"],
    ["1", "2"]
  ]);
});

test("toCsv round trips through parseCsv", () => {
  const rows = [
    ["id", "question"],
    ["x-01", 'Comma, "quotes" and\nnewlines']
  ];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test("rowsToQuestions maps answer letters to option text", () => {
  const { questions, errors } = rowsToQuestions(parseCsv([header, goodRow()].join("\n")));
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].answer, "Second");
  assert.equal(questions[0].difficulty, 2);
  assert.equal(questions[0].options.length, 4);
});

test("rowsToQuestions stays case insensitive on the answer letter", () => {
  const { questions } = rowsToQuestions(parseCsv([header, goodRow({ answer: "d" })].join("\n")));
  assert.equal(questions[0].answer, "Fourth");
});

test("rowsToQuestions reports a bad answer letter with its line number", () => {
  const { questions, errors } = rowsToQuestions(parseCsv([header, goodRow({ answer: "Z" })].join("\n")));
  assert.equal(questions.length, 0);
  assert.match(errors[0], /line 2: answer must be A, B, C, or D/);
});

test("rowsToQuestions rejects a wrong header", () => {
  const { errors } = rowsToQuestions(parseCsv("id,question\nanat-01,hi\n"));
  assert.match(errors[0], /header row must be exactly/);
});

test("rowsToQuestions rejects a short row", () => {
  const { errors } = rowsToQuestions(parseCsv([header, "anat-01,Anatomy,1"].join("\n")));
  assert.match(errors[0], /line 2: expected 10 columns, found 3/);
});

test("rowsToQuestions skips blank lines", () => {
  const { questions, errors } = rowsToQuestions(parseCsv([header, goodRow(), "", ""].join("\n")));
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 1);
});

test("validateQuestions flags duplicate ids", () => {
  const { questions } = rowsToQuestions(
    parseCsv([header, goodRow(), goodRow({ question: "A completely different question here?" })].join("\n"))
  );
  const errors = validateQuestions(questions);
  assert.ok(errors.some((error) => /duplicate id/.test(error)));
});

test("validateQuestions flags duplicate question text", () => {
  const { questions } = rowsToQuestions(
    parseCsv([header, goodRow(), goodRow({ id: "anat-98" })].join("\n"))
  );
  const errors = validateQuestions(questions);
  assert.ok(errors.some((error) => /duplicate question text/.test(error)));
});

test("validateQuestions flags duplicate options", () => {
  const { questions } = rowsToQuestions(
    parseCsv([header, goodRow({ option_c: "First" })].join("\n"))
  );
  const errors = validateQuestions(questions);
  assert.ok(errors.some((error) => /options must all be different/.test(error)));
});

test("validateQuestions flags bad difficulty, ids, and short explanations", () => {
  const { questions } = rowsToQuestions(
    parseCsv([
      header,
      goodRow({ id: "NOPE", difficulty: "7", explanation: "too short" })
    ].join("\n"))
  );
  const errors = validateQuestions(questions);
  assert.ok(errors.some((error) => /difficulty must be 1, 2, or 3/.test(error)));
  assert.ok(errors.some((error) => /id must look like/.test(error)));
  assert.ok(errors.some((error) => /explanation must be at least/.test(error)));
  assert.ok(MIN_EXPLANATION_LENGTH > 20);
});

test("questionsToRows round trips a deck", () => {
  const { questions } = rowsToQuestions(parseCsv([header, goodRow()].join("\n")));
  const rows = questionsToRows(questions);
  const roundTrip = rowsToQuestions(parseCsv(toCsv(rows)));
  assert.deepEqual(roundTrip.questions, questions);
});

test("renderDeckModule produces importable source", async () => {
  const { questions } = rowsToQuestions(parseCsv([header, goodRow()].join("\n")));
  const source = renderDeckModule(questions, 3);
  const url = `data:text/javascript,${encodeURIComponent(source)}`;
  const loaded = await import(url);
  assert.equal(loaded.deckVersion, 3);
  assert.deepEqual(loaded.questions, questions);
});

test("the generated deck module matches content/questions.csv", async () => {
  const deck = await loadDeck();
  assert.deepEqual(deck.problems, []);
  assert.ok(await isModuleInSync(deck), "run: npm run build:deck");
  assert.ok(deck.questions.length >= 30);
});
