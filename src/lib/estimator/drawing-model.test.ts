import { describe, expect, it } from "vitest";

import {
  buildConfirmedSnapshot,
  canonicalizeComponents,
  canonicalizeSnapshot,
  materialStateFromModel,
  modelFromSnapshot,
  updateComponentField,
} from "./drawing-model";
import type {
  ExtractedMeasurement,
  ExtractedSpec,
  StrictExtractionResult,
} from "./types";

const m = (field: string, label: string, value_mm: number): ExtractedMeasurement => ({
  field,
  label,
  raw_value: String(value_mm),
  raw_unit: "mm",
  value_mm,
  source: "dimension_annotation",
  source_text: `${value_mm}`,
  view: "tampak depan",
  page: 1,
  status: "CONFIRMED_FROM_DRAWING",
  confidence: 1,
});

const sp = (field: string, label: string, value: string): ExtractedSpec => ({
  field,
  label,
  value,
  source: "text_note",
  source_text: value,
  status: "CONFIRMED_FROM_DRAWING",
  confidence: 1,
});

/** FIXTURE WAJIB — MEJA KANTOR */
const MEJA_KANTOR: StrictExtractionResult = {
  provider: "test",
  model: "test",
  sections: [
    {
      id: "sec_1",
      name: "Meja Kantor",
      furniture_type: "Meja Kantor",
      furniture_type_confidence: 1,
      measurements: [
        m("overall_width", "Overall panjang", 1600),
        m("overall_depth", "Overall depth", 700),
        m("overall_height", "Overall tinggi", 750),
        m("top_width", "Top meja panjang", 1600),
        m("top_depth", "Top meja depth", 700),
        m("kaki_kiri_h", "Kaki panel kiri tinggi", 714),
        m("kaki_kiri_d", "Kaki panel kiri depth", 650),
        m("kaki_kanan_h", "Kaki panel kanan tinggi", 714),
        m("kaki_kanan_d", "Kaki panel kanan depth", 650),
        m("modesty_w", "Modesty panel panjang", 1500),
        m("modesty_h", "Modesty panel tinggi", 400),
        m("inset", "Inset kaki dari tepi top", 50),
      ],
      counts: [],
      specs: [
        sp("top_material", "Top meja material", "Triplek 18 mm"),
        sp("top_layer", "Top meja layer", "double layer"),
        sp("top_finishing", "Top meja finishing", "HPL permukaan atas"),
        sp("kaki_kiri_material", "Kaki panel kiri material", "Triplek 18 mm"),
        sp("kaki_kiri_finishing", "Kaki panel kiri finishing", "Tanpa HPL"),
        sp("kaki_kanan_material", "Kaki panel kanan material", "Triplek 18 mm"),
        sp("kaki_kanan_finishing", "Kaki panel kanan finishing", "Tanpa HPL"),
        sp("modesty_material", "Modesty panel material", "Triplek 18 mm"),
        sp("modesty_finishing", "Modesty panel finishing", "Tanpa HPL"),
      ],
      relations: [
        "Top menumpu di atas dua kaki panel",
        "Modesty panel berada di antara kaki kiri dan kanan",
      ],
      notes: [],
    },
  ],
  needs_confirmation: [],
  conflicts: [],
  unreadable_pages: [],
  drawing_scale_note: null,
};

const snap = () => buildConfirmedSnapshot(MEJA_KANTOR, { id: "snap_test", now: "2026-01-01" });

