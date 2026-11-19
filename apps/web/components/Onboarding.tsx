"use client";

import { useEffect, useRef, useState } from "react";
import { plural } from "../lib/format";
import type { CalendarConnection, CanvasConnection, DailyAvailability, Preferences } from "../lib/types";
import { Icon } from "./Icon";

/**
 * First-run setup for a brand-new workspace: how the student likes to study,
 * then Canvas, then Google Calendar, then their first plan. Every step can be
 * skipped, and nothing here is needed later: the same settings live in
 * Preferences and the connection ribbon.
 */

type Rhythm = "morning" | "afternoon" | "evening" | "night";
type Weekend = "same" | "lighter" | "off";

const RHYTHMS: { id: Rhythm; title: string; hint: string; start: string; end: string; sleep?: [string, string] }[] = [
  { id: "morning", title: "Mornings", hint: "8:30 – 11:30 AM", start: "08:30:00", end: "11:30:00" },
  { id: "afternoon", title: "Afternoons", hint: "1:30 – 5 PM", start: "13:30:00", end: "17:00:00" },
  { id: "evening", title: "Evenings", hint: "6:30 – 9:30 PM", start: "18:30:00", end: "21:30:00" },
  { id: "night", title: "Late nights", hint: "8 – 11 PM", start: "20:00:00", end: "23:00:00", sleep: ["23:30:00", "08:00:00"] },
];
const WEEKENDS: { id: Weekend; title: string; hint: string }[] = [
  { id: "same", title: "Study too", hint: "10 AM – 4 PM" },
  { id: "lighter", title: "A little", hint: "10 AM – 1 PM" },
  { id: "off", title: "Keep them free", hint: "No sessions" },
];
const DAILY_CAPS = [120, 180, 240, 300];
const FOCUS = [
  { minutes: 25, rest: 5, title: "25 min", hint: "Short sprints" },
  { minutes: 50, rest: 10, title: "50 min", hint: "Balanced" },
  { minutes: 90, rest: 15, title: "90 min", hint: "Deep work" },
];

const STEPS = ["Welcome", "Rhythm", "Canvas", "Calendar", "Ready"] as const;

export type RhythmChoice = { availability: DailyAvailability[]; preferences: Partial<Preferences> };

export function buildRhythm(rhythm: Rhythm, weekend: Weekend, cap: number, focus: number): RhythmChoice {
  const pick = RHYTHMS.find((item) => item.id === rhythm)!;
  const break_ = FOCUS.find((item) => item.minutes === focus) ?? FOCUS[1];
  const availability = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, day) => {
    const weekendDay = day >= 5;
    return {
      day_of_week: day,
      label,
      start_time: weekendDay ? "10:00:00" : pick.start,
      end_time: weekendDay ? (weekend === "lighter" ? "13:00:00" : "16:00:00") : pick.end,
      is_day_off: weekendDay && weekend === "off",
    };
  });
  const preferences: Partial<Preferences> = {
    max_study_minutes_per_day: String(cap),
    focus_session_minutes: String(break_.minutes),
    short_break_minutes: String(break_.rest),
    ...(pick.sleep ? { sleep_start: pick.sleep[0], wake_time: pick.sleep[1] } : {}),
  };
  return { availability, preferences };
}

type Props = {
  canvas: CanvasConnection | null;
  canvasAssignments: number;
  calendar: CalendarConnection | null;
  calendarImporting: boolean;
  taskCount: number;
  onApplyRhythm: (choice: RhythmChoice) => void;
  onOpenCanvas: () => void;
  onConnectCalendar: () => void;
  onLoadSample: () => void;
  onFinish: (next: "plan" | "add" | "dashboard") => void;
};

