/**
 * Audit spek bahan (QC Workshop SME) — exception-based.
 * Hanya melapor jika ada selisih antara gambar/visual, struktur modul, dan daftar bahan.
 */
import { WORKSHOP_MINOR_IDS, type KisFinishExtras } from "./kis";
import type { BomItem, CalculationResult, QuickSpec } from "./estimator/types";

/** Item audit QC: dihitung AI dari 3 foto lalu dibandingkan dengan spek/BOM. */
export const AUDIT_ITEMS = [
  { id: "pintu", label: "Daun pintu", unit: "daun" },
  { id: "laci", label: "Laci", unit: "laci" },
  { id: "engsel", label: "Engsel", unit: "pcs" },
  { id: "rel", label: "Rel laci", unit: "set" },
  { id: "hidrolik", label: "Hidrolik / gas spring", unit: "pcs" },
  { id: "kaca", label: "Pintu kaca", unit: "daun" },
  { id: "led", label: "Lampu LED strip", unit: "jalur" },
  { id: "sorot", label: "Lampu sorot / spot", unit: "titik" },
  { id: "list", label: "List profil gold/hitam", unit: "ada" },
  { id: "handle", label: "Handle pintu/laci", unit: "pcs" },
  { id: "top", label: "Top table", unit: "lapis" },
  { id: "rak-piring", label: "Rak piring", unit: "set" },
  { id: "rak-bumbu", label: "Rak bumbu", unit: "set" },
  { id: "rak-sayur", label: "Rak sayur", unit: "set" },
  { id: "ambalan", label: "Ambalan / rak dalam", unit: "lembar" },
] as const;
export type AuditItemId = (typeof AUDIT_ITEMS)[number]["id"];
/** Legacy (checklist manual lama). */
export type VisualCheckId = string;
export type VisualQc = Partial<Record<string, boolean>>;

export interface AiQcResult {
  scannedAt: string;
  counts?: { id: AuditItemId; qty: number | null; evidence: string }[];
  /** legacy */
  items?: { id: string; status: string; evidence: string }[];
  doors: number | null;
  drawers: number | null;
  extra: string[];
  /** jumlah pintu/laci per level dari foto — dipakai menyusun modul sebelum hitung */
  levels?: { upper: { doors: number | null; drawers: number | null }; lower: { doors: number | null; drawers: number | null } } | undefined;
  /** catatan jenis hardware, mis. "rel terlihat double track" */
  notes?: string[];
}

export interface AuditFinding {
  type: "kurang" | "lebih";
  item: string;
  note: string;
}

export interface AuditRow {
  id: AuditItemId;
  label: string;
  unit: string;
  spec: number | null;
  seen: number | null;
  status: "pass" | "kurang" | "lebih" | "tidak_jelas";
  evidence: string;
}

const sumQty = (bom: BomItem[], re: RegExp) => bom.filter((b) => re.test(`${b.id} ${b.name}`)).reduce((a, b) => a + b.qty, 0);

/** Kebutuhan menurut spek KIS + hitungan SME. */
export function specCounts(results: CalculationResult[], bom: BomItem[], ex?: KisFinishExtras, quick?: QuickSpec | null): Record<AuditItemId, number> {
  const parts = results.flatMap((r) => r.parts);
  const cnt = (re: RegExp) => parts.filter((p) => re.test(p.part_name)).reduce((a, p) => a + p.qty, 0);
  const hw = bom.filter((b) => b.group === "hardware");
  const hinge = hw.filter((b) => /engsel(?! hidrolik)|hinge/i.test(b.name) && !/gas spring/i.test(b.name)).reduce((a, b) => a + (/set|pasang/i.test(b.unit) ? b.qty * 2 : b.qty), 0);
  return {
    pintu: cnt(/pintu|door/i),
    laci: cnt(/front laci|depan laci|muka laci|drawer front/i),
    engsel: hinge,
    rel: hw.filter((b) => /rel|slide|tandem/i.test(b.name)).reduce((a, b) => a + b.qty, 0),
    hidrolik: sumQty(bom, /gas spring|hidrolik/i),
    kaca: ex?.glass ? Math.max(1, Math.round(sumQty(bom, /fitting-pintu|fitting pintu kaca/i)) || 0) : sumQty(bom, /^kaca/i) > 0 ? 1 : 0,
    led: ex?.lighting === "led" || ex?.lighting === "led_spot" || /led strip/i.test(bom.map((b) => b.name).join("|")) ? 1 : 0,
    sorot: ex?.lighting === "spot" || ex?.lighting === "led_spot" ? Math.max(1, sumQty(bom, /sorot|spot/i)) : sumQty(bom, /sorot|spot/i),
    list: ex?.edge === "list_gold" || ex?.edge === "list_black" ? 1 : 0,
    handle: sumQty(bom, /handle|tarikan/i),
    top: quick?.top === "double" ? 2 : quick?.top === "none" ? 0 : cnt(/top/i) > 0 ? 1 : 0,
    "rak-piring": sumQty(bom, /rak piring|dish/i),
    "rak-bumbu": sumQty(bom, /rak bumbu/i),
    "rak-sayur": sumQty(bom, /rak sayur/i),
    ambalan: cnt(/ambalan|shelf|rak dalam/i),
  };
}

/** Item yang cukup dicek ada/tidak (jumlah di gambar tidak harus sama persis). */
const PRESENCE: ReadonlySet<AuditItemId> = new Set(["led", "list", "kaca", "top"]);

