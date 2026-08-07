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
