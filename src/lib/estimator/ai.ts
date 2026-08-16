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
  extract(drawing: DrawingRef): Promise<DrawingExtraction>;
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

export const drawingExtractionService: DrawingExtractionService = {
  available: false,
  providerName: "belum tersambung",
  async extract() {
    throw new AiUnavailableError("AI Vision drawing extraction");
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
