import { readDrawing } from "./extraction.functions";
import type {
  DrawingExtraction,
  DrawingRef,
  ExtractedField,
  GeneratedDesignOption,
  ModuleSpec,
  StrictExtractionResult,
} from "./types";

/**
 * ABSTRAKSI SERVICE AI.
 *
 * TIDAK ADA provider AI yang tersambung pada build ini. Semua method di bawah
 * menolak dengan AiUnavailableError sehingga UI menampilkan state yang benar.
 * JANGAN membuat hasil AI palsu yang terlihat seperti hasil produksi.
 *
 * AI hanya boleh dipakai untuk: extraction gambar, generasi alternatif desain,
 * dan penjelasan. Seluruh angka material tetap dihitung oleh calculation engine.
 */

export class AiUnavailableError extends Error {
  constructor(feature: string) {
    super(
      `${feature} membutuhkan provider AI yang belum tersambung. Gunakan input manual, atau aktifkan integrasi AI terlebih dahulu.`,
    );
    this.name = "AiUnavailableError";
  }
}

export interface DrawingExtractionService {
  readonly available: boolean;
  readonly providerName: string;
  /** Semua file aktif dibaca sebagai satu drawing set. */
  extract(drawings: DrawingRef | DrawingRef[], category?: string): Promise<DrawingExtraction>;
}

export interface DesignGenerationService {
  readonly available: boolean;
  readonly providerName: string;
  generate(input: {
    category: string;
    width_mm: number;
    height_mm: number;
    depth_mm: number;
    notes: string;
  }): Promise<GeneratedDesignOption[]>;
  /** Visual dibuat DARI structured model, bukan sebaliknya. */
  renderConcept(model: ModuleSpec[], description: string): Promise<string>;
}

/** Ringkasan strict result -> field datar untuk validasi engine (tidak menambah nilai baru). */
function flatten(strict: StrictExtractionResult): ExtractedField[] {
  const out: ExtractedField[] = [];
  for (const sec of strict.sections) {
    for (const m of sec.measurements) {
      out.push({
        key: `${sec.id}.${m.field}`,
        label: `${sec.name} — ${m.label}`,
        value: m.value_mm,
        unit: "mm",
        confidence: m.confidence,
        ambiguous: m.status === "AMBIGUOUS" || m.status === "CONFLICT",
        range:
          m.candidates_mm && m.candidates_mm.length > 1
            ? [Math.min(...m.candidates_mm), Math.max(...m.candidates_mm)]
            : undefined,
      });
    }
    for (const c of sec.counts) {
      out.push({
        key: `${sec.id}.count.${c.label}`,
        label: `${sec.name} — ${c.label}`,
        value: c.value,
        confidence: c.confidence,
        ambiguous: c.status === "AMBIGUOUS" || c.status === "CONFLICT",
      });
    }
    for (const s of sec.specs) {
      out.push({
        key: `${sec.id}.spec.${s.field}`,
        label: `${sec.name} — ${s.label}`,
        value: s.value,
        confidence: s.confidence,
        ambiguous: s.status === "AMBIGUOUS" || s.status === "CONFLICT",
      });
    }
  }
  return out;
}

export const drawingExtractionService: DrawingExtractionService = {
  available: true,
  providerName: "AI Vision",
  async extract(drawings: DrawingRef | DrawingRef[], category = ""): Promise<DrawingExtraction> {
    const list = (Array.isArray(drawings) ? drawings : [drawings]).filter((d) => d.dataUrl);
    if (list.length === 0) throw new Error("Isi file gambar tidak tersedia.");
    const strict = (await readDrawing({
      data: {
        files: list.map((d) => ({ name: d.name, mime: d.mime, dataUrl: d.dataUrl })),
        category,
      },
    })) as StrictExtractionResult;
    const normalized = flatten(strict);
    const confident = normalized.filter((f) => f.value !== null);
    return {
      id: `ext_${Date.now().toString(36)}`,
      drawingId: list[0]!.id,
      drawingIds: list.map((d) => d.id),
      provider: strict.provider,
      raw: strict,
      normalized,
      confidence:
        confident.length > 0
          ? confident.reduce((a, f) => a + f.confidence, 0) / confident.length
          : 0,
      warnings: [...strict.needs_confirmation, ...strict.conflicts],
      confirmed_by_user: false,
      confirmed_at: null,
      created_at: new Date().toISOString(),
      strict,
    };
  },
};

export const designGenerationService: DesignGenerationService = {
  available: false,
  providerName: "belum tersambung",
  async generate() {
    throw new AiUnavailableError("AI design generation");
  },
  async renderConcept() {
    throw new AiUnavailableError("AI concept visualization");
  },
};
