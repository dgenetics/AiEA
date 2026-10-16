import Link from "next/link";

const OUTCOMES = [
  {
    title: "Nothing slips",
    body: "Every filter, belt, and oil change comes due on time.",
  },
  {
    title: "Less downtime",
    body: "Small upkeep now means fewer surprise repairs later.",
  },
  {
    title: "Peace of mind",
    body: "Know what's done and what's next, at a glance.",
  },
  {
    title: "Time back",
    body: "No spreadsheets, no hunting for manuals.",
  },
] as const;

function Cta({ tone }: { tone: "dark" | "light" }) {
  return (
    <>
      <Link href="/register" className={`landing-cta landing-cta--${tone}`}>
        Get started free
      </Link>
      <p className="landing-under">
        Have an account? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}

function SystemsVignette() {
  const tags = ["Irrigation", "Well & water", "Tractor", "Greenhouse", "Barn", "Fencing"];
  return (
    <div className="landing-vignette" aria-hidden="true">
      {tags.map((tag) => (
        <span key={tag} className="landing-tag">
          {tag}
        </span>
      ))}
    </div>
  );
}

function ScanVignette() {
  const rows = [
    { label: "Brand", value: "Honda" },
    { label: "Model", value: "GX390" },
    { label: "Serial", value: "GCAKK-1234567" },
  ];
  return (
    <div className="landing-vignette" aria-hidden="true">
      <div className="landing-scan">▮▯▮▮▯▮▯▮▮▯▮ HONDA GX390</div>
      {rows.map((row) => (
        <div key={row.label} className="landing-kv">
          <span>{row.label}</span>
          <span>
            {row.value}
            <i className="landing-found">found</i>
          </span>
        </div>
      ))}
      <div className="landing-kv">
        <span>Manual</span>
        <b>Owner&apos;s manual.pdf</b>
      </div>
    </div>
  );
}

function ScheduleVignette() {
  return (
    <div className="landing-vignette" aria-hidden="true">
      <div className="landing-kv">
        <span>Change engine oil</span>
        <span>every 6 months</span>
      </div>
      <div className="landing-arrow">↓</div>
      <div className="landing-task">
        <span className="landing-box" />
        <span>Change engine oil</span>
        <span className="landing-due">Due Fri</span>
      </div>
    </div>
  );
}

function TasksVignette() {
  return (
    <div className="landing-vignette" aria-hidden="true">
      <div className="landing-task">
        <span className="landing-box landing-box--done" />
        <s>Backflush sand filter</s>
      </div>
      <div className="landing-task">
        <span className="landing-box" />
        <span>Grease PTO shaft</span>
        <span className="landing-due">Today</span>
      </div>
      <div className="landing-task">
        <span className="landing-box" />
        <span>Replace air cleaner</span>
        <span className="landing-due">Tue</span>
      </div>
    </div>
  );
}

function ArchiveVignette() {
  const rows = [
    { when: "Oct 2", what: "Oil changed · GX390" },
    { when: "Sep 18", what: "Filter backflushed · Well" },
    { when: "Aug 30", what: "Belt replaced · Tractor" },
  ];
  return (
    <div className="landing-vignette" aria-hidden="true">
      {rows.map((row) => (
        <div key={row.when} className="landing-kv">
          <span>{row.when}</span>
          <span>{row.what}</span>
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  {
    n: "1",
    title: "Add your systems",
    body: "Irrigation, barn, well, tractor: however you think of the farm.",
    vignette: <SystemsVignette />,
  },
  {
    n: "2",
    title: "Scan your equipment",
    body: "Point your camera at a nameplate or barcode. We fill in the rest.",
    vignette: <ScanVignette />,
  },
  {
    n: "3",
    title: "Schedules become tasks",
    body: "Upkeep from the manual repeats on its own and lands on your list when it's due.",
    vignette: <ScheduleVignette />,
  },
  {
    n: "4",
    title: "Check it off",
    body: "Today's work in one list. Tap when it's done.",
    vignette: <TasksVignette />,
  },
  {
    n: "5",
    title: "Everything on record",
    body: "An archive of what was done and when, for every machine.",
    vignette: <ArchiveVignette />,
  },
] as const;

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-logo">
          <span className="landing-mark" aria-hidden="true" />
          Farm Manager
        </div>
        <Link href="/login" className="landing-login">
          Log in
        </Link>
      </header>

      <main>
        <h1>Nothing on the farm slips through the cracks.</h1>
        <p className="landing-sub">
          Less downtime, fewer surprise repairs, and time back for the work that matters.
        </p>
        <Cta tone="dark" />

        <p className="landing-kicker">Why it matters</p>
        <h2>Run the farm, not a to-do list.</h2>
        <div className="landing-outcomes">
          {OUTCOMES.map((card) => (
            <article key={card.title} className="landing-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>

        <p className="landing-kicker">How it works</p>
        <h2>Set it up once. It keeps up for you.</h2>
        <ol className="landing-steps">
          {STEPS.map((step) => (
            <li key={step.n} className="landing-step">
              <span className="landing-num" aria-hidden="true">
                {step.n}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                {step.vignette}
              </div>
            </li>
          ))}
        </ol>

        <section className="landing-end" aria-labelledby="landing-end-title">
          <h2 id="landing-end-title">Get ahead of the upkeep.</h2>
          <Cta tone="light" />
        </section>
        <p className="landing-foot">Farm Manager</p>
      </main>
    </div>
  );
}
