/**
 * MASTER HARGA TACO (sumber resmi dari user — TACO Relationship Officer).
 * - HPL, TACO Sheet, Edging: HET PT. Tangkas Cipta Optimal, 1 Sep 2026.
 * - PVC Board TPB / ECO PVC Board ECB: HET 15 Apr 2026.
 * - Engsel, rel laci, lem: harga TACO Official Partner (Tokopedia) Okt 2026.
 * Harga HPL dibaca dari SUFFIX kode (mis. "TH 002 AA" → AA). Bila suffix
 * dipakai di >1 grup harga & kategori tidak diketahui → harga null (perlu konfirmasi),
 * TIDAK ditebak.
 */
import type { GrainDirection, HplMaster } from "./types";

export const TACO_HET_DATE = "1 Sep 2026";
export const TACO_PVC_HET_DATE = "15 Apr 2026";

export type HplGroup = "white" | "solid" | "woodgrain" | "ultimate" | "long";

interface HplTier {
  group: HplGroup;
  label: string;
  suffixes: string[];
  harga: number;
}

/** TACO HPL 4×8 (1220 × 2440). */
export const TACO_HPL_TIERS: HplTier[] = [
  { group: "solid", label: "Solid Color AA", suffixes: ["AA"], harga: 160000 },
  { group: "solid", label: "Solid Color AB / SA", suffixes: ["AB", "SA"], harga: 170000 },
  { group: "solid", label: "Solid Color G / D / DB / SB", suffixes: ["G", "D", "DB", "SB"], harga: 210000 },
  { group: "woodgrain", label: "Woodgrain AA / B / H / AC", suffixes: ["AA", "B", "H", "AC"], harga: 198000 },
  { group: "woodgrain", label: "Woodgrain / Pattern J / FC / NT", suffixes: ["J", "FC", "NT"], harga: 234000 },
  { group: "woodgrain", label: "Woodgrain / Pattern GL / JG / DP", suffixes: ["GL", "JG", "DP"], harga: 287000 },
  {
    group: "woodgrain",
    label: "Woodgrain / Pattern FA, KY, KM, LU, RE, SL, TM, NA, BR",
    suffixes: ["FA", "KY", "KM", "LU", "RE", "SL", "TM", "NA", "BR"],
    harga: 333000,
  },
  { group: "solid", label: "Solid Core CR", suffixes: ["CR"], harga: 579000 },
  { group: "solid", label: "Glossy Core CRG", suffixes: ["CRG"], harga: 591000 },
  {
    group: "ultimate",
    label: "Ultimate SU, CM, DM, TR, VA, VB, VC, VD",
    suffixes: ["SU", "CM", "DM", "TR", "VA", "VB", "VC", "VD"],
    harga: 418000,
  },
  { group: "ultimate", label: "Ultimate G, ST, SA, PA", suffixes: ["G", "ST", "SA", "PA"], harga: 487000 },
  { group: "ultimate", label: "Ultimate Clean Touch AF", suffixes: ["AF"], harga: 1389000 },
  { group: "ultimate", label: "Ultimate Metallics MA, MB, MR, MC", suffixes: ["MA", "MB", "MR", "MC"], harga: 1829000 },
];

/** TACO HPL 3 meter (kode TH-Lxxxxx). */
export const TACO_LONG_HPL_TIERS: HplTier[] = [
  { group: "long", label: "Long HPL AB / SA", suffixes: ["AB", "SA"], harga: 257000 },
  { group: "long", label: "Long HPL AA / AC", suffixes: ["AA", "AC"], harga: 297000 },
  { group: "long", label: "Long HPL J / NT", suffixes: ["J", "NT"], harga: 348000 },
  { group: "long", label: "Long HPL DP", suffixes: ["DP"], harga: 413000 },
  { group: "long", label: "Long HPL BR / NA", suffixes: ["BR", "NA"], harga: 479000 },
];

const WHITE_NUMBERS = new Set(["001", "002", "016"]);
const SPECIAL_CODES: Record<string, { label: string; harga: number }> = {
  "602AL": { label: "Aluminium TH 602 AL", harga: 695000 },
  "611AL": { label: "Aluminium TH 611 AL", harga: 753000 },
  "8001ME": { label: "Metallics 8001-ME", harga: 881000 },
  "8008ME": { label: "Metallics 8008-ME", harga: 1123000 },
};

export interface HplPriceResult {
  harga: number | null;
  label: string;
  /** kandidat harga bila suffix ambigu */
  candidates: { label: string; harga: number }[];
  long: boolean;
}

