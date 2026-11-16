export const HEADERS = [
  "id",
  "category",
  "difficulty",
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "answer",
  "explanation"
];

export const ANSWER_LETTERS = ["A", "B", "C", "D"];
export const MIN_EXPLANATION_LENGTH = 40;

const ID_PATTERN = /^[a-z][a-z0-9]*-\d{2,}$/;

export function rowsToQuestions(rows) {
  const errors = [];

  if (rows.length === 0) {
    return { questions: [], errors: ["the CSV is empty"] };
  }

  const header = rows[0].map((value) => value.trim().toLowerCase());
  const headerOk =
    header.length === HEADERS.length && HEADERS.every((name, position) => header[position] === name);

  if (!headerOk) {
    errors.push(`header row must be exactly: ${HEADERS.join(",")}`);
    return { questions: [], errors };
  }

  const questions = [];

  rows.slice(1).forEach((row, offset) => {
    const line = offset + 2;
    if (row.every((value) => value.trim() === "")) {
      return;
    }
    if (row.length !== HEADERS.length) {
      errors.push(`line ${line}: expected ${HEADERS.length} columns, found ${row.length}`);
      return;
    }

    const record = Object.fromEntries(HEADERS.map((name, position) => [name, row[position].trim()]));
    const letter = record.answer.toUpperCase();
    const answerIndex = ANSWER_LETTERS.indexOf(letter);

    if (answerIndex === -1) {
      errors.push(`line ${line}: answer must be A, B, C, or D (found "${record.answer}")`);
      return;
    }

    const options = [record.option_a, record.option_b, record.option_c, record.option_d];

    questions.push({
      id: record.id,
      category: record.category,
      difficulty: Number(record.difficulty),
      question: record.question,
      options,
      answer: options[answerIndex],
      explanation: record.explanation
    });
  });

  return { questions, errors };
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function validateQuestions(questions) {
  const errors = [];
  const ids = new Map();
  const texts = new Map();

  questions.forEach((item, index) => {
    const label = item.id ? `"${item.id}"` : `row ${index + 1}`;

    if (!item.id) {
      errors.push(`${label}: missing id`);
    } else if (!ID_PATTERN.test(item.id)) {
      errors.push(`${label}: id must look like "anat-14" (lowercase letters, hyphen, two or more digits)`);
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
      errors.push(`${label}: duplicate question text (also at row ${texts.get(normalizeText(item.question))})`);
    } else {
      texts.set(normalizeText(item.question), index + 1);
    }

    if (!Array.isArray(item.options) || item.options.length !== 4) {
      errors.push(`${label}: needs exactly 4 options`);
      return;
    }

    if (item.options.some((option) => !option)) {
      errors.push(`${label}: one of option_a to option_d is blank`);
    }

    if (new Set(item.options.map(normalizeText)).size !== 4) {
      errors.push(`${label}: options must all be different`);
    }

    if (!item.options.includes(item.answer)) {
      errors.push(`${label}: answer does not match any option`);
    }

    if (!item.explanation || item.explanation.length < MIN_EXPLANATION_LENGTH) {
      errors.push(`${label}: explanation must be at least ${MIN_EXPLANATION_LENGTH} characters`);
    }
  });

  return errors;
}

export function deckStats(questions) {
  const categories = new Map();
  const difficulties = new Map();

  questions.forEach((item) => {
    categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
    difficulties.set(item.difficulty, (difficulties.get(item.difficulty) ?? 0) + 1);
  });

  return {
    total: questions.length,
    days: Math.floor(questions.length / 5),
    categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
    difficulties: [...difficulties.entries()].sort((a, b) => a[0] - b[0])
  };
}

export function renderDeckModule(questions, version) {
  const body = JSON.stringify(questions, null, 2);
  return `export const deckVersion = ${JSON.stringify(version)};\n\nexport const questions = ${body};\n`;
}

export function questionsToRows(questions) {
  return [
    HEADERS,
    ...questions.map((item) => {
      const answerIndex = item.options.indexOf(item.answer);
      return [
        item.id,
        item.category,
        String(item.difficulty),
        item.question,
        item.options[0],
        item.options[1],
        item.options[2],
        item.options[3],
        ANSWER_LETTERS[answerIndex] ?? "",
        item.explanation
      ];
    })
  ];
}
