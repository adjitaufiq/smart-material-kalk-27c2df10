import { describe, expect, it } from "vitest";
import { hplZones } from "./kis-audit";
import { parseFinishExtras, hplRef } from "./kis";
import { DEFAULT_QUICK_SPEC } from "./estimator/quick-spec";

const motifs = [
  { code: "TH 1205 FC", usage: "kabinet", name: "Scandinavia Walnut", texture: "woodgrain" },
  { code: "TH 003 AA", usage: "top", name: "Black", texture: "solid" },
  { code: "TH 001 AA", usage: "aksen", name: "Porcelain White", texture: "solid" },
];

describe("zona HPL KIS", () => {
  const ex = parseFinishExtras({ hplMotifs: motifs });
  const base = { ...DEFAULT_QUICK_SPEC, inside: "blockmin" as const, hplOutside: hplRef(motifs[0]), hplTop: hplRef(motifs[1]) };

  it("3 motif = 3 zona, Blockmin putih bukan zona", () => {
    const z = hplZones({ ...base, top: "double" }, ex);
    expect(z.map((m) => m.code)).toEqual(["TH 1205 FC", "TH 003 AA", "TH 001 AA"]);
    expect(z[0]!.texture).toBe("woodgrain");
  });
  it("top granit bukan zona HPL", () => {
    expect(hplZones({ ...base, top: "none", topMaterial: "granite" }, ex)).toHaveLength(2);
  });
  it("duco tidak punya zona HPL kabinet", () => {
    expect(hplZones({ ...base, top: "double", outside: "duco" }, ex).map((m) => m.usage)).toEqual(["top", "aksen"]);
  });
});
