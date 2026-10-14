"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Pencil } from "lucide-react";
import { useData } from "@/components/farm/data-context";
import type { Asset, AssetInput, SystemComponentInput } from "@/lib/farm-types";
import { normalizeCategory } from "@/lib/farm-types";
import { systemCardLocation } from "@/lib/system-cards";
import { AssetFormFields } from "@/components/farm/AssetFormFields";
import { ComponentsList } from "@/components/farm/ComponentsList";
import { StickySaveBar } from "@/components/farm/StickySaveBar";
import { Button } from "@/components/farm/ui";

function toInput(asset: Asset): AssetInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = asset;
  return rest;
}

export function SystemDetail({ id }: { id: string }) {
  const router = useRouter();
  const {
    getAsset,
    updateAsset,
    deleteAsset,
    addComponent,
    updateComponent,
    deleteComponent,
    duplicateComponent,
  } = useData();
  const asset = id ? getAsset(id) : undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AssetInput | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleUpdateComponent = useCallback(
    (componentId: string, patch: Partial<SystemComponentInput>) =>
      updateComponent(asset!.id, componentId, patch),
    [asset, updateComponent],
  );

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!asset) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">System not found.</p>
        <Link href="/systems" className="text-sm text-stone-500">
          ‹ Systems
        </Link>
      </div>
    );
  }

  function startEdit() {
    setMenuOpen(false);
    setDraft(toInput(asset!));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(null);
  }

  async function saveEdit() {
    if (!draft || !draft.name.trim()) return;
    await updateAsset(asset!.id, { ...draft, name: draft.name.trim() });
    setEditing(false);
    setDraft(null);
  }

  function deleteSystem() {
    if (!confirm(`Delete ${asset!.name}? This cannot be undone.`)) return;
    void deleteAsset(asset!.id).then(() => router.push("/systems"));
  }

  const place = systemCardLocation(asset);
  const subtitle = [normalizeCategory(asset.category), place].filter(Boolean).join(" · ");

  if (editing && draft) {
    return (
      <div>
        <button
          type="button"
          onClick={cancelEdit}
          className="inline-flex items-center gap-1 text-[13px] text-stone-500"
        >
          ‹ Cancel edit
        </button>
        <div className="mt-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Edit system</h1>
          <p className="mt-0.5 text-[13px] text-stone-500">{asset.name}</p>
        </div>
        <div className="mt-1">
          <AssetFormFields
            value={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev!, ...patch }))}
          />
        </div>
        <ComponentsList
          mode="edit"
          systemId={asset.id}
          components={asset.components}
          onAdd={(input) => addComponent(asset.id, input)}
          onUpdate={handleUpdateComponent}
          onDelete={(componentId) => deleteComponent(asset.id, componentId)}
          onDuplicate={(componentId) => duplicateComponent(asset.id, componentId)}
        />
        <button
          type="button"
          onClick={deleteSystem}
          className="mt-6 block border-t border-[#e7e0d0] pt-3.5 text-sm font-semibold text-[#b91c1c]"
        >
          Delete system…
        </button>
        <StickySaveBar>
          <Button variant="secondary" onClick={cancelEdit}>
            Cancel
          </Button>
          <Button onClick={saveEdit} disabled={!draft.name.trim()}>
            Save changes
          </Button>
        </StickySaveBar>
      </div>
    );
  }

  return (
    <div>
      <Link href="/systems" className="inline-flex items-center gap-1 text-[13px] text-stone-500">
        ‹ Systems
      </Link>
      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{asset.name}</h1>
          {subtitle ? <p className="mt-0.5 text-[13px] text-stone-500">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-8 items-center gap-1 rounded-[9px] border border-[#d9cfb8] bg-[#fffdf8] px-3 text-[13px] font-semibold text-stone-900"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] border border-[#d9cfb8] bg-[#fffdf8] text-lg leading-none text-stone-900"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-[200px] rounded-xl border border-[#e7e0d0] bg-[#fffdf8] p-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    deleteSystem();
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#b91c1c] hover:bg-cream-100"
                >
                  Delete system…
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ComponentsList
        mode="read"
        systemId={asset.id}
        components={asset.components}
        onAdd={(input) => addComponent(asset.id, input)}
        onUpdate={handleUpdateComponent}
        onDelete={(componentId) => deleteComponent(asset.id, componentId)}
        onDuplicate={(componentId) => duplicateComponent(asset.id, componentId)}
      />

      {asset.notes.trim() && (
        <details className="mt-4 text-[13px] text-stone-600">
          <summary className="cursor-pointer font-medium text-stone-500">System notes</summary>
          <p className="mt-1.5 leading-relaxed whitespace-pre-wrap">{asset.notes}</p>
        </details>
      )}

      <p className="mt-4 text-[11px] text-[#a8a29e]">
        Updated {format(parseISO(asset.updatedAt), "MMM d, yyyy")}
      </p>
    </div>
  );
}
