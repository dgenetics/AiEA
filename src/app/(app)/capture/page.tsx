import { CaptureForm } from "@/components/capture-form";
import { FarmMaintenancePullButton } from "@/components/farm-maintenance-pull";
import { Sprout } from "lucide-react";
import Link from "next/link";

export default function CapturePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
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

      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sprout className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <p className="text-sm font-medium text-emerald-100">
                Farm maintenance
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Pull from BF Maintenance into{" "}
                <Link href="/inbox" className="text-emerald-300 hover:underline">
                  Inbox
                </Link>{" "}
                as Proposed, then accept.
              </p>
            </div>
          </div>
          <FarmMaintenancePullButton className="w-full justify-center sm:w-auto" />
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-zinc-900/30 p-3 md:p-5">
        <CaptureForm />
      </div>
    </div>
  );
}
