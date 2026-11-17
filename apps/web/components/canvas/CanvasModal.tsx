"use client";

import { useEffect, useState } from "react";
import {
  type CanvasAssignment,
  type CanvasCourse,
  connectCanvas,
  syncCanvas,
} from "../../lib/canvasClient";
import { estimateFromPoints, plural, relativeTime, toLocalParts } from "../../lib/format";
import type { CanvasConnection, Task } from "../../lib/types";
import { Icon } from "../Icon";
import { AssignmentReview, isSchedulable, type ReviewItem } from "./AssignmentReview";

type Step = "url" | "token" | "connecting" | "courses" | "syncing" | "assignments" | "done" | "error";

export type CanvasImport = {
  /** Canvas tasks to keep in the plan after review. */
  tasks: Task[];
  /** Every Canvas task id the student reviewed; ids not in `tasks` were excluded. */
  reviewedIds: string[];
};

type Props = {
  apiUrl: string;
  now: Date | null;
  connection: CanvasConnection | null;
  existingTasks: Task[];
  /** Canvas task ids the student already finished in StudyFlow. */
  completedIds: string[];
  onClose: () => void;
  onConnected: (connection: CanvasConnection) => void;
  onImport: (result: CanvasImport) => void;
};

const taskId = (assignment: CanvasAssignment) => `canvas-${assignment.id}`;

function toReviewItems(
  assignments: CanvasAssignment[],
  courses: CanvasCourse[],
  existing: Task[],
  completedIds: Set<string>,
  now: Date,
): ReviewItem[] {
  const seen = new Set<string>();
  return assignments.flatMap((assignment) => {
    const id = taskId(assignment);
    if (seen.has(id)) return [];
    seen.add(id);
    if (assignment.due_at && new Date(assignment.due_at) <= now) return [];
    const course = courses.find((c) => c.id === assignment.course_id);
    const prior = existing.find((task) => task.id === id);
    const due = assignment.due_at ? toLocalParts(assignment.due_at) : null;
    return [{
      id,
      title: assignment.title,
      courseId: assignment.course_id,
      courseLabel: course ? `${course.course_code} · ${course.name}` : `Course ${assignment.course_id}`,
      dueDate: due?.date ?? null,
      dueTime: due?.time ?? null,
      points: assignment.points_possible ?? null,
      url: assignment.html_url ?? null,
      include: prior ? true : Boolean(due) && !completedIds.has(id),
      estimate: String(prior?.estimated_minutes ?? estimateFromPoints(assignment.points_possible)),
      manualDueDate: prior && !due ? prior.due_date : "",
      alreadyInPlan: Boolean(prior),
      finished: completedIds.has(id),
    }];
  }).sort((a, b) => `${a.dueDate ?? "9999"}${a.dueTime ?? ""}`.localeCompare(`${b.dueDate ?? "9999"}${b.dueTime ?? ""}`));
}

function toTask(item: ReviewItem, courses: CanvasCourse[]): Task {
  const course = courses.find((c) => c.id === item.courseId);
  return {
    id: item.id,
    title: item.title,
    course: course?.course_code ?? item.courseLabel,
    due_date: item.dueDate ?? item.manualDueDate,
    due_time: item.dueDate ? item.dueTime : null,
    estimated_minutes: Number(item.estimate),
    priority: 3,
    // Points only break ties between assignments due at the same time.
    course_weight: Math.min(100, Math.max(1, item.points ?? 10)),
    source: "canvas",
    points: item.points,
    url: item.url,
  };
}

