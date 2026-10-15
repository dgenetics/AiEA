"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ExternalLink } from 'lucide-react'
import { useData } from "@/components/farm/data-context"
import type { SystemComponent, SystemComponentInput } from "@/lib/farm-types"
import { emptyComponentInput, formatMoney, parseMoney } from "@/lib/farm-money"
import { maintenanceApi, type CreateScheduleInput } from "@/lib/farm-api"
import type { ScheduleJson } from "@/lib/maintenance"
import { scheduleCardFrequency } from "@/lib/chore-display"
import { calendarDayDiff, formatCalendarDate } from "@/lib/calendar"
import { BOARD_STATUSES } from "@/lib/board"
import {
  componentBubbleBadge,
  componentBubbleLine,
  componentMatchesFilter,
  type BubbleDue,
} from "@/lib/component-bubbles"
import { componentIdentityRows } from "@/lib/component-identity"
import {
  hasOtherSystemsToMoveTo,
  MoveComponentSheet,
} from "@/components/farm/MoveComponentSheet"
import { InlineDelete, componentDeleteMessage } from "@/components/farm/InlineDelete"
import { Toast } from "@/components/farm/Toast"
import { ScheduleForm } from "@/components/farm/ScheduleForm"
import { ScanComponent } from "@/components/farm/ScanComponent"
import { Modal } from "@/components/farm/Modal"
import { Button, Input } from "@/components/farm/ui"
import type { ScanScheduleDraft } from "@/lib/component-scan"

function ScanFrameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 5.25V3.75A1.25 1.25 0 0 1 3.75 2.5h1.5M10.75 2.5h1.5a1.25 1.25 0 0 1 1.25 1.25v1.5M13.5 10.75v1.5a1.25 1.25 0 0 1-1.25 1.25h-1.5M5.25 13.5h-1.5a1.25 1.25 0 0 1-1.25-1.25v-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function moneyToInput(value: number | null): string {
  if (value == null) return ''
  return String(value)
}

function dateToInput(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function toInput(part: SystemComponent): SystemComponentInput {
  const { id: _id, ...rest } = part
  return rest
}

const controlClass =
  "mt-1.5 h-12 appearance-none border-[#d6d3d1] bg-[#fffdf8] px-3.5 py-0 text-base text-stone-900 focus:border-stone-600 focus:ring-stone-600/12"

function SheetField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="mt-3.5 block min-w-0 text-[13px] text-[#78716c]">
      {label}
      {children}
    </label>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mt-[26px] text-[11px] font-semibold tracking-[0.12em] text-[#a8a29e] uppercase">
      {children}
    </p>
  )
}

/** Two columns until a value is wider than its box, then stack so nothing is cut off. */
function FieldPair({
  watch,
  children,
}: {
  watch: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [stack, setStack] = useState(false)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root || stack) return
    const clipped = [...root.querySelectorAll("input")].some(
      (input) => input.scrollWidth > input.clientWidth + 1,
    )
    if (clipped) setStack(true)
  }, [watch, stack])

  return (
    <div
      ref={ref}
      className={
        stack
          ? "flex min-w-0 flex-col"
          : "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2.5"
      }
    >
      {children}
    </div>
  )
}