export function Onboarding({
  canvas,
  canvasAssignments,
  calendar,
  calendarImporting,
  taskCount,
  onApplyRhythm,
  onOpenCanvas,
  onConnectCalendar,
  onLoadSample,
  onFinish,
}: Props) {
  const [step, setStep] = useState(0);
  const [rhythm, setRhythm] = useState<Rhythm>("evening");
  const [weekend, setWeekend] = useState<Weekend>("lighter");
  const [cap, setCap] = useState(180);
  const [focus, setFocus] = useState(50);
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus to each step's heading so screen readers announce the new step.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".canvas-overlay")) onFinish("dashboard");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFinish]);

  const next = () => setStep((value) => Math.min(value + 1, STEPS.length - 1));
  const back = () => setStep((value) => Math.max(value - 1, 0));

  function saveRhythm() {
    onApplyRhythm(buildRhythm(rhythm, weekend, cap, focus));
    next();
  }

  const rhythmLabel = RHYTHMS.find((item) => item.id === rhythm)!.title.toLowerCase();

  return (
    <div className="onboard-overlay" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="onboard">
        <header className="onboard-head">
          <ol className="onboard-steps" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((label, index) => (
              <li key={label} className={index < step ? "done" : index === step ? "current" : undefined} aria-current={index === step ? "step" : undefined}>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="onboard-skip" onClick={() => onFinish("dashboard")}>
            Skip setup
          </button>
        </header>

        <div className="onboard-body" key={step}>
          {step === 0 && (
            <section>
              <div className="onboard-orb" aria-hidden="true"><Icon name="spark" /></div>
              <h2 id="onboard-title" ref={heading} tabIndex={-1}>
                Let’s plan your week in <em>about a minute.</em>
              </h2>
              <p className="onboard-lede">Four quick steps. Everything can be changed later, and you can skip any of them.</p>
              <ul className="onboard-preview">
                <li><Icon name="clock" /><span><b>Your rhythm</b>When you like to study</span></li>
                <li><Icon name="canvas" /><span><b>Canvas</b>Your assignments, in one paste</span></li>
                <li><Icon name="calendar" /><span><b>Google Calendar</b>Classes and shifts stay protected</span></li>
                <li><Icon name="spark" /><span><b>Your plan</b>Focus sessions before every deadline</span></li>
              </ul>
              <div className="onboard-actions">
                <button type="button" className="glow-button" onClick={next}>Let’s go <Icon name="arrow" /></button>
                <button type="button" className="text-button" onClick={onLoadSample}>Just explore a sample week</button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <p className="kicker">STEP 1 · YOUR RHYTHM</p>
              <h2 id="onboard-title" ref={heading} tabIndex={-1}>When do you study <em>best?</em></h2>
              <p className="onboard-lede">StudyFlow only schedules inside these hours, and works around your classes.</p>

              <fieldset className="onboard-choices four">
                <legend className="sr-only">Weekday study time</legend>
                {RHYTHMS.map((item) => (
                  <button key={item.id} type="button" className="onboard-choice" aria-pressed={rhythm === item.id} onClick={() => setRhythm(item.id)}>
                    <strong>{item.title}</strong>
                    <small>{item.hint}</small>
                  </button>
                ))}
              </fieldset>

              <div className="onboard-row">
                <span className="onboard-label">Weekends</span>
                <div className="onboard-segment" role="group" aria-label="Weekends">
                  {WEEKENDS.map((item) => (
                    <button key={item.id} type="button" aria-pressed={weekend === item.id} onClick={() => setWeekend(item.id)} title={item.hint}>
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
              <div className="onboard-row">
                <span className="onboard-label">Most per day</span>
                <div className="onboard-segment" role="group" aria-label="Most study time per day">
                  {DAILY_CAPS.map((minutes) => (
                    <button key={minutes} type="button" aria-pressed={cap === minutes} onClick={() => setCap(minutes)}>
                      {minutes / 60}h{minutes === 300 ? "+" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div className="onboard-row">
                <span className="onboard-label">Focus blocks</span>
                <div className="onboard-segment" role="group" aria-label="Focus session length">
                  {FOCUS.map((item) => (
                    <button key={item.minutes} type="button" aria-pressed={focus === item.minutes} onClick={() => setFocus(item.minutes)} title={item.hint}>
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="onboard-actions">
                <button type="button" className="glow-button" onClick={saveRhythm}>Save and continue <Icon name="arrow" /></button>
                <button type="button" className="text-button" onClick={back}>Back</button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <p className="kicker">STEP 2 · COURSEWORK</p>
              <h2 id="onboard-title" ref={heading} tabIndex={-1}>Bring in your <em>assignments.</em></h2>
              <p className="onboard-lede">Paste your Canvas calendar link once. You’ll review every assignment, and its time estimate, before anything is added.</p>
              {canvas ? (
                <div className="onboard-connected">
                  <span><Icon name="check" /></span>
                  <div>
                    <strong>Canvas connected</strong>
                    <small>{canvasAssignments ? `${plural(canvasAssignments, "assignment")} imported` : "Choose courses to import your assignments"}</small>
                  </div>
                  {!canvasAssignments && <button type="button" className="ghost-button" onClick={onOpenCanvas}>Import</button>}
                </div>
              ) : (
                <button type="button" className="onboard-connect" onClick={onOpenCanvas}>
                  <span className="canvas-mark"><Icon name="canvas" /></span>
                  <div><strong>Connect Canvas</strong><small>Read-only · takes about 30 seconds</small></div>
                  <Icon name="arrow" />
                </button>
              )}
              <div className="onboard-actions">
                <button type="button" className="glow-button" onClick={next}>Continue <Icon name="arrow" /></button>
                {!canvas && <button type="button" className="text-button" onClick={next}>I don’t use Canvas</button>}
                <button type="button" className="text-button" onClick={back}>Back</button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <p className="kicker">STEP 3 · CALENDAR</p>
              <h2 id="onboard-title" ref={heading} tabIndex={-1}>Protect the time you’re <em>already busy.</em></h2>
              <p className="onboard-lede">StudyFlow reads when you’re busy (classes, shifts, practice) and plans around it. Event titles never leave your browser, and it never changes your calendar.</p>
              {calendar ? (
                <div className="onboard-connected">
                  <span><Icon name="check" /></span>
                  <div>
                    <strong>Google Calendar connected</strong>
                    <small>{plural(calendar.busyEvents, "busy time")} will be protected</small>
                  </div>
                </div>
              ) : (
                <button type="button" className="onboard-connect" onClick={onConnectCalendar} disabled={calendarImporting}>
                  <span className="google-mark">G</span>
                  <div><strong>{calendarImporting ? "Connecting…" : "Connect Google Calendar"}</strong><small>Read-only · busy times only</small></div>
                  <Icon name="arrow" />
                </button>
              )}
              <div className="onboard-actions">
                <button type="button" className="glow-button" onClick={next}>Continue <Icon name="arrow" /></button>
                {!calendar && <button type="button" className="text-button" onClick={next}>Skip for now</button>}
                <button type="button" className="text-button" onClick={back}>Back</button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="onboard-ready">
              <div className="onboard-orb done" aria-hidden="true"><Icon name="check" /></div>
              <h2 id="onboard-title" ref={heading} tabIndex={-1}>
                {taskCount ? <>You’re <em>all set.</em></> : <>Almost <em>there.</em></>}
              </h2>
              <ul className="onboard-summary">
                <li><Icon name="clock" />Studying {rhythmLabel}, up to {cap / 60}h a day in {focus}-minute blocks</li>
                <li><Icon name="canvas" />{canvasAssignments ? `${plural(canvasAssignments, "Canvas assignment")} ready to plan` : canvas ? "Canvas connected" : "Canvas not connected yet"}</li>
                <li><Icon name="calendar" />{calendar ? `${plural(calendar.busyEvents, "busy time")} protected` : "Google Calendar not connected yet"}</li>
              </ul>
              <div className="onboard-actions">
                {taskCount ? (
                  <button type="button" className="glow-button" onClick={() => onFinish("plan")}><Icon name="spark" />Generate my plan</button>
                ) : (
                  <button type="button" className="glow-button" onClick={() => onFinish("add")}><Icon name="plus" />Add an assignment</button>
                )}
                <button type="button" className="text-button" onClick={() => onFinish("dashboard")}>Go to my dashboard</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
