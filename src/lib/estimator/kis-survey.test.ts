import { describe, expect, it } from "vitest";
import { calculateItem } from "./engine";
import { newFurnitureItem } from "./factory";
import { applySurvey } from "./kis-survey";

describe("jalur otomatis KIS", () => {
  it("meteran 240×85×60 cm tersimpan 2400×850×600 mm tanpa diubah", () => {
    const it0 = applySurvey(newFurnitureItem("Kitchen Set Bawah", "Kitchen Set Bawah"), {
      width: 240, height: 85, depth: 60,
    });
    expect(it0.briefing?.width_mm).toBe(2400);
    expect(it0.briefing?.height_mm).toBe(850);
    expect(it0.briefing?.depth_mm).toBe(600);
    expect(it0.modules.length).toBeGreaterThan(0);
  });

  it("kitchen bawah tidak menghasilkan kabinet atas", () => {
    const it0 = applySurvey(newFurnitureItem("Kitchen Set Bawah", "Kitchen Set Bawah"), {
      width: 240, height: 85, depth: 60,
    });
    expect(it0.modules.some((m) => /atas|upper|wall/i.test(m.name))).toBe(false);
  });

  it("meteran belum lengkap tidak menyusun modul", () => {
    const it0 = applySurvey(newFurnitureItem("Kitchen Set Bawah", "Kitchen Set Bawah"), {
      width: 240, height: null, depth: 60,
    });
    expect(it0.modules).toHaveLength(0);
    expect(it0.confirmedDimensions).toBe(false);
  });

  it("hasil hitung punya BOM", () => {
    const it0 = applySurvey(newFurnitureItem("Kitchen Set Bawah", "Kitchen Set Bawah"), {
      width: 240, height: 85, depth: 60,
    });
    expect(calculateItem(it0).bom.length).toBeGreaterThan(0);
  });
});