export function auditTable(input: { results: CalculationResult[]; bom: BomItem[]; extras?: KisFinishExtras | undefined; quick?: QuickSpec | null | undefined; ai?: AiQcResult | undefined }): AuditRow[] {
  const spec = specCounts(input.results, input.bom, input.extras, input.quick);
  return AUDIT_ITEMS.map((it) => {
    const c = input.ai?.counts?.find((x) => x.id === it.id);
    const seen = c?.qty ?? null;
    const sp = spec[it.id];
    let status: AuditRow["status"] = "tidak_jelas";
    if (seen != null) {
      if (PRESENCE.has(it.id) && it.id !== "top") status = (seen > 0) === (sp > 0) ? "pass" : seen > 0 ? "kurang" : "lebih";
      else status = seen === sp ? "pass" : seen > sp ? "kurang" : "lebih";
    }
    return { id: it.id, label: it.label, unit: it.unit, spec: sp, seen, status, evidence: c?.evidence ?? "" };
  });
}

export function auditSpec(input: {
  results: CalculationResult[];
  bom: BomItem[];
  extras?: KisFinishExtras | undefined;
  quick?: QuickSpec | null | undefined;
  visual?: VisualQc | undefined;
  ai?: AiQcResult | undefined;
}): AuditFinding[] {
  const out: AuditFinding[] = [];
  const spec = specCounts(input.results, input.bom, input.extras, input.quick);
  if (spec.pintu > 0 && spec.engsel === 0) out.push({ type: "kurang", item: "Engsel", note: `${spec.pintu} daun pintu tanpa engsel di daftar bahan` });
  if (spec.laci > 0 && spec.rel === 0) out.push({ type: "kurang", item: "Rel laci", note: `${spec.laci} laci tanpa rel di daftar bahan` });
  if (spec.engsel > 0 && spec.pintu === 0) out.push({ type: "lebih", item: "Engsel", note: "Engsel ada tapi modul tidak punya pintu" });
  if (spec.rel > 0 && spec.laci === 0) out.push({ type: "lebih", item: "Rel laci", note: "Rel laci ada tapi modul tidak punya laci" });
  for (const r of auditTable(input)) {
    if (r.status === "kurang") out.push({ type: "kurang", item: r.label, note: `Gambar ${r.seen} ${r.unit}, spek/BOM ${r.spec ?? 0}` });
    if (r.status === "lebih") out.push({ type: "lebih", item: r.label, note: `Spek/BOM ${r.spec ?? 0} ${r.unit}, gambar ${r.seen}` });
  }
  for (const x of input.ai?.extra ?? []) out.push({ type: "kurang", item: x, note: "Terlihat di gambar (AI), tidak ada di daftar bahan" });
  return out;
}

export const SHOP_CATEGORIES = [
  "Bodi Board",
  "HPL & Finishing",
  "Hardware",
  "Kaca, List & Lampu",
  "Perintilan Workshop",
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export function shopCategory(b: BomItem): ShopCategory {
  if (WORKSHOP_MINOR_IDS.has(b.id) || /^lem/i.test(b.id) || /^lem /i.test(b.name)) return "Perintilan Workshop";
  if (/^(kaca|frame-alu|fitting-pintu)/.test(b.id) || b.group === "elektrik" || b.group === "edging") return "Kaca, List & Lampu";
  if (b.group === "hardware") return "Hardware";
  if (b.group === "finishing" || /hpl/i.test(b.id)) return "HPL & Finishing";
  return "Bodi Board";
}

/** Qty beli bulat ke atas (kaca per m² tetap desimal), subtotal = qty × harga. */
export function shoppingBreakdown(bom: BomItem[]) {
  const groups = new Map<ShopCategory, { name: string; qty: number; unit: string; unitPrice: number | null; subtotal: number | null }[]>();
  for (const b of bom) {
    const qty = b.unit === "m²" ? Math.round(b.qty * 100) / 100 : Math.max(b.id.startsWith("hpl-") ? 1 : 0, Math.ceil(b.qty - 1e-9));
    const row = { name: b.name, qty, unit: b.unit, unitPrice: b.unitPrice, subtotal: b.unitPrice == null ? null : Math.round(qty * b.unitPrice) };
    const c = shopCategory(b);
    groups.set(c, [...(groups.get(c) ?? []), row]);
  }
  const categories = SHOP_CATEGORIES.filter((c) => groups.has(c)).map((c) => {
    const rows = groups.get(c)!;
    return { category: c, rows, total: rows.reduce((a, r) => a + (r.subtotal ?? 0), 0) };
  });
  return { categories, total: categories.reduce((a, c) => a + c.total, 0), missingPrice: bom.filter((b) => b.unitPrice == null).length };
}

/** Terapkan jumlah pintu/laci hasil scan ke item KIS (Atas/Bawah). Item dobel per level tidak diisi (tidak menebak pembagian). */
export function applyQcToItems<T extends { name: string; briefing?: { doors: number | null; drawers: number | null } | null | undefined }>(items: T[], ai: AiQcResult | undefined): { items: T[]; skipped: string[] } {
  const skipped: string[] = [];
  if (!ai?.levels) return { items, skipped };
  const lvl = (n: string) => (/atas|upper/i.test(n) ? "upper" : /bawah|lower/i.test(n) ? "lower" : null);
  const count = (l: string) => items.filter((i) => lvl(i.name) === l).length;
  return {
    skipped,
    items: items.map((it) => {
      const l = lvl(it.name);
      if (!l || !it.briefing) return it;
      if (count(l) > 1) {
        skipped.push(it.name);
        return it;
      }
      const v = ai.levels![l];
      return { ...it, briefing: { ...it.briefing, doors: v.doors ?? it.briefing.doors, drawers: v.drawers ?? it.briefing.drawers } };
    }),
  };
}
