export type ImportedCalendarEvent = {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

type TokenResponse = { access_token?: string; error?: string };
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Identity could not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity could not load."));
    document.head.appendChild(script);
  });
}

export async function requestCalendarToken(clientId: string): Promise<string> {
  await loadGoogleIdentityScript();
  if (!window.google?.accounts.oauth2) throw new Error("Google Identity is unavailable.");
  return new Promise((resolve, reject) => {
    const client = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error === "access_denied" ? "Calendar access was not granted." : "Google Calendar could not connect."));
          return;
        }
        resolve(response.access_token);
      },
    });
    client?.requestAccessToken({ prompt: "consent" });
  });
}

export async function importCalendarEvents(accessToken: string): Promise<ImportedCalendarEvent[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const calendarsResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader", { headers });
  if (!calendarsResponse.ok) throw new Error("StudyFlow could not read your calendar list.");
  const calendars = (await calendarsResponse.json()).items as Array<{ id: string; summary: string; selected?: boolean }>;
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 35).toISOString();
  const visibleCalendars = calendars.filter((calendar) => calendar.selected !== false).slice(0, 20);
  const responses = await Promise.all(visibleCalendars.map(async (calendar) => {
    const query = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${query}`, { headers });
    if (!response.ok) return [] as ImportedCalendarEvent[];
    const payload = await response.json();
    return (payload.items as Array<{ id: string; summary?: string; start?: ImportedCalendarEvent["start"]; end?: ImportedCalendarEvent["end"] }>).map((event) => ({
      id: event.id,
      calendarId: calendar.id,
      calendarName: calendar.summary,
      title: event.summary || "Untitled calendar item",
      start: event.start,
      end: event.end,
    }));
  }));
  return responses.flat();
}
