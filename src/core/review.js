export function buildReview(puzzle, results) {
  return puzzle.map((question, index) => {
    const result = results[index] ?? null;
    return {
      id: question.id,
      category: question.category,
      question: question.question,
      correct: question.answer,
      chosen: result?.chosen ?? null,
      ok: Boolean(result?.ok),
      explanation: question.explanation
    };
  });
}

export function restorePuzzle(questions, entry) {
  const ids = Array.isArray(entry.ids) ? entry.ids : [];
  const total = Number(entry.total) || 0;
  if (ids.length === 0 || ids.length !== total) {
    return null;
  }
  const lookup = new Map(questions.map((question) => [question.id, question]));
  if (!ids.every((id) => lookup.has(id))) {
    return null;
  }
  return ids.map((id) => lookup.get(id));
}
