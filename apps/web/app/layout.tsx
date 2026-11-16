import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "StudyFlow — Make room for what matters",
  description: "An adaptive academic planner that works around your real life.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
