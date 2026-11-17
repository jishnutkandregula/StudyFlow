"use client";

import { FormEvent, useState } from "react";
import { formatDue, formatHours, hoursUntilDue } from "../lib/format";
import type { Task } from "../lib/types";
import { Icon } from "./Icon";

type Props = {
  now: Date | null;
  tasks: Task[];
  courseColor: (course: string) => string;
  showCapture: boolean;
  onToggleCapture: () => void;
  onAdd: (task: Task) => void;
  onRemove: (id: string) => void;
  onEstimateChange: (id: string, minutes: number) => void;
  completed: Array<{ id: string; title: string; course: string }>;
};

const emptyDraft = { title: "", course: "", due_date: "", due_time: "", estimated_minutes: "60" };

/** The estimate doubles as an editor: click it, type minutes, press Enter. */
function EstimateEditor({ task, onChange }: { task: Task; onChange: (minutes: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(task.estimated_minutes));

  function commit() {
    const minutes = Math.min(1440, Math.max(15, Math.round(Number(value) / 15) * 15 || 15));
    setEditing(false);
    if (minutes !== task.estimated_minutes) onChange(minutes);
  }

  if (!editing) {
    return (
      <button
        className="task-time"
        onClick={() => { setValue(String(task.estimated_minutes)); setEditing(true); }}
        title="Edit estimate"
        aria-label={`Estimate for ${task.title}: ${formatHours(task.estimated_minutes)}. Edit`}
      >
        {formatHours(task.estimated_minutes)}
      </button>
    );
  }
  return (
    <label className="minutes-field compact task-estimate">
      <input
        type="number"
        min="15"
        max="1440"
        step="15"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        aria-label={`Estimated minutes for ${task.title}`}
      />
      <span>min</span>
    </label>
  );
}

function compareDeadline(a: Task, b: Task) {
  return `${a.due_date}T${a.due_time ?? "23:59:59"}`.localeCompare(`${b.due_date}T${b.due_time ?? "23:59:59"}`);
}

export function WorkloadPanel({ now, tasks, courseColor, showCapture, onToggleCapture, onAdd, onRemove, onEstimateChange, completed }: Props) {
  const [draft, setDraft] = useState(emptyDraft);
  const sorted = [...tasks].sort(compareDeadline);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minutes = Number(draft.estimated_minutes);
    if (!draft.title.trim() || !draft.course.trim() || !draft.due_date || !(minutes >= 15)) return;
    onAdd({
      id: crypto.randomUUID(),
      title: draft.title.trim(),
      course: draft.course.trim(),
      due_date: draft.due_date,
      due_time: draft.due_time ? `${draft.due_time}:00` : null,
      estimated_minutes: minutes,
      priority: 3,
      course_weight: 10,
      source: "manual",
    });
    setDraft(emptyDraft);
  }

  return (
    <article id="work" className="surface workload-surface">
      <div className="surface-head">
        <div>
          <p className="kicker">WORKLOAD</p>
          <h2>Everything on your plate.</h2>
        </div>
        <button className="icon-button" onClick={onToggleCapture} aria-label={showCapture ? "Close manual entry" : "Add coursework manually"} aria-expanded={showCapture}>
          <Icon name={showCapture ? "x" : "plus"} />
        </button>
      </div>

      {showCapture && (
        <form className="capture-form" onSubmit={submit} aria-label="Add coursework">
          <input required autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="What needs doing?" aria-label="Title" />
          <div>
            <input required value={draft.course} onChange={(e) => setDraft({ ...draft, course: e.target.value })} placeholder="Course" aria-label="Course" />
            <input required type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} aria-label="Due date" />
            <input type="time" value={draft.due_time} onChange={(e) => setDraft({ ...draft, due_time: e.target.value })} aria-label="Due time (optional)" />
            <label className="minutes-field">
              <input required min="15" max="1440" step="15" type="number" value={draft.estimated_minutes} onChange={(e) => setDraft({ ...draft, estimated_minutes: e.target.value })} aria-label="Estimated minutes" />
              <span>min</span>
            </label>
          </div>
          <button className="glow-button" type="submit">Add to workload</button>
        </form>
      )}

      {!sorted.length && completed.length ? (
        <div className="empty-state">
          <Icon name="check" />
          <p>Everything on your list is done. Nice work.</p>
        </div>
      ) : !sorted.length ? (
        <div className="empty-state">
          <Icon name="canvas" />
          <p>Nothing here yet. Connect Canvas to import assignments, or add one with the + button.</p>
        </div>
      ) : (
        <ul className="task-stack">
          {sorted.map((task) => {
            const hours = hoursUntilDue(task.due_date, task.due_time, now);
            const urgent = hours !== null && hours <= 48;
            return (
              <li className="task-row" key={task.id}>
                <span className="task-color" style={{ background: courseColor(task.course) }} />
                <div className="task-main">
                  <strong>
                    {task.url ? (
                      <a href={task.url} target="_blank" rel="noopener noreferrer">{task.title}</a>
                    ) : (
                      task.title
                    )}
                  </strong>
                  <small suppressHydrationWarning>
                    {task.course} · <span className={urgent ? "due-soon" : undefined}>due {formatDue(task.due_date, task.due_time, now)}</span>
                    {task.source === "canvas" && <span className="source-badge">Canvas</span>}
                  </small>
                </div>
                <EstimateEditor key={task.estimated_minutes} task={task} onChange={(minutes) => onEstimateChange(task.id, minutes)} />
                <button className="row-remove" onClick={() => onRemove(task.id)} aria-label={`Remove ${task.title}`}>
                  <Icon name="x" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {completed.length > 0 && (
        <details className="completed-list">
          <summary><Icon name="check" /> {completed.length} finished</summary>
          <ul>
            {completed.map((item) => (
              <li key={item.id}><span>{item.title}</span><small>{item.course}</small></li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
