import type { AssetInput } from "@/lib/farm-types"
import { ASSET_CATEGORIES, normalizeCategory } from "@/lib/farm-types"
import { Field, Input, Select, Textarea } from "@/components/farm/ui"

export function AssetFormFields({
  value,
  onChange,
  plain = false,
}: {
  value: AssetInput
  onChange: (patch: Partial<AssetInput>) => void
  /** Edit-system page: no section headers, short hint. */
  plain?: boolean
}) {
  if (plain) {
    return (
      <div>
        <label htmlFor="name" className="mt-3 block text-xs font-medium text-stone-600">
          Name
          <Input
            id="name"
            className="mt-1"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Main heat pump"
            required
          />
        </label>
        <label htmlFor="category" className="mt-3 block text-xs font-medium text-stone-600">
          Category
          <Select
            id="category"
            className="mt-1"
            value={normalizeCategory(value.category)}
            onChange={(e) => onChange({ category: normalizeCategory(e.target.value) })}
          >
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <label htmlFor="notes" className="mt-3 block text-xs font-medium text-stone-600">
          Notes
          <Textarea
            id="notes"
            className="mt-1"
            rows={4}
            value={value.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </label>
        <p className="mt-2 text-xs text-[#78716c]">
          Location, model, vendor, warranty and costs live on each component.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-forest-800 uppercase">
          System
        </h3>
        <Field label="Name" htmlFor="name">
          <Input
            id="name"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Main heat pump"
            required
          />
        </Field>
        <Field label="Category" htmlFor="category">
          <Select
            id="category"
            value={normalizeCategory(value.category)}
            onChange={(e) => onChange({ category: normalizeCategory(e.target.value) })}
          >
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted">
          Location, costs, identification, vendor, warranty, manuals, and
          service contacts are set on each component after you save.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-forest-800 uppercase">
          Notes
        </h3>
        <Field label="System notes" htmlFor="notes">
          <Textarea
            id="notes"
            rows={3}
            value={value.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </Field>
      </section>
    </div>
  )
}
