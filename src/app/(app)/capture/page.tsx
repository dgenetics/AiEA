import { CaptureForm } from "@/components/capture-form";
import { FarmMaintenancePullButton } from "@/components/farm-maintenance-pull";

export default function CapturePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
            Capture
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Brain dump → organized plan
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Paste messy notes. AiEA splits them into one-time tasks, recurring
            habits, and people follow-ups — then you confirm.
          </p>
        </div>
        <FarmMaintenancePullButton />
      </div>
      <div className="mt-6 rounded-2xl border border-white/5 bg-zinc-900/30 p-3 md:p-5">
        <CaptureForm />
      </div>
    </div>
  );
}