describe("confirmed extraction snapshot — Meja Kantor", () => {
  it("menghasilkan 4 komponen terpisah, tidak digabung", () => {
    const s = snap();
    expect(s.components.map((c) => c.name)).toEqual([
      "Top Meja",
      "Kaki Panel Kiri",
      "Kaki Panel Kanan",
      "Modesty Panel",
    ]);
  });

  it("ukuran keseluruhan mirror apa adanya", () => {
    const s = snap();
    expect([s.overall.width_mm.value, s.overall.depth_mm.value, s.overall.height_mm.value]).toEqual([
      1600, 700, 750,
    ]);
  });

  it("dimensi komponen tidak berubah", () => {
    const s = snap();
    const dims = (name: string) =>
      s.components.find((c) => c.name === name)!.dims.map((d) => d.value_mm.value);
    expect(dims("Top Meja")).toEqual([1600, 700]);
    expect(dims("Kaki Panel Kiri")).toEqual([714, 650]);
    expect(dims("Kaki Panel Kanan")).toEqual([714, 650]);
    expect(dims("Modesty Panel")).toEqual([1500, 400]);
  });

  it("top meja: Triplek 18, 2 layer, HPL permukaan atas", () => {
    const top = snap().components[0]!;
    expect(top.material.value).toBe("Triplek 18 mm");
    expect(top.thickness_mm.value).toBe(18);
    expect(top.layers.value).toBe(2);
    expect(top.finishing.value).toBe("HPL permukaan atas");
  });

  it("kaki & modesty tanpa HPL", () => {
    const s = snap();
    for (const name of ["Kaki Panel Kiri", "Kaki Panel Kanan", "Modesty Panel"]) {
      const c = s.components.find((x) => x.name === name)!;
      expect(c.material.value).toBe("Triplek 18 mm");
      expect(c.finishing.value).toBe("Tanpa HPL");
    }
  });

  it("ukuran inset disimpan terpisah, bukan sebagai komponen", () => {
    const s = snap();
    expect(s.otherMeasurements).toEqual([{ label: "Inset kaki dari tepi top", value_mm: 50 }]);
  });
});

describe("mirror 1:1", () => {
  it("snapshot == model == material state", () => {
    const s = snap();
    const model = modelFromSnapshot(s);
    const material = materialStateFromModel(model);
    expect(canonicalizeComponents(model)).toBe(canonicalizeSnapshot(s));
    expect(canonicalizeComponents(material)).toBe(canonicalizeComponents(model));
  });
});

describe("tanpa injeksi default", () => {
  it("edging, hardware, brand/kode HPL, qty tetap kosong", () => {
    for (const c of materialStateFromModel(modelFromSnapshot(snap()))) {
      expect(c.edging.value).toBeNull();
      expect(c.hardware.value).toBeNull();
      expect(c.hplBrand.value).toBeNull();
      expect(c.hplCode.value).toBeNull();
      expect(c.qty.value).toBeNull();
    }
  });

  it("tidak ada material tambahan selain yang tertulis di gambar", () => {
    const materials = new Set(
      snap()
        .components.map((c) => c.material.value)
        .filter((v): v is string => v !== null),
    );
    expect(Array.from(materials)).toEqual(["Triplek 18 mm"]);
  });

  it("tidak membuat komponen frame besi / back panel", () => {
    const names = snap().components.map((c) => c.name.toLowerCase());
    expect(names.some((n) => /besi|frame|back/.test(n))).toBe(false);
  });
});

describe("provenance", () => {
  it("edit user tidak mengubah nilai gambar", () => {
    const c = snap().components[0]!;
    const edited = updateComponentField(c, "material", "Blockboard 18 mm");
    expect(edited.material.value).toBe("Blockboard 18 mm");
    expect(edited.material.source).toBe("USER_EDIT");
    expect(edited.material.drawingValue).toBe("Triplek 18 mm");
    expect(c.material.value).toBe("Triplek 18 mm");
  });

  it("field yang tidak ada di gambar menjadi USER_ADDED", () => {
    const c = snap().components[0]!;
    const edited = updateComponentField(c, "edging", "PVC Edge 1 mm");
    expect(edited.edging.value).toBe("PVC Edge 1 mm");
    expect(edited.edging.source).toBe("USER_ADDED");
    expect(edited.edging.drawingValue).toBeNull();
  });

  it("semua nilai dari gambar bersumber DRAWING", () => {
    const top = snap().components[0]!;
    expect(top.material.source).toBe("DRAWING");
    expect(top.finishing.source).toBe("DRAWING");
    expect(top.dims.every((d) => d.value_mm.source === "DRAWING")).toBe(true);
  });
});
