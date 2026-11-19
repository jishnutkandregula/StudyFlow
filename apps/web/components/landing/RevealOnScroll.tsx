"use client";

import { useEffect } from "react";

/**
 * Fades each `.reveal` element up once, the first time it scrolls into view.
 * The hidden starting state only applies under `html.js` (set by the theme
 * script in layout.tsx), so without JavaScript everything is simply visible.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.in)"));
    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          // A fast scroll can jump clean over a short heading, so reveal
          // everything above the element that just came into view as well.
          const upTo = items.indexOf(entry.target as HTMLElement);
          for (const item of items.slice(0, upTo + 1)) {
            item.classList.add("in");
            observer.unobserve(item);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);
  return null;
}
