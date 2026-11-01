/**
 * Audit spek bahan (QC Workshop SME) — exception-based.
 * Hanya melapor jika ada selisih antara gambar/visual, struktur modul, dan daftar bahan.
 */
import { WORKSHOP_MINOR_IDS, type KisFinishExtras } from "./kis";
import type { BomItem, CalculationResult, QuickSpec } from "./estimator/types";

/** Item audit QC: dihitung AI dari 3 foto lalu dibandingkan dengan spek/BOM. */
export const AUDIT_GROUPS = ["Finishing & Material", "Konstruksi & Hardware", "Elektrikal", "Aksesori"] as const;
export type AuditGroup = (typeof AUDIT_GROUPS)[number];
/** Item audit QC: dihitung AI dari 3 foto lalu dibandingkan dengan spek/BOM. */
export const AUDIT_ITEMS = [
  { id: "hpl-zona", label: "Zona motif HPL", unit: "zona", group: "Finishing & Material" },
  { id: "dalam-putih", label: "Finishing dalam putih (Blockmin/Tacosheet)", unit: "ada", group: "Finishing & Material" },
  { id: "handle", label: "Handle pintu/laci", unit: "pcs", group: "Finishing & Material" },
  { id: "tusir", label: "Pinggiran tusiran (tanpa edging PVC)", unit: "ada", group: "Finishing & Material" },
  { id: "list", label: "List profil gold/hitam", unit: "ada", group: "Finishing & Material" },
  { id: "top", label: "Top table", unit: "lapis", group: "Finishing & Material" },
  { id: "pintu", label: "Daun pintu (total)", unit: "daun", group: "Konstruksi & Hardware" },
  { id: "laci", label: "Laci", unit: "laci", group: "Konstruksi & Hardware" },
  { id: "engsel", label: "Engsel sendok (pintu swing)", unit: "pcs", group: "Konstruksi & Hardware" },
  { id: "rel", label: "Rel laci", unit: "set", group: "Konstruksi & Hardware" },
  { id: "hidrolik", label: "Hidrolik / gas spring", unit: "pcs", group: "Konstruksi & Hardware" },
  { id: "kaca", label: "Pintu kaca (lift-up)", unit: "daun", group: "Konstruksi & Hardware" },
  { id: "ambalan", label: "Ambalan / rak dalam", unit: "lembar", group: "Konstruksi & Hardware" },
  { id: "led", label: "Lampu LED strip", unit: "jalur", group: "Elektrikal" },
  { id: "sorot", label: "Lampu sorot / downlight", unit: "titik", group: "Elektrikal" },
  { id: "rak-piring", label: "Rak piring", unit: "set", group: "Aksesori" },
  { id: "rak-bumbu", label: "Rak bumbu", unit: "set", group: "Aksesori" },
  { id: "rak-sayur", label: "Rak sayur", unit: "set", group: "Aksesori" },
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
  /** sink, kran, kompor dll — info lapangan, bukan bahan workshop */
  nonWorkshop?: string[];
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
  group: AuditGroup;
}

const sumQty = (bom: BomItem[], re: RegExp) => bom.filter((b) => re.test(`${b.id} ${b.name}`)).reduce((a, b) => a + b.qty, 0);