/** Pecah kode TACO: "TH 002 AA" → { num: "002", suffix: "AA", long: false } */
export function parseTacoCode(code: string): { num: string; suffix: string; long: boolean } | null {
  const c = code.toUpperCase().replace(/TACO/g, "").replace(/[\s._-]+/g, "");
  const m = /^TH(L)?(\d{3,5})([A-Z]{0,3})$/.exec(c) ?? /^(L)?(\d{3,5})([A-Z]{0,3})$/.exec(c);
  if (!m) return null;
  return { long: !!m[1], num: m[2] ?? "", suffix: m[3] ?? "" };
}

export function tacoHplPrice(code: string, group?: HplGroup): HplPriceResult {
  const none: HplPriceResult = { harga: null, label: "Kode HPL tidak dikenali", candidates: [], long: false };
  const p = parseTacoCode(code);
  if (!p) return none;
  const special = SPECIAL_CODES[`${p.num}${p.suffix}`];
  if (special) return { harga: special.harga, label: special.label, candidates: [], long: false };
  if (!p.long && WHITE_NUMBERS.has(p.num) && (p.suffix === "" || p.suffix === "AA")) {
    return { harga: 130000, label: "White 001 / 002 / 016AA", candidates: [], long: false };
  }
  const tiers = p.long ? TACO_LONG_HPL_TIERS : TACO_HPL_TIERS;
  let hits = tiers.filter((t) => t.suffixes.includes(p.suffix));
  if (group && hits.length > 1) {
    const g = hits.filter((t) => t.group === group);
    if (g.length) hits = g;
  }
  if (hits.length === 1) {
    const h = hits[0]!;
    return { harga: h.harga, label: h.label, candidates: [], long: p.long };
  }
  if (hits.length === 0) return { ...none, long: p.long, label: `Suffix "${p.suffix}" tidak ada di HET` };
  return {
    harga: null,
    label: `Suffix ${p.suffix} ada di ${hits.length} grup harga — pilih jenis (solid/woodgrain/ultimate)`,
    candidates: hits.map((h) => ({ label: h.label, harga: h.harga })),
    long: p.long,
  };
}

/** Bangun HplMaster dinamis dari kode TACO apa pun yang dikirim KIS/workshop. */
export function tacoHplMaster(code: string, opts: { nama?: string; group?: HplGroup; grain?: GrainDirection } = {}): HplMaster {
  const r = tacoHplPrice(code, opts.group);
  const grain: GrainDirection =
    opts.grain ?? (opts.group === "woodgrain" || opts.group === "long" ? "length" : "none");
  return {
    id: tacoHplId(code, opts.group),
    brand: "TACO",
    kode: code.trim().toUpperCase(),
    nama: opts.nama?.trim() || r.label,
    panjang_mm: r.long ? 3000 : 2440,
    lebar_mm: 1220,
    arah_serat: grain,
    harga: r.harga,
    aktif: true,
  };
}

/** ID dinamis: "taco:TH 002 AA" atau "taco:woodgrain:TH 002 AA" */
export function tacoHplId(code: string, group?: HplGroup, nama?: string): string {
  const n = nama?.trim() ? `|${nama.trim()}` : "";
  return `taco:${group ? `${group}:` : ""}${code.trim().toUpperCase()}${n}`;
}

export const HPL_GROUPS: HplGroup[] = ["white", "solid", "woodgrain", "ultimate", "long"];

export function hplFromDynamicId(id: string): HplMaster | null {
  if (!id.startsWith("taco:")) return null;
  const [rest = "", nama] = id.slice(5).split("|");
  const m = /^(white|solid|woodgrain|ultimate|long):(.+)$/.exec(rest);
  const hpl = m
    ? tacoHplMaster(m[2]!, { group: m[1] as HplGroup, nama })
    : tacoHplMaster(rest, { nama });
  return { ...hpl, id };
}

/* ---------------- PVC BOARD (HET 15 Apr 2026) ---------------- */
export const TACO_PVC_BOARD: { kode: string; tebal: number; harga: number; eco: boolean }[] = [
  { kode: "TPB-03", tebal: 3, harga: 143000, eco: false },
  { kode: "TPB-05", tebal: 5, harga: 220000, eco: false },
  { kode: "TPB-09", tebal: 9, harga: 352000, eco: false },
  { kode: "TPB-12", tebal: 12, harga: 468000, eco: false },
  { kode: "TPB-15", tebal: 15, harga: 589000, eco: false },
  { kode: "TPB-18", tebal: 18, harga: 699000, eco: false },
  { kode: "ECB-03", tebal: 3, harga: 110000, eco: true },
  { kode: "ECB-05", tebal: 5, harga: 153000, eco: true },
  { kode: "ECB-09", tebal: 9, harga: 266000, eco: true },
  { kode: "ECB-12", tebal: 12, harga: 350000, eco: true },
  { kode: "ECB-15", tebal: 15, harga: 432000, eco: true },
  { kode: "ECB-18", tebal: 18, harga: 520000, eco: true },
];

