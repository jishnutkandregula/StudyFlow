"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Switches between light and dark. The new theme grows out of the button as a
 * circle (View Transitions API); browsers without it, and anyone who prefers
 * reduced motion, get an instant switch.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
    // The bootstrap script in layout.tsx follows the system setting; mirror it.
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = currentTheme() === "light" ? "dark" : "light";
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("sf-theme", next);
      } catch {
        // Private mode: the choice lasts for this page only.
      }
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (reduce || !doc.startViewTransition) {
      apply();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = doc.startViewTransition(apply);
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 620, easing: "cubic-bezier(.7,0,.2,1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => undefined);
  }

  const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label} data-theme-state={theme ?? "dark"}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <g className="theme-sun">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </g>
        <path className="theme-moon" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    </button>
  );
}
