import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CheckCircle2, Sparkles, Users, Bell } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/today");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070b] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.2),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.12),_transparent_45%)]" />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold">
            A
          </div>
          <span className="font-semibold tracking-tight">AiEA</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-zinc-400 hover:text-white">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/15"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-16 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/80">
          AI Executive Assistant
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          The best todo system you&apos;ll actually keep up with
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Capture the chaos of life, home, and work. AiEA organizes it into clear categories,
          prioritizes for you, schedules recurring work, tracks people follow-ups, and pings you
          when it matters — you always confirm.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-3 text-sm font-medium text-white shadow-xl shadow-indigo-500/25"
          >
            <Sparkles className="h-4 w-4" />
            Start free
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
          {[
            {
              icon: CheckCircle2,
              title: "Prioritize & schedule",
              body: "One-time vs recurring, deadlines, and a Today board that tells you what matters.",
            },
            {
              icon: Users,
              title: "People radar",
              body: "Never drop a follow-up. AiEA tracks who you owe a response and when to ping.",
            },
            {
              icon: Bell,
              title: "Proactive pings",
              body: "Daily brief + in-app reminders so nothing important slips through the day.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/5 bg-zinc-900/50 p-5 backdrop-blur"
            >
              <f.icon className="h-5 w-5 text-indigo-300" />
              <h2 className="mt-3 font-medium text-white">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
