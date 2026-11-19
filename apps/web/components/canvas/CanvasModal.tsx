"use client";

import { useEffect, useRef, useState } from "react";
import {
  type CanvasAssignment,
  type CanvasConnectResult,
  type CanvasCourse,
  canvasHost,
  connectCanvas,
  connectCanvasFeed,
  isCanvasFeedLink,
  KNOWN_CANVAS_HOSTS,
  disconnectCanvas,
  listCanvasCourses,
  RECONNECT_CODES,
  syncCanvas,
} from "../../lib/canvasClient";
import { ApiError } from "../../lib/http";
import { eventToBusy } from "../../lib/busyTime";
import { type Estimate, requestEstimates } from "../../lib/estimatesApi";
import { estimateFromPoints, plural, relativeTime, toLocalParts } from "../../lib/format";
import type { BusyBlock, CanvasConnection, Task } from "../../lib/types";
import { Icon } from "../Icon";
import { AssignmentReview, isSchedulable, type ReviewItem } from "./AssignmentReview";

type Step = "feed" | "url" | "token" | "connecting" | "loading" | "courses" | "syncing" | "assignments" | "done" | "error";

export type CanvasImport = {
  /** Canvas tasks to keep in the plan after review. */
  tasks: Task[];
  /** Every Canvas task id the student reviewed; ids not in `tasks` were excluded. */
  reviewedIds: string[];
  /** Class meetings from the Canvas feed (null when this sync had none to offer). */
  busy: BusyBlock[] | null;
};

type Props = {
  now: Date | null;
  connection: CanvasConnection | null;
  existingTasks: Task[];
  /** Canvas task ids the student already finished in StudyFlow. */
  completedIds: string[];
  onClose: () => void;
  onConnected: (connection: CanvasConnection) => void;
  /** The saved connection is gone (disconnected, or Canvas rejected the token). */
  onDisconnected: () => void;
  onImport: (result: CanvasImport) => void;
};

const taskId = (assignment: CanvasAssignment) => `canvas-${assignment.id}`;

function toReviewItems(
  assignments: CanvasAssignment[],
  courses: CanvasCourse[],
  existing: Task[],
  completedIds: Set<string>,
  now: Date,
  estimates: Map<string, Estimate>,
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
    const guess = estimates.get(id);
    // A re-sync keeps the student's number; a new assignment starts from the estimator.
    const suggested = guess?.minutes ?? estimateFromPoints(assignment.points_possible);
    return [{
      id,
      title: assignment.title,
      courseId: assignment.course_id,
      courseLabel: course
        ? course.course_code && course.course_code !== course.name ? `${course.course_code} · ${course.name}` : course.name
        : `Course ${assignment.course_id}`,
      dueDate: due?.date ?? null,
      dueTime: due?.time ?? null,
      points: assignment.points_possible ?? null,
      url: assignment.html_url ?? null,
      include: prior ? true : Boolean(due) && !completedIds.has(id),
      estimate: String(prior?.estimated_minutes ?? suggested),
      description: assignment.description ?? null,
      category: prior?.category ?? guess?.category ?? null,
      reason: prior ? prior.estimate_reason ?? null : guess?.reason ?? null,
      confidence: prior ? null : guess?.confidence ?? null,
      baseEstimate: prior?.original_estimate ?? guess?.base_minutes ?? null,
      suggested: prior ? null : suggested,
      manualDueDate: prior && !due ? prior.due_date : "",
      alreadyInPlan: Boolean(prior),
      finished: completedIds.has(id),
    }];
  }).sort((a, b) => `${a.dueDate ?? "9999"}${a.dueTime ?? ""}`.localeCompare(`${b.dueDate ?? "9999"}${b.dueTime ?? ""}`));
}

function toTask(item: ReviewItem, courses: CanvasCourse[], existing: Task[]): Task {
  const course = courses.find((c) => c.id === item.courseId);
  const prior = existing.find((task) => task.id === item.id);
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
    category: item.category,
    estimate_reason: item.reason,
    original_estimate: item.baseEstimate,
    logged_minutes: prior?.logged_minutes ?? 0,
  };
}

