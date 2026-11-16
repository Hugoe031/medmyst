import { seededShuffle } from "./rng.js";

export function buildPractice(questions, seed = Date.now(), size = 5) {
  const key = `practice:${seed}:${questions.length}`;
  return seededShuffle(questions, key)
    .slice(0, size)
    .map((item) => ({
      ...item,
      options: seededShuffle(item.options, `options:${item.id}`)
    }));
}