function GrowingNotes({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function fit() {
    const el = ref.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.max(76, el.scrollHeight)}px`
  }

  useLayoutEffect(() => {
    fit()
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1.5 min-h-[76px] w-full min-w-0 resize-none overflow-hidden rounded-xl border border-[#d6d3d1] bg-[#fffdf8] px-3.5 py-3 text-base leading-snug text-stone-900 focus:border-stone-600 focus:ring-2 focus:ring-stone-600/12 focus:outline-none"
    />
  )
}

function ComponentFields({
  value,
  onChange,
  autoFocusName,
}: {
  value: SystemComponentInput
  onChange: (patch: Partial<SystemComponentInput>) => void
  autoFocusName?: boolean
}) {
  return (
    <div>
      <SheetField label="Name">
        <Input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Component name"
          autoFocus={autoFocusName}
          className={controlClass}
        />
      </SheetField>
      <SheetField label="Location">
        <Input
          value={value.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="House, barn, office…"
          className={controlClass}
        />
      </SheetField>

      <SectionLabel>Equipment</SectionLabel>
      <SheetField label="Make">
        <Input
          value={value.manufacturer}
          onChange={(e) => onChange({ manufacturer: e.target.value })}
          className={controlClass}
        />
      </SheetField>
      <FieldPair watch={`${value.modelNumber}\n${value.productNumber}`}>
        <SheetField label="Model #">
          <Input
            value={value.modelNumber}
            onChange={(e) => onChange({ modelNumber: e.target.value })}
            className={controlClass}
          />
        </SheetField>
        <SheetField label="SKU">
          <Input
            value={value.productNumber}
            onChange={(e) => onChange({ productNumber: e.target.value })}
            className={controlClass}
          />
        </SheetField>
      </FieldPair>
      <SheetField label="Serial #">
        <Input
          value={value.serialNumber}
          onChange={(e) => onChange({ serialNumber: e.target.value })}
          className={controlClass}
        />
      </SheetField>
      <SheetField label="Warranty">
        <Input
          value={value.warrantyInfo}
          onChange={(e) => onChange({ warrantyInfo: e.target.value })}
          placeholder="e.g. 2 yr parts"
          className={controlClass}
        />
      </SheetField>
      <SheetField label="Manual">
        <Input
          value={value.userManual}
          onChange={(e) => onChange({ userManual: e.target.value })}
          placeholder="URL or filing note"
          className={controlClass}
        />
        {isUrl(value.userManual) && (
          <a
            href={value.userManual.trim()}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-forest-800 hover:underline"
          >
            Open manual <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </SheetField>

      <SectionLabel>Contacts</SectionLabel>
      <FieldPair watch={`${value.vendorName}\n${value.vendorContact}`}>
        <SheetField label="Vendor">
          <Input
            value={value.vendorName}
            onChange={(e) => onChange({ vendorName: e.target.value })}
            className={controlClass}
          />
        </SheetField>
        <SheetField label="Vendor contact">
          <Input
            value={value.vendorContact}
            onChange={(e) => onChange({ vendorContact: e.target.value })}
            placeholder="Phone or email"
            className={controlClass}
          />
        </SheetField>
      </FieldPair>
      <FieldPair watch={`${value.serviceCompanyName}\n${value.serviceCompanyContact}`}>
        <SheetField label="Service co.">
          <Input
            value={value.serviceCompanyName}
            onChange={(e) => onChange({ serviceCompanyName: e.target.value })}
            className={controlClass}
          />
        </SheetField>
        <SheetField label="Service contact">
          <Input
            value={value.serviceCompanyContact}
            onChange={(e) => onChange({ serviceCompanyContact: e.target.value })}
            placeholder="Phone or email"
            className={controlClass}
          />
        </SheetField>
      </FieldPair>

      <SectionLabel>Purchase</SectionLabel>
      <SheetField label="Purchase date">
        <Input
          type="date"
          placeholder="mm/dd/yyyy"
          value={dateToInput(value.purchaseDate)}
          onChange={(e) =>
            onChange({
              purchaseDate: e.target.value
                ? new Date(e.target.value + "T12:00:00").toISOString()
                : null,
            })
          }
          className={`sheet-date ${controlClass}`}
        />
      </SheetField>
      <SheetField label="Cost">
        <Input
          inputMode="decimal"
          value={moneyToInput(value.purchaseCost)}
          onChange={(e) => onChange({ purchaseCost: parseMoney(e.target.value) })}
          placeholder="0"
          className={controlClass}
        />
      </SheetField>

      <SheetField label="Notes">
        <GrowingNotes value={value.notes} onChange={(notes) => onChange({ notes })} />
      </SheetField>
    </div>
  )
}

/**
 * Fully local draft while the sheet is open. Save writes the draft, including
 * the stored replacement cost, which this sheet no longer shows.
 */
function EditableComponent({
  part,
  onUpdate,
  onDraftName,
  onAddSchedule,
  onSaved,
  scheduleDisabled,
  deleteSlot,
}: {
  part: SystemComponent
  onUpdate: (
    id: string,
    patch: Partial<SystemComponentInput>,
  ) => void | Promise<void>
  onDraftName?: (name: string) => void
  onAddSchedule: () => void
  onSaved: () => void
  scheduleDisabled?: boolean
  deleteSlot: React.ReactNode
}) {
  const [draft, setDraft] = useState<SystemComponentInput>(() => toInput(part))
  const draftRef = useRef(draft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const partId = part.id

  draftRef.current = draft

  useEffect(() => {
    setDraft(toInput(part))
    onDraftName?.(part.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId])

  async function save() {
    const next = draftRef.current
    if (!next.name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await onUpdate(partId, {
        ...next,
        name: next.name.trim(),
        replacementCost: next.replacementCost,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that")
      setSaving(false)
    }
  }

  return (
    <div>
      <ComponentFields
        value={draft}
        autoFocusName
        onChange={(patch) => {
          setDraft((d) => {
            const next = { ...d, ...patch, replacementCost: d.replacementCost }
            draftRef.current = next
            if (patch.name !== undefined) onDraftName?.(patch.name)
            return next
          })
        }}
      />
      <button
        type="button"
        disabled={scheduleDisabled || saving}
        onClick={onAddSchedule}
        className="mt-3.5 flex min-h-12 w-full items-center bg-transparent text-left text-[17px] font-semibold text-[#166534] disabled:opacity-40"
      >
        + Add Schedule
      </button>
      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={saving || !draft.name.trim()}
        onClick={() => void save()}
        className="mt-1.5 h-[50px] w-full rounded-[14px] bg-stone-900 text-base font-semibold text-[#f7f3eb] disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {deleteSlot}
    </div>
  )
}


type BoardTask = {
  id: string
  title: string
  status?: string
  dueAt: string | null
  componentId: string | null
  scheduleId: string | null
  component?: { id?: string | null } | null
}

const OPEN_TASK_STATUSES = new Set<string>(BOARD_STATUSES)

function taskComponentId(task: BoardTask): string | null {
  return task.componentId || task.component?.id || null
}

export function ComponentsList({
  mode = 'read',
  systemId,
  components,
  onAdd,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  mode?: 'read' | 'edit'
  systemId: string
  components: SystemComponent[]
  onAdd: (input: SystemComponentInput) => void | Promise<void | SystemComponent>
  onUpdate: (
    id: string,
    patch: Partial<SystemComponentInput>,
  ) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onDuplicate: (
    id: string,
  ) => SystemComponent | undefined | Promise<SystemComponent | undefined>
}) {
  const [showForm, setShowForm] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<SystemComponentInput>(() =>
    emptyComponentInput(),
  )
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const partFromUrl = searchParams.get('part')
  const [expandedId, setExpandedId] = useState<string | null>(partFromUrl)
  // Live title while editing so the row header doesn't lag / fight the input
  const [liveNames, setLiveNames] = useState<Record<string, string>>({})
  const { assets } = useData()
  const systemName = assets.find((asset) => asset.id === systemId)?.name ?? ""
  const hasOtherSystems = hasOtherSystemsToMoveTo(assets, systemId)
  const [movePart, setMovePart] = useState<SystemComponent | null>(null)
  const [schedulePart, setSchedulePart] = useState<SystemComponent | null>(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [schedules, setSchedules] = useState<ScheduleJson[]>([])
  const [schedulesReady, setSchedulesReady] = useState(false)
  const [tasks, setTasks] = useState<BoardTask[]>([])
  const [editingPart, setEditingPart] = useState<SystemComponent | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const partRowRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const [relatedTick, setRelatedTick] = useState(0)
  const componentKey = components.map((part) => part.id).join(',')

  useEffect(() => {
    let cancelled = false
    const ids = new Set(componentKey ? componentKey.split(',') : [])
    void (async () => {
      const [allSchedules, taskRes] = await Promise.all([
        maintenanceApi.listSchedules().catch(() => null),
        fetch('/api/tasks?view=board', { credentials: 'include' })
          .then((response) => response.json())
          .catch(() => ({ tasks: [] as BoardTask[] })),
      ])
      if (cancelled) return
      if (allSchedules) {
        setSchedules(allSchedules.filter((schedule) => ids.has(schedule.componentId)))
        setSchedulesReady(true)
      }
      const listed = (taskRes.tasks ?? []) as BoardTask[]
      setTasks(listed.filter((task) => {
        const id = taskComponentId(task)
        if (id == null || !ids.has(id)) return false
        // view=board is already open-only. Drop DONE/CANCELLED if a payload includes them.
        return !task.status || OPEN_TASK_STATUSES.has(task.status)
      }))
    })()
    return () => {
      cancelled = true
    }
  }, [componentKey, relatedTick])

  // Auto-expand + scroll to ?part= on mount / when the query changes
  useEffect(() => {
    if (!partFromUrl) return
    if (!components.some((c) => c.id === partFromUrl)) return
    setExpandedId(partFromUrl)
    // Scroll after expand paints
    const t = window.setTimeout(() => {
      partRowRefs.current[partFromUrl]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }, 50)
    return () => window.clearTimeout(t)
  }, [partFromUrl, components])

  function setPartParam(partId: string | null) {
    const next = new URLSearchParams(searchParams)
    if (partId) next.set('part', partId)
    else next.delete('part')
    const q = next.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  function togglePart(partId: string) {
    const nextId = expandedId === partId ? null : partId
    setExpandedId(nextId)
    setPartParam(nextId)
  }

  async function submitNew() {
    if (!draft.name.trim()) return
    await onAdd({ ...draft, name: draft.name.trim() })
    setDraft(emptyComponentInput())
    setShowForm(false)
  }

  function onScanPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setShowForm(false)
    setScanNote(null)
    setScanFile(file)
    setScanOpen(true)
  }

  function openManual() {
    setScanOpen(false)
    setScanFile(null)
    setScanNote(null)
    setShowForm(true)
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }, 50)
  }

  async function saveScanned(input: SystemComponentInput, schedules: ScanScheduleDraft[]) {
    const created = await onAdd(input)
    if (schedules.length) {
      const componentId = created && typeof created === "object" && "id" in created ? created.id : ""
      if (!componentId) {
        setScanNote("Saved the component. Add the schedule from the component.")
      } else {
        for (const schedule of schedules) {
          try {
            await maintenanceApi.createSchedule({ ...schedule, componentId })
            setRelatedTick((tick) => tick + 1)
          } catch {
            setScanNote("Saved the component. Add the schedule from the component.")
            break
          }
        }
      }
    }
    setScanOpen(false)
    setScanFile(null)
    setShowForm(false)
    setDraft(emptyComponentInput())
  }

  const readMode = mode === "read"
  const visible = readMode
    ? components.filter((part) => componentMatchesFilter(part, query))
    : components
  const sheetPart = editingPart
    ? (components.find((part) => part.id === editingPart.id) ?? editingPart)
    : null

  function duesFor(partId: string): BubbleDue[] {
    const taskDues: BubbleDue[] = tasks
      .filter((task) => taskComponentId(task) === partId)
      .map((task) => ({ kind: "task", due: task.dueAt }))
    const scheduleDues: BubbleDue[] = schedules
      .filter((schedule) => schedule.componentId === partId)
      .map((schedule) => ({ kind: "schedule", due: schedule.nextDueDate }))
    return [...taskDues, ...scheduleDues]
  }

  function rowsFor(part: SystemComponent): { label: string; value: string; href?: string }[] {
    const vendor = [part.vendorName, part.vendorContact]
      .map((piece) => piece.trim())
      .filter(Boolean)
      .join(" · ")
    const service = [part.serviceCompanyName, part.serviceCompanyContact]
      .map((piece) => piece.trim())
      .filter(Boolean)
      .join(" · ")
    const rows: { label: string; value: string; href?: string }[] = [
      ...componentIdentityRows(part),
      { label: "Vendor", value: vendor },
      {
        label: "Installed",
        value: part.purchaseDate
          ? formatCalendarDate(part.purchaseDate, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "",
      },
      { label: "Location", value: part.location.trim() },
      {
        label: "Purchase",
        value: part.purchaseCost != null ? formatMoney(part.purchaseCost) : "",
      },
      { label: "Warranty", value: part.warrantyInfo.trim() },
      { label: "Manual", value: part.userManual.trim(), href: isUrl(part.userManual) ? part.userManual.trim() : undefined },
      { label: "Service", value: service },
      { label: "Notes", value: part.notes.trim() },
    ]
    return rows.filter((row) => row.value && row.value !== "No date" && row.value !== "—")
  }

  function scheduleCadence(schedule: ScheduleJson, partId: string): string {
    const openOnSchedule = tasks.some(
      (task) => taskComponentId(task) === partId && task.scheduleId === schedule.id,
    )
    if (openOnSchedule) return "open task"
    const phrase = scheduleCardFrequency(schedule.frequency, schedule.intervalDays)
    if (!phrase || phrase === "—") return ""
    return phrase.replace(/^Every /, "every ")
  }

  function dateTone(due: string): string {
    const days = calendarDayDiff(due)
    if (Number.isNaN(days) || days > 14) return "font-medium text-stone-500"
    if (days < 0) return "font-semibold text-[#b91c1c]"
    return "font-semibold text-[#92400e]"
  }

  return (
    <>
      {readMode ? (
        <div className="mt-4 flex flex-wrap items-center justify-start gap-7">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-left text-[13px] font-semibold text-[#166534]">
            <ScanFrameIcon />
            Scan Component
            <input
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Take a photo of the label"
              className="sr-only"
              onChange={onScanPhoto}
            />
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center text-left text-[13px] font-semibold text-[#166534]">
            Photo library
            <input
              type="file"
              accept="image/*"
              aria-label="Choose a photo from the library"
              className="sr-only"
              onChange={onScanPhoto}
            />
          </label>
          <button
            type="button"
            onClick={openManual}
            className="inline-flex min-h-11 items-center text-left text-[13px] font-semibold text-[#166534]"
          >
            Add Manually
          </button>
        </div>
      ) : null}
      {scanNote ? <p className="text-[13px] text-[#b91c1c]">{scanNote}</p> : null}
      <h2
        className={`${readMode ? "mt-4" : "mt-[22px]"} text-[11px] font-medium tracking-[0.14em] text-[#a8a29e] uppercase`}
      >
        Components
      </h2>

      {readMode && (
        <label className="mt-3.5 flex h-[46px] items-center gap-2 rounded-[10px] border border-[#d9cfb8] bg-[#fffdf8] px-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a8a29e"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a component"
            aria-label="Find a component"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-stone-900 outline-none placeholder:text-stone-400 [&::-webkit-search-cancel-button]:appearance-none"
          />
        </label>
      )}

      {components.length === 0 && !showForm ? (
        <p className="mt-3 text-sm text-[#78716c]">No components yet.</p>
      ) : null}

      {readMode && query.trim() && visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#78716c]">No components match</p>
      ) : null}

      {readMode && visible.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-3.5">
          {visible.map((part) => {
            const open = expandedId === part.id
            const displayName = liveNames[part.id] ?? part.name
            const hasOpenTask = tasks.some((task) => taskComponentId(task) === part.id)
            const badge = componentBubbleBadge(duesFor(part.id))
            const overdue = badge?.tone === "overdue"
            const partSchedules = schedules.filter((schedule) => schedule.componentId === part.id)
            const rows = rowsFor(part)
            const actionClass =
              "min-h-8 rounded-lg px-0.5 py-1.5 text-sm font-medium text-stone-600 hover:text-stone-900 hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-stone-800"
            return (
              <li
                key={part.id}
                ref={(el) => {
                  partRowRefs.current[part.id] = el
                }}
                className={`min-w-0 border shadow-sm ${
                  open ? "rounded-[20px]" : "rounded-[25px]"
                } ${
                  overdue
                    ? "border-[#f5c2c2] bg-[#fdecec]"
                    : hasOpenTask
                      ? "border-[#f3d79a] bg-[#fdf0d5]"
                      : "border-[#e6dcc8] bg-[#fffdf8]"
                }`}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`part-details-${part.id}`}
                  onClick={() => togglePart(part.id)}
                  className="block min-h-[50px] w-full rounded-[inherit] px-5 py-3.5 text-left text-base leading-[1.3] font-semibold text-stone-900 [overflow-wrap:anywhere]"
                >
                  {displayName}
                </button>
                {open ? (
                  <div id={`part-details-${part.id}`} className="px-5 pb-5">
                    <div className="-mt-2 -ml-0.5 flex justify-start gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleError(null)
                          setSchedulePart(part)
                        }}
                        className={actionClass}
                      >
                        Add schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPart(part)}
                        className={actionClass}
                      >
                        Edit Component
                      </button>
                    </div>
                    {rows.length > 0 ? (
                      <dl className="mt-3 grid grid-cols-[104px_1fr] gap-x-3 gap-y-[9px] text-sm">
                        {rows.map((row) => (
                          <div key={row.label} className="contents">
                            <dt className="pt-px text-xs text-[#78716c]">{row.label}</dt>
                            <dd className="text-stone-900 whitespace-pre-wrap">
                              {row.href ? (
                                <a
                                  href={row.href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[#166534] underline"
                                >
                                  {row.value}
                                  <ExternalLink className="h-3 w-3" aria-hidden />
                                </a>
                              ) : (
                                row.value
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {partSchedules.length > 0 ? (
                      <div className="mt-5">
                        <p className="text-xs text-[#78716c]">Schedules</p>
                        <div className="mt-2 flex flex-col gap-[9px]">
                          {partSchedules.map((schedule) => {
                            const cadence = scheduleCadence(schedule, part.id)
                            return (
                              <div
                                key={schedule.id}
                                className="flex items-baseline justify-between gap-2 text-sm"
                              >
                                <span className="min-w-0 text-stone-900">
                                  {schedule.name}
                                  {cadence ? (
                                    <em className="text-xs text-[#78716c] not-italic">
                                      {" "}
                                      · {cadence}
                                    </em>
                                  ) : null}
                                </span>
                                <b className={`shrink-0 text-xs whitespace-nowrap ${dateTone(schedule.nextDueDate)}`}>
                                  {formatCalendarDate(schedule.nextDueDate, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </b>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {readMode ? (
        <p className="mt-8 flex flex-wrap gap-3.5 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded border border-[#f3d79a] bg-[#fdf0d5]" />
            Amber = has an open task
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded border border-[#f5c2c2] bg-[#fdecec]" />
            Red = overdue
          </span>
        </p>
      ) : null}

      {!readMode && visible.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {visible.map((part) => {
            const displayName = liveNames[part.id] ?? part.name
            const line = componentBubbleLine(part.modelNumber, part.location)
            return (
              <li
                key={part.id}
                className="flex items-start gap-2.5 rounded-xl border border-[#ebe3d3] bg-[#fffdf8] px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold text-stone-900">{displayName}</p>
                  {line ? (
                    <p className="truncate text-xs text-[#78716c]">{line}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    title="Add schedule"
                    aria-label={`Add schedule for ${displayName}`}
                    className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg text-sm text-stone-600"
                    onClick={() => {
                      setScheduleError(null)
                      setSchedulePart(part)
                    }}
                  >
                    ⏱
                  </button>
                  <button
                    type="button"
                    title={hasOtherSystems ? "Move" : "No other systems to move to."}
                    aria-label={`Move ${displayName}`}
                    disabled={!hasOtherSystems}
                    className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg text-sm text-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => setMovePart(part)}
                  >
                    ⇄
                  </button>
                  <button
                    type="button"
                    title="Duplicate"
                    aria-label={`Duplicate ${displayName}`}
                    className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg text-sm text-stone-600"
                    onClick={() => {
                      void onDuplicate(part.id)
                    }}
                  >
                    ⧉
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {showForm ? (
        <div ref={formRef} className="mt-2 space-y-2 rounded-xl border border-[#ebe3d3] bg-[#fffdf8] p-3">
          <ComponentFields
            value={draft}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            autoFocusName
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setShowForm(false)
                setDraft(emptyComponentInput())
              }}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={!draft.name.trim()} onClick={() => void submitNew()}>
              Add component
            </Button>
          </div>
        </div>
      ) : null}

      {!readMode ? (
        <button
          type="button"
          onClick={() => setShowForm((open) => !open)}
          className="mt-2 text-[13px] font-semibold text-[#166534]"
        >
          + Add component
        </button>
      ) : null}

      {movePart ? (
        <MoveComponentSheet
          open
          onClose={() => setMovePart(null)}
          componentId={movePart.id}
          componentName={liveNames[movePart.id] ?? movePart.name}
          currentSystemId={systemId}
          systems={assets}
          onMoved={() => {
            setMovePart(null)
            setExpandedId((current) => (current === movePart.id ? null : current))
            setLiveNames((names) => {
              const next = { ...names }
              delete next[movePart.id]
              return next
            })
          }}
        />
      ) : null}

      {scanOpen && scanFile ? (
        <ScanComponent
          key={`${scanFile.name}-${scanFile.size}-${scanFile.lastModified}`}
          systemName={systemName}
          file={scanFile}
          onClose={() => {
            setScanOpen(false)
            setScanFile(null)
          }}
          onTypeInstead={openManual}
          onSave={saveScanned}
        />
      ) : null}

      {sheetPart ? (
        <Modal variant="sheet" title="Edit component" onClose={() => setEditingPart(null)}>
          <EditableComponent
            key={sheetPart.id}
            part={sheetPart}
            onUpdate={onUpdate}
            onDraftName={(name) =>
              setLiveNames((names) => ({ ...names, [sheetPart.id]: name }))
            }
            scheduleDisabled={scheduleSaving}
            onAddSchedule={() => {
              setScheduleError(null)
              setSchedulePart(sheetPart)
            }}
            onSaved={() => setEditingPart(null)}
            deleteSlot={
              <InlineDelete
                label="Delete component"
                disabled={!schedulesReady}
                className="mt-7"
                buttonClassName="flex h-12 w-full items-center justify-center text-base font-semibold text-[#b91c1c] disabled:opacity-40"
                message={componentDeleteMessage(
                  liveNames[sheetPart.id] ?? sheetPart.name,
                  schedules.filter((schedule) => schedule.componentId === sheetPart.id).length,
                )}
                onConfirm={async () => {
                  const id = sheetPart.id
                  const name = (liveNames[id] ?? sheetPart.name).trim() || "Component"
                  await onDelete(id)
                  setEditingPart(null)
                  setExpandedId((current) => (current === id ? null : current))
                  setLiveNames((names) => {
                    const next = { ...names }
                    delete next[id]
                    return next
                  })
                  setToast(`Deleted '${name}'.`)
                }}
              />
            }
          />
        </Modal>
      ) : null}

      {schedulePart ? (
        <Modal
          variant="sheet"
          stacked={sheetPart != null}
          title="Add schedule"
          subtitle={liveNames[schedulePart.id] ?? schedulePart.name}
          onBack={
            sheetPart
              ? () => {
                  if (scheduleSaving) return
                  setSchedulePart(null)
                  setScheduleError(null)
                }
              : undefined
          }
          onClose={() => {
            if (scheduleSaving) return
            setSchedulePart(null)
            setScheduleError(null)
          }}
        >
          <ScheduleForm
            key={schedulePart.id}
            error={scheduleError}
            formId="system-part-schedule-add-form"
            componentId={schedulePart.id}
            busy={scheduleSaving}
            onSubmit={async (input: CreateScheduleInput) => {
              setScheduleSaving(true)
              setScheduleError(null)
              try {
                await maintenanceApi.createSchedule(input)
                setSchedulePart(null)
                setRelatedTick((tick) => tick + 1)
              } catch (error) {
                setScheduleError(
                  error instanceof Error ? error.message : "Failed to save schedule",
                )
              } finally {
                setScheduleSaving(false)
              }
            }}
          />
        </Modal>
      ) : null}

      {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
    </>
  )
}
