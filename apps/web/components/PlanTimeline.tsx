"use client";

import { useState } from "react";
import { dayLabel, formatClock, formatHours, plural, toDateKey } from "../lib/format";
import { healthLabel, healthTrend } from "../lib/health";
import type { Plan, PlanChange, Session } from "../lib/types";
import { Icon } from "./Icon";

type Props = {
  now: Date | null;
  plan: Plan | null;
  stale: boolean;
  loading: boolean;
  change: PlanChange | null;
  todayBlocked: boolean;
  courseColor: (course: string) => string;
  onGenerate: () => void;
  onDismissChange: () => void;
  onDone: (session: Session) => void;
  onMoreTime: (session: Session) => void;
  onToggleLock: (session: Session) => void;
  onSkipToday: () => void;
  onUnskipToday: () => void;
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

function ChangeSummary({ change, onDismiss }: { change: PlanChange; onDismiss: () => void }) {
  const trend = healthTrend(change.healthBefore, change.healthAfter);
  const lines: string[] = [];
  if (change.nowFits.length) lines.push(`Now fits: ${change.nowFits.join(", ")}.`);
  if (change.noLongerFits.length) lines.push(`No longer fits: ${change.noLongerFits.join(", ")}.`);
  if (change.movedSessions) lines.push(`${plural(change.movedSessions, "session")} moved or added.`);
  if (!lines.length) lines.push("Nothing else had to move.");
  return (
    <div className={`change-summary ${trend}`} role="status">
      <div>
        <strong>
          {change.cause}
          {trend !== "same" && (
            <span> · {healthLabel[change.healthBefore]} → {healthLabel[change.healthAfter]}</span>
          )}
        </strong>
        <p>{lines.join(" ")}</p>
      </div>
      <button onClick={onDismiss} aria-label="Dismiss summary"><Icon name="x" /></button>
    </div>
  );
}

export function PlanTimeline(props: Props) {
  const { now, plan, stale, loading, change, todayBlocked, courseColor } = props;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const upcoming = plan?.sessions.filter((session) => !now || new Date(session.ends_at) > now) ?? [];
  const days = groupByDay(upcoming);
  const visibleDays = showAll ? days : days.slice(0, COLLAPSED_DAYS);
  const todayKey = now ? toDateKey(now) : null;

  return (
    <article id="plan" className="surface plan-surface" aria-busy={loading}>
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
          <button onClick={props.onGenerate} disabled={loading}>{loading ? "Replanning…" : "Replan"}</button>
        </div>
      )}

      {change && !stale && <ChangeSummary change={change} onDismiss={props.onDismissChange} />}

      {todayBlocked && plan && (
        <div className="day-off-banner">
          <span>Taking today off. Nothing is scheduled until tomorrow.</span>
          <button onClick={props.onUnskipToday} disabled={loading}>Study today after all</button>
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
                {dateKey === todayKey && sessions.some((s) => !s.locked) && (
                  <button className="day-action" onClick={props.onSkipToday} disabled={loading}>
                    Can’t study today
                  </button>
                )}
              </h3>
              <ol>
                {sessions.map((session) => {
                  const id = `${session.task_id}-${session.starts_at}`;
                  const isOpen = expanded === id;
                  const live = now && new Date(session.starts_at) <= now;
                  return (
                    <li
                      key={id}
                      className={`session-row${live ? " live" : ""}${session.locked ? " locked" : ""}`}
                      style={{ ["--course" as string]: courseColor(session.course) }}
                    >
                      <time className="session-time" dateTime={session.starts_at}>
                        {formatClock(session.starts_at)}
                        <small>{session.minutes}m</small>
                      </time>
                      <div className="session-body">
                        <strong>
                          {session.locked && <span className="lock-badge" title="Locked"><Icon name="lock" /></span>}
                          {session.task_title}
                        </strong>
                        <small>{session.course} · until {formatClock(session.ends_at)}</small>
                        {isOpen && <p className="session-why">{session.explanation}</p>}
                      </div>
                      <div className="session-actions" role="group" aria-label={`Actions for ${session.task_title}`}>
                        <button className="why-button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : id)}>
                          Why?
                        </button>
                        <button className="session-icon done" onClick={() => props.onDone(session)} disabled={loading} title="Mark this session done" aria-label={`Mark ${session.task_title} session done`}>
                          <Icon name="check" />
                        </button>
                        <button className="session-icon" onClick={() => props.onMoreTime(session)} disabled={loading} title="This needs 30 more minutes" aria-label={`${session.task_title} needs 30 more minutes`}>
                          +30
                        </button>
                        <button
                          className={`session-icon${session.locked ? " active" : ""}`}
                          onClick={() => props.onToggleLock(session)}
                          disabled={loading}
                          aria-pressed={Boolean(session.locked)}
                          title={session.locked ? "Unlock: let StudyFlow move it" : "Lock: keep this exact time"}
                          aria-label={`${session.locked ? "Unlock" : "Lock"} ${session.task_title} session`}
                        >
                          <Icon name={session.locked ? "lock" : "unlock"} />
                        </button>
                      </div>
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
              <li key={item.task_id} className={item.recoverable === false ? "high" : item.risk}>
                <div>
                  <strong>{item.task_title}</strong>
                  <small>{item.course} · {formatHours(item.remaining_minutes)} still unplanned</small>
                  <p>{item.reason}</p>
                </div>
                <span>{item.recoverable === false ? "Can’t fit alone" : "Competing for time"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
