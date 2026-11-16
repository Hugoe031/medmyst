import { writeFile } from "node:fs/promises";
import { deckStats } from "./deck-utils.mjs";
import { expectedModule, isModuleInSync, loadDeck, paths } from "./deck-source.mjs";

const checkOnly = process.argv.includes("--check");

function printReport(deck) {
  const stats = deckStats(deck.questions);
  console.log(`deck v${deck.config.version}`);
  console.log(`questions: ${stats.total}`);
  console.log(`unique days: ${stats.days}`);
  console.log(
    `categories: ${stats.categories.map(([name, count]) => `${name} (${count})`).join(", ")}`
  );
}

const deck = await loadDeck();

if (deck.problems.length > 0) {
  console.error(`deck has ${deck.problems.length} problem(s):`);
  deck.problems.forEach((problem) => console.error(` - ${problem}`));
  process.exit(1);
}

const stats = deckStats(deck.questions);

if (stats.total < 30) {
  console.error(`deck too small: ${stats.total} questions, need at least 30`);
  process.exit(1);
}

if (checkOnly) {
  const inSync = await isModuleInSync(deck);
  printReport(deck);
  if (!inSync) {
    console.error("\nsrc/data/questions.js is out of date. Run: npm run build:deck");
    process.exit(1);
  }
  console.log("\ndeck build is current");
} else {
  await writeFile(paths.module, expectedModule(deck.questions, deck.config), "utf8");
  printReport(deck);
  console.log("\nwrote src/data/questions.js");
}
