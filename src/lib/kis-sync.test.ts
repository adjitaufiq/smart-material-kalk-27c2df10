import { describe, expect, it } from "vitest";
import { finishExtraLines, kisProjectBom, parseKisSearch, toBase64Url } from "./kis";
import { applyQcToItems } from "./kis-audit";
import { HARDWARE_MASTER } from "./estimator/masters";
import type { BomItem } from "./estimator/types";

const hints = (o: object) => toBase64Url(JSON.stringify(o));

describe("Sinkron 1 jalur KIS → SME", () => {
  it("membaca 3 motif HPL: luar, top table, aksen", () => {
    const d = parseKisSearch({
      projectId: "p",
      jobType: "kitchen_set",
      specHints: hints({ hplOutside: "1205 FC", hplTop: "003 AA", hplAccent: "001 AA", top: "double" }),
    })!;
    expect(d.specHint?.hplOutside?.code).toBe("1205 FC");
    expect(d.specHint?.hplTop?.code).toBe("003 AA");
    expect(d.specHint?.top).toBe("double");
    expect(d.link.finishExtras?.hplAccent?.code).toBe("001 AA");
  });

  it("format array hplMotifs juga terbaca sesuai pemakaian", () => {
    const d = parseKisSearch({
      projectId: "p",
      specHints: hints({ hplMotifs: [{ code: "1205 FC", usage: "kabinet" }, { code: "003 AA", usage: "top table" }, { code: "001 AA", usage: "aksen bingkai" }] }),
    })!;
    expect(d.specHint?.hplOutside?.code).toBe("1205 FC");
    expect(d.specHint?.hplTop?.code).toBe("003 AA");
    expect(d.link.finishExtras?.hplAccent?.code).toBe("001 AA");
  });

  it("HPL aksen 001 AA = 1 lembar × Rp130.000", () => {
    const { add } = finishExtraLines({ hplAccent: { code: "001 AA" } }, [], []);
    const l = add.find((b) => b.id.startsWith("hpl-accent"))!;
    expect(l.qty).toBe(1);
    expect(l.unitPrice).toBe(130000);
  });

  it("tusiran dari KIS menghapus edging PVC dari belanja", () => {
    const edging = { id: "pvc1-white", group: "edging", name: "Edging PVC", qty: 11, unit: "meter", unitPrice: 2500, total: 27500, trace: [], explanation: "" } as BomItem;
    const d = parseKisSearch({ projectId: "p", specHints: hints({ edge: "tusiran" }) })!;
    const bom = kisProjectBom([edging], [], d.link.finishExtras);
    expect(bom.some((b) => b.group === "edging" && b.id === "pvc1-white")).toBe(false);
    expect(bom.some((b) => b.id === "tusir")).toBe(true);
  });

  it("gas spring dari KIS dikenali sebagai hidrolik", () => {
    const d = parseKisSearch({ projectId: "p", specHints: hints({ accessories: [{ id: "gas-spring", qty: 2 }] }) })!;
    expect(d.link.finishExtras?.otherAccessories).toEqual([{ id: "hidrolik", qty: 2 }]);
  });

  it("merk LENAGA & HUBEN diparkir (tidak aktif), tidak dihapus", () => {
    const parked = HARDWARE_MASTER.filter((h) => h.brand === "LENAGA" || h.brand === "HUBEN");
    expect(parked.length).toBeGreaterThan(0);
    expect(parked.every((h) => !h.aktif)).toBe(true);
    expect(HARDWARE_MASTER.filter((h) => h.aktif).some((h) => h.brand === "LENAGA" || h.brand === "HUBEN")).toBe(false);
  });

  it("jumlah pintu & laci hasil scan masuk ke kabinet atas/bawah", () => {
    const b = { doors: null, drawers: null };
    const { items } = applyQcToItems(
      [{ name: "Kitchen Set Bawah", briefing: { ...b } }, { name: "Kitchen Set Atas", briefing: { ...b } }],
      { scannedAt: "", doors: 8, drawers: 3, extra: [], levels: { upper: { doors: 4, drawers: 0 }, lower: { doors: 4, drawers: 3 } } },
    );
    expect(items[0]!.briefing).toEqual({ doors: 4, drawers: 3 });
    expect(items[1]!.briefing).toEqual({ doors: 4, drawers: 0 });
  });
});
