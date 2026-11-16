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

// The daily round renders options in stored order, so the correct answer must
// be spread across option positions. Guard against degenerate decks where one
// position dominates (e.g. everything is option A).
if (stats.total >= 40) {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  deck.questions.forEach((item) => {
    const index = item.options.indexOf(item.answer);
    if (index >= 0) counts["ABCD"[index]] += 1;
  });
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const share = (dominant[1] / stats.total) * 100;
  console.log(`answer positions: A:${counts.A} B:${counts.B} C:${counts.C} D:${counts.D}`);
  if (share > 40) {
    console.error(
      `\nanswer positions are skewed: option ${dominant[0]} holds ${share.toFixed(0)}% of correct answers (max 40%)`
    );
    failed = true;
  }
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
