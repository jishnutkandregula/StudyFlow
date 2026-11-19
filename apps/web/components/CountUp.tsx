"use client";

import { useEffect, useRef, useState } from "react";

/** Counts from the previous value to the new one with an ease-out curve. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (time: number) => {
      const t = Math.min(1, (time - began) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(Math.round(start + (value - start) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{shown}</>;
}
