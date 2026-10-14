"use client";

import { useEffect, useRef, useState } from 'react'
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
import {
  hasOtherSystemsToMoveTo,
  MoveComponentSheet,
} from "@/components/farm/MoveComponentSheet"
import { ScheduleForm } from "@/components/farm/ScheduleForm"
import { Modal } from "@/components/farm/Modal"
import { Button, Field, Input, Textarea } from "@/components/farm/ui"

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

function ComponentFields({
  value,
  onChange,
  onBlurSave,
  autoFocusName,
}: {
  value: SystemComponentInput
  onChange: (patch: Partial<SystemComponentInput>) => void
  onBlurSave?: () => void
  autoFocusName?: boolean
}) {
  return (
    <div className="space-y-2">
      <Field label="Component name">
        <Input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={onBlurSave}
          placeholder="Component name"
          autoFocus={autoFocusName}
        />
      </Field>
      <Field label="Location">
        <Input
          value={value.location}
          onChange={(e) => onChange({ location: e.target.value })}
          onBlur={onBlurSave}
          placeholder="House, barn, office…"
        />
      </Field>

      <p className="pt-1 text-[10px] font-semibold tracking-wide text-forest-800 uppercase">
        Identification
      </p>
      <Field label="Manufacturer">
        <Input
          value={value.manufacturer}
          onChange={(e) => onChange({ manufacturer: e.target.value })}
          onBlur={onBlurSave}
        />
      </Field>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Model #">
          <Input
            value={value.modelNumber}
            onChange={(e) => onChange({ modelNumber: e.target.value })}
            onBlur={onBlurSave}
          />
        </Field>
        <Field label="SKU">
          <Input
            value={value.productNumber}
            onChange={(e) => onChange({ productNumber: e.target.value })}
            onBlur={onBlurSave}
          />
        </Field>
        <Field label="Serial #">
          <Input
            value={value.serialNumber}
            onChange={(e) => onChange({ serialNumber: e.target.value })}
            onBlur={onBlurSave}
          />
        </Field>
      </div>

      <p className="pt-1 text-[10px] font-semibold tracking-wide text-forest-800 uppercase">
        Warranty & manual
      </p>
      <Field label="Warranty info">
        <Textarea
          rows={2}
          value={value.warrantyInfo}
          onChange={(e) => onChange({ warrantyInfo: e.target.value })}
          onBlur={onBlurSave}
          placeholder="Coverage period, expiration, claim phone, policy #…"
        />
      </Field>
      <Field label="User manual">
        <Input
          value={value.userManual}
          onChange={(e) => onChange({ userManual: e.target.value })}
          onBlur={onBlurSave}
          placeholder="URL or filing note"
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
      </Field>

      <p className="pt-1 text-[10px] font-semibold tracking-wide text-forest-800 uppercase">
        Vendor / installer
      </p>
      <Field label="Name">
        <Input
          value={value.vendorName}
          onChange={(e) => onChange({ vendorName: e.target.value })}
          onBlur={onBlurSave}
        />
      </Field>
      <Field label="Contact info">
        <Textarea
          rows={2}
          value={value.vendorContact}
          onChange={(e) => onChange({ vendorContact: e.target.value })}
          onBlur={onBlurSave}
          placeholder="Phone, email, account #…"
        />
      </Field>

      <p className="pt-1 text-[10px] font-semibold tracking-wide text-forest-800 uppercase">
        Maintenance / repair
      </p>
      <Field label="Company name">
        <Input
          value={value.serviceCompanyName}
          onChange={(e) => onChange({ serviceCompanyName: e.target.value })}
          onBlur={onBlurSave}
        />
      </Field>
      <Field label="Contact info">
        <Textarea
          rows={2}
          value={value.serviceCompanyContact}
          onChange={(e) =>
            onChange({ serviceCompanyContact: e.target.value })
          }
          onBlur={onBlurSave}
          placeholder="Phone, email, after-hours…"
        />
      </Field>

      <p className="pt-1 text-[10px] font-semibold tracking-wide text-forest-800 uppercase">
        Purchase & replacement
      </p>
      <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
        <Field label="Purchase date">
          <Input
            type="date"
            value={dateToInput(value.purchaseDate)}
            onChange={(e) =>
              onChange({
                purchaseDate: e.target.value
                  ? new Date(e.target.value + 'T12:00:00').toISOString()
                  : null,
              })
            }
            onBlur={onBlurSave}
          />
        </Field>
        <Field label="Purchase cost">
          <Input
            inputMode="decimal"
            value={moneyToInput(value.purchaseCost)}
            onChange={(e) =>
              onChange({ purchaseCost: parseMoney(e.target.value) })
            }
            onBlur={onBlurSave}
            placeholder="0"
          />
        </Field>
      </div>
      <Field label="Replacement cost">
        <Input
          inputMode="decimal"
          value={moneyToInput(value.replacementCost)}
          onChange={(e) =>
            onChange({ replacementCost: parseMoney(e.target.value) })
          }
          onBlur={onBlurSave}
          placeholder="Current estimate"
        />
      </Field>

      <p className="pt-1 text-[10px] font-semibold tracking-wide text-forest-800 uppercase">
        Notes
      </p>
      <Field label="Notes">
        <Textarea
          rows={2}
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          onBlur={onBlurSave}
        />
      </Field>
    </div>
  )
}

