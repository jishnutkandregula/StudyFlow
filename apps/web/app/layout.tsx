import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./styles.css";

// Fonts are downloaded at build time and served from this origin, so there is
// no request to Google from the student's browser and no layout shift.
const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StudyFlow — Make room for what matters",
  description: "An adaptive academic planner that works around your real life.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#08080d" },
  ],
};

// Runs before the first paint so the page never flashes the wrong theme.
// A saved choice wins; otherwise the page follows the system setting, live.
const themeScript = `(function(){try{var d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: light)");function a(){var s=null;try{s=localStorage.getItem("sf-theme")}catch(e){}d.dataset.theme=s==="light"||s==="dark"?s:(m.matches?"light":"dark")}a();m.addEventListener("change",a)}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Browser extensions such as Grammarly can add attributes to <body> before React
  // hydrates, and the theme script sets data-theme on <html>. Neither affects React.
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
