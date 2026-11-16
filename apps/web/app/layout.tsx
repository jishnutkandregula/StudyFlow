import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "StudyFlow — Make room for what matters",
  description: "An adaptive academic planner that works around your real life.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Browser extensions such as Grammarly can add attributes to <body> before React
  // hydrates. The app does not depend on those attributes, so ignore that mismatch.
  return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning>{children}</body></html>;
}
