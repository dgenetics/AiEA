"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/components/farm/data-context";
import { AssetFormFields } from "@/components/farm/AssetFormFields";
import { Modal } from "@/components/farm/Modal";
import { Button } from "@/components/farm/ui";
import { maintenanceApi } from "@/lib/farm-api";
import { emptyAssetInput } from "@/lib/farm-money";
import type { AssetInput } from "@/lib/farm-types";
import { formatCalendarDate } from "@/lib/calendar";
import { urgencyForNextDueDate } from "@/lib/maintenance";

export function SystemsList() {
  const { assets, loading, error, addAsset } = useData();
  const router = useRouter();
  const params = useSearchParams();
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");
  const [value, setValue] = useState<AssetInput>(() => emptyAssetInput());
  const [saving, setSaving] = useState(false);
  const [dueByComponent, setDueByComponent] = useState<
    Record<string, { urgency: "overdue" | "dueSoon" | "upcoming"; nextDueDate: string }>
  >({});

  useEffect(() => {
    let cancelled = false;
    void maintenanceApi.listSchedules().then((rows) => {
      if (cancelled) return;
      const next: Record<string, { urgency: "overdue" | "dueSoon" | "upcoming"; nextDueDate: string }> = {};
      const rank = { overdue: 0, dueSoon: 1, upcoming: 2 };
      for (const row of rows) {
        const urgency = urgencyForNextDueDate(row.nextDueDate);
        const prev = next[row.componentId];
        if (!prev || rank[urgency] < rank[prev.urgency]) {
          next[row.componentId] = { urgency, nextDueDate: row.nextDueDate };
        }
      }
      setDueByComponent(next);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [assets.length]);

  const filtered = useMemo(
    () => [...assets].sort((a, b) => a.name.localeCompare(b.name)),
    [assets],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.name.trim() || saving) return;
    setSaving(true);
    try {
      const asset = await addAsset({ ...value, name: value.name.trim() });
      setAddOpen(false);
      router.push(`/systems/${asset.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-stone-900">Systems</h1>
        <button
          type="button"
          onClick={() => {
            setValue(emptyAssetInput());
            setAddOpen(true);
          }}
          className="text-[13px] font-semibold text-green-800"
        >
          + Add system
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-800">{error}</p>}
      {loading ? (
        <p className="text-sm text-stone-500">Loading systems…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">
          {assets.length === 0 ? "No systems yet." : "No matches."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((asset) => {
            const names = asset.components.map((c) => c.name);
            const overdue = asset.components.filter((c) => dueByComponent[c.id]?.urgency === "overdue").length;
            const soon = asset.components
              .map((c) => dueByComponent[c.id])
              .filter((d) => d?.urgency === "dueSoon")
              .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))[0];
            return (
              <li key={asset.id}>
                <Link
                  href={`/systems/${asset.id}`}
                  className="block rounded-2xl border border-[#efe9dc] bg-white px-3.5 py-3 text-[13px] shadow-sm"
                >
                  <p className="font-semibold text-stone-900">
                    {asset.name}
                    <span className="font-normal text-stone-500"> · {asset.category}</span>
                  </p>
                  <p className="mt-0.5 text-stone-500">
                    Components: {names.length ? names.join(", ") : "none"}
                    {" · "}
                    {overdue > 0 ? (
                      <span className="font-semibold text-rose-700">{overdue} overdue</span>
                    ) : soon ? (
                      <span className="font-semibold text-amber-700">
                        due {formatCalendarDate(soon.nextDueDate, { weekday: "short" })}
                      </span>
                    ) : (
                      <span>ok</span>
                    )}
                    {" · "}
                    <span className="text-green-800 underline">open ›</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {addOpen && (
        <Modal
          title="Add system"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="asset-new-form" disabled={!value.name.trim() || saving}>
                Save
              </Button>
            </>
          }
        >
          <form id="asset-new-form" onSubmit={handleSubmit} className="space-y-4">
            <AssetFormFields
              value={value}
              onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
