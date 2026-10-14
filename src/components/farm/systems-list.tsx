"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  systemIdsWithOpenTasks,
  systemMatchesSearch,
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
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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

  const groups = useMemo(() => {
    const grouped = groupSystemsByCategory(assets);
    const needle = query.trim().toLowerCase();
    if (!needle) return grouped;
    return grouped
      .map((group) => ({
        ...group,
        systems: group.systems.filter((asset) =>
          systemMatchesSearch(asset, group.category, needle),
        ),
      }))
      .filter((group) => group.systems.length > 0);
  }, [assets, query]);
  const openSystemIds = useMemo(
    () => systemIdsWithOpenTasks(assets, openTasks),
    [assets, openTasks],
  );

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

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
      <div className="mb-4 flex items-center justify-between gap-3">
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

      <div className="mb-7 flex h-[46px] items-center gap-2 rounded-[10px] border border-[#d9cfb8] bg-[#fffdf8] px-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="flex-none text-stone-400"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder="Search systems, components, locations"
          autoComplete="off"
          aria-label="Search systems"
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-stone-900 outline-none placeholder:text-stone-400 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearSearch}
            className="px-1 text-[15px] text-stone-500"
          >
            ✕
          </button>
        ) : null}
      </div>

      {error && <p className="mb-3 text-sm text-red-800">{error}</p>}
      {loading ? (
        <p className="text-sm text-stone-500">Loading systems…</p>
      ) : assets.length === 0 ? (
        <p className="rounded-2xl border border-[#ebe3d3] bg-[#fffdf8] px-4 py-8 text-center text-sm text-stone-500">
          No systems yet.
        </p>
      ) : groups.length === 0 ? (
        <p className="py-7 text-center text-sm text-stone-500">No systems match</p>
      ) : (
        <div>
          {groups.map((group, index) => (
            <section key={group.category}>
              <h2
                className={
                  index === 0
                    ? "text-[11px] font-medium tracking-[0.14em] text-[#a8a29e] uppercase"
                    : "mt-8 text-[11px] font-medium tracking-[0.14em] text-[#a8a29e] uppercase"
                }
              >
                {group.category}
              </h2>
              <ul className="mt-3 flex flex-wrap items-start gap-2.5">
                {group.systems.map((asset) => {
                  const open = openSystemIds.has(asset.id);
                  return (
                    <li key={asset.id} className="max-w-full">
                      <Link
                        href={`/systems/${asset.id}`}
                        className={
                          open
                            ? "inline-flex min-h-[46px] max-w-full items-center rounded-3xl border border-[#f3d79a] bg-[#fdf0d5] px-[18px] py-[11px] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
                            : "inline-flex min-h-[46px] max-w-full items-center rounded-3xl border border-[#e6dcc8] bg-[#fffdf8] px-[18px] py-[11px] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
                        }
                      >
                        <span className="text-base leading-[1.3] font-semibold text-stone-900 [overflow-wrap:anywhere]">
                          {asset.name}
                        </span>
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
        <p className="mt-8 flex items-center gap-1.5 text-xs text-stone-500">
          <span
            aria-hidden
            className="inline-block size-3 rounded border border-[#f3d79a] bg-[#fdf0d5]"
          />
          Amber = has an open task
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
