import type { DrawingExtraction, DrawingRef } from "./types";

/** File aktif = punya isi (dataUrl), urut sesuai urutan upload. */
export function activeDrawings(drawings: DrawingRef[]): DrawingRef[] {
  return drawings.filter((d) => Boolean(d.dataUrl));
}

/** Identitas duplikat dalam satu item: nama + size + lastModified. */
export function drawingKey(d: {
  name: string;
  size?: number | undefined;
  lastModified?: number | undefined;
}): string {
  return `${d.name}|${d.size ?? "?"}|${d.lastModified ?? "?"}`;
}

export function isDuplicateDrawing(
  existing: DrawingRef[],
  candidate: { name: string; size?: number | undefined; lastModified?: number | undefined },
): boolean {
  const key = drawingKey(candidate);
  return existing.some((d) => drawingKey(d) === key);
}

/**
 * Hasil pembacaan lama dianggap stale bila daftar file aktif berubah
 * (tambah/hapus) dibanding drawing set saat ekstraksi dijalankan.
 */
export function isExtractionStale(
  extraction: DrawingExtraction | null | undefined,
  drawings: DrawingRef[],
): boolean {
  if (!extraction) return false;
  const now = activeDrawings(drawings).map((d) => d.id);
  const then = extraction.drawingIds ?? [extraction.drawingId];
  if (now.length === 0) return true;
  if (now.length !== then.length) return true;
  return now.some((id, i) => id !== then[i]);
}

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileKindLabel(mime: string, name: string): string {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "PDF";
  const ext = lower.split(".").pop() ?? "";
  if (ext) return ext.toUpperCase();
  return mime.split("/").pop()?.toUpperCase() ?? "FILE";
}
