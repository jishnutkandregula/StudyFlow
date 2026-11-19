"use client";

import { useEffect, useRef, useState } from "react";
import { courseColorMap } from "../../lib/courseColors";

/**
 * A looping, self-playing tour of the real planner on the sample week the app
 * ships with (lib/sampleData.ts): Canvas assignments arrive with explained
 * estimates, calendar commitments block time, sessions fill the gaps, then the
 * student can't study Thursday and the plan reflows.
 *
 * Under prefers-reduced-motion it shows the finished plan and never moves.
 */

type Phase = 0 | 1 | 2 | 3 | 4 | 5;

const TASKS = [
  { id: "lab6", title: "Lab 6 · Shortest paths", course: "CSE 101", minutes: 120, reason: "Lab · typical lab" },
  { id: "ps9", title: "Problem set 9", course: "STAT 131", minutes: 90, reason: "Problem set · 8 problems" },
  { id: "reading", title: "Reading response: Ch. 7", course: "WRIT 2", minutes: 45, reason: "Reflection · 2 pages of writing" },
  { id: "shell", title: "Project milestone 2 · Shell", course: "CSE 130", minutes: 240, reason: "Project · −12% for your pace on CSE 130" },
  { id: "midterm", title: "Midterm 2 review", course: "CSE 101", minutes: 180, reason: "Exam prep · 2 chapters" },
  { id: "quiz", title: "Quiz 8", course: "STAT 131", minutes: 30, reason: "Quiz · 20-minute time limit" },
] as const;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const START_HOUR = 9;
const HOURS = 12;

type Block = { day: number; start: number; length: number };

const BUSY: (Block & { label: string; source: "Canvas" | "Google" })[] = [
  { day: 0, start: 10, length: 1.5, label: "CSE 101 lecture", source: "Canvas" },
  { day: 2, start: 10, length: 1.5, label: "CSE 101 lecture", source: "Canvas" },
  { day: 1, start: 13, length: 4, label: "Work shift", source: "Google" },
  { day: 3, start: 9.5, length: 1.5, label: "STAT 131 section", source: "Canvas" },
  { day: 4, start: 17, length: 3, label: "Soccer", source: "Google" },
];

// `moved` is where a Thursday session lands once Thursday is blocked off.
const SESSIONS: { task: (typeof TASKS)[number]["id"]; at: Block; moved?: Block }[] = [
  { task: "lab6", at: { day: 0, start: 12, length: 0.85 } },
  { task: "lab6", at: { day: 0, start: 13, length: 0.85 } },
  { task: "reading", at: { day: 0, start: 15, length: 0.75 } },
  { task: "ps9", at: { day: 1, start: 9.5, length: 0.85 } },
  { task: "ps9", at: { day: 1, start: 18, length: 0.6 } },
  { task: "shell", at: { day: 2, start: 12.5, length: 0.85 } },
  { task: "shell", at: { day: 2, start: 13.5, length: 0.85 } },
  { task: "shell", at: { day: 3, start: 12, length: 0.85 }, moved: { day: 2, start: 18.5, length: 0.85 } },
  { task: "midterm", at: { day: 3, start: 13, length: 0.85 }, moved: { day: 1, start: 19, length: 0.85 } },
  { task: "midterm", at: { day: 3, start: 15, length: 0.85 }, moved: { day: 4, start: 13.5, length: 0.85 } },
  { task: "midterm", at: { day: 4, start: 11, length: 0.85 } },
  { task: "shell", at: { day: 4, start: 12.2, length: 0.85 } },
  { task: "quiz", at: { day: 4, start: 15, length: 0.5 } },
];

// When each phase begins, in ms from the start of a loop.
const TIMELINE: [Phase, number][] = [
  [1, 300],
  [2, 2600],
  [3, 3700],
  [4, 7200],
  [5, 11200],
  [0, 15200],
];
const LOOP_MS = 16400;

