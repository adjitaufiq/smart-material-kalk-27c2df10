import { describe, expect, it } from "vitest";

import { routeExtraction } from "./ai-router";
import { buildConfirmedSnapshot } from "./drawing-model";
import { parseStrictText } from "./extraction.server";
import { createPool } from "./provider-state";
import type { ExtractionRequest } from "./providers/types";

/**
 * SAMPLE GROUND TRUTH (regression only, tidak dipakai di produksi):
 * Meja Kantor 1600x700x750, top plywood 18mm double layer (36mm),
 * kaki kiri/kanan 714x650, modesty 1500x400, HPL hanya top, skala NTS.
 */
const SAMPLE_MODEL_TEXT = "```json\n" +
  JSON.stringify({
    sections: [
      {
        name: "Meja Kantor",
        furniture_type: "Meja Kantor",
        furniture_type_confidence: 1,
        measurements: [
          mm("overall_width", "Overall panjang", 1600),
          mm("overall_depth", "Overall depth", 700),
          mm("overall_height", "Overall tinggi", 750),
          mm("top_width", "Top meja panjang", 1600),
          mm("top_depth", "Top meja depth", 700),
          mm("top_thickness", "Top meja tebal total", 36),
          mm("kaki_kiri_h", "Kaki panel kiri tinggi", 714),
          mm("kaki_kiri_d", "Kaki panel kiri depth", 650),
          mm("kaki_kanan_h", "Kaki panel kanan tinggi", 714),
          mm("kaki_kanan_d", "Kaki panel kanan depth", 650),
          mm("modesty_w", "Modesty panel belakang panjang", 1500),
          mm("modesty_h", "Modesty panel belakang tinggi", 400),
        ],
        counts: [],
        specs: [
          spec("top_material", "Top meja material", "Plywood 18 mm double layer"),
          spec("top_finish", "Top meja finishing", "HPL permukaan atas saja"),
          spec("kaki_finish", "Kaki panel finishing", "Tanpa HPL"),
          spec("modesty_finish", "Modesty panel finishing", "Tanpa HPL"),
        ],
        relations: ["Kaki panel kiri dan kanan menopang top meja"],
        notes: ["Skala NTS"],
      },
    ],
    needs_confirmation: [],
    conflicts: [],
    unreadable_pages: [],
    drawing_scale_note: "NTS",
  }) +
  "\n```";

function mm(field: string, label: string, value: number) {
  return {
    field,
    label,
    raw_value: String(value),
    raw_unit: "mm",
    value_mm: value,
    source: "dimension_annotation",
    source_text: `${value}`,
    view: "tampak depan",
    page: 1,
    status: "CONFIRMED_FROM_DRAWING",
    confidence: 1,
  };
}

function spec(field: string, label: string, value: string) {
  return {
    field,
    label,
    value,
    source: "text_note",
    source_text: value,
    status: "CONFIRMED_FROM_DRAWING",
    confidence: 1,
  };
}

const req: ExtractionRequest = {
  systemPrompt: "sys",
  userText: "user",
  file: {
    name: "meja-kantor.png",
    mime: "image/png",
    dataUrl: "data:image/png;base64,QUJDRA==",
  },
};

function geminiResponse(text: string) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("sample ground truth — meja kantor", () => {
  it("pipeline router -> parse -> snapshot mempertahankan 4 komponen apa adanya", async () => {
    const fetchImpl = (async () => geminiResponse(SAMPLE_MODEL_TEXT)) as never;
    const raw = await routeExtraction(req, {
      env: { GEMINI_API_KEY_1: "k1" },
      fetchImpl,
      pool: createPool(5),
    });

    const strict = parseStrictText(raw);
    expect(strict.provider).toBe("AI Vision");
    expect(strict.sections).toHaveLength(1);
    expect(strict.sections[0]!.furniture_type).toBe("Meja Kantor");

    const snapshot = buildConfirmedSnapshot(strict);
    expect(snapshot.overall.width_mm.value).toBe(1600);
    expect(snapshot.overall.depth_mm.value).toBe(700);
    expect(snapshot.overall.height_mm.value).toBe(750);

    const names = snapshot.components.map((c) => c.name.toLowerCase());
    expect(names.some((n) => n.includes("top"))).toBe(true);
    expect(names.filter((n) => n.includes("kiri"))).toHaveLength(1);
    expect(names.filter((n) => n.includes("kanan"))).toHaveLength(1);
    expect(names.some((n) => n.includes("modesty"))).toBe(true);


    // tidak ada hardware / edging yang dikarang
    for (const comp of snapshot.components) {
      expect(comp.edging.value).toBeNull();
      expect(comp.hplBrand.value).toBeNull();
      expect(comp.hplCode.value).toBeNull();

      expect(comp.hardware.value).toBeNull();
    }
  });

  it("tidak ada nilai selain yang tertulis pada gambar", async () => {
    const strict = parseStrictText(SAMPLE_MODEL_TEXT);
    const values = strict.sections[0]!.measurements.map((x) => x.value_mm);
    expect(values).toEqual([1600, 700, 750, 1600, 700, 36, 714, 650, 714, 650, 1500, 400]);
    expect(strict.sections[0]!.counts).toHaveLength(0);
    expect(strict.conflicts).toEqual([]);
    expect(strict.drawing_scale_note).toBe("NTS");
  });
});
