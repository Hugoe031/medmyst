import { readFile, writeFile } from "node:fs/promises";
import { parseCsv } from "./csv.mjs";
import { renderWordHuntModule, rowsToCases, validateCases, wordHuntStats } from "./wordhunt-utils.mjs";
import { buildGrid } from "../src/core/wordgrid.js";

const paths = {
  csv: new URL("../content/wordhunt.csv", import.meta.url),
  module: new URL("../src/data/wordhunt.js", import.meta.url)
};

const VERSION = 1;
const MIN_CASES = 30;
const checkOnly = process.argv.includes("--check");

const csvText = await readFile(paths.csv, "utf8");
const { cases, errors } = rowsToCases(parseCsv(csvText));
const problems = [...errors, ...validateCases(cases)];

function placementProblems(items) {
  const failures = [];
  items.forEach((item) => {
    const words = [item.answer, ...item.decoys];
    try {
      const grid = buildGrid({ words, seed: `check:${item.id}` });
      words.forEach((word) => {
        if (!grid.placements.some((placement) => placement.word === word)) {
          failures.push(`"${item.id}": "${word}" was not placed on the grid`);
        }
      });
    } catch (error) {
      failures.push(`"${item.id}": ${error.message}`);
    }
  });
  return failures;
}

problems.push(...placementProblems(cases));

if (problems.length > 0) {
  console.error(`word hunt has ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(` - ${problem}`));
  process.exit(1);
}

const stats = wordHuntStats(cases);

if (stats.total < MIN_CASES) {
  console.error(`word hunt too small: ${stats.total} cases, need at least ${MIN_CASES}`);
  process.exit(1);
}

function report() {
  console.log(`word hunt v${VERSION}`);
  console.log(`cases: ${stats.total}`);
  console.log(`longest word: ${stats.longest} letters`);
  console.log(
    `categories: ${stats.categories.map(([name, count]) => `${name} (${count})`).join(", ")}`
  );
}

const expected = renderWordHuntModule(cases, VERSION);
const normalize = (text) => text.replace(/\r\n/g, "\n");

if (checkOnly) {
  const actual = await readFile(paths.module, "utf8").catch(() => "");
  report();
  if (normalize(expected) !== normalize(actual)) {
    console.error("\nsrc/data/wordhunt.js is out of date. Run: npm run build:wordhunt");
    process.exit(1);
  }
  console.log("\nword hunt build is current");
} else {
  await writeFile(paths.module, expected, "utf8");
  report();
  console.log("\nwrote src/data/wordhunt.js");
}
