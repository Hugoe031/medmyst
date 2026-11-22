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

// Adds whole days to a YYYY-MM-DD key using UTC arithmetic, so daylight-saving
// transitions can never shift a scheduled review by an hour.
export function shiftDayKey(key, days) {
  const [year, month, day] = String(key ?? "").split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return key;
  }
  const stamp = Date.UTC(year, month - 1, day) + Math.round(days) * 86400000;
  const shifted = new Date(stamp);
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0")
  ].join("-");
}

export function previousDayKey(key) {
  return shiftDayKey(key, -1);
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
