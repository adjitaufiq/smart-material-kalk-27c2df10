import { describe, expect, it } from "vitest";

import {
  confirmedBriefFromStrict,
  isMultiPage,
  missingCriticalDimensions,
} from "./extraction-review";
import { formatSource, friendlyLabel, materialLabel } from "./terminology";
import type { Briefing, ExtractedMeasurement, StrictExtractionResult } from "./types";

const m = (p: Partial<ExtractedMeasurement>): ExtractedMeasurement => ({
  field: "width",
  label: "Lebar",
  raw_value: null,
  raw_unit: null,
  value_mm: null,
  source: "dimension_annotation",
  source_text: null,
  view: null,
  page: null,
  status: "NOT_FOUND",
  confidence: 1,
  ...p,
});

const strict = (measurements: ExtractedMeasurement[]): StrictExtractionResult => ({
  provider: "internal",
  model: "internal",
  sections: [
    {
      id: "s1",
      name: "MEJA KANTOR",
      furniture_type: "Meja Kantor",
      furniture_type_confidence: 1,
      measurements,
      counts: [],
      specs: [],
      relations: [],
      notes: [],
    },
  ],
  needs_confirmation: [],
  conflicts: [],
  unreadable_pages: [],
  drawing_scale_note: null,
});

const emptyBrief: Briefing = {
  width_mm: null,
  height_mm: null,
  depth_mm: null,
  doors: null,
  drawers: null,
  shelves: null,
  doorType: "none",
  notes: "",
};

describe("pakai semua data terbaca", () => {
  it("hanya mengambil CONFIRMED_FROM_DRAWING", () => {
    const out = confirmedBriefFromStrict(
      strict([
        m({ field: "width", value_mm: 1600, status: "CONFIRMED_FROM_DRAWING" }),
        m({ field: "height", label: "Tinggi", value_mm: 750, status: "AMBIGUOUS" }),
      ]),
    );
    expect(out).toEqual({ width_mm: 1600 });
  });

  it("NOT_FOUND / AMBIGUOUS / CONFLICT tidak masuk brief", () => {
    const out = confirmedBriefFromStrict(
      strict([
        m({ field: "width", status: "NOT_FOUND" }),
        m({ field: "height", label: "Tinggi", value_mm: 750, status: "AMBIGUOUS" }),
        m({ field: "depth", label: "Kedalaman", value_mm: 700, status: "CONFLICT" }),
      ]),
    );
    expect(out).toEqual({});
  });

  it("width/depth/height langsung masuk brief", () => {
    const out = confirmedBriefFromStrict(
      strict([
        m({ field: "width", value_mm: 1600, status: "CONFIRMED_FROM_DRAWING" }),
        m({ field: "height", label: "Tinggi", value_mm: 750, status: "CONFIRMED_FROM_DRAWING" }),
        m({ field: "depth", label: "Kedalaman", value_mm: 700, status: "CONFIRMED_FROM_DRAWING" }),
      ]),
    );
    expect(out).toEqual({ width_mm: 1600, height_mm: 750, depth_mm: 700 });
  });
});

describe("konfirmasi diblokir bila ukuran kritis kosong", () => {
  it("melaporkan field yang kurang", () => {
    expect(missingCriticalDimensions(emptyBrief)).toEqual(["Lebar", "Tinggi", "Kedalaman"]);
    expect(
      missingCriticalDimensions({ ...emptyBrief, width_mm: 1600, height_mm: 750, depth_mm: 700 }),
    ).toEqual([]);
  });
});

describe("sumber ringkas", () => {
  it("tidak menampilkan hal. 1 pada gambar satu halaman", () => {
    const s = strict([m({ page: 1, view: "TAMPAK ATAS (TOP VIEW)", source_text: "1600" })]);
    expect(isMultiPage(s)).toBe(false);
    expect(formatSource(s.sections[0]!.measurements[0]!, false)).toBe("Tampak Atas · “1600”");
  });

  it("menampilkan halaman pada gambar multi-halaman", () => {
    const s = strict([m({ page: 3, view: "DETAIL KABINET", source_text: "550" })]);
    expect(isMultiPage(s)).toBe(true);
    expect(formatSource(s.sections[0]!.measurements[0]!, true)).toBe(
      "Hal. 3 · Detail Kabinet · “550”",
    );
  });
});

describe("terminologi material", () => {
  it("plywood → triplek", () => {
    expect(materialLabel("Plywood 18 mm")).toBe("Triplek 18 mm");
  });
  it("blockboard tetap blockboard", () => {
    expect(materialLabel("Blockboard 18 mm")).toBe("Blockboard 18 mm");
  });
  it("mdf tetap mdf", () => {
    expect(materialLabel("MDF 18 mm")).toBe("MDF 18 mm");
  });
  it("multiplex → multipleks", () => {
    expect(materialLabel("Multiplex 18 mm")).toBe("Multipleks 18 mm");
  });
  it("raw text tidak berubah oleh normalisasi", () => {
    const raw = "Plywood 18 mm";
    const normalized = materialLabel(raw);
    expect(raw).toBe("Plywood 18 mm");
    expect(normalized).not.toBe(raw);
  });
  it("label semantik dirapikan", () => {
    expect(friendlyLabel("Jarak Top ke Kaki (Samping)")).toBe("Jarak kaki dari tepi top");
  });
});
