"use client";

import { formatDue, formatHours, plural } from "../../lib/format";
import { Icon } from "../Icon";

export type ReviewItem = {
  id: string;
  title: string;
  courseId: string;
  courseLabel: string;
  dueDate: string | null;
  dueTime: string | null;
  points: number | null;
  url: string | null;
  include: boolean;
  estimate: string;
  /** Date the student picked for an assignment Canvas has no due date for. */
  manualDueDate: string;
  alreadyInPlan: boolean;
  /** Marked done in StudyFlow earlier; left out by default on a re-sync. */
  finished: boolean;
};

type Props = {
  items: ReviewItem[];
  now: Date | null;
  onChange: (id: string, changes: Partial<ReviewItem>) => void;
  onSetAll: (include: boolean) => void;
  onConfirm: () => void;
};

export function isSchedulable(item: ReviewItem) {
  return Boolean(item.dueDate || item.manualDueDate) && Number(item.estimate) >= 15;
}

function Row({ item, now, onChange }: { item: ReviewItem; now: Date | null; onChange: Props["onChange"] }) {
  const undated = !item.dueDate;
  const checkboxDisabled = undated && !item.manualDueDate;
  return (
    <li className={`review-row${item.include ? "" : " excluded"}`}>
      <input
        type="checkbox"
        checked={item.include}
        disabled={checkboxDisabled}
        onChange={(e) => onChange(item.id, { include: e.target.checked })}
        aria-label={`Include ${item.title}`}
      />
      <div className="review-main">
        <strong>{item.title}</strong>
        <small suppressHydrationWarning>
          {undated ? "No due date in Canvas" : `Due ${formatDue(item.dueDate!, item.dueTime, now)}`}
          {item.points != null && ` · ${item.points} pts`}
          {item.alreadyInPlan && <span className="source-badge">In plan</span>}
          {item.finished && <span className="source-badge finished">Finished</span>}
        </small>
        {undated && (
          <label className="review-date">
            <span>Plan it for</span>
            <input
              type="date"
              value={item.manualDueDate}
              onChange={(e) => onChange(item.id, { manualDueDate: e.target.value, include: Boolean(e.target.value) })}
            />
          </label>
        )}
      </div>
      <label className="minutes-field compact" title="Estimated focus time">
        <input
          type="number"
          min="15"
          max="1440"
          step="15"
          value={item.estimate}
          onChange={(e) => onChange(item.id, { estimate: e.target.value })}
          onBlur={(e) => {
            const value = Math.round(Number(e.target.value) / 15) * 15;
            onChange(item.id, { estimate: String(Math.min(1440, Math.max(15, value || 15))) });
          }}
          aria-label={`Estimated minutes for ${item.title}`}
        />
        <span>min</span>
      </label>
      {item.url ? (
        <a className="review-link" href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.title} in Canvas`}>
          <Icon name="link" />
        </a>
      ) : (
        <span className="review-link" />
      )}
    </li>
  );
}

export function AssignmentReview({ items, now, onChange, onSetAll, onConfirm }: Props) {
  const dated = items.filter((item) => item.dueDate);
  const undated = items.filter((item) => !item.dueDate);
  const selected = items.filter((item) => item.include && isSchedulable(item));
  const totalMinutes = selected.reduce((total, item) => total + Number(item.estimate), 0);

  const byCourse = new Map<string, ReviewItem[]>();
  for (const item of dated) byCourse.set(item.courseLabel, [...(byCourse.get(item.courseLabel) ?? []), item]);

  return (
    <div className="canvas-step review-step">
      <h2>Review assignments</h2>
      <p>
        Choose what goes into your plan. Estimates start from point values — adjust them to match how long the work
        really takes you.
      </p>

      {!items.length ? (
        <div className="empty-state compact">
          <Icon name="check" />
          <p>No upcoming assignments in the selected courses. You’re clear.</p>
        </div>
      ) : (
        <>
          <div className="review-toolbar">
            <span>{plural(items.length, "assignment")} found</span>
            <div>
              <button onClick={() => onSetAll(true)}>Select all</button>
              <button onClick={() => onSetAll(false)}>Clear</button>
            </div>
          </div>
          <div className="review-list">
            {[...byCourse.entries()].map(([course, courseItems]) => (
              <section key={course}>
                <h3>{course}</h3>
                <ul>{courseItems.map((item) => <Row key={item.id} item={item} now={now} onChange={onChange} />)}</ul>
              </section>
            ))}
            {undated.length > 0 && (
              <section>
                <h3 className="undated-heading"><Icon name="alert" /> No due date ({undated.length})</h3>
                <p className="review-note">Canvas doesn’t list a deadline for these. Pick a date to plan them, or leave them out.</p>
                <ul>{undated.map((item) => <Row key={item.id} item={item} now={now} onChange={onChange} />)}</ul>
              </section>
            )}
          </div>
        </>
      )}

      <div className="review-footer">
        <span>
          <strong>{plural(selected.length, "assignment")}</strong> · {formatHours(totalMinutes)} estimated
        </span>
        <button className="glow-button" onClick={onConfirm}>
          {selected.length ? `Add ${selected.length} to plan` : "Continue without importing"} <Icon name="arrow" />
        </button>
      </div>
    </div>
  );
}
