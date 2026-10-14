import { normalizeCategory } from "@/lib/farm-types";

type CardComponent = {
  name?: string | null;
  location?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
};

/** Second line on a system card: “Refrigeration · Barn”, “John Deere 5075E · Equipment shed”. */
export function systemCardSubtitle(asset: {
  notes?: string | null;
  components: CardComponent[];
}): string {
  const note = firstLine(asset.notes);
  if (note.includes("·")) return clip(note);

  const type = (note && note.length <= 60 ? note : "") || componentIdentity(asset.components);
  const location = sharedLocation(asset.components);
  if (type && location && type.toLowerCase() !== location.toLowerCase()) {
    return clip(`${type} · ${location}`);
  }
  return clip(type || location);
}

export function systemComponentCountLabel(count: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
  if (n === 1) return "1 component";
  return `${n} components`;
}

/**
 * Location line for a compact system tile.
 * The most common component location, "Multiple locations" when several tie,
 * or "" when no component has a location.
 */
export function systemCardLocation(asset: { components: CardComponent[] }): string {
  const counts = new Map<string, number>();
  for (const component of asset.components) {
    const location = (component.location ?? "").trim();
    if (!location) continue;
    counts.set(location, (counts.get(location) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  let tied = false;
  for (const [location, count] of counts) {
    if (count > bestCount) {
      best = location;
      bestCount = count;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }
  if (!best) return "";
  return tied ? "Multiple locations" : best;
}

/** Case-insensitive match on the system, its category, or any component name or location. */
export function systemMatchesSearch(
  asset: { name: string; components: CardComponent[] },
  category: string,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const fields = [
    asset.name,
    category,
    systemCardLocation(asset),
    ...asset.components.flatMap((component) => [component.name ?? "", component.location ?? ""]),
  ];
  return fields.join("\n").toLowerCase().includes(needle);
}

export function groupSystemsByCategory<T extends { name: string; category: string }>(
  systems: T[],
): Array<{ category: string; systems: T[] }> {
  const buckets = new Map<string, T[]>();
  for (const system of systems) {
    const category = normalizeCategory(system.category);
    const list = buckets.get(category);
    if (list) list.push(system);
    else buckets.set(category, [system]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map(([category, list]) => ({
      category,
      systems: [...list].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    }));
}

type OpenTaskRef = {
  componentId?: string | null;
  component?: { id?: string | null; system?: { id?: string | null } | null } | null;
};

/** Systems that have an open task on one of their components. */
export function systemIdsWithOpenTasks(
  systems: Array<{ id: string; components: Array<{ id: string }> }>,
  tasks: OpenTaskRef[],
): Set<string> {
  const componentToSystem = new Map<string, string>();
  const systemIds = new Set<string>();
  for (const system of systems) {
    systemIds.add(system.id);
    for (const component of system.components) {
      componentToSystem.set(component.id, system.id);
    }
  }
  const open = new Set<string>();
  for (const task of tasks) {
    const fromComponentId = task.componentId
      ? componentToSystem.get(task.componentId)
      : undefined;
    const nestedComponentId = task.component?.id
      ? componentToSystem.get(task.component.id)
      : undefined;
    const nestedSystemId = task.component?.system?.id;
    const id =
      fromComponentId ||
      nestedComponentId ||
      (nestedSystemId && systemIds.has(nestedSystemId) ? nestedSystemId : undefined);
    if (id) open.add(id);
  }
  return open;
}

function firstLine(notes: string | null | undefined): string {
  return (notes ?? "").split(/\r?\n/)[0]?.trim().replace(/\s+/g, " ") ?? "";
}

function clip(value: string, max = 80): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function componentIdentity(components: CardComponent[]): string {
  for (const component of components) {
    const bits = [component.manufacturer, component.modelNumber]
      .map((part) => (part ?? "").trim())
      .filter(Boolean);
    if (bits.length) return bits.join(" ");
  }
  return "";
}

function sharedLocation(components: CardComponent[]): string {
  const locations = [
    ...new Set(components.map((component) => (component.location ?? "").trim()).filter(Boolean)),
  ];
  return locations.length === 1 ? locations[0]! : "";
}
