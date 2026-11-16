import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { questions, deckVersion } from "../src/data/questions.js";
import { toCsv } from "./csv.mjs";
import { questionsToRows } from "./deck-utils.mjs";
import { paths } from "./deck-source.mjs";

const force = process.argv.includes("--force");

if (existsSync(paths.csv) && !force) {
  console.error("content/questions.csv already exists. Re-run with --force to overwrite it.");
  process.exit(1);
}

await writeFile(paths.csv, toCsv(questionsToRows(questions)), "utf8");
await writeFile(paths.config, JSON.stringify({ version: deckVersion }, null, 2) + "\n", "utf8");

console.log(`exported ${questions.length} questions to content/questions.csv`);
console.log(`deck version: ${deckVersion}`);
