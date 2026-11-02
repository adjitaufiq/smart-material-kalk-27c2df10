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

/** Kode solid TACO yang sudah dikonfirmasi workshop (mis. 003 AA = Black solid). */
const KNOWN_SOLID_NUMBERS = new Set(["003"]);

/** Tebak grup dari nama/tekstur resmi motif (KIS hplInfo), bukan dari visual. */
export function hplGroupFromHint(hint?: string): HplGroup | undefined {
  const h = (hint ?? "").toLowerCase();
  if (!h) return undefined;
  if (/wood|oak|walnut|teak|jati|serat|grain/.test(h)) return "woodgrain";
  if (/solid|black|hitam|putih|white|grey|gray|abu|polos|plain/.test(h)) return "solid";
  return undefined;
}

export function tacoHplPrice(code: string, group?: HplGroup, hint?: string): HplPriceResult {
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
  const g0 = group ?? hplGroupFromHint(hint) ?? (KNOWN_SOLID_NUMBERS.has(p.num) ? "solid" : undefined);
  if (g0 && hits.length > 1) {
    const g = hits.filter((t) => t.group === g0);
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
export function tacoHplMaster(code: string, opts: { nama?: string | undefined; group?: HplGroup | undefined; grain?: GrainDirection | undefined } = {}): HplMaster {
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

/* ---------------- TACO SHEET / ECO SHEET (HET 1 Sep 2026) — dijual PER METER ---------------- */
export interface MeterItem { id: string; kategori: string; nama: string; kode: string; harga_per_m: number }
export const TACO_SHEET: MeterItem[] = [
  { id: "ts-p", kategori: "TACO Sheet 0.3mm", nama: "Solid Color Plain", kode: "Tipe P", harga_per_m: 41500 },
  { id: "ts-pg", kategori: "TACO Sheet 0.3mm", nama: "Solid Color Plain & Glossy", kode: "P-002G, P-003G", harga_per_m: 60000 },
  { id: "ts-x", kategori: "TACO Sheet 0.3mm", nama: "Solid Color Soft Touch", kode: "TS 117X, 118X, 119X, 228M", harga_per_m: 88000 },
  { id: "ts-mirror", kategori: "TACO Sheet 0.3mm", nama: "Solid Color Mirror", kode: "TS-501-G s/d TS-504-G", harga_per_m: 112000 },
  { id: "ts-premium", kategori: "TACO Sheet 0.3mm", nama: "Woodgrain / Pattern Premium", kode: "Premium", harga_per_m: 50500 },
  { id: "ts-pattern-m", kategori: "TACO Sheet 0.3mm", nama: "Pattern", kode: "TS-233-M s/d TS-236-M", harga_per_m: 88000 },
  { id: "ts-ap", kategori: "TACO Sheet New Motif", nama: "Price Group P", kode: "AP", harga_per_m: 41500 },
  { id: "ts-fq", kategori: "TACO Sheet New Motif", nama: "Price Group Q", kode: "FQ", harga_per_m: 50500 },
  { id: "ts-r", kategori: "TACO Sheet New Motif", nama: "Price Group R", kode: "DR, FR, WR", harga_per_m: 60000 },
  { id: "ts-ws", kategori: "TACO Sheet New Motif", nama: "Price Group S", kode: "WS", harga_per_m: 72000 },
  { id: "ts-t", kategori: "TACO Sheet New Motif", nama: "Price Group T", kode: "DT, MT", harga_per_m: 88000 },
  { id: "es-ac", kategori: "ECO Sheet 0.2mm", nama: "Solid", kode: "ES A/C", harga_per_m: 24000 },
  { id: "es-g", kategori: "ECO Sheet 0.2mm", nama: "Solid Glossy", kode: "ES G", harga_per_m: 35000 },
  { id: "es-wm", kategori: "ECO Sheet 0.2mm", nama: "Woodgrain / Pattern", kode: "ES W/M", harga_per_m: 35000 },
];

/* ---------------- TACO EDGING — dijual PER METER ---------------- */
export type EdgingMotif = "solid" | "woodgrain";
export const TACO_EDGING: { motif: EdgingMotif; tebal: 1 | 2; lebar: 22 | 42; harga_per_m: number }[] = [
  { motif: "solid", tebal: 1, lebar: 22, harga_per_m: 2500 },
  { motif: "solid", tebal: 1, lebar: 42, harga_per_m: 5000 },
  { motif: "solid", tebal: 2, lebar: 22, harga_per_m: 2500 },
  { motif: "solid", tebal: 2, lebar: 42, harga_per_m: 5000 },
  { motif: "woodgrain", tebal: 1, lebar: 22, harga_per_m: 3000 },
  { motif: "woodgrain", tebal: 1, lebar: 42, harga_per_m: 6000 },
  { motif: "woodgrain", tebal: 2, lebar: 22, harga_per_m: 3000 },
  { motif: "woodgrain", tebal: 2, lebar: 42, harga_per_m: 6000 },
];
/** Lebar edging: ≤22 mm (board 18 mm) → 22, selain itu 42. Woodgrain/glossy/pattern pakai harga woodgrain. */
export function edgingPrice(motif: EdgingMotif, tebal: 1 | 2, boardThickness_mm: number): number {
  const lebar = boardThickness_mm <= 20 ? 22 : 42;
  return TACO_EDGING.find((e) => e.motif === motif && e.tebal === tebal && e.lebar === lebar)!.harga_per_m;
}
/** Pembelian per meter (dibulatkan ke atas meter penuh), bukan per roll. */
export function meterOrder(meter: number, harga_per_m: number) {
  const m = Math.ceil(meter - 1e-9);
  return { meter: m, total: m * harga_per_m };
}

/* ---------------- ECO HPL 4×8 ---------------- */
export const TACO_ECO_HPL: { kode: string; nama: string; harga: number }[] = [
  { kode: "SW001/SW002/SW016", nama: "ECO HPL Super White", harga: 105000 },
  { kode: "ECO-SLD", nama: "ECO HPL Solid", harga: 140000 },
  { kode: "ECO-SLD-G", nama: "ECO HPL Solid Glossy", harga: 160000 },
  { kode: "ECO-SLD-M", nama: "ECO HPL Solid Matt", harga: 160000 },
  { kode: "ECO", nama: "ECO HPL Woodgrain / Pattern", harga: 166000 },
  { kode: "ECO-P", nama: "ECO HPL Woodgrain", harga: 166000 },
  { kode: "ECO-G", nama: "ECO HPL Woodgrain / Pattern G", harga: 184000 },
  { kode: "ECO 2000-SILVER", nama: "ECO HPL Aluminium", harga: 461000 },
];

/* ---------------- SPECIAL COLLECTION (MOQ 300 pcs) ---------------- */
export const TACO_SPECIAL_COLLECTION = {
  moq: 300,
  lab_grade: { white: 150000, solid_aa: 180000, solid_gd: 230000, wood_aabh: 218000, wood_jfc: 254000, wood_gljgdp: 307000 },
  post_forming: { white: 150000, solid_aa: 180000, solid_014g: 230000, wood_aabh: 218000, wood_jfc: 254000 },
  fire_retardant: { white: 180000, solid_aa: 210000, solid_014g: 260000, wood_aabh: 248000, wood_jfc: 284000 },
} as const;

/* ---------------- TACOMPACT / COMPACT BOARD ---------------- */
export const TACO_COMPACT_4X8: { core: "MC" | "BL"; motif: "solid" | "woodgrain"; tebal: 3 | 10 | 12 | 18; harga: number }[] = [
  { core: "MC", motif: "solid", tebal: 3, harga: 420000 }, { core: "MC", motif: "solid", tebal: 10, harga: 1245000 },
  { core: "MC", motif: "solid", tebal: 12, harga: 1400000 }, { core: "MC", motif: "solid", tebal: 18, harga: 1830000 },
  { core: "MC", motif: "woodgrain", tebal: 3, harga: 460000 }, { core: "MC", motif: "woodgrain", tebal: 10, harga: 1300000 },
  { core: "MC", motif: "woodgrain", tebal: 12, harga: 1480000 }, { core: "MC", motif: "woodgrain", tebal: 18, harga: 1935000 },
  { core: "BL", motif: "solid", tebal: 3, harga: 550000 }, { core: "BL", motif: "solid", tebal: 10, harga: 1895000 },
  { core: "BL", motif: "solid", tebal: 12, harga: 2150000 }, { core: "BL", motif: "solid", tebal: 18, harga: 2925000 },
  { core: "BL", motif: "woodgrain", tebal: 3, harga: 590000 }, { core: "BL", motif: "woodgrain", tebal: 10, harga: 1950000 },
  { core: "BL", motif: "woodgrain", tebal: 12, harga: 2230000 }, { core: "BL", motif: "woodgrain", tebal: 18, harga: 3030000 },
];
export const TACO_COMPACT_MOQ = 2;
export const TACO_COMPACT_6X6 = { core: "BL", motif: "wood & solid", tebal: 12, panjang_mm: 1830, lebar_mm: 1830, harga: 2350000 } as const;

/** Katalog lengkap harga TACO (untuk disinkron ke KIS). */
export function tacoCatalog() {
  return {
    het_date: TACO_HET_DATE,
    pvc_het_date: TACO_PVC_HET_DATE,
    hpl: TACO_HPL_TIERS, long_hpl: TACO_LONG_HPL_TIERS, eco_hpl: TACO_ECO_HPL,
    special_collection: TACO_SPECIAL_COLLECTION,
    sheet_per_meter: TACO_SHEET, edging_per_meter: TACO_EDGING,
    pvc_board: TACO_PVC_BOARD, compact_4x8: TACO_COMPACT_4X8, compact_6x6: TACO_COMPACT_6X6,
    slides: TACO_SLIDES, glue: TACO_GLUE,
  };
}

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
    nama: "Rel Laci Double Track Slowmotion TACO",
    harga: { 30: 44100, 35: 48400, 40: 52800, 45: 57100, 50: 61400, 55: 65800 },
    rule: "1 set per laci",
  },
  {
    id: "taco-bbs009po",
    kode: "BBS 009 PO",
    nama: "Rel Laci Push to Open TACO",
    harga: { 30: 40600, 35: 44900, 40: 49400, 45: 53800, 50: 58000, 55: 62400 },
    rule: "1 set per laci (tanpa handle)",
  },
  {
    id: "taco-bbs006fe",
    kode: "BBS 006 FE",
    nama: "Rel Laci Double Track TACO",
    harga: { 30: 28600, 35: 33500, 40: 39300, 45: 43100, 50: 47900 },
    rule: "1 set per laci",
  },
  {
    id: "taco-bbs010fe",
    kode: "FE BBS 010",
    nama: "Rel Laci Double Track Ekonomis TACO",
    harga: { 40: 19000, 45: 21500, 50: 24000 },
    rule: "1 set per laci",
  },
  {
    id: "taco-us001sc",
    kode: "US 001 SC",
    nama: "Rel Laci Tandem Slowmotion TACO",
    harga: { 25: 79900 },
    rule: "1 set per laci",
  },
  {
    id: "taco-rlt",
    kode: "RLT",
    nama: "Rel Laci Roller Putih TACO",
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
/** Standar workshop: 1 kg lem per 1 lembar HPL 1220×2440 (≈2,98 m²) → 1 blek = ± 10 lembar. */
export const GLUE_M2_PER_KG = (1220 * 2440) / 1e6;
/** Mulai butuh 3 galon (> 5 kg) → rekomendasi 1 blek: per kg lebih irit & ada cadangan. */
export const GLUE_BLEK_FROM_GALON = 3;

/** Kombinasi blek + galon termurah yang menutup kebutuhan kg. */
export function glueOrder(kg: number, type: GlueType) {
  const g = TACO_GLUE[type];
  let blek = Math.floor(kg / GLUE_BLEK_KG);
  let galon = Math.max(0, Math.ceil((kg - blek * GLUE_BLEK_KG) / GLUE_GALON_KG - 1e-9));
  if (galon >= GLUE_BLEK_FROM_GALON || galon * g.galon.harga > g.blek.harga) {
    blek += 1;
    galon = 0;
  }
  return { blek, galon, total: blek * g.blek.harga + galon * g.galon.harga };
}
