import { seededShuffle } from "./rng.js";

export const PUZZLE_SIZE = 5;
export const SEASON_START = "2026-10-01";

export function dayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dayNumber(date = new Date()) {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utc / 86400000);
}

export function previousDayKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  const stamp = Date.UTC(year, month - 1, day) - 86400000;
  const previous = new Date(stamp);
  return [
    previous.getUTCFullYear(),
    String(previous.getUTCMonth() + 1).padStart(2, "0"),
    String(previous.getUTCDate()).padStart(2, "0")
  ].join("-");
}

export function puzzleNumber(date = new Date()) {
  const [year, month, day] = SEASON_START.split("-").map(Number);
  const start = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return Math.max(1, dayNumber(date) - start + 1);
}

export function buildPuzzle(questions, date = new Date(), deckVersion = 1) {
  const key = dayKey(date);
  const shuffled = seededShuffle(questions, `medmyst:${deckVersion}:${key}`);
  return shuffled.slice(0, PUZZLE_SIZE).map((item) => ({
    ...item,
    options: seededShuffle(item.options, `options:${item.id}`)
  }));
}
