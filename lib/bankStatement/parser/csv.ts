// CSV / delimited text → raw rows.
// Hand-rolled rather than pulled from a library: statement CSVs are small,
// RFC4180 quoting is the only real complexity, and the delimiter varies.

import type { RawRow } from "@/lib/bankStatement/types";
import { sanitiseCell } from "@/lib/bankStatement/utils/text";

/** Pick the delimiter by which one gives the most consistent row width. */
export function detectDelimiter(text: string): string {
  const candidates = [",", ";", "\t", "|"];
  const sample = text.split(/\r?\n/).slice(0, 20).filter((line) => line.trim() !== "");
  if (sample.length === 0) return ",";

  let best = ",";
  let bestScore = -1;

  for (const delimiter of candidates) {
    const counts = sample.map((line) => splitLine(line, delimiter).length);
    const max = Math.max(...counts);
    if (max < 2) continue;
    // Reward width, punish rows that disagree on how many columns there are.
    const modal = counts.filter((count) => count === max).length / counts.length;
    const score = max * modal;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Parse CSV text into rows, honouring quoted fields that contain newlines.
 * Blank lines are dropped; row numbers stay 1-based over the original file so
 * a validation issue can point the CA at the right line.
 */
export function parseCsv(text: string): RawRow[] {
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean);

  const rows: RawRow[] = [];
  let current = "";
  let quoted = false;
  let lineNumber = 1;

  const flush = (line: string, number: number) => {
    if (line.trim() === "") return;
    const cells = splitLine(line, delimiter).map((cell) => sanitiseCell(cell));
    if (cells.every((cell) => cell === "")) return;
    rows.push({ cells, row: number });
  };

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (char === '"') {
      quoted = !quoted;
      current += char;
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && clean[i + 1] === "\n") i += 1;
      flush(current, lineNumber);
      lineNumber += 1;
      current = "";
      continue;
    }
    current += char;
  }
  flush(current, lineNumber);

  return rows;
}
