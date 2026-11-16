import { deckStats } from "./deck-utils.mjs";
import { isModuleInSync, loadDeck } from "./deck-source.mjs";

const deck = await loadDeck();
const stats = deckStats(deck.questions);

console.log(`deck v${deck.config.version}`);
console.log(`questions: ${stats.total}`);
console.log(`unique days: ${stats.days}`);
console.log(
  `categories: ${stats.categories.map(([name, count]) => `${name} (${count})`).join(", ")}`
);
console.log(
  `difficulty: ${stats.difficulties.map(([level, count]) => `${level}:${count}`).join("  ")}`
);

let failed = false;

if (deck.problems.length > 0) {
  console.error(`\n${deck.problems.length} problem(s) in content/questions.csv:`);
  deck.problems.forEach((problem) => console.error(` - ${problem}`));
  failed = true;
}

if (stats.total < 30) {
  console.error(`\ndeck too small: ${stats.total} questions, need at least 30`);
  failed = true;
}

const inSync = await isModuleInSync(deck);
if (!inSync) {
  console.error("\nsrc/data/questions.js does not match content/questions.csv. Run: npm run build:deck");
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log("\ndeck ok");
