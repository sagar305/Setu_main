// Batch rules for a single teacher.
//
// This product is deliberately one teacher's own class, not an institute. A
// single teacher cannot be in two rooms at once, so two batches that share a
// day and overlap in time is always a mistake — as is the same batch entered
// twice. Both are refused outright.
//
// The one case that is legitimate is the same subject and class taught to two
// different groups at different times (a morning batch and an evening batch),
// so that is only a warning the teacher can accept.

import type { Batch } from "./types";
import { formatTime } from "./types";

export type BatchDraft = Pick<
  Batch,
  "name" | "subject" | "classLevel" | "days" | "startTime" | "endTime"
>;

export type BatchConflict =
  /** A batch with this name already exists. Refused. */
  | { kind: "duplicate-name"; batch: Batch }
  /** Overlapping day + time with an existing batch. Refused. */
  | { kind: "time-clash"; batch: Batch }
  /** Same subject and class at a different time. Allowed after confirming. */
  | { kind: "same-subject"; batch: Batch };

const normalise = (value: string) => value.trim().toLowerCase();

/** "18:30" → 1110 minutes past midnight. */
function toMinutes(time: string): number | null {
  if (!/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Do two batches run at the same time on at least one shared day? */
export function batchesClash(a: BatchDraft, b: Batch): boolean {
  const sharedDay = a.days.some((day) => b.days.includes(day));
  if (!sharedDay) return false;

  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);
  // Without usable timings we cannot prove a clash, so we do not claim one.
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;

  // Half-open intervals: a batch ending at 18:00 and one starting at 18:00 are fine.
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Every problem with adding (or editing) this batch, most serious first.
 * Pass the id of the batch being edited so it is not compared with itself.
 */
export function findBatchConflicts(
  batches: Batch[],
  draft: BatchDraft,
  ignoreId?: string
): BatchConflict[] {
  const conflicts: BatchConflict[] = [];
  const name = normalise(draft.name);
  const subject = normalise(draft.subject);
  const classLevel = normalise(draft.classLevel);

  for (const batch of batches) {
    if (batch.id === ignoreId) continue;

    if (name && normalise(batch.name) === name) {
      conflicts.push({ kind: "duplicate-name", batch });
      continue;
    }
    if (batch.active && batchesClash(draft, batch)) {
      conflicts.push({ kind: "time-clash", batch });
      continue;
    }
    if (
      subject &&
      normalise(batch.subject) === subject &&
      normalise(batch.classLevel) === classLevel
    ) {
      conflicts.push({ kind: "same-subject", batch });
    }
  }

  return conflicts;
}

/** Conflicts that must be fixed — the teacher cannot save through these. */
export function blockingConflicts(conflicts: BatchConflict[]): BatchConflict[] {
  return conflicts.filter((conflict) => conflict.kind !== "same-subject");
}

export function describeConflict(conflict: BatchConflict): string {
  const other = conflict.batch.name;
  switch (conflict.kind) {
    case "duplicate-name":
      return `You already have a batch called "${other}". Give this one a different name, or edit the existing batch instead of adding it twice.`;
    case "time-clash":
      return `This clashes with "${other}" (${formatTime(conflict.batch.startTime)}–${formatTime(
        conflict.batch.endTime
      )}). You cannot take two batches at the same time — change the day or the timing.`;
    case "same-subject":
      return `You already teach this subject and class in "${other}". That is fine if this is a separate group at a different time — otherwise add these students to "${other}" instead of making a second batch.`;
  }
}