/* ---------------- RELL LACI (harga per set, panjang cm) ---------------- */
export interface SlideSeries {
  id: string;
  kode: string;
  nama: string;
  /** panjang cm → harga per set */
  harga: Record<number, number>;
  rule: string;
}

export const TACO_SLIDES: SlideSeries[] = [
  {
    id: "taco-bbs008sc",
    kode: "BBS 008 SC",
    nama: "Rel Laci Double Track Slowmotion Full Extension 45 mm",
    harga: { 30: 44100, 35: 48400, 40: 52800, 45: 57100, 50: 61400, 55: 65800 },
    rule: "1 set per laci",
  },
  {
    id: "taco-bbs009po",
    kode: "BBS 009 PO",
    nama: "Rel Laci Push to Open Full Extension 45 mm",
    harga: { 30: 40600, 35: 44900, 40: 49400, 45: 53800, 50: 58000, 55: 62400 },
    rule: "1 set per laci (tanpa handle)",
  },
  {
    id: "taco-bbs006fe",
    kode: "BBS 006 FE",
    nama: "Rel Laci Double Track Full Extension (non slow)",
    harga: { 30: 28600, 35: 33500, 40: 39300, 45: 43100, 50: 47900 },
    rule: "1 set per laci",
  },
  {
    id: "taco-bbs010fe",
    kode: "FE BBS 010",
    nama: "Rel Laci Double Track Full Extension Ekonomis",
    harga: { 40: 19000, 45: 21500, 50: 24000 },
    rule: "1 set per laci",
  },
  {
    id: "taco-us001sc",
    kode: "US 001 SC",
    nama: "Rel Laci Tandem / Undermount Slowmotion Clip-on",
    harga: { 25: 79900 },
    rule: "1 set per laci",
  },
  {
    id: "taco-rlt",
    kode: "RLT",
    nama: "Rel Laci Roller Putih",
    harga: { 35: 14100, 40: 15700, 45: 17000 },
    rule: "1 set per laci",
  },
];

/** Ruang belakang laci (mm) yang dikurangi dari kedalaman modul sebelum pilih panjang rel. */
export const SLIDE_REAR_CLEARANCE_MM = 50;

/** Panjang rel standar: kelipatan 5 cm terbesar ≤ (kedalaman − clearance). */
export function slideLengthCm(depth_mm: number): number {
  return Math.floor((depth_mm - SLIDE_REAR_CLEARANCE_MM) / 50) * 5;
}

export function findSlide(id: string) {
  return TACO_SLIDES.find((s) => s.id === id) ?? null;
}

/* ---------------- LEM KUNING ---------------- */
export const TACO_GLUE = {
  active: { nama: "Lem Kuning TACO Active", galon: { kode: "TA-1025-KB", harga: 187300 }, blek: { kode: "TA-1100-KB", harga: 648900 } },
  starmax: { nama: "Lem Kuning TACO Starmax", galon: { kode: "Starmax 2,5 kg", harga: 225000 }, blek: { kode: "Starmax 10 kg", harga: 775000 } },
} as const;
export type GlueType = keyof typeof TACO_GLUE;
export const GLUE_GALON_KG = 2.5;
export const GLUE_BLEK_KG = 10;
/** Konsumsi lem kontak HPL: ± 1 kg per 4 m² bidang (dua sisi dioles). */
export const GLUE_M2_PER_KG = 4;

/** Kombinasi blek + galon termurah yang menutup kebutuhan kg. */
export function glueOrder(kg: number, type: GlueType) {
  const g = TACO_GLUE[type];
  let blek = Math.floor(kg / GLUE_BLEK_KG);
  let galon = Math.ceil(Math.max(0, kg - blek * GLUE_BLEK_KG) / GLUE_GALON_KG - 1e-9);
  if (galon * g.galon.harga > g.blek.harga) {
    blek += 1;
    galon = 0;
  }
  return { blek, galon, total: blek * g.blek.harga + galon * g.galon.harga };
}
