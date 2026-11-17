import type { PlanHealth } from "./types";

export const healthLabel: Record<PlanHealth, string> = {
  on_track: "On track",
  tight: "Tight",
  at_risk: "At risk",
  not_recoverable: "Not recoverable",
};

/** Ordered worst-last so a change can be described as better or worse. */
const order: PlanHealth[] = ["on_track", "tight", "at_risk", "not_recoverable"];

export function healthTrend(before: PlanHealth, after: PlanHealth): "better" | "worse" | "same" {
  const delta = order.indexOf(after) - order.indexOf(before);
  return delta < 0 ? "better" : delta > 0 ? "worse" : "same";
}
