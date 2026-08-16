import type { Briefing, StrictExtractionResult } from "./types";

/** Field brief yang bisa diisi langsung dari hasil pembacaan gambar. */
export function briefTargetFor(field: string, label = ""): keyof Briefing | null {
  const f = `${field} ${label}`.toLowerCase();
  if (/(width|lebar)/.test(f)) return "width_mm";
  if (/(height|tinggi)/.test(f)) return "height_mm";
  if (/(depth|kedalaman|dalam)/.test(f)) return "depth_mm";
  return null;
}

export function countTargetFor(label: string): keyof Briefing | null {
  const l = label.toLowerCase();
  if (/pintu|door/.test(l)) return "doors";
  if (/laci|drawer/.test(l)) return "drawers";
  if (/rak|shelf|shelves/.test(l)) return "shelves";
  return null;
}

/**
 * Kumpulkan HANYA nilai berstatus CONFIRMED_FROM_DRAWING untuk dipakai ke brief.
 * AMBIGUOUS / CONFLICT / NOT_FOUND tidak pernah ikut otomatis.
 */
export function confirmedBriefFromStrict(strict: StrictExtractionResult): Partial<Briefing> {
  const out: Partial<Briefing> = {};
  for (const sec of strict.sections) {
    for (const m of sec.measurements) {
      if (m.status !== "CONFIRMED_FROM_DRAWING" || m.value_mm === null) continue;
      const t = briefTargetFor(m.field, m.label);
      if (t && out[t] === undefined) (out as Record<string, unknown>)[t] = m.value_mm;
    }
    for (const c of sec.counts) {
      if (c.status !== "CONFIRMED_FROM_DRAWING" || c.value === null) continue;
      const t = countTargetFor(c.label);
      if (t && out[t] === undefined) (out as Record<string, unknown>)[t] = c.value;
    }
  }
  return out;
}

/** Ukuran kritis yang wajib ada sebelum hasil ekstraksi boleh dikonfirmasi. */
export function missingCriticalDimensions(brief: Briefing): string[] {
  const missing: string[] = [];
  if (brief.width_mm === null) missing.push("Lebar");
  if (brief.height_mm === null) missing.push("Tinggi");
  if (brief.depth_mm === null) missing.push("Kedalaman");
  return missing;
}

/** Halaman ditampilkan hanya bila gambar benar-benar multi-halaman. */
export function isMultiPage(strict: StrictExtractionResult): boolean {
  const pages = new Set<number>();
  for (const sec of strict.sections) {
    for (const m of sec.measurements) if (m.page) pages.add(m.page);
  }
  for (const p of strict.unreadable_pages) pages.add(p);
  return pages.size > 1 || Array.from(pages).some((p) => p > 1);
}
