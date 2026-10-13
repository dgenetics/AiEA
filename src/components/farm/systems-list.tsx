"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/components/farm/data-context";
import { AssetFormFields } from "@/components/farm/AssetFormFields";
import { Modal } from "@/components/farm/Modal";
import { Button } from "@/components/farm/ui";
import { emptyAssetInput } from "@/lib/farm-money";
import type { AssetInput } from "@/lib/farm-types";
import {
  groupSystemsByCategory,
  systemCardSubtitle,
  systemComponentCountLabel,
  systemIdsWithOpenTasks,
} from "@/lib/system-cards";

type OpenTask = {
  componentId?: string | null;
  component?: { id?: string | null; system?: { id?: string | null } | null } | null;
};

export function SystemsList() {
  const { assets, loading, error, addAsset } = useData();
  const router = useRouter();
  const params = useSearchParams();
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");
  const [value, setValue] = useState<AssetInput>(() => emptyAssetInput());
  const [saving, setSaving] = useState(false);
  const [openTasks, setOpenTasks] = useState<OpenTask[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/tasks?view=board", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { tasks?: OpenTask[] }) => {
        if (!cancelled) setOpenTasks(data.tasks ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [assets]);

  const groups = useMemo(() => groupSystemsByCategory(assets), [assets]);
  const openSystemIds = useMemo(
    () => systemIdsWithOpenTasks(assets, openTasks),
    [assets, openTasks],
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
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-[#ebe3d3] bg-[#fffdf8] px-4 py-8 text-center text-sm text-stone-500">
          No systems yet.
        </p>
      ) : (
        <div>
          {groups.map((group, index) => (
            <section key={group.category}>
              <h2
                className={
                  index === 0
                    ? "mt-1 border-b border-[#e7e0d0] pb-1.5 text-[11px] font-medium tracking-[0.14em] text-[#a8a29e] uppercase"
                    : "mt-5 border-b border-[#e7e0d0] pb-1.5 text-[11px] font-medium tracking-[0.14em] text-[#a8a29e] uppercase"
                }
              >
                {group.category}
              </h2>
              <ul className="mt-2 grid grid-cols-1 gap-3 min-[700px]:grid-cols-3">
                {group.systems.map((asset) => {
                  const open = openSystemIds.has(asset.id);
                  const subtitle = systemCardSubtitle(asset);
                  return (
                    <li key={asset.id}>
                      <Link
                        href={`/systems/${asset.id}`}
                        className={
                          open
                            ? "block rounded-2xl border border-[#f3d79a] bg-[#fdf0d5] px-4 py-3.5 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
                            : "block rounded-2xl border border-[#ebe3d3] bg-[#fffdf8] px-4 py-3.5 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
                        }
                      >
                        <div className="text-[15px] font-semibold text-stone-900">{asset.name}</div>
                        {subtitle ? (
                          <div className="mt-0.5 text-[13px] text-stone-500">{subtitle}</div>
                        ) : null}
                        <div className="mt-2 text-[13px] text-stone-600">
                          {systemComponentCountLabel(asset.components.length)}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!loading && (
        <p className="mt-3.5 flex items-center gap-1.5 text-xs text-stone-500">
          <span
            aria-hidden
            className="inline-block size-3 rounded border border-[#f3d79a] bg-[#fdf0d5]"
          />
          Tinted = has an open task on Tasks
        </p>
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
