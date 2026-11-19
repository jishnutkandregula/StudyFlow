export type ImportedCalendarEvent = {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

type RawEvent = {
  id: string;
  summary?: string;
  status?: string;
  transparency?: string;
  eventType?: string;
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
  start?: ImportedCalendarEvent["start"];
  end?: ImportedCalendarEvent["end"];
};

/**
 * Whether an event actually takes the student's time. Events marked "Free", invitations
 * they declined, cancelled events, and working-location markers ("Home", "Office") don't.
 */
export function blocksTime(event: RawEvent): boolean {
  if (event.status === "cancelled") return false;
  if (event.transparency === "transparent") return false;
  if (event.eventType === "workingLocation") return false;
  if (event.attendees?.some((attendee) => attendee.self && attendee.responseStatus === "declined")) return false;
  return Boolean(event.start?.dateTime && event.end?.dateTime);
}

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

export type CalendarImportResult = { events: ImportedCalendarEvent[]; calendarsScanned: number };

export async function importCalendarEvents(accessToken: string): Promise<CalendarImportResult> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const calendarsResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader", { headers });
  if (!calendarsResponse.ok) throw new Error("StudyFlow could not read your calendar list.");
  const calendars = (await calendarsResponse.json()).items as Array<{ id: string; summary: string; selected?: boolean }>;
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString();
  // A student's Canvas feed or school calendar may be readable but not marked selected
  // in Google Calendar. V1 intentionally considers all readable calendars; a calendar
  // picker will let the student narrow this down in a later pass.
  const readableCalendars = calendars.slice(0, 50);
  const responses = await Promise.all(readableCalendars.map(async (calendar) => {
    const query = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${query}`, { headers });
    if (!response.ok) return [] as ImportedCalendarEvent[];
    const payload = await response.json();
    return (payload.items as RawEvent[]).filter(blocksTime).map((event) => ({
      id: event.id,
      calendarId: calendar.id,
      calendarName: calendar.summary,
      title: event.summary || "Untitled calendar item",
      start: event.start,
      end: event.end,
    }));
  }));
  return { events: responses.flat(), calendarsScanned: readableCalendars.length };
}
