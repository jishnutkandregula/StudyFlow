import { toDateKey } from "./format";
import type { Task } from "./types";

/**
 * A realistic week for a CS undergraduate, dated relative to today so the demo
 * always looks current. Every task is marked `source: "sample"`; the UI labels
 * it everywhere and removes it before any real coursework is added.
 */
export function buildSampleTasks(now: Date): Task[] {
  const due = (days: number, time: string) => {
    const date = new Date(now);
    date.setDate(now.getDate() + days);
    return { due_date: toDateKey(date), due_time: time };
  };
  const base = { priority: 3, source: "sample" as const, url: null };
  return [
    { ...base, id: "sample-lab6", title: "Lab 6 · Shortest paths", course: "CSE 101", ...due(1, "23:59:00"), estimated_minutes: 120, course_weight: 50, points: 50 },
    { ...base, id: "sample-ps9", title: "Problem set 9", course: "STAT 131", ...due(2, "17:00:00"), estimated_minutes: 90, course_weight: 20, points: 20 },
    { ...base, id: "sample-reading", title: "Reading response: Chapter 7", course: "WRIT 2", ...due(3, "09:00:00"), estimated_minutes: 45, course_weight: 10, points: 10 },
    { ...base, id: "sample-shell", title: "Project milestone 2 · Shell", course: "CSE 130", ...due(4, "23:59:00"), estimated_minutes: 240, course_weight: 100, points: 100 },
    { ...base, id: "sample-midterm", title: "Midterm 2 review", course: "CSE 101", ...due(5, "12:00:00"), estimated_minutes: 180, course_weight: 100, points: null },
    { ...base, id: "sample-quiz", title: "Quiz 8", course: "STAT 131", ...due(6, "23:59:00"), estimated_minutes: 30, course_weight: 5, points: 5 },
  ];
}

export const isSample = (task: Task) => task.source === "sample";
