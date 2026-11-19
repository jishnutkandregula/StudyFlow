import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — StudyFlow",
  description: "What StudyFlow stores, what it never stores, and how to delete your data.",
};

const sections = [
  {
    heading: "What StudyFlow stores",
    items: [
      "Your coursework (titles, courses, due dates, estimates), planning preferences, and your current plan, so they survive a reload.",
      "When you’re busy according to Google Calendar: dates and times only. Event titles, descriptions, attendees, and locations are never saved; titles never leave your browser.",
      "If you connect Canvas: your school’s Canvas address, a display name, and either your calendar feed link or your personal access token, encrypted at rest. Class meeting times from Canvas are kept as busy time, without their titles.",
      "To learn your pace: for each task you finish, StudyFlow’s first estimate and the focus time you logged, with the course and kind of work (for example “lab”). Assignment instructions are read to estimate time, then discarded rather than stored.",
    ],
  },
  {
    heading: "What StudyFlow never does",
    items: [
      "Read or import grades, submissions, messages, or files from Canvas.",
      "Create, edit, or delete anything in Canvas or Google Calendar. Access to both is read-only.",
      "Log access tokens, send them back to your browser, or share them with anyone.",
      "Sell data, show ads, or use your coursework to train AI models.",
    ],
  },
  {
    heading: "How your session works",
    items: [
      "There are no accounts yet. Your browser gets an anonymous session cookie (HttpOnly, so page scripts can’t read it). The server stores only a hash of it.",
      "Data is tied to that browser. Another device or browser starts a separate, empty workspace.",
      "Sessions unused for 180 days are deleted automatically.",
    ],
  },
  {
    heading: "Deleting your data",
    items: [
      "Preferences → Your data → Delete my StudyFlow data erases your session, coursework, plan, and Canvas connection immediately.",
      "Disconnect Canvas (in the Canvas window) deletes just the stored token. You can also revoke it in Canvas under Account → Settings → Approved Integrations.",
      "Google Calendar access can be revoked anytime at myaccount.google.com/permissions.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="doc-shell">
      <div className="ambient ambient-one" />
      <article className="doc">
        <Link href="/" className="doc-back">&#8592; Back to StudyFlow</Link>
        <p className="kicker">PRIVACY</p>
        <h1>Your data, plainly.</h1>
        <p className="doc-lede">
          StudyFlow plans around your coursework and calendar. It keeps the minimum it needs to do that,
          and you can delete all of it in one click.
        </p>
        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}
        <p className="doc-footnote">
          StudyFlow is a student project under active development. Questions or concerns: open an issue on the{" "}
          <a href="https://github.com/jishnutkandregula/StudyFlow/issues" target="_blank" rel="noopener noreferrer">
            GitHub repository
          </a>
          .
        </p>
      </article>
    </main>
  );
}
