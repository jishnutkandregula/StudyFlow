"use client";

import { useEffect, useState } from "react";

/**
 * The current time, refreshed every 30 seconds. Starts as null so the static
 * prerender never bakes in the build machine's date (avoids hydration mismatch).
 */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
