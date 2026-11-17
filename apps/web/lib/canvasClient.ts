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
