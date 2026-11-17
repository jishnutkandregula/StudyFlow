// Canvas LMS frontend client — calls the StudyFlow backend only.
// The access token is never sent directly to Canvas, never stored in
// browser storage (localStorage / sessionStorage / cookies), and
// never placed in a URL parameter or query string.

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

type ApiErrorPayload = { code?: string; message?: string };

export class CanvasClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CanvasClientError";
  }
}

async function post<T>(
  apiUrl: string,
  path: string,
  body: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CanvasClientError(
      "UNREACHABLE",
      "Could not reach the StudyFlow backend. Is it running?",
    );
  }

  if (!response.ok) {
    let code = "CANVAS_ERROR";
    let message = "An unexpected error occurred connecting to Canvas.";
    try {
      const data = (await response.json()) as ApiErrorPayload;
      if (data.code) code = data.code;
      if (data.message) message = data.message;
    } catch {
      // fall through to defaults
    }
    throw new CanvasClientError(code, message);
  }

  return response.json() as Promise<T>;
}

/** Verify a Canvas URL + access token and return the student's name + course list. */
export async function connectCanvas(
  apiUrl: string,
  canvasUrl: string,
  accessToken: string,
): Promise<CanvasConnectResult> {
  return post<CanvasConnectResult>(apiUrl, "/api/v1/canvas/connect", {
    canvas_url: canvasUrl,
    access_token: accessToken,
  });
}

/** Fetch upcoming assignments for the given courses (or all if omitted). */
export async function syncCanvas(
  apiUrl: string,
  canvasUrl: string,
  accessToken: string,
  courseIds?: string[],
): Promise<CanvasSyncResult> {
  return post<CanvasSyncResult>(apiUrl, "/api/v1/canvas/sync", {
    canvas_url: canvasUrl,
    access_token: accessToken,
    course_ids: courseIds ?? null,
  });
}
