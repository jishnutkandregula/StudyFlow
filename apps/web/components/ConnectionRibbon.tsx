import { plural, relativeTime } from "../lib/format";
import type { CalendarConnection, CanvasConnection } from "../lib/types";
import { Icon } from "./Icon";

type Props = {
  now: Date | null;
  calendar: CalendarConnection | null;
  calendarImporting: boolean;
  canvas: CanvasConnection | null;
  canvasAssignments: number;
  onConnectCalendar: () => void;
  onOpenCanvas: () => void;
};

export function ConnectionRibbon(props: Props) {
  const { now, calendar, calendarImporting, canvas, canvasAssignments } = props;
  const bothConnected = Boolean(calendar && canvas);

  const calendarDetail = calendarImporting
    ? "Reading your calendar…"
    : calendar
      ? `${plural(calendar.busyEvents, "event")} protected · ${relativeTime(calendar.lastSynced, now)}`
      : "Read-only · import busy time";

  const canvasDetail = canvas
    ? `${plural(canvasAssignments, "assignment")} · synced ${relativeTime(canvas.lastSynced, now)}`
    : "Import courses · assignments";

  return (
    <section id="connections" className="connection-ribbon" aria-label="Connections">
      <div className="ribbon-copy">
        <span className="orb"><Icon name="spark" /></span>
        <div>
          <p className="kicker">{bothConnected ? "CONNECTED" : "ONE-TIME SETUP"}</p>
          <h2>{bothConnected ? "Your real week, in one place." : "Your life, already in motion."}</h2>
          <p>
            {bothConnected
              ? "Assignments come from Canvas; busy time comes from Google Calendar."
              : "Connect once. StudyFlow plans around your real calendar and coursework."}
          </p>
        </div>
      </div>
      <div className="connection-actions">
        <button
          className={`connection-card${calendar ? " is-connected" : ""}`}
          onClick={props.onConnectCalendar}
          disabled={calendarImporting}
          aria-busy={calendarImporting}
        >
          <span className="google-mark">G</span>
          <div>
            <strong>{calendar ? "Google Calendar" : "Connect Google Calendar"}</strong>
            <small suppressHydrationWarning>{calendarDetail}</small>
          </div>
          {calendar ? <span className="status-dot" aria-label="Connected" /> : <Icon name="arrow" />}
        </button>
        <button className={`connection-card${canvas ? " is-connected" : ""}`} onClick={props.onOpenCanvas}>
          <span className="canvas-mark"><Icon name="canvas" /></span>
          <div>
            <strong>{canvas ? "Canvas LMS" : "Connect Canvas"}</strong>
            <small suppressHydrationWarning>{canvasDetail}</small>
          </div>
          {canvas ? <span className="status-dot" aria-label="Connected" /> : <Icon name="arrow" />}
        </button>
      </div>
    </section>
  );
}