export function CanvasModal({ now, connection, existingTasks, completedIds, onClose, onConnected, onDisconnected, onImport }: Props) {
  const [step, setStep] = useState<Step>(connection ? "done" : "feed");
  const [errorReturnStep, setErrorReturnStep] = useState<Step>("feed");
  const [canvasUrl, setCanvasUrl] = useState(connection?.canvasUrl ?? "");
  const [school, setSchool] = useState(connection ? canvasHost(connection.canvasUrl) : "");
  const [feedLink, setFeedLink] = useState("");
  const [feedHint, setFeedHint] = useState("");
  const [method, setMethod] = useState<CanvasConnection["method"]>(connection?.method ?? "feed");
  const feedInput = useRef<HTMLInputElement>(null);
  // The token is held only until /connect accepts it; after that the API keeps it, encrypted.
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState(connection?.displayName ?? "");
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [classBusy, setClassBusy] = useState<BusyBlock[] | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !["connecting", "loading", "syncing"].includes(step)) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  function fail(err: unknown, fallback: string, returnTo: Step) {
    if (err instanceof ApiError && RECONNECT_CODES.has(err.code) && returnTo !== "token" && returnTo !== "feed") {
      // The saved token or feed link no longer works: the API already forgot it.
      onDisconnected();
      returnTo = method === "token" ? "token" : "feed";
    }
    setError(err instanceof Error ? err.message : fallback);
    setErrorReturnStep(returnTo);
    setStep("error");
  }

  function showCourses(list: CanvasCourse[]) {
    setCourses(list);
    setSelectedCourses(new Set(list.map((course) => course.id)));
    setStep("courses");
  }

  function connected(result: CanvasConnectResult) {
    setCanvasUrl(result.canvas_url);
    setDisplayName(result.display_name);
    setMethod(result.method);
    onConnected({
      displayName: result.display_name,
      canvasUrl: result.canvas_url,
      method: result.method,
      lastSynced: connection?.lastSynced ?? null,
    });
    showCourses(result.courses);
  }

  async function connect() {
    if (!canvasUrl.trim() || !token.trim()) return;
    setStep("connecting");
    try {
      const result = await connectCanvas(canvasUrl.trim(), token.trim());
      setToken("");
      connected(result);
    } catch (err) {
      fail(err, "Could not connect to Canvas.", "token");
    }
  }

  /** One paste: the feed link alone identifies the school and the student. */
  async function connectFeed(link: string) {
    if (!isCanvasFeedLink(link)) {
      setFeedHint("That doesn’t look like a Calendar Feed link. It should end in .ics.");
      return;
    }
    setFeedHint("");
    setStep("connecting");
    try {
      const result = await connectCanvasFeed(link.trim());
      setFeedLink("");
      connected(result);
    } catch (err) {
      fail(err, "Could not connect to Canvas.", "feed");
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setFeedLink(text.trim());
      if (isCanvasFeedLink(text)) void connectFeed(text);
      else setFeedHint("Your clipboard doesn’t have a feed link yet. Copy it from Canvas first.");
    } catch {
      // Clipboard access denied or unsupported: fall back to a manual paste.
      setFeedHint("Paste the link into the box (⌘V or long-press → Paste).");
      feedInput.current?.focus();
    }
  }

  const schoolHost = canvasHost(school);
  const schoolLooksValid = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(schoolHost);

  /** Re-sync with the saved connection: no token needed. */
  async function resync() {
    setStep("loading");
    try {
      showCourses((await listCanvasCourses()).courses);
    } catch (err) {
      fail(err, "Could not load your Canvas courses.", "done");
    }
  }

  async function sync() {
    setStep("syncing");
    try {
      const ids = [...selectedCourses];
      const result = await syncCanvas(ids.length < courses.length ? ids : undefined);
      // Estimates are a helpful default, never a blocker: if they fail, points-based guesses stand.
      const estimates = await requestEstimates(
        result.assignments.map((assignment) => ({
          id: taskId(assignment),
          title: assignment.title,
          course: courses.find((course) => course.id === assignment.course_id)?.course_code ?? "",
          description: assignment.description ?? null,
          points: assignment.points_possible ?? null,
        })),
      ).catch(() => new Map<string, Estimate>());
      setItems(toReviewItems(result.assignments, courses, existingTasks, new Set(completedIds), new Date(), estimates));
      setClassBusy(result.busy ? result.busy.flatMap((event) => eventToBusy(event.start, event.end, "Class", "canvas")) : null);
      onConnected({ displayName, canvasUrl, method, lastSynced: new Date() });
      setStep("assignments");
    } catch (err) {
      fail(err, "Could not sync Canvas assignments.", "courses");
    }
  }

  async function disconnect() {
    try {
      await disconnectCanvas();
      onDisconnected();
      onClose();
    } catch (err) {
      fail(err, "Could not disconnect Canvas.", "done");
    }
  }

  function confirmImport() {
    const kept = items.filter((item) => item.include && isSchedulable(item));
    onImport({ tasks: kept.map((item) => toTask(item, courses, existingTasks)), reviewedIds: items.map((item) => item.id), busy: classBusy });
    const skipped = items.filter((item) => !item.dueDate && !(item.include && isSchedulable(item))).length;
    setSummary(
      `${plural(kept.length, "assignment")} from ${plural(selectedCourses.size, "course")} ${kept.length === 1 ? "is" : "are"} in your plan.` +
        (skipped ? ` ${plural(skipped, "undated assignment")} left out.` : ""),
    );
    setStep("done");
  }

  const backTarget: Partial<Record<Step, Step>> = { url: "feed", token: "url", courses: connection ? "done" : method === "token" ? "token" : "feed" };
  const busy = step === "connecting" || step === "loading" || step === "syncing";

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
            const position = { feed: 0, url: 0, token: 0, connecting: 0, loading: 1, courses: 1, syncing: 1, assignments: 2, done: 3, error: -1 }[step];
            return <li key={label} className={position > index ? "complete" : position === index ? "current" : ""}>{label}</li>;
          })}
        </ol>

        {step === "feed" && (
          <div className="canvas-step">
            <div className="canvas-modal-icon"><Icon name="canvas" /></div>
            <h2 id="canvas-modal-title">Connect Canvas</h2>
            <p>Two quick steps, no passwords or tokens. You’ll review every assignment before it reaches your plan.</p>

            <ol className="feed-steps">
              <li>
                <div className="feed-step-head"><span className="feed-step-num">1</span><strong>Open your Canvas calendar</strong></div>
                <div className="feed-school-row">
                  <input
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    list="canvas-hosts"
                    aria-label="Your school’s Canvas address"
                    placeholder="canvas.yourschool.edu"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                  />
                  <datalist id="canvas-hosts">{KNOWN_CANVAS_HOSTS.map((host) => <option key={host} value={host} />)}</datalist>
                  <a
                    className={`feed-open${schoolLooksValid ? "" : " disabled"}`}
                    href={schoolLooksValid ? `https://${schoolHost}/calendar` : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!schoolLooksValid}
                    onClick={() => window.setTimeout(() => feedInput.current?.focus(), 400)}
                  >
                    Open <Icon name="link" />
                  </a>
                </div>
                <div className="feed-diagram" aria-hidden="true">
                  <div className="feed-diagram-cal">
                    {Array.from({ length: 14 }, (_, i) => <span key={i} className={i === 9 ? "dot" : undefined} />)}
                  </div>
                  <div className="feed-diagram-side">
                    <span /><span /><span />
                    <b>Calendar Feed</b>
                  </div>
                </div>
                <small>In Canvas, click <b>Calendar Feed</b> at the bottom right of the calendar and copy the link.</small>
              </li>
              <li>
                <div className="feed-step-head"><span className="feed-step-num">2</span><strong>Paste it here</strong></div>
                <div className="feed-paste-row">
                  <input
                    ref={feedInput}
                    type="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="Canvas Calendar Feed link"
                    placeholder="https://…/feeds/calendars/user_….ics"
                    value={feedLink}
                    onChange={(e) => {
                      setFeedLink(e.target.value);
                      setFeedHint("");
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (isCanvasFeedLink(text)) {
                        e.preventDefault();
                        setFeedLink(text.trim());
                        void connectFeed(text);
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && feedLink.trim()) void connectFeed(feedLink); }}
                  />
                  <button className="glow-button" onClick={() => (feedLink.trim() ? void connectFeed(feedLink) : void pasteFromClipboard())}>
                    {feedLink.trim() ? <>Connect <Icon name="arrow" /></> : <><Icon name="paste" />Paste link</>}
                  </button>
                </div>
                {feedHint && <small className="feed-hint" role="status">{feedHint}</small>}
              </li>
            </ol>

            <div className="canvas-token-notice">
              <Icon name="lock" />
              <span>The link is private, so StudyFlow treats it like a password: encrypted, never logged, never shown again, and deleted when you disconnect.</span>
            </div>
            <button className="feed-alt" onClick={() => setStep("url")}>
              Your school allows access tokens? <u>Connect with a token</u> to also import points.
            </button>
          </div>
        )}

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
              <span>Encrypted and kept on StudyFlow’s server so you can re-sync with one click. Never logged, never sent back to your browser, and deleted when you disconnect.</span>
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
            <p>
              {step === "connecting"
                ? token ? "Verifying your token and finding courses…" : "Reading your Canvas calendar…"
                : step === "loading"
                  ? "Loading your courses…"
                  : `Reading assignments from ${plural(selectedCourses.size, "course")}…`}
            </p>
          </div>
        )}

        {step === "courses" && (
          <div className="canvas-step">
            <h2 id="canvas-modal-title">Choose courses</h2>
            <p className="canvas-user-name">{method === "feed" ? `From ${displayName}` : `Signed in as ${displayName}`}</p>
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
                    <div>
                      <strong>{course.name}</strong>
                      {(course.course_code !== course.name || course.term) && (
                        <small>{[course.course_code !== course.name ? course.course_code : "", course.term ?? ""].filter(Boolean).join(" · ")}</small>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <Icon name="canvas" />
                <p>{method === "feed" ? "Your Canvas calendar has no upcoming assignments right now. Sync again when new work is posted." : "No active student enrollments were found on this Canvas account."}</p>
              </div>
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
            fromFeed={method === "feed"}
            now={now}
            onChange={(id, changes) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)))}
            onSetAll={(include) => setItems((current) => current.map((item) => ({ ...item, include: include && Boolean(item.dueDate || item.manualDueDate) })))}
            onConfirm={confirmImport}
          />
        )}

        {step === "done" && (
          <div className="canvas-step canvas-success-step">
            <div className="canvas-success-icon"><Icon name="check" /></div>
            <h2 id="canvas-modal-title">{summary ? "Canvas synced" : "Canvas connected"}</h2>
            <p suppressHydrationWarning>
              {summary ||
                (connection
                  ? `${connection.method === "feed" ? "Connected through your calendar feed" : `Signed in as ${connection.displayName}`}${connection.lastSynced ? ` · last synced ${relativeTime(connection.lastSynced, now)}` : ""}. ${plural(existingTasks.length, "Canvas assignment")} in your plan.`
                  : "")}
            </p>
            <div className="canvas-modal-actions">
              {summary ? (
                <button className="glow-button" onClick={onClose}>Done</button>
              ) : (
                <button className="glow-button" onClick={() => void resync()}><Icon name="refresh" />Sync now</button>
              )}
              {confirmDisconnect ? (
                <div className="confirm-row" role="group" aria-label="Confirm disconnect">
                  <span>Delete the saved {connection?.method === "feed" ? "feed link" : "token"}? Imported assignments stay in your plan.</span>
                  <button className="danger-button" onClick={() => void disconnect()}>Disconnect</button>
                  <button className="quiet-action" onClick={() => setConfirmDisconnect(false)}>Keep</button>
                </div>
              ) : (
                <button className="quiet-action" onClick={() => setConfirmDisconnect(true)}>Disconnect Canvas</button>
              )}
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
