import { hashString, mulberry32 } from "./rng.js";

export const GRID_SIZE = 10;
export const MIN_WORD = 3;
export const MAX_WORD = 10;

export const DIRECTIONS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 }
];

const SIGNS = [1, -1];

const FILL_ALPHABET =
  "EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSHHHHHHRRRRRRDDDDLLLLCCCUUUMMMWWWFFFGGGYYPPBBVVKKXQJZ";

function seedValue(seed) {
  return typeof seed === "string" ? hashString(seed) : seed >>> 0;
}

function shuffle(items, random) {
  const output = items.slice();
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const value = output[index];
    output[index] = output[swap];
    output[swap] = value;
  }
  return output;
}

function inside(size, row, col) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function fits(size, length, row, col, dr, dc) {
  return inside(size, row + dr * (length - 1), col + dc * (length - 1));
}

function compatible(board, word, row, col, dr, dc) {
  for (let index = 0; index < word.length; index += 1) {
    const cell = board[row + dr * index][col + dc * index];
    if (cell && cell !== word[index]) {
      return false;
    }
  }
  return true;
}

function placeWord(board, size, word, random) {
  const candidates = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      for (const direction of DIRECTIONS) {
        for (const sign of SIGNS) {
          const dr = direction.dr * sign;
          const dc = direction.dc * sign;
          if (!fits(size, word.length, row, col, dr, dc)) {
            continue;
          }
          if (!compatible(board, word, row, col, dr, dc)) {
            continue;
          }
          candidates.push({ row, col, dr, dc });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const pick = candidates[Math.floor(random() * candidates.length)];

  for (let index = 0; index < word.length; index += 1) {
    board[pick.row + pick.dr * index][pick.col + pick.dc * index] = word[index];
  }

  return { word, row: pick.row, col: pick.col, dr: pick.dr, dc: pick.dc };
}

function fillBoard(board, size, random) {
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!board[row][col]) {
        board[row][col] = FILL_ALPHABET[Math.floor(random() * FILL_ALPHABET.length)];
      }
    }
  }
}

export function normalizeWords(words) {
  const seen = new Set();
  return words.map((word) => String(word).toUpperCase()).filter((word) => {
    if (seen.has(word)) {
      return false;
    }
    seen.add(word);
    return true;
  });
}

export function buildGrid({ words, size = GRID_SIZE, seed = 0, attempts = 80 } = {}) {
  const list = normalizeWords(words ?? []);

  if (list.length === 0) {
    throw new Error("buildGrid needs at least one word");
  }

  const longest = Math.max(...list.map((word) => word.length));
  if (longest > size) {
    throw new Error(`grid of ${size} cannot hold a ${longest} letter word`);
  }

  const base = seedValue(seed);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const random = mulberry32(base + attempt * 2654435761);
    const board = Array.from({ length: size }, () => new Array(size).fill(""));
    const placements = [];
    let placed = true;

    for (const word of shuffle(list, random)) {
      const placement = placeWord(board, size, word, random);
      if (!placement) {
        placed = false;
        break;
      }
      placements.push(placement);
    }

    if (!placed) {
      continue;
    }

    fillBoard(board, size, random);
    return { size, letters: board, placements };
  }

  throw new Error(`could not place ${list.join(", ")} on a ${size} by ${size} grid`);
}

export function lineCells(size, start, end) {
  if (!start || !end) {
    return [];
  }
  const rowDelta = end.row - start.row;
  const colDelta = end.col - start.col;
  const steps = Math.max(Math.abs(rowDelta), Math.abs(colDelta));

  if (steps === 0) {
    return [];
  }

  const straight = rowDelta === 0 || colDelta === 0;
  const diagonal = Math.abs(rowDelta) === Math.abs(colDelta);

  if (!straight && !diagonal) {
    return [];
  }

  const dr = Math.sign(rowDelta);
  const dc = Math.sign(colDelta);
  const cells = [];

  for (let index = 0; index <= steps; index += 1) {
    const row = start.row + dr * index;
    const col = start.col + dc * index;
    if (!inside(size, row, col)) {
      return [];
    }
    cells.push({ row, col });
  }

  return cells;
}

export function lineText(grid, cells) {
  return cells.map(({ row, col }) => grid.letters[row][col]).join("");
}

export function matchesWord(text, word) {
  return text === word || text === [...word].reverse().join("");
}

export function placementFor(grid, word) {
  return grid.placements.find((placement) => placement.word === word) ?? null;
}

export function placementCells(placement) {
  if (!placement) {
    return [];
  }
  const cells = [];
  for (let index = 0; index < placement.word.length; index += 1) {
    cells.push({
      row: placement.row + placement.dr * index,
      col: placement.col + placement.dc * index
    });
  }
  return cells;
}
