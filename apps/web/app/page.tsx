import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "../components/Icon";
import { HeroDemo } from "../components/landing/HeroDemo";
import { RevealOnScroll } from "../components/landing/RevealOnScroll";
import { ThemeToggle } from "../components/ThemeToggle";

export const metadata: Metadata = {
  title: "StudyFlow — Your coursework, planned around your actual life",
  description:
    "StudyFlow pulls your assignments from Canvas, estimates how long each one really takes, and fits focus sessions around your classes, shifts and plans. Free, no account needed.",
};

const features = [
  {
    icon: "canvas",
    title: "Canvas in one paste",
    body: "Copy your Canvas calendar link, paste it once. Assignments, due dates and class times come in. No tokens, no settings pages.",
    visual: "paste",
  },
  {
    icon: "spark",
    title: "Estimates that show their work",
    body: "StudyFlow reads what each assignment asks for (word counts, problems, pages, time limits) and tells you why it picked the number. It learns your pace as you finish work.",
    visual: "estimate",
  },
  {
    icon: "calendar",
    title: "Plans around your real calendar",
    body: "Lectures, shifts and practice from Google Calendar and Canvas are protected. Study sessions go into the gaps, before each deadline.",
    visual: "calendar",
  },
  {
    icon: "refresh",
    title: "Replans when life happens",
    body: "Sick day? Tap “Can’t study today”. StudyFlow moves the work, tells you exactly what changed, and lets you undo it.",
    visual: "replan",
  },
] as const;

const steps = [
  { title: "Connect", body: "Paste your Canvas calendar link and, if you like, connect Google Calendar (read-only)." },
  { title: "Review", body: "See every assignment with its estimate and the reason behind it. Change anything before it’s imported." },
  { title: "Study", body: "Get a plan of focused sessions. Mark them done, and StudyFlow keeps the rest of the week honest." },
];

function FeatureVisual({ kind }: { kind: (typeof features)[number]["visual"] }) {
  switch (kind) {
    case "paste":
      return (
        <div className="fv fv-paste" aria-hidden="true">
          <div className="fv-input"><span>https://canvas.ucsc.edu/feeds/calendars/user_…ics</span><b>Connected ✓</b></div>
          <div className="fv-chips"><span>CSE 101</span><span>STAT 131</span><span>WRIT 2</span></div>
        </div>
      );
    case "estimate":
      return (
        <div className="fv fv-estimate" aria-hidden="true">
          <div><strong>Essay 2</strong><em>✦ Writing assignment · ~1,500 words</em><b>5h</b></div>
          <div><strong>Lab 7</strong><em>✦ Lab · −24% for your pace on CSE 101 labs</em><b>1h 45m</b></div>
        </div>
      );
    case "calendar":
      return (
        <div className="fv fv-calendar" aria-hidden="true">
          <span className="busy" style={{ left: "4%", width: "22%" }}>Lecture</span>
          <span className="study" style={{ left: "29%", width: "16%" }} />
          <span className="study" style={{ left: "47%", width: "14%" }} />
          <span className="busy" style={{ left: "64%", width: "32%" }}>Work shift</span>
        </div>
      );
    case "replan":
      return (
        <div className="fv fv-replan" aria-hidden="true">
          <div className="fv-day off">Thu</div>
          <div className="fv-day"><span /><span className="arrive" /></div>
          <div className="fv-day"><span /><span className="arrive late" /></div>
        </div>
      );
  }
}

export default function Landing() {
  return (
    <main className="landing">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grain" />
      <RevealOnScroll />

      <header className="lp-nav">
        <Link href="/" className="logo" aria-label="StudyFlow home">
          <span><Icon name="spark" /></span>StudyFlow
        </Link>
        <nav aria-label="Page">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <div className="lp-nav-actions">
          <ThemeToggle />
          <Link href="/app" className="glow-button lp-small">Open app</Link>
        </div>
      </header>

      <section className="lp-hero">
        <p className="lp-eyebrow"><span className="live-dot" /> Works with Canvas and Google Calendar</p>
        <h1>
          <span className="headline-line"><span>Your coursework,</span></span>{" "}
          <span className="headline-line"><span>planned around</span></span>{" "}
          <span className="headline-line"><span><em>your actual life.</em></span></span>
        </h1>
        <p className="lp-lede">
          StudyFlow pulls in your assignments, works out how long each one will really take, and fits focused
          study sessions around your classes, shifts and plans. When the week changes, it replans in one click.
        </p>
        <div className="lp-ctas">
          <Link href="/app" className="glow-button lp-big">Plan my week <Icon name="arrow" /></Link>
          <Link href="/app?sample=1" className="ghost-button lp-big">Try a sample week</Link>
        </div>
        <p className="lp-fineprint">Free · No account · Read-only access · Delete everything in one click</p>
      </section>

      <section className="lp-demo-wrap" aria-label="Product preview">
        <HeroDemo />
      </section>

      <section className="lp-facts reveal" aria-label="At a glance">
        <div><strong>1 paste</strong><span>to connect Canvas</span></div>
        <div><strong>11 kinds</strong><span>of assignments recognized</span></div>
        <div><strong>Every</strong><span>estimate explains itself</span></div>
        <div><strong>0</strong><span>passwords stored</span></div>
      </section>

      <section id="features" className="lp-section">
        <p className="kicker reveal">FEATURES</p>
        <h2 className="reveal">A planner that does the planning.</h2>
        <div className="lp-bento">
          {features.map((feature) => (
            <article key={feature.title} className="lp-card reveal">
              <FeatureVisual kind={feature.visual} />
              <div className="lp-card-icon"><Icon name={feature.icon} /></div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="lp-section">
        <p className="kicker reveal">HOW IT WORKS</p>
        <h2 className="reveal">Three minutes to a calmer week.</h2>
        <ol className="lp-steps">
          {steps.map((step, index) => (
            <li key={step.title} className="reveal">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-privacy reveal">
        <div>
          <p className="kicker">PRIVACY</p>
          <h2>Your data, plainly.</h2>
        </div>
        <ul>
          <li><Icon name="check" />Read-only access to Canvas and Google Calendar. StudyFlow never changes either.</li>
          <li><Icon name="check" />Calendar event titles never leave your browser. Only busy times are used.</li>
          <li><Icon name="check" />Your Canvas link is encrypted at rest. Delete everything in one click.</li>
        </ul>
        <Link href="/privacy" className="text-button">Read the privacy details <Icon name="arrow" /></Link>
      </section>

      <section className="lp-final reveal">
        <h2>Make room for <em>what matters.</em></h2>
        <Link href="/app" className="glow-button lp-big">Plan my week <Icon name="arrow" /></Link>
      </section>

      <footer className="lp-footer">
        <span>StudyFlow</span>
        <Link href="/privacy">Privacy</Link>
        <a href="https://github.com/jishnutkandregula/StudyFlow" target="_blank" rel="noopener noreferrer">Source</a>
      </footer>
    </main>
  );
}
