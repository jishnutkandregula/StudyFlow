import { formatLongDate } from "../lib/format";
import { Icon } from "./Icon";

type Props = {
  now: Date | null;
  loading: boolean;
  hasTasks: boolean;
  hasPlan: boolean;
  stale: boolean;
  onGenerate: () => void;
};

export function Topbar({ now, loading, hasTasks, hasPlan, stale, onGenerate }: Props) {
  const label = loading ? "Building your plan…" : hasPlan ? (stale ? "Replan with changes" : "Replan") : "Generate my plan";
  return (
    <header className="topbar">
      <div>
        <p className="kicker" suppressHydrationWarning>{now ? formatLongDate(now) : " "}</p>
        <h1>Make room for <em>what matters.</em></h1>
      </div>
      <button
        className={`glow-button${stale ? " pulse" : ""}`}
        onClick={onGenerate}
        disabled={loading || !hasTasks}
        title={hasTasks ? undefined : "Add or import an assignment first"}
      >
        <Icon name={hasPlan ? "refresh" : "spark"} />
        {label}
      </button>
    </header>
  );
}