/** Kebutuhan menurut spek KIS + hitungan SME. */
export function specCounts(results: CalculationResult[], bom: BomItem[], ex?: KisFinishExtras, quick?: QuickSpec | null, applied?: AiQcResult): Record<AuditItemId, number> {
  const seen = (id: AuditItemId) => applied?.counts?.find((c) => c.id === id)?.qty ?? null;
  const parts = results.flatMap((r) => r.parts);
  const cnt = (re: RegExp) => parts.filter((p) => re.test(p.part_name)).reduce((a, p) => a + p.qty, 0);
  const hw = bom.filter((b) => b.group === "hardware");
  const hinge = hw.filter((b) => /engsel(?! hidrolik)|hinge/i.test(b.name) && !/gas spring/i.test(b.name)).reduce((a, b) => a + (/set|pasang/i.test(b.unit) ? b.qty * 2 : b.qty), 0);
  return {
    "hpl-zona": new Set([quick?.hplOutside?.code, quick?.hplTop?.code, ex?.hplAccent?.code].filter(Boolean)).size,
    "dalam-putih": quick?.inside === "blockmin" || quick?.inside === "tacosheet" ? 1 : 0,
    tusir: ex?.edge === "tusir" && !bom.some((b) => b.group === "edging") ? 1 : 0,
    pintu: seen("pintu") ?? cnt(/pintu|door/i),
    laci: seen("laci") ?? cnt(/front laci|depan laci|muka laci|drawer front/i),
    engsel: hinge,
    rel: hw.filter((b) => /rel|slide|tandem/i.test(b.name)).reduce((a, b) => a + b.qty, 0),
    hidrolik: sumQty(bom, /gas spring|hidrolik/i),
    kaca: seen("kaca") != null && ex?.glass ? seen("kaca")! : ex?.glass ? Math.max(1, Math.round(sumQty(bom, /fitting-pintu|fitting pintu kaca/i)) || 0) : sumQty(bom, /^kaca/i) > 0 ? 1 : 0,
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
const PRESENCE: ReadonlySet<AuditItemId> = new Set(["led", "list", "top", "dalam-putih", "tusir"]);

export function auditTable(input: { results: CalculationResult[]; bom: BomItem[]; extras?: KisFinishExtras | undefined; quick?: QuickSpec | null | undefined; ai?: AiQcResult | undefined; applied?: boolean | undefined }): AuditRow[] {
  const spec = specCounts(input.results, input.bom, input.extras, input.quick, input.applied ? input.ai : undefined);
  return AUDIT_ITEMS.map((it) => {
    const c = input.ai?.counts?.find((x) => x.id === it.id);
    const seen = c?.qty ?? null;
    const sp = spec[it.id];
    let status: AuditRow["status"] = "tidak_jelas";
    if (seen != null) {
      if (PRESENCE.has(it.id) && it.id !== "top") status = (seen > 0) === (sp > 0) ? "pass" : seen > 0 ? "kurang" : "lebih";
      else status = seen === sp ? "pass" : seen > sp ? "kurang" : "lebih";
    }
    return { id: it.id, label: it.label, unit: it.unit, spec: sp, seen, status, evidence: c?.evidence ?? "", group: it.group };
  });
}

export function auditSpec(input: {
  results: CalculationResult[];
  bom: BomItem[];
  extras?: KisFinishExtras | undefined;
  quick?: QuickSpec | null | undefined;
  visual?: VisualQc | undefined;
  ai?: AiQcResult | undefined;
  applied?: boolean | undefined;
}): AuditFinding[] {
  const out: AuditFinding[] = [];
  const spec = specCounts(input.results, input.bom, input.extras, input.quick, input.applied ? input.ai : undefined);
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

const qty = (ai: AiQcResult | undefined, id: AuditItemId) => ai?.counts?.find((c) => c.id === id)?.qty ?? null;

/** "Terapkan Hasil Audit": kunci hidrolik (2 pcs per pintu angkat), titik sorot, dan handleless ke spek KIS. */
export function applyAuditToExtras(ex: KisFinishExtras | undefined, ai: AiQcResult): KisFinishExtras {
  const out: KisFinishExtras = { ...(ex ?? {}) };
  const lift = qty(ai, "kaca");
  const gas = qty(ai, "hidrolik") ?? (lift != null ? lift * 2 : null);
  if (gas != null) {
    const others = (out.otherAccessories ?? []).filter((o) => o.id !== "hidrolik");
    out.otherAccessories = gas > 0 ? [...others, { id: "hidrolik", qty: gas }] : others;
  }
  const spot = qty(ai, "sorot");
  if (spot != null && spot > 0) {
    out.lighting = out.lighting === "led" || out.lighting === "led_spot" ? "led_spot" : "spot";
    out.spotQty = spot;
  }
  if (qty(ai, "handle") === 0) out.handle = "none";
  return out;
}

/** BOM setelah audit diterapkan: engsel = pintu swing (pintu − pintu kaca angkat) set, rel = laci set, handle dihapus bila handleless. */
export function auditAdjustBom(bom: BomItem[], ai: AiQcResult | undefined, ex: KisFinishExtras | undefined): BomItem[] {
  const doors = qty(ai, "pintu");
  const lift = qty(ai, "kaca") ?? 0;
  const drawers = qty(ai, "laci");
  const isHinge = (b: BomItem) => b.group === "hardware" && /engsel|hinge/i.test(b.name) && !/gas spring|hidrolik/i.test(b.name);
  const isRail = (b: BomItem) => b.group === "hardware" && /rel|slide|tandem/i.test(b.name);
  const setQty = (b: BomItem, q: number): BomItem => ({ ...b, qty: q, total: b.unitPrice == null ? null : Math.round(b.unitPrice * q), explanation: `${b.explanation ?? ""} · disesuaikan audit foto`.trim() });
  let hingeDone = false;
  let railDone = false;
  const out: BomItem[] = [];
  for (const b of bom) {
    if (ex?.handle === "none" && /handle|tarikan/i.test(`${b.id} ${b.name}`)) continue;
    if (doors != null && isHinge(b)) {
      if (hingeDone) continue;
      hingeDone = true;
      const swing = Math.max(0, doors - lift);
      if (swing > 0) out.push(setQty(b, /set|pasang/i.test(b.unit) ? swing : swing * 2));
      continue;
    }
    if (drawers != null && isRail(b)) {
      if (railDone) continue;
      railDone = true;
      if (drawers > 0) out.push(setQty(b, drawers));
      continue;
    }
    out.push(b);
  }
  return out;
}
