import { initials, relativeTime } from "../lib/format";
import type { SaveStatus } from "../lib/types";
import { Icon } from "./Icon";

const links = [
  { href: "#today", icon: "bolt", label: "Today" },
  { href: "#plan", icon: "clock", label: "Plan" },
  { href: "#work", icon: "canvas", label: "Workload" },
  { href: "#preferences", icon: "settings", label: "Preferences" },
] as const;

function saveLabel(status: SaveStatus, now: Date | null): string {
  switch (status.state) {
    case "loading":
      return "Loading your workspace…";
    case "saving":
      return "Saving…";
    case "error":
      return "Not saved. Retrying on next change";
    case "saved":
      return status.at ? `Saved ${relativeTime(status.at, now)}` : "Changes save automatically";
  }
}

type Props = { studentName: string | null; saveStatus: SaveStatus; now: Date | null };

export function Sidebar({ studentName, saveStatus, now }: Props) {
  return (
    <aside className="rail">
      <div className="logo">
        <span><Icon name="spark" /></span>StudyFlow
      </div>
      <div className="rail-label">YOUR SPACE</div>
      <nav aria-label="Sections">
        {links.map((link, index) => (
          <a key={link.href} href={link.href} className={index === 0 ? "active" : undefined} aria-label={link.label}>
            <Icon name={link.icon} />
            <span>{link.label}</span>
          </a>
        ))}
      </nav>
      <div className="rail-footer">
        <div className="identity" aria-hidden="true">{studentName ? initials(studentName) : "?"}</div>
        <div>
          <strong>{studentName ?? "Your workspace"}</strong>
          <small className={`save-status ${saveStatus.state}`} role="status" suppressHydrationWarning>
            {saveLabel(saveStatus, now)}
          </small>
        </div>
      </div>
    </aside>
  );
}
