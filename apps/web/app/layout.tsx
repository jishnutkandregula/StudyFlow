import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "StudyFlow",
  description: "A realistic plan for academic work.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
