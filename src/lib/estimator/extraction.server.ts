import { routeExtraction } from "./ai-router";
import type {
  ExtractedCount,
  ExtractedMeasurement,
  ExtractedSection,
  ExtractedSpec,
  ExtractionSourceKind,
  ExtractionStatus,
  StrictExtractionResult,
} from "./types";

const MODEL = "gemini/lovable-router";

/**
 * STRICT DRAWING READING MODE.
 * AI berperan sebagai PEMBACA gambar kerja, bukan desainer/estimator.
 * Semua nilai WAJIB source-bound. Tidak ada default, tidak ada standar furniture,
 * tidak ada penskalaan visual, tidak ada construction template.
 */
const SYSTEM_PROMPT = `Anda adalah PEMBACA GAMBAR KERJA FURNITURE (drawing reader), BUKAN desainer dan BUKAN estimator.

TUGAS ANDA HANYA:
1. Mengenali jenis furniture yang terlihat pada gambar.
2. Membaca ukuran yang BENAR-BENAR TERTULIS pada gambar (dimension annotation, dimension line berlabel, tabel spesifikasi, catatan teks, title block).
3. Membaca hubungan antar komponen/modul yang terlihat.
4. Membaca material/spesifikasi yang TERTULIS.
5. Menandai informasi yang tidak tersedia atau tidak jelas.

DILARANG KERAS (pelanggaran = jawaban salah):
- membuat/menebak/memperkirakan ukuran;
- memakai ukuran default atau standar furniture (mis. tinggi 2000, depth 600, tebal 18mm);
- menghitung ukuran dari proporsi/skala visual bila tidak ada anotasi angka;
- membuat jumlah pintu/laci/rak/modul yang tidak terlihat atau tidak tertulis;
- mengarang material, ketebalan plywood, HPL, edging, atau hardware;
- mengganti angka yang terbaca dengan angka yang "lebih umum" atau dibulatkan;
- mengisi field kosong dengan tebakan.

ATURAN NILAI:
- Setiap nilai WAJIB punya source: dimension_annotation | dimension_line | text_note | spec_table | title_block | callout | not_available, beserta kutipan teks aslinya (source_text) apa adanya.
- Tidak ada anotasi -> value null, status "NOT_FOUND", source "not_available".
- Angka buram/terpotong/dobel/tidak yakin -> status "AMBIGUOUS", isi candidates_mm bila ada beberapa kemungkinan, value_mm tetap null.
- Dua nilai berbeda untuk komponen yang sama (antar view/halaman) -> status "CONFLICT", laporkan keduanya di candidates_mm dan di conflicts.
- Angka jelas tertulis -> status "CONFIRMED_FROM_DRAWING", value_mm dikonversi ke MILIMETER (mm) apa adanya tanpa pembulatan yang mengubah nilai (m -> x1000, cm -> x10).
- Jenis furniture tidak jelas -> furniture_type "TIDAK_DIKETAHUI".
- Bila gambar punya beberapa unit/area/modul, buat satu section per unit sesuai penamaan pada gambar.

KELUARAN: HANYA JSON valid (tanpa markdown, tanpa penjelasan) dengan bentuk:
{
  "sections": [{
    "name": string,
    "furniture_type": string,
    "furniture_type_confidence": number,
    "measurements": [{"field": string, "label": string, "raw_value": string|null, "raw_unit": string|null, "value_mm": number|null, "source": string, "source_text": string|null, "view": string|null, "page": number|null, "status": string, "confidence": number, "candidates_mm": number[]|null, "note": string|null}],
    "counts": [{"label": string, "value": number|null, "source": string, "source_text": string|null, "status": string, "confidence": number}],
    "specs": [{"field": string, "label": string, "value": string|null, "source": string, "source_text": string|null, "status": string, "confidence": number}],
    "relations": string[],
    "notes": string[]
  }],
  "needs_confirmation": string[],
  "conflicts": string[],
  "unreadable_pages": number[],
  "drawing_scale_note": string|null
}

PRIORITAS: TIDAK MENGARANG UKURAN lebih penting daripada kelengkapan hasil.`;

const SOURCES: ExtractionSourceKind[] = [
  "dimension_annotation",
  "dimension_line",
  "text_note",
  "spec_table",
  "title_block",
  "callout",
  "not_available",
];
const STATUSES: ExtractionStatus[] = [
  "CONFIRMED_FROM_DRAWING",
  "AMBIGUOUS",
  "CONFLICT",
  "NOT_FOUND",
];

const asSource = (v: unknown): ExtractionSourceKind =>
  SOURCES.includes(v as ExtractionSourceKind) ? (v as ExtractionSourceKind) : "not_available";

const asStatus = (v: unknown): ExtractionStatus =>
  STATUSES.includes(v as ExtractionStatus) ? (v as ExtractionStatus) : "NOT_FOUND";

const asNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const asStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

const conf = (v: unknown): number => {
  const n = asNum(v);
  if (n === null) return 0;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
};

/** Sanitasi keras: nilai hanya dipertahankan bila status CONFIRMED_FROM_DRAWING. */
function normalizeMeasurement(raw: Record<string, unknown>, i: number): ExtractedMeasurement {
  const status = asStatus(raw["status"]);
  const value = status === "CONFIRMED_FROM_DRAWING" ? asNum(raw["value_mm"]) : null;
  const candidates = Array.isArray(raw["candidates_mm"])
    ? (raw["candidates_mm"] as unknown[]).map(asNum).filter((n): n is number => n !== null)
    : undefined;
  return {
    field: asStr(raw["field"]) ?? `field_${i + 1}`,
    label: asStr(raw["label"]) ?? asStr(raw["field"]) ?? `Ukuran ${i + 1}`,
    raw_value: asStr(raw["raw_value"]),
    raw_unit: asStr(raw["raw_unit"]),
    value_mm: value,
    source: value === null ? asSource(raw["source"]) : asSource(raw["source"]),
    source_text: asStr(raw["source_text"]),
    view: asStr(raw["view"]),
    page: asNum(raw["page"]),
    status: value === null && status === "CONFIRMED_FROM_DRAWING" ? "NOT_FOUND" : status,
    confidence: conf(raw["confidence"]),
    candidates_mm: candidates && candidates.length > 0 ? candidates : undefined,
    note: asStr(raw["note"]) ?? undefined,
  };
}

