/**
 * System card grouping, subtitle, and the /systems view shape.
 * Run in CI: npm run test:systems
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  componentBubbleBadge,
  componentBubbleLine,
  componentMatchesFilter,
} from "../src/lib/component-bubbles";
import {
  groupSystemsByCategory,
  systemCardLocation,
  systemCardSubtitle,
  systemMatchesSearch,
  systemComponentCountLabel,
  systemIdsWithOpenTasks,
} from "../src/lib/system-cards";

assert.equal(
  systemCardSubtitle({
    notes: "Refrigeration",
    components: [{ location: "Barn" }],
  }),
  "Refrigeration · Barn",
);
assert.equal(
  systemCardSubtitle({
    notes: "",
    components: [{ manufacturer: "John Deere", modelNumber: "5075E", location: "Equipment shed" }],
  }),
  "John Deere 5075E · Equipment shed",
);
assert.equal(
  systemCardSubtitle({
    notes: "Propane · Greenhouse",
    components: [],
  }),
  "Propane · Greenhouse",
);
assert.equal(
  systemCardSubtitle({
    notes: "Standby 22kW",
    components: [
      { location: "Behind house" },
      { location: "Behind house" },
    ],
  }),
  "Standby 22kW · Behind house",
);
assert.equal(
  systemCardSubtitle({
    notes: "Drip lines",
    components: [{ location: "Lower field" }, { location: "Upper field" }],
  }),
  "Drip lines",
);
assert.equal(
  systemCardSubtitle({
    notes: "",
    components: [{ location: "", manufacturer: "", modelNumber: "" }],
  }),
  "",
);
assert.equal(systemComponentCountLabel(0), "0 components");
assert.equal(systemComponentCountLabel(1), "1 component");
assert.equal(systemComponentCountLabel(5), "5 components");

assert.equal(
  systemCardLocation({ components: [{ location: "  Pond  " }] }),
  "Pond",
);
assert.equal(
  systemCardLocation({
    components: [
      { location: "Barn kitchen" },
      { location: "Barn kitchen" },
      { location: "Main house" },
    ],
  }),
  "Barn kitchen",
);
assert.equal(
  systemCardLocation({
    components: [{ location: "Barn kitchen" }, { location: "Main house" }],
  }),
  "Multiple locations",
);
assert.equal(
  systemCardLocation({
    components: [{ location: "" }, { location: null }, {}],
  }),
  "",
);

const hvac = {
  name: "HVAC",
  components: [
    { name: "Furnace", location: "Main house" },
    { name: "Filter", location: "Root cellar" },
  ],
};
const tractor = {
  name: "Tractor",
  components: [{ name: "Engine", location: "Equipment shed" }],
};
assert.equal(systemMatchesSearch(hvac, "Other", "furnace"), true);
assert.equal(systemMatchesSearch(tractor, "Other", "furnace"), false);
assert.equal(systemMatchesSearch(hvac, "Other", "root"), true);
assert.equal(systemMatchesSearch(hvac, "Other", "HVAC"), true);
assert.equal(systemMatchesSearch(tractor, "Other", "other"), true);
assert.equal(systemMatchesSearch(tractor, "Other", "   "), true);

const groups = groupSystemsByCategory([
  { name: "Well pump", category: "Water" },
  { name: "Tractor", category: "Farm Equipment" },
  { name: "Walk-in cooler", category: "Appliance" },
  { name: "Irrigation", category: "Water" },
  { name: "Greenhouse heater", category: "HVAC" },
]);
assert.deepEqual(
  groups.map((group) => group.category),
  ["Culinary", "Farm Equipment", "HVAC", "Water"],
);
assert.deepEqual(
  groups.find((group) => group.category === "Water")?.systems.map((system) => system.name),
  ["Irrigation", "Well pump"],
);
assert.equal(
  groupSystemsByCategory([]).length,
  0,
);

const open = systemIdsWithOpenTasks(
  [
    { id: "tractor", components: [{ id: "engine" }, { id: "tires" }] },
    { id: "well", components: [{ id: "pump" }] },
  ],
  [
    { componentId: "tires" },
    { componentId: null, component: { id: "pump", system: { id: "well" } } },
    { componentId: "missing" },
    { component: { system: { id: "other" } } },
  ],
);
assert.deepEqual([...open].sort(), ["tractor", "well"]);

const root = join(import.meta.dirname, "..");
const view = readFileSync(join(root, "src/components/farm/systems-list.tsx"), "utf8");
assert.doesNotMatch(view, /<table\b/);
assert.doesNotMatch(view, /overdue/);
assert.doesNotMatch(view, /open ›/);
assert.doesNotMatch(view, /Components:/);
assert.match(view, /Amber = has an open task/);
assert.doesNotMatch(view, /Tinted = has an open task on Tasks/);
assert.match(view, /href=\{`\/systems\/\$\{asset\.id\}`\}/);
assert.match(view, /flex flex-wrap items-start gap-2\.5/);
assert.doesNotMatch(view, /grid-cols-2/);
assert.doesNotMatch(view, /minmax\(168px,1fr\)/);
assert.doesNotMatch(view, /systemCardLocation/);
assert.doesNotMatch(view, /systemComponentCountLabel/);
assert.doesNotMatch(view, /searchOpen/);
assert.doesNotMatch(view, /truncate/);
assert.doesNotMatch(view, /systemCardSubtitle/);
assert.doesNotMatch(view, /›/);
assert.match(view, /bg-\[#fdf0d5\]/);
assert.match(view, /border-\[#e6dcc8\]/);
assert.match(view, /groupSystemsByCategory/);
assert.match(view, /systemMatchesSearch/);
assert.match(view, /aria-label="Search systems"/);
assert.match(view, /aria-label="Clear search"/);
assert.doesNotMatch(view, /Close search/);
assert.match(view, /Search systems, components, locations/);
assert.match(view, /No systems match/);
assert.match(view, /No systems yet/);
assert.match(view, /event\.key === "Escape"/);
assert.match(view, /min-h-\[46px\]/);
assert.match(view, /rounded-3xl/);
assert.match(view, /overflow-wrap:anywhere/);
assert.match(view, /tracking-\[0\.14em\]/);
assert.match(view, /uppercase/);
assert.doesNotMatch(view, /border-b/);
const systemsPage = readFileSync(join(root, "src/app/(app)/(farm)/systems/page.tsx"), "utf8");
assert.match(systemsPage, /pb-28/);
assert.match(systemsPage, /max-w-\[960px\]/);

assert.equal(componentBubbleLine("7043", "Equipment shed"), "7043 · Equipment shed");
assert.equal(componentBubbleLine("  ", "Barn"), "Barn");
assert.equal(componentBubbleLine("", "  "), "");
assert.equal(
  componentMatchesFilter(
    { name: "Battery", location: "Shed", modelNumber: "26R", vendorName: "Shenandoah" },
    "shen",
  ),
  true,
);
assert.equal(
  componentMatchesFilter({ name: "Battery", modelNumber: "26R" }, "26r"),
  true,
);
assert.equal(componentMatchesFilter({ name: "Battery" }, "propane"), false);
assert.equal(componentMatchesFilter({ name: "Battery" }, "   "), true);

const badgeNow = new Date("2026-10-14T16:00:00Z");
assert.deepEqual(
  componentBubbleBadge(
    [
      { kind: "schedule", due: "2026-10-01" },
      { kind: "task", due: "2026-10-10" },
    ],
    badgeNow,
  ),
  { text: "Overdue Oct 1", tone: "overdue" },
);
assert.deepEqual(
  componentBubbleBadge([{ kind: "task", due: "2026-10-10" }], badgeNow),
  { text: "Task overdue", tone: "overdue" },
);
assert.deepEqual(
  componentBubbleBadge([{ kind: "schedule", due: "2026-10-20" }], badgeNow),
  { text: "Due Oct 20", tone: "soon" },
);
assert.equal(
  componentBubbleBadge([{ kind: "schedule", due: "2026-12-01" }], badgeNow),
  null,
);
assert.equal(componentBubbleBadge([{ kind: "task", due: null }], badgeNow), null);

const detail = readFileSync(join(root, "src/components/farm/system-detail.tsx"), "utf8");
const list = readFileSync(join(root, "src/components/farm/ComponentsList.tsx"), "utf8");
const types = readFileSync(join(root, "src/lib/farm-types.ts"), "utf8");
assert.match(detail, /‹ Systems/);
assert.match(detail, /Delete system…/);
assert.match(detail, /mode="read"/);
assert.match(detail, /plain/);
const fields = readFileSync(join(root, "src/components/farm/AssetFormFields.tsx"), "utf8");
assert.match(fields, /Location, model, vendor, warranty and costs live on each component./);
assert.match(detail, /mode="edit"/);
assert.match(detail, /System notes/);
assert.doesNotMatch(detail, /Purchase total/);
assert.doesNotMatch(detail, /Replacement total/);
assert.doesNotMatch(detail, /systemPurchaseTotal/);
assert.doesNotMatch(detail, /Duplicate system/);
assert.match(list, /Find a component/);
assert.match(list, /Edit component/);
assert.match(list, /No components match/);
assert.match(list, /components\.length > 4/);
assert.match(list, /min-\[900px\]:grid-cols-2/);
assert.match(list, /componentBubbleBadge/);
assert.doesNotMatch(list, /ChevronRight/);
assert.doesNotMatch(list, /PartRowMenu/);
assert.match(list, /BOARD_STATUSES/);
assert.match(list, /OPEN_TASK_STATUSES\.has\(task\.status\)/);
assert.match(list, /break-words text-sm font-semibold/);
assert.doesNotMatch(list, /truncate text-sm font-semibold/);
assert.match(types, /function systemPurchaseTotal/);
assert.match(types, /function systemReplacementTotal/);

console.log("systems: cards group by category; open tasks are tinted");
