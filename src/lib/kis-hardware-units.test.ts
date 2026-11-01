import { describe, expect, it } from "vitest";
import { finishExtraLines, parseKisSearch, toBase64Url } from "./kis";
import { calculateHardware } from "./estimator/engine";
import { makeModule } from "./estimator/modules";

const hints = (o: object) => toBase64Url(JSON.stringify(o));

describe("Aturan satuan hardware KIS ⇄ SME", () => {
  it("6 daun pintu standar = 6 set engsel ET-01 × Rp18.000 = Rp108.000", () => {
    const m = { ...makeModule({ kind: "wall_cabinet", name: "Atas", width_mm: 1800, height_mm: 700, depth_mm: 350 }), doors: 6, drawers: 0, hingeId: "engsel-sendok", hingeOverride: 2 };
    const h = calculateHardware([m]).find((b) => b.id === "engsel-sendok")!;
    expect(h.qty).toBe(6);
    expect(h.total).toBe(108000);
  });
  it("3 box laci = 3 set rel laci", () => {
    const m = { ...makeModule({ kind: "drawer_module", name: "Laci", width_mm: 600, height_mm: 700, depth_mm: 550 }), doors: 0, drawers: 3, drawerSlideId: "taco-bbs008sc" };
    const rel = calculateHardware([m]).filter((b) => /rel/i.test(b.name));
    expect(rel.reduce((a, b) => a + b.qty, 0)).toBe(3);
  });
  it("gas spring dari KIS: 4 pcs dicatat 4 pcs", () => {
    const d = parseKisSearch({ projectId: "p", specHints: hints({ accessories: [{ id: "gas-spring", qty: 4 }] }) })!;
    const line = finishExtraLines(d.link.finishExtras, [], []).add.find((b) => b.id === "hidrolik")!;
    expect(line.qty).toBe(4);
    expect(line.unit).toBe("pcs");
  });
  it("kode KIS hardware ET-01 & drawerSlide dt_slowmo terbaca", () => {
    const d = parseKisSearch({ projectId: "p", specHints: hints({ hardware: "ET-01", drawerSlide: "dt_slowmo" }) })!;
    expect(d.specHint?.hinge).toBe("slowmo");
    expect(d.specHint?.slide).toBe("dt_slowmo");
  });
});
