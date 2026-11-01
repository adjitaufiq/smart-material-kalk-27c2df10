/**
 * Audit spek bahan (QC Workshop SME) — exception-based.
 * Hanya melapor jika ada selisih antara gambar/visual, struktur modul, dan daftar bahan.
 */
import { WORKSHOP_MINOR_IDS, type KisFinishExtras } from "./kis";
import type { BomItem, CalculationResult } from "./estimator/types";

/** Item yang dicek QC dari foto render / tampak dalam. */
export const VISUAL_CHECKS = [
  { id: "lampu", label: "Lampu LED / sorot" },
  { id: "kaca", label: "Pintu kaca" },
  { id: "list", label: "List profil gold/hitam" },
  { id: "pintu-angkat", label: "Pintu angkat (gas spring)" },
  { id: "rak-sayur", label: "Rak sayur" },
  { id: "rak-bumbu", label: "Rak bumbu" },
  { id: "rak-piring", label: "Rak piring" },
] as const;
export type VisualCheckId = (typeof VISUAL_CHECKS)[number]["id"];
/** true = terlihat di gambar, false = tidak ada, undefined = belum dicek */
export type VisualQc = Partial<Record<VisualCheckId, boolean>>;

export interface AuditFinding {
  type: "kurang" | "lebih";
  item: string;
  note: string;
}

const has = (bom: BomItem[], re: RegExp) => bom.some((b) => re.test(`${b.id} ${b.name}`));

/** Apa yang sudah ada di spek/BOM untuk tiap item visual. */
function inSpec(id: VisualCheckId, bom: BomItem[], ex: KisFinishExtras | undefined): boolean {
  switch (id) {
    case "lampu": return !!ex?.lighting || has(bom, /led|lampu/i);
    case "kaca": return !!ex?.glass || has(bom, /kaca/i);
    case "list": return ex?.edge === "list_gold" || ex?.edge === "list_black";
    case "pintu-angkat": return has(bom, /gas spring|hidrolik/i);
    case "rak-sayur": return has(bom, /rak sayur/i);
    case "rak-bumbu": return has(bom, /rak bumbu/i);
    case "rak-piring": return has(bom, /rak piring|dish/i);
  }
}

export function auditSpec(input: {
  results: CalculationResult[];
  bom: BomItem[];
  extras?: KisFinishExtras | undefined;
  visual?: VisualQc | undefined;
}): AuditFinding[] {
  const out: AuditFinding[] = [];
  const parts = input.results.flatMap((r) => r.parts);
  const doors = parts.filter((p) => /pintu|door/i.test(p.part_name)).reduce((a, p) => a + p.qty, 0);
  const drawers = parts.filter((p) => /front laci|depan laci|muka laci|drawer front/i.test(p.part_name)).reduce((a, p) => a + p.qty, 0);
  const hinge = input.bom.some((b) => b.group === "hardware" && /engsel|hinge|fitting/i.test(b.name));
  const slide = input.bom.some((b) => b.group === "hardware" && /rel|slide|tandem/i.test(b.name));
  if (doors > 0 && !hinge) out.push({ type: "kurang", item: "Engsel", note: `${doors} daun pintu tanpa engsel di daftar bahan` });
  if (drawers > 0 && !slide) out.push({ type: "kurang", item: "Rel laci", note: `${drawers} laci tanpa rel di daftar bahan` });
  if (hinge && doors === 0) out.push({ type: "lebih", item: "Engsel", note: "Engsel ada tapi modul tidak punya pintu" });
  if (slide && drawers === 0) out.push({ type: "lebih", item: "Rel laci", note: "Rel laci ada tapi modul tidak punya laci" });
  for (const c of VISUAL_CHECKS) {
    const seen = input.visual?.[c.id];
    if (seen === undefined) continue;
    const spec = inSpec(c.id, input.bom, input.extras);
    if (seen && !spec) out.push({ type: "kurang", item: c.label, note: "Terlihat di gambar, belum ada di spek KIS" });
    if (!seen && spec) out.push({ type: "lebih", item: c.label, note: "Ada di spek KIS, tidak terlihat di gambar" });
  }
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
