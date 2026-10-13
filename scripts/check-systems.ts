/**
 * System card grouping, subtitle, and the /systems view shape.
 * Run in CI: npm run test:systems
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  groupSystemsByCategory,
  systemCardSubtitle,
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
assert.equal(systemComponentCountLabel(0), "0 components ›");
assert.equal(systemComponentCountLabel(1), "1 component ›");
assert.equal(systemComponentCountLabel(5), "5 components ›");

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
assert.match(view, /Tinted = has an open task on Tasks/);
assert.match(view, /href=\{`\/systems\/\$\{asset\.id\}`\}/);
assert.match(view, /grid-cols-1/);
assert.match(view, /min-\[700px\]:grid-cols-3/);
assert.match(view, /bg-\[#fdf0d5\]/);
assert.match(view, /groupSystemsByCategory/);
assert.match(view, /systemCardSubtitle/);
assert.match(view, /tracking-\[0\.14em\]/);
assert.match(view, /uppercase/);

console.log("systems: cards group by category; open tasks are tinted");
