import type { Unit } from "./types";

const FACTORS: Record<Unit, number> = { mm: 1, cm: 10, m: 1000 };

/** Convert any accepted UI unit into the internal unit (mm). */
export function toMm(value: number, unit: Unit): number {
  if (!Number.isFinite(value)) return NaN;
  return value * FACTORS[unit];
}

export function fromMm(value_mm: number, unit: Unit): number {
  return value_mm / FACTORS[unit];
}

export function mm(value: number): string {
  return `${Math.round(value)} mm`;
}

export function m2(area_mm2: number): number {
  return area_mm2 / 1_000_000;
}

export function meters(length_mm: number): number {
  return Math.round((length_mm / 1000) * 100) / 100;
}

export function rupiah(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Unit default untuk INPUT user (tukang membaca meteran dalam cm). */
export const DEFAULT_INPUT_UNIT: Unit = "cm";

/** Pembulatan display: mm -> unit input, tanpa trailing zero. */
export function displayIn(value_mm: number | null, unit: Unit): string {
  if (value_mm === null || !Number.isFinite(value_mm)) return "";
  const v = fromMm(value_mm, unit);
  return String(Math.round(v * 1000) / 1000);
}

/** "240 × 260 × 60 cm (2400 × 2600 × 600 mm)" */
export function dualDim(w: number, h: number, d: number): string {
  const cm = (v: number) => Math.round((v / 10) * 10) / 10;
  return `${cm(w)} × ${cm(h)} × ${cm(d)} cm (${Math.round(w)} × ${Math.round(h)} × ${Math.round(d)} mm)`;
}

/** "90 × 75 × 60 cm" — tampilan ringkas dalam satuan input (cm). */
export function cmDim(w: number, h: number, d: number): string {
  const cm = (v: number) => Math.round((v / 10) * 10) / 10;
  return `${cm(w)} × ${cm(h)} × ${cm(d)} cm`;
}
