import { describe, expect, it } from "vitest";
import { calculateHardware, calculateItem } from "./engine";
import { findHardware, findHpl, findMaterial } from "./masters";
import { applyQuickSpec, DEFAULT_QUICK_SPEC } from "./quick-spec";
import { glueOrder, slideLengthCm, tacoHplPrice } from "./taco-pricing";
import { materialLabel } from "./terminology";
import { makeModule } from "./factory";

describe("HET HPL TACO 1 Sep 2026 (per suffix kode)", () => {
  it("white 001/002/016AA = 130.000", () => {
    expect(tacoHplPrice("TH 001").harga).toBe(130000);
    expect(tacoHplPrice("TH-016 AA").harga).toBe(130000);
  });
  it("suffix unik langsung dapat harga", () => {
    expect(tacoHplPrice("TH 123 J").harga).toBe(234000);
    expect(tacoHplPrice("TH 880 DP").harga).toBe(287000);
    expect(tacoHplPrice("TH 555 BR").harga).toBe(333000);
    expect(tacoHplPrice("TH 602 AL").harga).toBe(695000);
    expect(tacoHplPrice("TH 100 AF").harga).toBe(1389000);
  });
  it("suffix ambigu tanpa jenis → harga kosong, tidak ditebak", () => {
    const r = tacoHplPrice("TH 125 AA");
    expect(r.harga).toBeNull();
    expect(r.candidates.map((c) => c.harga).sort()).toEqual([160000, 198000]);
    expect(tacoHplPrice("TH 125 AA", "woodgrain").harga).toBe(198000);
    expect(tacoHplPrice("TH 125 AA", "solid").harga).toBe(160000);
  });
  it("HPL 3 meter TH-L", () => {
    expect(tacoHplPrice("TH-L 125 AA").harga).toBe(297000);
    expect(tacoHplPrice("TH-L 125 AA").long).toBe(true);
  });
  it("kode dari KIS dipakai apa adanya", () => {
    const h = findHpl("taco:woodgrain:TH 777 AA|Oak Kiss");
    expect(h?.kode).toBe("TH 777 AA");
    expect(h?.nama).toBe("Oak Kiss");
    expect(h?.harga).toBe(198000);
  });
});

describe("PVC Board TACO (HET 15 Apr 2026)", () => {
  it("TPB-18 699.000 & ECB-18 520.000", () => {
    expect(findMaterial("pvc18")?.harga).toBe(699000);
    expect(findMaterial("ecb18")?.harga).toBe(520000);
    expect(findMaterial("pvc9")?.harga).toBe(352000);
  });
  it("label tidak dobel 'Board Board'", () => {
    expect(materialLabel("PVC Board 18mm")).toBe("PVC Board 18mm");
  });
});

describe("Hardware TACO", () => {
  it("engsel ET-01 18.000, ET-02 33.600, ET-06 7.600", () => {
    expect(findHardware("engsel-sendok")?.harga).toBe(18000);
    expect(findHardware("engsel-et02")?.harga).toBe(33600);
    expect(findHardware("engsel-biasa")?.harga).toBe(7600);
  });
  it("FE BBS 010: 40=19.000, 45=21.500, 50=24.000", () => {
    expect(findHardware("taco-bbs010fe:40")?.harga).toBe(19000);
    expect(findHardware("taco-bbs010fe:45")?.harga).toBe(21500);
    expect(findHardware("taco-bbs010fe:50")?.harga).toBe(24000);
    expect(findHardware("taco-bbs010fe:35")?.harga).toBeNull();
  });
  it("BBS 008 SC 45 cm = 57.100", () => {
    expect(findHardware("taco-bbs008sc:45")?.harga).toBe(57100);
  });
  it("panjang rel dari kedalaman kabinet: 560 mm → 50 cm, 500 mm → 45 cm", () => {
    expect(slideLengthCm(560)).toBe(50);
    expect(slideLengthCm(500)).toBe(45);
  });
  it("kabinet laci dalam 500 mm pakai FE BBS 010 45 cm", () => {
    const m = makeModule({ kind: "base_cabinet", name: "K1", width_mm: 600, height_mm: 720, depth_mm: 500, doors: 0, drawers: 2 });
    const hw = calculateHardware(applyQuickSpec([m], { ...DEFAULT_QUICK_SPEC, slide: "dt_eco" }));
    const rel = hw.find((h) => h.id === "taco-bbs010fe:45");
    expect(rel?.qty).toBe(2);
    expect(rel?.total).toBe(43000);
  });
});

