import { initials } from "../lib/format";
import { Icon } from "./Icon";

const links = [
  { href: "#today", icon: "bolt", label: "Today" },
  { href: "#plan", icon: "clock", label: "Plan" },
  { href: "#work", icon: "canvas", label: "Workload" },
  { href: "#preferences", icon: "settings", label: "Preferences" },
] as const;

export function Sidebar({ studentName }: { studentName: string | null }) {
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
          <strong>{studentName ?? "Local session"}</strong>
          <small>{studentName ? "Canvas connected" : "Nothing is saved yet"}</small>
        </div>
      </div>
    </aside>
  );
}