/**
 * Fully local draft while editing. Saves only on blur / unmount / collapse —
 * never mid-keystroke — so React state + API responses cannot clobber typing.
 */
function EditableComponent({
  part,
  onUpdate,
  onDraftName,
}: {
  part: SystemComponent
  onUpdate: (
    id: string,
    patch: Partial<SystemComponentInput>,
  ) => void | Promise<void>
  onDraftName?: (name: string) => void
}) {
  const [draft, setDraft] = useState<SystemComponentInput>(() => toInput(part))
  const draftRef = useRef(draft)
  const dirtyRef = useRef(false)
  const onUpdateRef = useRef(onUpdate)
  const partId = part.id

  draftRef.current = draft
  onUpdateRef.current = onUpdate

  // Only re-seed when opening a different component
  useEffect(() => {
    setDraft(toInput(part))
    dirtyRef.current = false
    onDraftName?.(part.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId])

  function flush() {
    if (!dirtyRef.current) return
    dirtyRef.current = false
    void onUpdateRef.current(partId, draftRef.current)
  }

  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        dirtyRef.current = false
        void onUpdateRef.current(partId, draftRef.current)
      }
    }
  }, [partId])

  return (
    <ComponentFields
      value={draft}
      onChange={(patch) => {
        dirtyRef.current = true
        setDraft((d) => {
          const next = { ...d, ...patch }
          draftRef.current = next
          if (patch.name !== undefined) onDraftName?.(patch.name)
          return next
        })
      }}
      onBlurSave={flush}
    />
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
  const hasOtherSystems = hasOtherSystemsToMoveTo(assets, systemId)
  const [movePart, setMovePart] = useState<SystemComponent | null>(null)
  const [schedulePart, setSchedulePart] = useState<SystemComponent | null>(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [schedules, setSchedules] = useState<ScheduleJson[]>([])
  const [tasks, setTasks] = useState<BoardTask[]>([])
  const [editingPart, setEditingPart] = useState<SystemComponent | null>(null)
  const partRowRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const [relatedTick, setRelatedTick] = useState(0)
  const componentKey = components.map((part) => part.id).join(',')

  useEffect(() => {
    let cancelled = false
    const ids = new Set(componentKey ? componentKey.split(',') : [])
    void (async () => {
      const [allSchedules, taskRes] = await Promise.all([
        maintenanceApi.listSchedules().catch(() => [] as ScheduleJson[]),
        fetch('/api/tasks?view=board', { credentials: 'include' })
          .then((response) => response.json())
          .catch(() => ({ tasks: [] as BoardTask[] })),
      ])
      if (cancelled) return
      setSchedules(allSchedules.filter((schedule) => ids.has(schedule.componentId)))
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
    const model = [part.manufacturer, part.modelNumber]
      .map((piece) => piece.trim())
      .filter(Boolean)
      .join(" ")
    const vendor = [part.vendorName, part.vendorContact]
      .map((piece) => piece.trim())
      .filter(Boolean)
      .join(" · ")
    const service = [part.serviceCompanyName, part.serviceCompanyContact]
      .map((piece) => piece.trim())
      .filter(Boolean)
      .join(" · ")
    const rows: { label: string; value: string; href?: string }[] = [
      { label: "Model", value: model },
      { label: "Serial", value: part.serialNumber.trim() },
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
      {
        label: "Replacement",
        value: part.replacementCost != null ? formatMoney(part.replacementCost) : "",
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
      <h2 className="mt-[22px] text-[11px] font-medium tracking-[0.14em] text-[#a8a29e] uppercase">
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
                  <button
                    type="button"
                    title="Remove"
                    aria-label={`Delete ${displayName}`}
                    className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg text-sm text-[#b91c1c]"
                    onClick={() => {
                      if (confirm(`Remove ${displayName} from this system?`)) {
                        void onDelete(part.id)
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {showForm ? (
        <div className="mt-2 space-y-2 rounded-xl border border-[#ebe3d3] bg-[#fffdf8] p-3">
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

      <button
        type="button"
        onClick={() => setShowForm((open) => !open)}
        className="mt-2 text-[13px] font-semibold text-[#166534]"
      >
        + Add component
      </button>

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

      {schedulePart ? (
        <Modal
          variant="sheet"
          title="Add schedule"
          subtitle={liveNames[schedulePart.id] ?? schedulePart.name}
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

      {sheetPart ? (
        <Modal title="Edit component" onClose={() => setEditingPart(null)}>
          <EditableComponent
            key={sheetPart.id}
            part={sheetPart}
            onUpdate={onUpdate}
            onDraftName={(name) =>
              setLiveNames((names) => ({ ...names, [sheetPart.id]: name }))
            }
          />
          <button
            type="button"
            className="mt-3 text-[13px] font-semibold text-[#166534]"
            onClick={() => {
              setScheduleError(null)
              setSchedulePart(sheetPart)
            }}
          >
            Add schedule
          </button>
        </Modal>
      ) : null}
    </>
  )
}