const color = courseColorMap(TASKS.map((task) => task.course));
const hours = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`);

function place(block: Block): React.CSSProperties {
  return {
    left: `calc(${(block.day / DAYS.length) * 100}% + 3px)`,
    top: `${((block.start - START_HOUR) / HOURS) * 100}%`,
    height: `${(block.length / HOURS) * 100}%`,
    width: `calc(${100 / DAYS.length}% - 6px)`,
  };
}

export function HeroDemo() {
  const [phase, setPhase] = useState<Phase>(0);
  const [loop, setLoop] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(4);
      return;
    }
    let timers: number[] = [];
    let visible = false;
    const run = () => {
      timers.forEach(clearTimeout);
      setPhase(0);
      timers = TIMELINE.map(([next, at]) => window.setTimeout(() => setPhase(next), at));
      timers.push(window.setTimeout(() => setLoop((n) => n + 1), LOOP_MS));
    };
    // Only play while on screen, so it never burns CPU in a background tab.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !visible) {
        visible = true;
        run();
      } else if (!entry.isIntersecting && visible) {
        visible = false;
        timers.forEach(clearTimeout);
        setPhase(4);
      }
    });
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [loop]);

  const scheduled = phase >= 3;
  const replanned = phase >= 5;

  return (
    <div className="demo" ref={root} data-phase={phase} aria-label="An animated example of StudyFlow planning a sample week" role="img">
      <div className="demo-chrome" aria-hidden="true">
        <span /><span /><span />
        <div className="demo-url">studyflow · sample week</div>
      </div>
      <div className="demo-body" aria-hidden="true">
        <aside className="demo-work">
          <div className="demo-label">
            <span>Workload</span>
            <span className={`demo-sync${phase >= 1 ? " done" : ""}`}>{phase >= 1 ? "Canvas · synced" : "Syncing Canvas…"}</span>
          </div>
          <ul>
            {TASKS.map((task, index) => (
              <li key={task.id} className={phase >= 1 ? "in" : ""} style={{ transitionDelay: phase >= 1 ? `${index * 230}ms` : "0ms" }}>
                <i style={{ background: color(task.course) }} />
                <div>
                  <strong>{task.title}</strong>
                  <small>{task.course}</small>
                  <em>✦ {task.reason}</em>
                </div>
                <b>{hours(task.minutes)}</b>
              </li>
            ))}
          </ul>
        </aside>

        <div className="demo-week">
          <div className="demo-label">
            <span>This week</span>
            <span className={`demo-health${phase >= 4 ? " on" : ""}`}>
              {replanned ? "Replanned · still on track" : phase >= 4 ? "On track · 100% placed" : scheduled ? "Planning…" : "Waiting for a plan"}
            </span>
          </div>
          <div className="demo-days">
            {DAYS.map((day, index) => (
              <span key={day} className={replanned && index === 3 ? "off" : ""}>{day}</span>
            ))}
          </div>
          <div className="demo-grid">
            {Array.from({ length: HOURS - 1 }, (_, i) => (
              <hr key={i} style={{ top: `${((i + 1) / HOURS) * 100}%` }} />
            ))}
            <div className={`demo-dayoff${replanned ? " on" : ""}`} style={place({ day: 3, start: START_HOUR, length: HOURS })}>
              <span>Can’t study Thursday</span>
            </div>
            {BUSY.map((block, index) => (
              <div
                key={`busy-${index}`}
                className={`demo-busy${phase >= 2 ? " in" : ""}`}
                style={{ ...place(block), transitionDelay: phase >= 2 ? `${index * 120}ms` : "0ms" }}
              >
                <strong>{block.label}</strong>
                <small>{block.source}</small>
              </div>
            ))}
            {SESSIONS.map((session, index) => {
              const task = TASKS.find((item) => item.id === session.task)!;
              const where = replanned && session.moved ? session.moved : session.at;
              return (
                <div
                  key={`s-${index}`}
                  className={`demo-session${scheduled ? " in" : ""}${replanned && session.moved ? " moved" : ""}`}
                  style={{
                    ...place(where),
                    ["--c" as string]: color(task.course),
                    transitionDelay: scheduled && !replanned ? `${300 + index * 150}ms` : replanned && session.moved ? `${index * 60}ms` : "0ms",
                  }}
                >
                  <strong>{task.title.split(" · ")[0].replace("Reading response: Ch. 7", "Reading resp.")}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className={`demo-toast${replanned ? " on" : ""}`} aria-hidden="true">
        <span>↻</span> Thursday’s 3 sessions moved. Every deadline still fits.
      </div>
    </div>
  );
}