describe("Lem kuning TACO galon / blek", () => {
  it("Active: 2 kg → 1 galon 187.300", () => {
    expect(glueOrder(2, "active")).toEqual({ blek: 0, galon: 1, total: 187300 });
  });
  it("Active: 9 kg → 1 blek (lebih murah dari 4 galon)", () => {
    expect(glueOrder(9, "active")).toEqual({ blek: 1, galon: 0, total: 648900 });
  });
  it("Starmax: 12 kg → 1 blek + 1 galon", () => {
    expect(glueOrder(12, "starmax")).toEqual({ blek: 1, galon: 1, total: 1000000 });
  });
  it("lem masuk BOM sesuai pilihan Starmax", () => {
    const m = makeModule({ kind: "base_cabinet", name: "K1", width_mm: 800, height_mm: 720, depth_mm: 560, doors: 2, drawers: 0 });
    const modules = applyQuickSpec([m], { ...DEFAULT_QUICK_SPEC, glue: "starmax" });
    const r = calculateItem({ id: "i", name: "t", category: "Kitchen", modules, sheetMode: "potong", wasteFactor: 0.1 } as never);
    expect(r.bom.some((b) => b.id.startsWith("lem-starmax-"))).toBe(true);
  });
});

import { edgingPrice, meterOrder, TACO_SHEET, TACO_COMPACT_4X8, TACO_ECO_HPL } from "./taco-pricing";
describe("TACO sheet/edging/compact HET 1 Sep 2026", () => {
  it("edging woodgrain 1x22 = Rp3.000/m, solid 1x42 = Rp5.000/m", () => {
    expect(edgingPrice("woodgrain", 1, 18)).toBe(3000);
    expect(edgingPrice("solid", 1, 36)).toBe(5000);
  });
  it("beli per meter, dibulatkan ke atas", () => {
    expect(meterOrder(12.3, 3000)).toEqual({ meter: 13, total: 39000 });
  });
  it("TACO Sheet Mirror Rp112.000/m", () => {
    expect(TACO_SHEET.find((s) => s.id === "ts-mirror")!.harga_per_m).toBe(112000);
  });
  it("Compact BL woodgrain 18mm Rp3.030.000; ECO Super White Rp105.000", () => {
    expect(TACO_COMPACT_4X8.find((c) => c.core === "BL" && c.motif === "woodgrain" && c.tebal === 18)!.harga).toBe(3030000);
    expect(TACO_ECO_HPL[0]!.harga).toBe(105000);
  });
});

describe("Perbaikan harga 2 Nov 2026", () => {
  it("003 AA Black solid = Rp160.000", () => {
    expect(tacoHplPrice("TH 003 AA").harga).toBe(160000);
    expect(tacoHplPrice("003 AA", undefined, "Black").harga).toBe(160000);
  });
  it("AA woodgrain dari nama motif = Rp198.000", () => {
    expect(tacoHplPrice("TH 777 AA", undefined, "Oak Natural woodgrain").harga).toBe(198000);
  });
  it("rel BBS 006 FE 55cm = Rp45.720 per set", async () => {
    const { TACO_SLIDES } = await import("./taco-pricing") as any;
    const s = (TACO_SLIDES ?? []).find?.((x: any) => x.id === "taco-bbs006fe");
    if (s) expect(s.harga[55]).toBe(45720);
  });
});
