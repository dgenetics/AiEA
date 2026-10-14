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
  systemCardLocation,
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
  const [searchOpen, setSearchOpen] = useState(false);
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
        systems: group.systems.filter((asset) => {
          const haystack = `${asset.name} ${systemCardLocation(asset)} ${group.category}`.toLowerCase();
          return haystack.includes(needle);
        }),
      }))
      .filter((group) => group.systems.length > 0);
  }, [assets, query]);
  const openSystemIds = useMemo(
    () => systemIdsWithOpenTasks(assets, openTasks),
    [assets, openTasks],
  );

  useEffect(() => {
    if (!searchOpen) return;
    searchRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setQuery("");
      setSearchOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  function closeSearch() {
    setQuery("");
    setSearchOpen(false);
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-stone-900">Systems</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Search systems"
            aria-pressed={searchOpen}
            onClick={() => {
              if (searchOpen) closeSearch();
              else setSearchOpen(true);
            }}
            className="flex size-11 items-center justify-center text-stone-600"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
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
      </div>

      {searchOpen && (
        <div className="mb-1.5 flex h-10 items-center gap-2 rounded-[10px] border border-[#d9cfb8] bg-[#fffdf8] px-2.5">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, location, category"
            autoComplete="off"
            aria-label="Search title, location, category"
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-stone-900 outline-none placeholder:text-stone-400 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          <button
            type="button"
            aria-label="Close search"
            onClick={closeSearch}
            className="px-1 text-[15px] text-stone-500"
          >
            ✕
          </button>
        </div>
      )}

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
                    ? "mt-1 border-b border-[#e7e0d0] pb-1.5 text-[11px] font-medium tracking-[0.14em] text-[#a8a29e] uppercase"
                    : "mt-5 border-b border-[#e7e0d0] pb-1.5 text-[11px] font-medium tracking-[0.14em] text-[#a8a29e] uppercase"
                }
              >
                {group.category}
              </h2>
              <ul className="mt-2 grid grid-cols-2 gap-2 min-[700px]:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
                {group.systems.map((asset) => {
                  const open = openSystemIds.has(asset.id);
                  const location = systemCardLocation(asset);
                  return (
                    <li key={asset.id}>
                      <Link
                        href={`/systems/${asset.id}`}
                        className={
                          open
                            ? "block h-full rounded-xl border border-[#f3d79a] bg-[#fdf0d5] px-[11px] py-[9px] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
                            : "block h-full rounded-xl border border-[#ebe3d3] bg-[#fffdf8] px-[11px] py-[9px] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
                        }
                      >
                        <div className="truncate text-sm leading-tight font-semibold text-stone-900">
                          {asset.name}
                        </div>
                        {location ? (
                          <div className="mt-px truncate text-xs text-stone-500">{location}</div>
                        ) : null}
                        <div className="mt-1.5 text-xs text-stone-600">
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
