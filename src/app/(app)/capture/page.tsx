import { CaptureForm } from "@/components/capture-form";

export default function CapturePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
          Capture
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Brain dump → plan
        </h1>
        <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
          Paste messy notes. AiEA splits them into tasks, habits, and follow-ups — then you
          confirm.
        </p>
      </div>
      <div className="mt-4 rounded-2xl border border-white/5 bg-zinc-900/30 p-3 sm:mt-6 sm:p-5">
        <CaptureForm />
      </div>
    </div>
  );
}
