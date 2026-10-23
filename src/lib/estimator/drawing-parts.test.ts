import { describe, expect, it } from "vitest";
import { drawingField, emptyField, type ConfirmedExtractionSnapshot, type DrawingComponent } from "./drawing-model";
import { modulesFromDrawing, partsFromDrawingComponents } from "./drawing-parts";
import { calculateItem } from "./engine";
import type { FurnitureItem } from "./types";

function comp(name: string, dims: Record<string, number>, extra: Partial<DrawingComponent> = {}): DrawingComponent {
  return {
    id: name, name,
    dims: Object.entries(dims).map(([key, v]) => ({ key, label: key, value_mm: drawingField(v) })),
    qty: emptyField(), thickness_mm: emptyField(), layers: emptyField(), material: emptyField(),
    finishing: emptyField(), hplBrand: emptyField(), hplCode: emptyField(), edging: emptyField(),
    hardware: emptyField(), notes: [], ...extra,
  };
}
function snap(over: [number, number, number] | null, components: DrawingComponent[]): ConfirmedExtractionSnapshot {
  const f = (v: number | undefined) => (v ? drawingField(v) : emptyField<number>());
  return {
    id: "s", created_at: "", furniture_type: "Lemari",
    strict: { sections: [{ counts: [{ label: "Jumlah pintu", value: 4, status: "CONFIRMED_FROM_DRAWING" }], specs: [], measurements: [], relations: [], notes: [] }] } as never,
    overall: { width_mm: f(over?.[0]), height_mm: f(over?.[1]), depth_mm: f(over?.[2]) },
    components, relations: [], generalSpecs: [], otherMeasurements: [], notes: [],
  };
}

describe("gambar kerja -> hitungan", () => {
  it("Meja Kantor: top double layer 1600×700 jadi 2 part plywood 18 mm", () => {
    const top = comp("Top", { width: 1600, depth: 700 }, {
      thickness_mm: drawingField(18), layers: drawingField(2), material: drawingField("Plywood"),
    });
    const { parts } = partsFromDrawingComponents([top]);
    expect(parts.reduce((a, p) => a + p.qty, 0)).toBe(2);
    expect(parts[0]!.length_mm).toBe(1600);
    expect(parts[0]!.width_mm).toBe(700);
    expect(parts[0]!.material_id).toBe("ply18");
  });

  it("gambar tampak lemari 200×240×60 cm 4 pintu jadi modul workshop & lembar triplek > 0", () => {
    const s = snap([2000, 2400, 600], []);
    const modules = modulesFromDrawing(s, "Lemari");
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.reduce((a, m) => a + m.doors * m.qty, 0)).toBe(4);
    const item = { modules, drawingComponents: [], drawingSnapshot: s, wasteFactor: 0.1, sheetMode: "potong" } as unknown as FurnitureItem;
    const r = calculateItem(item);
    expect(r.sheets.reduce((a, x) => a + x.sheets, 0)).toBeGreaterThan(0);
  });

  it("komponen tanpa ukuran lengkap memblokir BOM siap belanja", () => {
    const r = calculateItem({ modules: [], drawingComponents: [comp("Kaki", { height: 750 })], wasteFactor: 0.1, sheetMode: "potong", confirmedConstruction: true, confirmedDimensions: true } as unknown as FurnitureItem);
    expect(r.status).toBe("estimasi_awal");
  });
});