function normalizeCount(raw: Record<string, unknown>, i: number): ExtractedCount {
  const status = asStatus(raw["status"]);
  const value = status === "CONFIRMED_FROM_DRAWING" ? asNum(raw["value"]) : null;
  return {
    label: asStr(raw["label"]) ?? `Jumlah ${i + 1}`,
    value,
    source: asSource(raw["source"]),
    source_text: asStr(raw["source_text"]),
    status: value === null && status === "CONFIRMED_FROM_DRAWING" ? "NOT_FOUND" : status,
    confidence: conf(raw["confidence"]),
  };
}

function normalizeSpec(raw: Record<string, unknown>, i: number): ExtractedSpec {
  const status = asStatus(raw["status"]);
  const value = status === "CONFIRMED_FROM_DRAWING" ? asStr(raw["value"]) : null;
  return {
    field: asStr(raw["field"]) ?? `spec_${i + 1}`,
    label: asStr(raw["label"]) ?? `Spesifikasi ${i + 1}`,
    value,
    source: asSource(raw["source"]),
    source_text: asStr(raw["source_text"]),
    status: value === null && status === "CONFIRMED_FROM_DRAWING" ? "NOT_FOUND" : status,
    confidence: conf(raw["confidence"]),
  };
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(asStr).filter((s): s is string => s !== null) : [];
}

export function normalizeStrictResult(parsed: unknown): StrictExtractionResult {
  const root = (parsed ?? {}) as Record<string, unknown>;
  const rawSections = Array.isArray(root["sections"]) ? root["sections"] : [];
  const sections: ExtractedSection[] = rawSections.map((s, idx) => {
    const sec = (s ?? {}) as Record<string, unknown>;
    const arr = (k: string) => (Array.isArray(sec[k]) ? (sec[k] as unknown[]) : []);
    return {
      id: `sec_${idx + 1}`,
      name: asStr(sec["name"]) ?? `Unit ${idx + 1}`,
      furniture_type: asStr(sec["furniture_type"]) ?? "TIDAK_DIKETAHUI",
      furniture_type_confidence: conf(sec["furniture_type_confidence"]),
      measurements: arr("measurements").map((m, i) =>
        normalizeMeasurement((m ?? {}) as Record<string, unknown>, i),
      ),
      counts: arr("counts").map((c, i) => normalizeCount((c ?? {}) as Record<string, unknown>, i)),
      specs: arr("specs").map((c, i) => normalizeSpec((c ?? {}) as Record<string, unknown>, i)),
      relations: strArray(sec["relations"]),
      notes: strArray(sec["notes"]),
    };
  });

  const auto: string[] = [];
  for (const sec of sections) {
    for (const m of sec.measurements) {
      if (m.status !== "CONFIRMED_FROM_DRAWING") {
        auto.push(`${sec.name} — ${m.label}: ${statusLabel(m.status)}`);
      }
    }
    for (const c of sec.counts) {
      if (c.status !== "CONFIRMED_FROM_DRAWING") {
        auto.push(`${sec.name} — ${c.label}: ${statusLabel(c.status)}`);
      }
    }
    for (const s of sec.specs) {
      if (s.status !== "CONFIRMED_FROM_DRAWING") {
        auto.push(`${sec.name} — ${s.label}: ${statusLabel(s.status)}`);
      }
    }
    if (sec.furniture_type === "TIDAK_DIKETAHUI") {
      auto.push(`${sec.name} — jenis furniture tidak dapat dipastikan dari gambar`);
    }
  }

  return {
    provider: "Lovable AI Gateway",
    model: MODEL,
    sections,
    needs_confirmation: Array.from(new Set([...strArray(root["needs_confirmation"]), ...auto])),
    conflicts: strArray(root["conflicts"]),
    unreadable_pages: Array.isArray(root["unreadable_pages"])
      ? (root["unreadable_pages"] as unknown[]).map(asNum).filter((n): n is number => n !== null)
      : [],
    drawing_scale_note: asStr(root["drawing_scale_note"]),
  };
}

function statusLabel(s: ExtractionStatus): string {
  switch (s) {
    case "AMBIGUOUS":
      return "tidak terbaca jelas";
    case "CONFLICT":
      return "ada nilai bertentangan pada gambar";
    case "NOT_FOUND":
      return "tidak ada di gambar";
    default:
      return "";
  }
}

export async function readDrawingStrict(input: {
  name: string;
  mime: string;
  dataUrl: string;
  category: string;
}): Promise<StrictExtractionResult> {
  const text = await routeExtraction({
    systemPrompt: SYSTEM_PROMPT,
    userText: `Baca gambar kerja berikut. Konteks kategori dari user (JANGAN dipakai untuk mengisi ukuran, hanya konteks): "${input.category}". Kembalikan JSON sesuai skema.`,
    file: { name: input.name, mime: input.mime, dataUrl: input.dataUrl },
  });

  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Hasil pembacaan gambar tidak dapat diproses.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error("Hasil pembacaan gambar tidak dapat diproses.");
  }
  return normalizeStrictResult(parsed);
}

