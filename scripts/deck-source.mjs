import { readFile } from "node:fs/promises";
import { parseCsv } from "./csv.mjs";
import { renderDeckModule, rowsToQuestions, validateQuestions } from "./deck-utils.mjs";

export const paths = {
  csv: new URL("../content/questions.csv", import.meta.url),
  config: new URL("../content/deck.config.json", import.meta.url),
  module: new URL("../src/data/questions.js", import.meta.url)
};

export async function loadDeck() {
  const csvText = await readFile(paths.csv, "utf8");
  const config = JSON.parse(await readFile(paths.config, "utf8"));
  const { questions, errors } = rowsToQuestions(parseCsv(csvText));
  return {
    csvText,
    config,
    questions,
    problems: [...errors, ...validateQuestions(questions)]
  };
}

export function expectedModule(questions, config) {
  return renderDeckModule(questions, config.version);
}

export async function readModule() {
  return readFile(paths.module, "utf8").catch(() => "");
}

export function normalizeNewlines(text) {
  return text.replace(/\r\n/g, "\n");
}

export async function isModuleInSync(deck) {
  const expected = normalizeNewlines(expectedModule(deck.questions, deck.config));
  const actual = normalizeNewlines(await readModule());
  return expected === actual;
}
