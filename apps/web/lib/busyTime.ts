// Turning calendar events (Google or Canvas) into busy time the planner must avoid.

import type { BusyBlock, BusySource } from "./types";
import { toDateKey } from "./format";

const pad = (value: number) => String(value).padStart(2, "0");
const clock = (value: Date) => `${pad(value.getHours())}:${pad(value.getMinutes())}:00`;

/**
 * Split a timed event into one block per local day, so an event that runs past midnight
 * (a 10 PM–1 AM shift) protects both evenings instead of being dropped.
 */
export function eventToBusy(startIso: string, endIso: string, label: string, source: BusySource): BusyBlock[] {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];
  // Guard against runaway multi-week events: anything this long isn't "busy", it's a status.
  if (end.getTime() - start.getTime() > 1000 * 60 * 60 * 24 * 3) return [];

  const blocks: BusyBlock[] = [];
  let cursor = start;
  while (cursor < end) {
    const midnight = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    const sliceEnd = end < midnight ? end : midnight;
    const endTime = sliceEnd === midnight ? "23:59:59" : clock(sliceEnd);
    const startTime = clock(cursor);
    if (startTime < endTime) {
      blocks.push({ date: toDateKey(cursor), start_time: startTime, end_time: endTime, label: label.slice(0, 160), source });
    }
    cursor = midnight;
  }
  return blocks;
}

/** Drop exact duplicates (the same class can arrive from both Canvas and Google). */
export function dedupeBusy(blocks: BusyBlock[]): BusyBlock[] {
  const seen = new Set<string>();
  return blocks.filter((block) => {
    const key = `${block.date}|${block.start_time}|${block.end_time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Replace one source's blocks, keeping the other's. */
export function replaceBusySource(current: BusyBlock[], source: BusySource, next: BusyBlock[]): BusyBlock[] {
  return dedupeBusy([...current.filter((block) => (block.source ?? "google") !== source), ...next]);
}
