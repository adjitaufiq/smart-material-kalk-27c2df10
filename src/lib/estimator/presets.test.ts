import { describe, expect, it } from "vitest";
import { composeModules, kitchenPart } from "./factory";
import { itemsFromSelections } from "./presets";

const brief = { width_mm: 2400, height_mm: 850, depth_mm: 600, doors: 4, drawers: 2, shelves: 2, doorType: "swing" as const };

describe("work presets", () => {
  it("kitchen single line bawah+atas = 2 items", () => {
    const items = itemsFromSelections([{ presetId: "kitchen", options: ["bawah", "atas"], shape: "single" }]);
    expect(items.map((i) => i.name)).toEqual(["Kitchen Set Bawah", "Kitchen Set Atas"]);
  });

  it("kitchen L bawah+atas = 4 items", () => {
    const items = itemsFromSelections([{ presetId: "kitchen", options: ["bawah", "atas"], shape: "L" }]);
    expect(items).toHaveLength(4);
    expect(items[1].name).toBe("Kitchen Set Bawah - Sayap L");
    expect(kitchenPart(items[1].category)).toBe("bawah");
    expect(kitchenPart(items[3].category)).toBe("atas");
  });

  it("bawah item never gets wall cabinets, even if category is generic", () => {
    const mods = composeModules("Kitchen Set", brief, "Kitchenset bawah");
    expect(mods.some((m) => m.kind === "wall_cabinet")).toBe(false);
  });

  it("kamar tidur creates 2 nakas", () => {
    const items = itemsFromSelections([{ presetId: "kamar", options: ["divan", "nakas"] }]);
    expect(items.map((i) => i.name)).toEqual(["Divan / Tempat Tidur", "Nakas Kiri", "Nakas Kanan"]);
  });
});
