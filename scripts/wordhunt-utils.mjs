export const WORDHUNT_HEADERS = [
  "id",
  "category",
  "difficulty",
  "question",
  "answer",
  "decoy_1",
  "decoy_2",
  "decoy_3",
  "explanation"
];

export const WORD_MIN = 3;
export const WORD_MAX = 10;
export const MIN_EXPLANATION_LENGTH = 40;

const ID_PATTERN = /^[a-z][a-z0-9]*-\d{2,}$/;
const WORD_PATTERN = /^[A-Z]+$/;

export function rowsToCases(rows) {
  const errors = [];

  if (rows.length === 0) {
    return { cases: [], errors: ["the CSV is empty"] };
  }

  const header = rows[0].map((value) => value.trim().toLowerCase());
  const headerOk =
    header.length === WORDHUNT_HEADERS.length &&
    WORDHUNT_HEADERS.every((name, position) => header[position] === name);

  if (!headerOk) {
    errors.push(`header row must be exactly: ${WORDHUNT_HEADERS.join(",")}`);
    return { cases: [], errors };
  }

  const cases = [];

  rows.slice(1).forEach((row, offset) => {
    const line = offset + 2;
    if (row.every((value) => value.trim() === "")) {
      return;
    }
    if (row.length !== WORDHUNT_HEADERS.length) {
      errors.push(`line ${line}: expected ${WORDHUNT_HEADERS.length} columns, found ${row.length}`);
      return;
    }

    const record = Object.fromEntries(
      WORDHUNT_HEADERS.map((name, position) => [name, row[position].trim()])
    );

    cases.push({
      id: record.id,
      category: record.category,
      difficulty: Number(record.difficulty),
      question: record.question,
      answer: record.answer.toUpperCase(),
      decoys: [record.decoy_1, record.decoy_2, record.decoy_3].map((value) => value.toUpperCase()),
      explanation: record.explanation
    });
  });

  return { cases, errors };
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function wordProblem(label, word, position) {
  if (!WORD_PATTERN.test(word)) {
    return `${label}: ${position} must be A-Z letters only (found "${word}")`;
  }
  if (word.length < WORD_MIN || word.length > WORD_MAX) {
    return `${label}: ${position} must be ${WORD_MIN} to ${WORD_MAX} letters (found ${word.length} in "${word}")`;
  }
  return null;
}

export function validateCases(cases) {
  const errors = [];
  const ids = new Map();
  const texts = new Map();
  const answers = new Map();

  cases.forEach((item, index) => {
    const label = item.id ? `"${item.id}"` : `row ${index + 1}`;

    if (!item.id) {
      errors.push(`${label}: missing id`);
    } else if (!ID_PATTERN.test(item.id)) {
      errors.push(`${label}: id must look like "hunt-01" (lowercase letters, hyphen, two or more digits)`);
    } else if (ids.has(item.id)) {
      errors.push(`${label}: duplicate id (also used at row ${ids.get(item.id)})`);
    } else {
      ids.set(item.id, index + 1);
    }

    if (!item.category) {
      errors.push(`${label}: missing category`);
    }

    if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 3) {
      errors.push(`${label}: difficulty must be 1, 2, or 3`);
    }

    if (!item.question) {
      errors.push(`${label}: missing question text`);
    } else if (texts.has(normalizeText(item.question))) {
      errors.push(
        `${label}: duplicate question text (also at row ${texts.get(normalizeText(item.question))})`
      );
    } else {
      texts.set(normalizeText(item.question), index + 1);
    }

    const words = [item.answer, ...item.decoys];

    words.forEach((word, position) => {
      const problem = wordProblem(label, word ?? "", position === 0 ? "answer" : `decoy ${position}`);
      if (problem) {
        errors.push(problem);
      }
    });

    if (new Set(words).size !== words.length) {
      errors.push(`${label}: answer and decoys must all be different`);
    }

    if (answers.has(item.answer) && answers.get(item.answer) !== item.id) {
      errors.push(`${label}: answer "${item.answer}" is already the answer of "${answers.get(item.answer)}"`);
    } else {
      answers.set(item.answer, item.id);
    }

    if (!item.explanation || item.explanation.length < MIN_EXPLANATION_LENGTH) {
      errors.push(`${label}: explanation must be at least ${MIN_EXPLANATION_LENGTH} characters`);
    }
  });

  return errors;
}

export function renderWordHuntModule(cases, version) {
  const body = JSON.stringify(
    cases.map((item) => ({
      id: item.id,
      category: item.category,
      difficulty: item.difficulty,
      question: item.question,
      answer: item.answer,
      decoys: item.decoys,
      explanation: item.explanation
    })),
    null,
    2
  );
  return `export const wordHuntVersion = ${JSON.stringify(version)};\n\nexport const wordHuntCases = ${body};\n`;
}

export function wordHuntStats(cases) {
  const categories = new Map();
  const difficulties = new Map();
  let longest = 0;

  cases.forEach((item) => {
    categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
    difficulties.set(item.difficulty, (difficulties.get(item.difficulty) ?? 0) + 1);
    longest = Math.max(longest, ...[item.answer, ...item.decoys].map((word) => word.length));
  });

  return {
    total: cases.length,
    longest,
    categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
    difficulties: [...difficulties.entries()].sort((a, b) => a[0] - b[0])
  };
}
