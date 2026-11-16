export function buildShareText({ title, number, score, total, results, streak, url = "" }) {
  const heading = title ?? `MedMyst #${number}`;
  const grid = results.map((result) => (result.ok ? "🟩" : "🟥")).join("");
  const lines = [`${heading}  ${score}/${total}`, grid];
  if (streak > 1) {
    lines.push(`🔥 ${streak} day streak`);
  }
  if (url) {
    lines.push(url);
  }
  return lines.join("\n");
}

export function resultGrid(results) {
  return results.map((result) => (result.ok ? "🟩" : "🟥")).join("");
}
