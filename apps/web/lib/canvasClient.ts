// Canvas LMS client — talks to the StudyFlow API only, never to Canvas directly.
// The access token is sent exactly once, to /connect. The API encrypts and keeps
// it server-side; it never comes back to the browser and is never put in
// browser storage or a URL.

import { apiFetch } from "./http";

export type CanvasCourse = {
  id: string;
  name: string;
  course_code: string;
  term?: string;
};

export type CanvasAssignment = {
  id: string;
  course_id: string;
  title: string;
  due_at: string | null;
  points_possible?: number;
  html_url?: string;
};

export type CanvasConnectResult = {
  display_name: string;
  canvas_url: string;
  courses: CanvasCourse[];
  method: "token" | "feed";
};

export type CanvasSyncResult = {
  assignments: CanvasAssignment[];
  courses_scanned: number;
  assignments_found: number;
};

/** Verify a Canvas URL + token; the API stores the token and returns courses. */
export function connectCanvas(canvasUrl: string, accessToken: string): Promise<CanvasConnectResult> {
  return apiFetch("/api/v1/canvas/connect", {
    method: "POST",
    json: { canvas_url: canvasUrl, access_token: accessToken },
  });
}

/**
 * Connect with the private Calendar Feed link: no token, works even where a school blocks
 * tokens. Like a token, the link is stored encrypted by the API and never returned.
 */
export function connectCanvasFeed(feedUrl: string): Promise<CanvasConnectResult> {
  return apiFetch("/api/v1/canvas/connect-feed", { method: "POST", json: { feed_url: feedUrl } });
}

/** True when text looks like a Canvas Calendar Feed link. */
export function isCanvasFeedLink(text: string): boolean {
  return /^(https?:\/\/|webcal:\/\/)?[a-z0-9.-]+\.[a-z]{2,}\/feeds\/calendars\/user_[a-z0-9]{10,}\.ics\s*$/i.test(text.trim());
}

/** Pull the Canvas host out of a feed link or a typed address. */
export function canvasHost(text: string): string {
  const cleaned = text.trim().replace(/^(https?|webcal):\/\//i, "");
  return cleaned.split("/")[0].toLowerCase();
}

/** Canvas addresses for common schools; free text works for every other school. */
export const KNOWN_CANVAS_HOSTS = [
  "canvas.ucsc.edu",
  "bruinlearn.ucla.edu",
  "bcourses.berkeley.edu",
  "canvas.ucsd.edu",
  "canvas.eee.uci.edu",
  "canvas.ucdavis.edu",
  "canvas.stanford.edu",
  "canvas.harvard.edu",
  "canvas.mit.edu",
  "canvas.asu.edu",
  "canvas.uw.edu",
  "umich.instructure.com",
];

/** List courses with the saved connection. */
export function listCanvasCourses(): Promise<CanvasConnectResult> {
  return apiFetch("/api/v1/canvas/courses");
}

/** Fetch upcoming assignments with the saved connection. */
export function syncCanvas(courseIds?: string[]): Promise<CanvasSyncResult> {
  return apiFetch("/api/v1/canvas/sync", { method: "POST", json: { course_ids: courseIds ?? null } });
}

/** Delete the saved token and connection details. */
export function disconnectCanvas(): Promise<void> {
  return apiFetch("/api/v1/canvas/connection", { method: "DELETE" });
}

/** Error codes meaning the saved connection is gone and the student must reconnect. */
export const RECONNECT_CODES = new Set(["unauthorized", "not_connected"]);
