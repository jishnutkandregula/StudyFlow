// One fetch wrapper for every StudyFlow API call. Requests go to the same origin
// (Next.js proxies /api/* to FastAPI), carry the session cookie, and send the
// header the API requires on state-changing requests.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ErrorPayload = { code?: string; message?: string; detail?: unknown };

export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      credentials: "same-origin",
      headers: {
        "X-StudyFlow-Request": "1",
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "unreachable", "Couldn’t reach StudyFlow. Check your connection and that the API is running.");
  }

  if (!response.ok) {
    let code = `http_${response.status}`;
    let message = "Something went wrong. Please try again.";
    try {
      const data = (await response.json()) as ErrorPayload;
      if (data.code) code = data.code;
      if (data.message) message = data.message;
      else if (typeof data.detail === "string") message = data.detail;
    } catch {
      // Non-JSON error body (e.g. the proxy couldn't reach the API).
      if (response.status >= 500) message = "The StudyFlow API isn’t responding. Is it running?";
    }
    throw new ApiError(response.status, code, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
