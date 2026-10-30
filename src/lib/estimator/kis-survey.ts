/**
 * Jalur otomatis KIS: workshop hanya isi meteran aktual (cm),
 * modul + spek KIS disusun otomatis. Ukuran user tetap source of truth.
 */
import { composeModules, resolveBrief } from "./factory";
import { applyQuickSpec, DEFAULT_QUICK_SPEC } from "./quick-spec";
import type { FurnitureItem } from "./types";

export interface SurveyCm {
  width: number | null;
  height: number | null;
  depth: number | null;
}

export function surveyComplete(s: SurveyCm): boolean {
  return [s.width, s.height, s.depth].every((v) => typeof v === "number" && v > 0);
}

export function surveyOf(item: FurnitureItem): SurveyCm {
  const b = item.briefing;
  const cm = (v: number | null | undefined) => (v ? v / 10 : null);
  return { width: cm(b?.width_mm), height: cm(b?.height_mm), depth: cm(b?.depth_mm) };
}

/** Terapkan meteran (cm) -> briefing mm, modul tersusun, spek KIS diterapkan. */
export function applySurvey(item: FurnitureItem, s: SurveyCm): FurnitureItem {
  const mm = (v: number | null) => (v && v > 0 ? Math.round(v * 10) : null);
  const briefing = {
    doors: null,
    drawers: null,
    shelves: null,
    doorType: "swing" as const,
    notes: "",
    ...item.briefing,
    width_mm: mm(s.width),
    height_mm: mm(s.height),
    depth_mm: mm(s.depth),
  };
  if (!surveyComplete(s)) return { ...item, briefing, modules: [], confirmedDimensions: false };
  const spec = item.quickSpec ?? item.quickSpecHint ?? DEFAULT_QUICK_SPEC;
  const modules = applyQuickSpec(composeModules(item.category, resolveBrief(briefing), item.name), spec);
  return {
    ...item,
    briefing,
    hasDrawing: false,
    modules,
    quickSpec: spec,
    confirmedDimensions: true,
    confirmedConstruction: true,
  };
}
