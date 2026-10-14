export type ComponentPickerOption = {
  id: string;
  name: string;
  system: string;
};

export type ComponentPickerGroup = {
  system: string;
  items: ComponentPickerOption[];
};

/** Groups whose system or component name contains the query. A matching system keeps every component. */
export function filterComponentPicks(
  options: ComponentPickerOption[],
  query: string,
): ComponentPickerGroup[] {
  const q = query.trim().toLowerCase();
  const bySystem = new Map<string, ComponentPickerOption[]>();
  for (const option of options) {
    const list = bySystem.get(option.system) ?? [];
    list.push(option);
    bySystem.set(option.system, list);
  }
  const groups: ComponentPickerGroup[] = [];
  const systems = [...bySystem.keys()].sort((a, b) => a.localeCompare(b));
  for (const system of systems) {
    const items = bySystem.get(system) ?? [];
    const matched =
      !q || system.toLowerCase().includes(q)
        ? items
        : items.filter((item) => item.name.toLowerCase().includes(q));
    if (!matched.length) continue;
    groups.push({
      system,
      items: matched.slice().sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return groups;
}

export function componentPickCount(groups: ComponentPickerGroup[]): number {
  return groups.reduce((count, group) => count + group.items.length, 0);
}

export function componentMatchLabel(count: number): string {
  return count === 1 ? "1 match" : `${count} matches`;
}

/** Split text so each case-insensitive hit can be marked. The query is treated as plain text. */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "ig");
  const parts: { text: string; match: boolean }[] = [];
  let last = 0;
  for (const found of text.matchAll(re)) {
    const index = found.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), match: false });
    parts.push({ text: found[0], match: true });
    last = index + found[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts.length ? parts : [{ text, match: false }];
}