export function CanvasModal({ apiUrl, now, connection, existingTasks, completedIds, onClose, onConnected, onImport }: Props) {
  const [step, setStep] = useState<Step>(connection ? "done" : "url");
  const [errorReturnStep, setErrorReturnStep] = useState<Step>("token");
  const [canvasUrl, setCanvasUrl] = useState(connection?.canvasUrl ?? "");
  // The token lives only in this component's memory and disappears when the modal closes.
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState(connection?.displayName ?? "");
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && step !== "connecting" && step !== "syncing") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  function fail(message: string, returnTo: Step) {
    setError(message);
    setErrorReturnStep(returnTo);
    setStep("error");
  }

  async function connect() {
    if (!canvasUrl.trim() || !token.trim()) return;
    setStep("connecting");
    try {
      const result = await connectCanvas(apiUrl, canvasUrl.trim(), token.trim());
      setCanvasUrl(result.canvas_url);
      setDisplayName(result.display_name);
      setCourses(result.courses);
      setSelectedCourses(new Set(result.courses.map((course) => course.id)));
      setStep("courses");
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not connect to Canvas.", "token");
    }
  }

  async function sync() {
    setStep("syncing");
    try {
      const ids = [...selectedCourses];
      const result = await syncCanvas(apiUrl, canvasUrl, token.trim(), ids.length < courses.length ? ids : undefined);
      setItems(toReviewItems(result.assignments, courses, existingTasks, new Set(completedIds), new Date()));
      onConnected({ displayName, canvasUrl, courseCount: ids.length, lastSynced: new Date() });
      setToken("");
      setStep("assignments");
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not sync Canvas assignments.", "courses");
    }
  }

  function confirmImport() {
    const kept = items.filter((item) => item.include && isSchedulable(item));
    onImport({ tasks: kept.map((item) => toTask(item, courses)), reviewedIds: items.map((item) => item.id) });
    const skipped = items.filter((item) => !item.dueDate && !(item.include && isSchedulable(item))).length;
    setSummary(
      `${plural(kept.length, "assignment")} from ${plural(selectedCourses.size, "course")} ${kept.length === 1 ? "is" : "are"} in your plan.` +
        (skipped ? ` ${plural(skipped, "undated assignment")} left out.` : ""),
    );
    setStep("done");
  }

  const backTarget: Partial<Record<Step, Step>> = { token: "url", courses: "token" };
  const busy = step === "connecting" || step === "syncing";

  return (
    <div className="canvas-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className={`canvas-modal${step === "assignments" ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="canvas-modal-title">
        <div className="canvas-modal-header">
          {backTarget[step] && (
            <button className="canvas-back" onClick={() => setStep(backTarget[step]!)}>&#8592; Back</button>
          )}
          {!busy && <button className="canvas-close" onClick={onClose} aria-label="Close"><Icon name="x" /></button>}
        </div>

        <ol className="canvas-progress" aria-label="Progress">
          {["Connect", "Courses", "Review"].map((label, index) => {
            const position = { url: 0, token: 0, connecting: 0, courses: 1, syncing: 1, assignments: 2, done: 3, error: -1 }[step];
            return <li key={label} className={position > index ? "complete" : position === index ? "current" : ""}>{label}</li>;
          })}
        </ol>

        {step === "url" && (
          <div className="canvas-step">
            <div className="canvas-modal-icon"><Icon name="canvas" /></div>
            <h2 id="canvas-modal-title">Connect Canvas</h2>
            <p>Import your courses and upcoming assignments. You’ll review everything before it reaches your plan.</p>
            <label className="canvas-field">
              <span>Your school’s Canvas URL</span>
              <input type="text" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="canvas.university.edu" value={canvasUrl} onChange={(e) => setCanvasUrl(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && canvasUrl.trim()) setStep("token"); }} />
              <small>The address you see when you’re logged in to Canvas.</small>
            </label>
            <div className="canvas-modal-actions">
              <button className="glow-button" disabled={!canvasUrl.trim()} onClick={() => setStep("token")}>Continue <Icon name="arrow" /></button>
            </div>
          </div>
        )}

        {step === "token" && (
          <div className="canvas-step">
            <div className="canvas-modal-icon"><Icon name="canvas" /></div>
            <h2 id="canvas-modal-title">Access token</h2>
            <p>In Canvas, open <b>Account → Settings → Approved Integrations</b> and choose <b>New Access Token</b>. Paste it here.</p>
            <label className="canvas-field">
              <span>Access token</span>
              <input type="password" placeholder="Paste your Canvas access token" value={token} onChange={(e) => setToken(e.target.value)} autoFocus autoComplete="off" onKeyDown={(e) => { if (e.key === "Enter" && token.trim()) void connect(); }} />
            </label>
            <div className="canvas-token-notice">
              <Icon name="check" />
              <span>Read-only. Sent to StudyFlow’s backend only for this sync — never stored, logged, or saved in your browser.</span>
            </div>
            <div className="canvas-modal-actions">
              <button className="glow-button" disabled={!token.trim()} onClick={() => void connect()}>Connect Canvas <Icon name="arrow" /></button>
            </div>
          </div>
        )}

        {busy && (
          <div className="canvas-step canvas-loading" role="status">
            <div className="canvas-spinner" />
            <h2 id="canvas-modal-title" className="sr-only">Working</h2>
            <p>{step === "connecting" ? "Verifying your token and finding courses…" : `Reading assignments from ${plural(selectedCourses.size, "course")}…`}</p>
          </div>
        )}

        {step === "courses" && (
          <div className="canvas-step">
            <h2 id="canvas-modal-title">Choose courses</h2>
            <p className="canvas-user-name">Signed in as {displayName}</p>
            {courses.length ? (
              <div className="canvas-course-list">
                {courses.map((course) => (
                  <label key={course.id} className="canvas-course-item">
                    <input
                      type="checkbox"
                      checked={selectedCourses.has(course.id)}
                      onChange={() => setSelectedCourses((current) => {
                        const next = new Set(current);
                        if (next.has(course.id)) next.delete(course.id);
                        else next.add(course.id);
                        return next;
                      })}
                    />
                    <div><strong>{course.name}</strong><small>{course.course_code}{course.term ? ` · ${course.term}` : ""}</small></div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="empty-state compact"><Icon name="canvas" /><p>No active student enrollments were found on this Canvas account.</p></div>
            )}
            <p className="canvas-select-count">{selectedCourses.size} of {courses.length} selected</p>
            <div className="canvas-modal-actions">
              <button className="glow-button" disabled={selectedCourses.size === 0} onClick={() => void sync()}>Find assignments <Icon name="arrow" /></button>
            </div>
          </div>
        )}

        {step === "assignments" && (
          <AssignmentReview
            items={items}
            now={now}
            onChange={(id, changes) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)))}
            onSetAll={(include) => setItems((current) => current.map((item) => ({ ...item, include: include && Boolean(item.dueDate || item.manualDueDate) })))}
            onConfirm={confirmImport}
          />
        )}

        {step === "done" && (
          <div className="canvas-step canvas-success-step">
            <div className="canvas-success-icon"><Icon name="check" /></div>
            <h2 id="canvas-modal-title">Canvas synced</h2>
            <p suppressHydrationWarning>
              {summary ||
                (connection
                  ? `Connected as ${connection.displayName} · last synced ${relativeTime(connection.lastSynced, now)}. ${plural(existingTasks.length, "Canvas assignment")} in your plan.`
                  : "")}
            </p>
            <div className="canvas-modal-actions">
              <button className="glow-button" onClick={onClose}>Done</button>
              <button className="quiet-action" onClick={() => { setToken(""); setStep("token"); }}><Icon name="refresh" />Sync again</button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="canvas-step canvas-error-step" role="alert">
            <div className="canvas-error-icon">!</div>
            <h2 id="canvas-modal-title">Canvas didn’t connect</h2>
            <p className="canvas-error-msg">{error}</p>
            <div className="canvas-modal-actions">
              <button className="glow-button" onClick={() => setStep(errorReturnStep)}>Try again</button>
              <button className="quiet-action" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
