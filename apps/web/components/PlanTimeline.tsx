"use client";

import { useState } from "react";
import { dayLabel, formatClock, formatHours, plural, toDateKey } from "../lib/format";
import type { Plan, Session } from "../lib/types";
import { Icon } from "./Icon";

type Props = {
  now: Date | null;
  plan: Plan | null;
  stale: boolean;
  loading: boolean;
  courseColor: (course: string) => string;
  onGenerate: () => void;
};

const COLLAPSED_DAYS = 3;

function groupByDay(sessions: Session[]): Array<[string, Session[]]> {
  const groups = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = toDateKey(new Date(session.starts_at));
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }
  return [...groups.entries()];
}

export function PlanTimeline({ now, plan, stale, loading, courseColor, onGenerate }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const upcoming = plan?.sessions.filter((session) => !now || new Date(session.ends_at) > now) ?? [];
  const days = groupByDay(upcoming);
  const visibleDays = showAll ? days : days.slice(0, COLLAPSED_DAYS);

  return (
    <article id="plan" className="surface plan-surface">
      <div className="surface-head">
        <div>
          <p className="kicker">THE PLAN</p>
          <h2>{plan ? "Every session, and why it’s there." : "Your plan lands here."}</h2>
        </div>
        {plan && <span className="surface-meta">{plural(upcoming.length, "session")} · {formatHours(upcoming.reduce((t, s) => t + s.minutes, 0))}</span>}
      </div>

      {stale && plan && (
        <div className="stale-banner" role="status">
          <Icon name="refresh" />
          <span>Your coursework or settings changed since this plan was built.</span>
          <button onClick={onGenerate} disabled={loading}>{loading ? "Replanning…" : "Replan"}</button>
        </div>
      )}

      {!plan ? (
        <div className="empty-state">
          <Icon name="clock" />
          <p>Generate a plan and each focus session appears here, grouped by day, with the reason StudyFlow picked it.</p>
        </div>
      ) : !upcoming.length ? (
        <div className="empty-state">
          <Icon name="check" />
          <p>{plan.sessions.length ? "Every planned session is behind you." : "No sessions could be placed. Check the items below that didn’t fit."}</p>
        </div>
      ) : (
        <div className="session-days">
          {visibleDays.map(([dateKey, sessions]) => (
            <section key={dateKey} className="session-day" aria-label={dayLabel(dateKey, now)}>
              <h3 suppressHydrationWarning>
                {dayLabel(dateKey, now)}
                <span>{formatHours(sessions.reduce((total, session) => total + session.minutes, 0))}</span>
              </h3>
              <ol>
                {sessions.map((session) => {
                  const id = `${session.task_id}-${session.starts_at}`;
                  const isOpen = expanded === id;
                  const live = now && new Date(session.starts_at) <= now;
                  return (
                    <li key={id} className={`session-row${live ? " live" : ""}`} style={{ ["--course" as string]: courseColor(session.course) }}>
                      <time className="session-time" dateTime={session.starts_at}>
                        {formatClock(session.starts_at)}
                        <small>{session.minutes}m</small>
                      </time>
                      <div className="session-body">
                        <strong>{session.task_title}</strong>
                        <small>{session.course} · until {formatClock(session.ends_at)}</small>
                        {isOpen && <p className="session-why">{session.explanation}</p>}
                      </div>
                      <button
                        className="why-button"
                        aria-expanded={isOpen}
                        aria-label={`Why is ${session.task_title} scheduled here?`}
                        onClick={() => setExpanded(isOpen ? null : id)}
                      >
                        Why?
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {days.length > COLLAPSED_DAYS && (
            <button className="quiet-action" onClick={() => setShowAll((current) => !current)}>
              {showAll ? "Show fewer days" : `Show all ${plural(days.length, "day")}`} <Icon name="arrow" />
            </button>
          )}
        </div>
      )}

      {plan && plan.unscheduled.length > 0 && (
        <div className="unscheduled">
          <h3><Icon name="alert" /> Didn’t fit</h3>
          <ul>
            {plan.unscheduled.map((item) => (
              <li key={item.task_id} className={item.risk}>
                <div>
                  <strong>{item.task_title}</strong>
                  <small>{item.course} · {formatHours(item.remaining_minutes)} still unplanned</small>
                </div>
                <span>{item.risk === "high" ? "Due within a day" : "Needs more time"}</span>
              </li>
            ))}
          </ul>
          <p>Add availability, shorten an estimate, or exclude something to make room.</p>
        </div>
      )}
    </article>
  );
}
