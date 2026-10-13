"use client";

import { useCallback, useState } from 'react'
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useData } from "@/components/farm/data-context"
import type { Asset, AssetInput, SystemComponentInput } from "@/lib/farm-types"
import {
  systemPurchaseTotal,
  systemReplacementTotal,
} from "@/lib/farm-types"
import { formatMoney } from "@/lib/farm-money"
import { AssetFormFields } from "@/components/farm/AssetFormFields"
import { ComponentsList } from "@/components/farm/ComponentsList"
import { StickySaveBar } from "@/components/farm/StickySaveBar"
import { Button, Card, PageHeader } from "@/components/farm/ui"

function toInput(asset: Asset): AssetInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = asset
  return rest
}

export function SystemDetail({ id }: { id: string }) {
  const router = useRouter()
  const {
    getAsset,
    updateAsset,
    deleteAsset,
    addComponent,
    updateComponent,
    deleteComponent,
    duplicateComponent,
  } = useData()
  const asset = id ? getAsset(id) : undefined
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AssetInput | null>(null)

  const handleUpdateComponent = useCallback(
    (componentId: string, patch: Partial<SystemComponentInput>) =>
      updateComponent(asset!.id, componentId, patch),
    [asset, updateComponent],
  )

  if (!asset) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">System not found.</p>
        <Link href="/systems">
          <Button variant="secondary" size="sm">
            Back to list
          </Button>
        </Link>
      </div>
    )
  }

  function startEdit() {
    setDraft(toInput(asset!))
    setEditing(true)
  }

  async function saveEdit() {
    if (!draft || !draft.name.trim()) return
    await updateAsset(asset!.id, { ...draft, name: draft.name.trim() })
    setEditing(false)
    setDraft(null)
  }

  if (editing && draft) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setDraft(null)
          }}
          className="flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Cancel edit
        </button>
        <PageHeader title="Edit system" subtitle={asset.name} />
        <Card className="space-y-4">
          <AssetFormFields
            value={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev!, ...patch }))}
          />
        </Card>
        <StickySaveBar>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(false)
              setDraft(null)
            }}
          >
            Cancel
          </Button>
          <Button onClick={saveEdit} disabled={!draft.name.trim()}>
            Save changes
          </Button>
        </StickySaveBar>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.push("/systems")}
        className="flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <PageHeader
        title={asset.name}
        subtitle={asset.category || undefined}
        action={
          <Button size="sm" variant="secondary" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Card className="py-3">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            Purchase total
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatMoney(systemPurchaseTotal(asset) || null)}
          </p>
          <p className="mt-0.5 text-xs text-muted">Sum of components</p>
        </Card>
        <Card className="border-forest-100 bg-forest-50/50 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            Replacement total
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatMoney(systemReplacementTotal(asset) || null)}
          </p>
          <p className="mt-0.5 text-xs text-muted">Sum of components</p>
        </Card>
      </div>

      <ComponentsList
        systemId={asset.id}
        components={asset.components}
        onAdd={(input) => addComponent(asset.id, input)}
        onUpdate={handleUpdateComponent}
        onDelete={(componentId) => deleteComponent(asset.id, componentId)}
        onDuplicate={(componentId) =>
          duplicateComponent(asset.id, componentId)
        }
      />

      {asset.notes.trim() && (
        <Card>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-forest-800 uppercase">
            System notes
          </h3>
          <p className="text-sm whitespace-pre-wrap text-ink">{asset.notes}</p>
        </Card>
      )}

      <p className="text-[11px] text-muted">
        Updated {format(parseISO(asset.updatedAt), 'MMM d, yyyy')}
      </p>

      <Button
        variant="danger"
        size="sm"
        className="w-full"
        onClick={() => {
          if (confirm(`Delete ${asset.name}? This cannot be undone.`)) {
            void deleteAsset(asset.id).then(() => router.push("/systems"))
          }
        }}
      >
        <Trash2 className="h-4 w-4" /> Delete system
      </Button>
    </div>
  )
}
