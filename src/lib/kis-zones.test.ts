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

import { parseKisSearch as _pks, toBase64Url as _b64 } from "./kis";
describe("KIS payload bertingkat finishExtras + hplInfo (Adji v2)", () => {
  const payload = {
    body: "blockmin_2s", hardware: "ET-01", drawerSlide: "double_slowmo", edge: "edging", handle: "none",
    topMaterial: "granite", top: "none", hplOutside: "TH 003 AA", hplAccent: "TH 1205 FC",
    hplMotifs: [{ code: "TH 003 AA", usage: "kabinet" }, { code: "TH 1205 FC", usage: "aksen" }],
    hplInfo: { "TH 003 AA": { name: "Solid Black", texture: "Solid Matte" }, "TH 1205 FC": { name: "Scandinavia Walnut", texture: "Woodgrain" } },
    accessories: [{ id: "gas-spring", qty: 4 }],
    finishExtras: { glassDoors: { type: "fluted", qty: null }, gasSprings: { doors: 2, qty: 4, unit: "pcs" }, ledRun: { meters: null }, spotlights: { qty: 0 } },
  };
  const r = _pks({ projectId: "adji", specHints: _b64(JSON.stringify(payload)) })!;
  it("2 motif dengan nama resmi, top granit tanpa HPL", () => {
    expect(r.specHint?.hplOutside).toMatchObject({ code: "TH 003 AA", name: "Solid Black" });
    expect(r.link.finishExtras?.hplAccent).toMatchObject({ code: "TH 1205 FC", name: "Scandinavia Walnut" });
    expect(r.specHint?.top).toBe("none");
    expect(r.specHint?.hplTop).toBeUndefined();
  });
  it("kaca fluted, LED tanpa spot, gas spring 4 pcs, handle 0", () => {
    const f = r.link.finishExtras!;
    expect(f.glass).toBe("fluted");
    expect(f.lighting).toBe("led");
    expect(f.spotQty).toBeUndefined();
    expect(f.handle).toBe("none");
    expect(f.otherAccessories?.find((o) => o.id === "hidrolik")?.qty).toBe(4);
  });
});

import { parseFinishExtras as _pfe } from "./kis";
import { nonWorkshopNotes as _nwn, specCounts as _sc } from "./kis-audit";
describe("SOP KIS: top HPL, bingkai kayu HPL, sorot null", () => {
  const ex = _pfe({ finishExtras: { glassDoors: { type: "fluted", frame: "wood_hpl", hplCode: "TH 001 AA", qty: null }, spotlights: { qty: null } } })!;
  it("frame wood_hpl terbaca + kode aksen", () => {
    expect(ex.glassFrame).toBe("wood_hpl");
    expect(ex.hplAccent?.code).toBe("TH 001 AA");
  });
  it("spotlights qty null → sorot menunggu foto, bukan 0", () => {
    expect(ex.lighting).toBe("spot");
    expect(_sc([], [], ex, null).sorot).toBeNull();
  });
  it("top HPL motif granit tidak masuk non-workshop", () => {
    const ai = { scannedAt: "", doors: null, drawers: null, extra: [], nonWorkshop: ["top granit hitam", "sink"] };
    expect(_nwn(ai, { topMaterial: "hpl" } as never)).toEqual(["sink"]);
  });
});
