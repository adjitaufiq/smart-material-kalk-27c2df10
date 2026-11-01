/**
 * Integrasi Kerjaku Interior Studio (KIS).
 * Masuk: KIS membuka /import?projectId=...&returnUrl=...
 * Balik: SME membuka returnUrl?estimate=<base64url JSON>
 */
import { defaultSelection, itemsFromSelections, type PresetItem } from "./estimator/presets";
import { DEFAULT_QUICK_SPEC } from "./estimator/quick-spec";
import { TACO_HET_DATE, TACO_PVC_HET_DATE } from "./estimator/taco-pricing";
import type { BomItem, CalculationResult, CalculationStatus, QuickSpec } from "./estimator/types";

export const KIS_ORIGIN = "https://kerjaku-design-forge.lovable.app";

export interface KisLink {
  projectId: string;
  workspaceId: string;
  leadId?: string | undefined;
  shape?: "single" | "L" | "U" | undefined;
  clientName: string;
  phone: string;
  jobType: string;
  beforeUrl: string;
  renderUrl: string;
  interiorUrl?: string | undefined;
  returnUrl: string;
  /** Posisi aksesori dari KIS, mis. { "rak-sayur": "kabinet ke-2 dari kiri" } */
  accessoryPositions?: Record<string, string> | undefined;
  /** Kaca, list, lampu, aksesori tambahan dari specHints KIS */
  finishExtras?: KisFinishExtras | undefined;
  /** Foto tersalin ke IndexedDB (key) — link KIS hanya aktif 1 jam */
  beforeBlobKey?: string | undefined;
  renderBlobKey?: string | undefined;
  interiorBlobKey?: string | undefined;
  importedAt: string;
}

export interface KisImport {
  link: KisLink;
  projectName: string;
  location: string;
  notes: string;
  items: PresetItem[];
  specHint: QuickSpec | null;
}

export function fromBase64Url(b64: string): string {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm + "=".repeat((4 - (norm.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const BODY_ALIAS: Record<string, string> = {
  "pvc-board-18": "pvc", "eco-pvc-18": "pvc_eco", "multiplek-18": "ply", "blockboard-18": "blockboard",
  "blockmin-1s-18": "blockmin_1s", "blockmin-2s-18": "blockmin_2s",
};
/** Nilai body/material KIS (key pendek atau alias "xxx-18") → key SME. */
export function normBody(v: unknown): unknown {
  return typeof v === "string" ? (BODY_ALIAS[v.trim().toLowerCase()] ?? v.trim().toLowerCase()) : v;
}

const OPTS = {
  outside: ["hpl", "hpl_premium", "duco"],
  inside: ["blockmin", "tacosheet", "hpl"],
  hinge: ["slowmo", "slowmo_stainless", "biasa"],
  slide: ["dt_slowmo", "dt_biasa", "dt_eco", "push", "tandem", "roller"],
  glue: ["active", "starmax"],
  body: ["ply", "pvc", "pvc_eco", "hybrid", "blockboard", "blockmin_1s", "blockmin_2s"],
} as const;
// KIS punya rak-gelas terpisah; di SME gabung dengan rak-piring.
const ACC_MAP: Record<string, string> = {
  "rak-piring": "rak-piring",
  "rak-gelas": "rak-piring",
  "rak-piring-atas": "rak-piring-atas",
  "rak-sayur": "rak-sayur",
  "rak-bumbu": "rak-bumbu",
  "tray-sendok": "tray-sendok",
};

/** Ambil spek dari specHints (base64url JSON) atau param datar (outside=hpl&...). Nilai tak dikenal diabaikan. */
export function parseSpecHints(search: Record<string, unknown>): {
  spec: QuickSpec | null;
  positions: Record<string, string>;
} {
  let raw: Record<string, unknown> = {};
  const enc = search["specHints"];
  if (typeof enc === "string" && enc) {
    try {
      raw = JSON.parse(fromBase64Url(enc)) as Record<string, unknown>;
    } catch {
      try {
        raw = JSON.parse(enc) as Record<string, unknown>;
      } catch {
        raw = {};
      }
    }
  } else if (enc && typeof enc === "object") raw = enc as Record<string, unknown>;
  for (const k of Object.keys(OPTS)) if (raw[k] === undefined && search[k] !== undefined) raw[k] = search[k];

  const spec: QuickSpec = { ...DEFAULT_QUICK_SPEC, accessories: [] };
  let found = false;
  for (const [k, allowed] of Object.entries(OPTS)) {
    const v = raw[k];
    const v2 = k === "body" ? normBody(v ?? raw["material"]) : v;
    if (typeof v2 === "string" && (allowed as readonly string[]).includes(v2)) {
      (spec as unknown as Record<string, string>)[k] = v2;
      found = true;
    }
  }
  const gOut = hplRef(raw["hplOutside"]);
  const gIn = hplRef(raw["hplInside"]);
  if (gOut) {
    spec.hplOutside = gOut;
    found = true;
  }
  if (gIn) {
    spec.hplInside = gIn;
    spec.inside = "hpl";
    found = true;
  }
  const positions: Record<string, string> = {};
  if (Array.isArray(raw["accessories"])) {
    for (const a of raw["accessories"]) {
      const id = typeof a === "string" ? a : a && typeof a === "object" ? (a as { id?: unknown }).id : null;
      const mapped = typeof id === "string" ? ACC_MAP[id] : undefined;
      if (!mapped) continue;
      found = true;
      if (!spec.accessories.includes(mapped)) spec.accessories.push(mapped);
      const pos = a && typeof a === "object" ? (a as { position?: unknown }).position : null;
      if (typeof pos === "string" && pos.trim()) positions[id as string] = pos.trim();
    }
  }
  return { spec: found ? spec : null, positions };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** returnUrl hanya boleh mengarah ke domain KIS. */
export function safeReturnUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return u.origin === KIS_ORIGIN ? u.toString() : "";
  } catch {
    return "";
  }
}

const JOB_PRESET: Record<string, string> = {
  kitchen_set: "kitchen",
  wardrobe: "lemari",
  bedroom: "kamar",
  living_room: "tv",
  office: "meja",
};

export function itemsForJobType(jobType: string): PresetItem[] {
  const preset = JOB_PRESET[jobType];
  if (!preset) return [{ category: "Custom", name: "Pekerjaan Custom" }];
  return itemsFromSelections([defaultSelection(preset)]);
}

function decodeRaw(search: Record<string, unknown>): Record<string, unknown> {
  const enc = search["specHints"];
  if (typeof enc === "string" && enc) {
    try {
      return JSON.parse(fromBase64Url(enc)) as Record<string, unknown>;
    } catch {
      try {
        return JSON.parse(enc) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
  }
  return enc && typeof enc === "object" ? (enc as Record<string, unknown>) : {};
}

type HplRef = NonNullable<QuickSpec["hplOutside"]>;
const GROUPS = ["white", "solid", "woodgrain", "ultimate", "long"] as const;
/** "TH 002 AA" | { code, name, group } → HplRef. Kode dipakai apa adanya (tidak diganti default SME). */
export function hplRef(v: unknown): HplRef | undefined {
  if (typeof v === "string" && v.trim()) return { code: v.trim() };
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const code = str(o["code"]) || str(o["kode"]) || str(o["hplCode"]);
  if (!code) return undefined;
  const g = str(o["group"]) || str(o["category"]);
  const group = GROUPS.find((x) => x === g.toLowerCase());
  const name = str(o["name"]) || str(o["nama"]);
  return { code, ...(name ? { name } : {}), ...(group ? { group } : {}) };
}

function moduleSpec(r: Record<string, unknown>): Partial<QuickSpec> | undefined {
  const f = r["finish"] && typeof r["finish"] === "object" ? (r["finish"] as Record<string, unknown>) : {};
  const out: Partial<QuickSpec> = {};
  const outside = hplRef(f["outside"] ?? f["hplOutside"] ?? r["hplOutside"] ?? r["hplCode"] ?? (typeof r["finish"] === "string" ? r["finish"] : undefined));
  const inside = hplRef(f["inside"] ?? f["hplInside"] ?? r["hplInside"]);
  if (outside) out.hplOutside = outside;
  if (inside) {
    out.hplInside = inside;
    out.inside = "hpl";
  }
  for (const [k, allowed] of Object.entries(OPTS)) {
    const v = k === "body" ? normBody(r[k] ?? r["material"]) : r[k];
    if (typeof v === "string" && (allowed as readonly string[]).includes(v)) (out as Record<string, string>)[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

const WING: Record<string, string> = { wing: "Sayap L", wing2: "Sayap U", left: "Sayap Kiri", right: "Sayap Kanan" };

/** Modul kabinet dari KIS (specHints.modules) → item terpisah per kabinet. */
export function itemsFromKisModules(raw: Record<string, unknown>): PresetItem[] {
  const mods = raw["modules"];
  if (!Array.isArray(mods)) return [];
  const out: PresetItem[] = [];
  for (const m of mods) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const level = r["level"] === "upper" ? "Atas" : r["level"] === "lower" ? "Bawah" : r["level"] === "tall" ? "tall" : null;
    if (!level) continue;
    if (level === "tall") {
      const specOverride = moduleSpec(r);
      out.push({ category: "Kabinet", name: str(r["label"]) || "Tall Unit / Kabinet Kulkas", ...(specOverride ? { specOverride } : {}) });
      continue;
    }
    const side = str(r["side"]);
    const suffix = side && side !== "main" ? ` - ${WING[side] ?? side}` : "";
    const full = r["fullCeiling"] === true && level === "Atas" ? " (Full Plafon)" : "";
    let name = `Kitchen Set ${level}${suffix}${full}`;
    let n = 2;
    while (out.some((o) => o.name === name)) name = `Kitchen Set ${level}${suffix}${full} ${n++}`;
    const specOverride = moduleSpec(r);
    out.push({ category: `Kitchen Set ${level}${suffix}`, name, ...(specOverride ? { specOverride } : {}) });
  }
  return out;
}

export function parseKisSearch(search: Record<string, unknown>): KisImport | null {
  const projectId = str(search["projectId"]);
  if (!projectId) return null;
  const jobType = str(search["jobType"]) || "custom";
  const clientName = str(search["clientName"]);
  const hints = parseSpecHints(search);
  const raw = decodeRaw(search);
  const shapeRaw = str(raw["shape"]) || str(search["shape"]);
  const shape = (["single", "L", "U"] as const).find((s) => s === shapeRaw);
  const modItems = itemsFromKisModules(raw);
  return {
    specHint: hints.spec,
    link: {
      projectId,
      workspaceId: str(search["workspaceId"]),
      leadId: str(search["leadId"]) || undefined,
      shape,
      clientName,
      phone: str(search["phone"]),
      jobType,
      beforeUrl: str(search["beforeUrl"]),
      renderUrl: str(search["renderUrl"]),
      interiorUrl: str(search["interiorUrl"]),
      accessoryPositions: Object.keys(hints.positions).length ? hints.positions : undefined,
      finishExtras: parseFinishExtras(raw),
      returnUrl: safeReturnUrl(str(search["returnUrl"])),
      importedAt: new Date().toISOString(),
    },
    projectName:
      str(search["projectName"]) || [jobType.replace(/_/g, " "), clientName].filter(Boolean).join(" "),
    location: str(search["location"]),
    notes: str(search["notes"]),
    items: modItems.length ? modItems : itemsForJobType(jobType),
  };
}

const STATUS: Record<CalculationStatus, string> = {
  estimasi_awal: "calculated",
  estimasi_terverifikasi: "approved",
  bom_siap_belanja: "production_ready",
};

/** Perintilan workshop: dihitung & dibelanjakan di SME, TIDAK dikirim ke KIS. */
export const WORKSHOP_MINOR_IDS = new Set([
  "sekrup", "sekrup-sambung", "paku-f30", "pin-ambalan", "fischer-s8", "lem-putih", "minifix", "dynabolt",
]);

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function buildKisEstimate(input: {
  kisProjectId: string;
  estimateId: string;
  results: CalculationResult[];
  bom: BomItem[];
  grandTotal: number | null;
  deepLinkUrl: string;
  extras?: KisFinishExtras | undefined;
}) {
  const ex = finishExtraLines(input.extras, input.results, input.bom);
  const baseBom = ex.dropEdging ? input.bom.filter((b) => b.group !== "edging") : input.bom;
  const allBom = [...baseBom, ...ex.add];
  const minorBom = allBom.filter((b) => WORKSHOP_MINOR_IDS.has(b.id));
  const fullBom = allBom.filter((b) => !WORKSHOP_MINOR_IDS.has(b.id));
  const workshopConsumablesCost = minorBom.reduce((a, b) => a + (b.total ?? 0), 0);
  const edgingCost = ex.dropEdging ? input.bom.filter((b) => b.group === "edging").reduce((a, b) => a + (b.total ?? 0), 0) : 0;
  const extraCost = ex.add.reduce((a, b) => a + (b.total ?? 0), 0);
  const materialCost = input.grandTotal == null ? 0 : input.grandTotal - edgingCost + extraCost;
  const order: CalculationStatus[] = ["estimasi_awal", "estimasi_terverifikasi", "bom_siap_belanja"];
  // Status project = status item terendah.
  const lowest = input.results.length
    ? input.results.reduce(
        (min, r) => (order.indexOf(r.status) < order.indexOf(min) ? r.status : min),
        "bom_siap_belanja" as CalculationStatus,
      )
    : null;
  const sheetCount: Record<string, number> = {};
  const hardwareCount: Record<string, number> = {};
  for (const b of fullBom) {
    if (b.group === "hardware") hardwareCount[slug(b.name)] = b.qty;
    else if (b.unit.toLowerCase().startsWith("lembar") || b.unit.toLowerCase() === "lbr")
      sheetCount[slug(b.name)] = b.qty;
    else if (b.group === "edging") sheetCount[`${slug(b.name)}_meters`] = b.qty;
  }
  const totalSheets = Object.entries(sheetCount)
    .filter(([k]) => !k.endsWith("_meters"))
    .reduce((a, [, v]) => a + v, 0);
  const totalHw = Object.values(hardwareCount).reduce((a, v) => a + v, 0);
  // Estimasi hari kerja WS: ±4 lembar/hari potong-rakit-finishing + 2 hari pasang & finishing.
  const estimatedDays = totalSheets ? Math.ceil(totalSheets / 4) + 2 : 0;
  // Daftar belanja per baris: kuantitas + harga acuan TACO (HPP). KIS menambah margin.
  const bom = fullBom.map((b) => ({
    group: b.group,
    name: b.name,
    qty: b.qty,
    unit: b.unit,
    unitPrice: b.unitPrice,
    total: b.total,
    needsConfirmation: b.unitPrice == null,
  }));
  // Kontrak 1 jalur KIS: qty beli selalu bulat ke atas (kecuali kaca per m²); HPL min 1 lembar.
  const shoppingList = fullBom.map((b) => {
    const code = b.id.startsWith("taco:") ? (b.id.slice(b.id.indexOf(":", 5) + 1).split("|")[0] ?? b.id) : b.id;
    const decimalOk = b.unit === "m²";
    let qty = decimalOk ? Math.round(b.qty * 100) / 100 : Math.ceil(b.qty - 1e-9);
    if (b.id.startsWith("hpl-") && qty < 1) qty = 1;
    const waste = decimalOk ? 0 : Math.round((qty - b.qty) * 100) / 100;
    const subtotal = b.unitPrice == null ? null : Math.round(qty * b.unitPrice);
    return { name: b.name, code, qty, unit: b.unit, unitPrice: b.unitPrice, subtotal, needsConfirmation: b.unitPrice == null, ...(waste > 0 ? { waste } : {}) };
  });
  const shopCost = shoppingList.reduce((a, s) => a + (s.subtotal ?? 0), 0) + workshopConsumablesCost;
  return {
    projectId: input.kisProjectId,
    estimateId: input.estimateId,
    status: lowest ? STATUS[lowest] : "draft",
    materialCost: input.grandTotal == null ? materialCost : shopCost,
    workdays: estimatedDays,
    shoppingList,
    /** sudah termasuk di materialCost; rinciannya hanya di SME */
    workshopConsumablesCost,
    estimatedMaterialCost: materialCost,
    priceBasis: `HET TACO ${TACO_HET_DATE} (PVC Board ${TACO_PVC_HET_DATE}) — HPP sebelum margin workshop`,
    sheetCount: totalSheets,
    hardwareCount: totalHw,
    estimatedDays,
    bom,
    summary: {
      estimatedDays,
      sheetCount,
      hardwareCount,
      lastCalculatedAt: new Date().toISOString(),
    },
    deepLinkUrl: input.deepLinkUrl,
  };
}

export function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function kisReturnLink(returnUrl: string, payload: object): string {
  const u = new URL(returnUrl);
  // Base64URL: KIS router mem-parse JSON mentah jadi object sehingga tidak terbaca.
  u.searchParams.set("estimate", toBase64Url(JSON.stringify(payload)));
  return u.toString();
}

/** Salin foto dari link KIS (aktif 1 jam) ke data URL. Gagal (CORS) → null. */
export async function fetchAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Spek tambahan KIS (kaca, list, lampu, aksesori di luar master). */
export interface KisFinishExtras {
  glass?: "dark" | "clear" | "fluted" | undefined;
  edge?: "list_gold" | "list_black" | "edging" | "tusir" | undefined;
  lighting?: "led" | "spot" | "led_spot" | undefined;
  /** Aksesori KIS yang belum ada di master SME, mis. ventilasi, hidrolik. */
  otherAccessories?: { id: string; qty: number }[] | undefined;
}

const GLASS_PRICE = { dark: 175000, clear: 140000, fluted: 295000 } as const;
const GLASS_NAME = { dark: "Kaca Riben / Gelap 5 mm", clear: "Kaca Bening 5 mm", fluted: "Kaca Fluted / Moru 5 mm" } as const;
const EXTRA_ACC: Record<string, { name: string; unit: string; qty: number; price: number }> = {
  ventilasi: { name: "Ventilasi Kisi-kisi Aluminium", unit: "pcs", qty: 2, price: 25000 },
  hidrolik: { name: "Engsel Hidrolik / Gas Spring Pintu Angkat", unit: "pcs", qty: 2, price: 20000 },
};

export function parseFinishExtras(raw: Record<string, unknown>): KisFinishExtras | undefined {
  const pick = <T extends string>(v: unknown, ok: readonly T[]) => (typeof v === "string" && (ok as readonly string[]).includes(v) ? (v as T) : undefined);
  const out: KisFinishExtras = {
    glass: pick(raw["glass"], ["dark", "clear", "fluted"] as const),
    edge: pick(raw["edge"], ["list_gold", "list_black", "edging", "tusir"] as const),
    lighting: pick(raw["lighting"], ["led", "spot", "led_spot"] as const),
  };
  const others: { id: string; qty: number }[] = [];
  if (Array.isArray(raw["accessories"])) {
    for (const a of raw["accessories"]) {
      const id = typeof a === "string" ? a : a && typeof a === "object" ? (a as { id?: unknown }).id : null;
      if (typeof id !== "string" || ACC_MAP[id] || !id.trim()) continue;
      const q = a && typeof a === "object" ? Number((a as { qty?: unknown }).qty) : NaN;
      others.push({ id, qty: q > 0 ? q : (EXTRA_ACC[id]?.qty ?? 1) });
    }
  }
  if (others.length) out.otherAccessories = others;
  return out.glass || out.edge || out.lighting || out.otherAccessories ? out : undefined;
}

const UPPER = /atas|upper|wall|gantung/i;
/** Baris belanja tambahan dari spek KIS. Harga tanpa price list resmi = null (perlu konfirmasi). */
export function finishExtraLines(extras: KisFinishExtras | undefined, results: CalculationResult[], bom: BomItem[]): { add: BomItem[]; dropEdging: boolean } {
  const add: BomItem[] = [];
  if (!extras) return { add, dropEdging: false };
  const line = (id: string, group: BomItem["group"], name: string, qty: number, unit: string, unitPrice: number | null, explanation: string): BomItem => ({
    id, group, name, qty, unit, unitPrice, total: unitPrice == null ? null : Math.round(unitPrice * qty), trace: [], explanation,
  });
  const parts = results.flatMap((r) => r.parts);
  if (extras.glass) {
    const doors = parts.filter((p) => UPPER.test(p.module_name) && /pintu|door/i.test(p.part_name));
    const m2 = Math.round(doors.reduce((a, p) => a + (p.length_mm * p.width_mm * p.qty) / 1e6, 0) * 100) / 100;
    const frame = Math.ceil(doors.reduce((a, p) => a + (2 * (p.length_mm + p.width_mm) * p.qty) / 1000, 0));
    add.push(line(`kaca-${extras.glass}`, "finishing", GLASS_NAME[extras.glass], m2, "m²", GLASS_PRICE[extras.glass], `Luas daun pintu kabinet atas (${doors.length} jenis daun)`));
    add.push(line("frame-alu-kaca", "hardware", "Frame / Profil Aluminium Pintu Kaca (batang 3 m)", Math.ceil(frame / 3), "batang", 195000, `Keliling daun pintu kabinet atas ${frame} m'`));
    add.push(line("fitting-pintu-kaca", "hardware", "Fitting / Engsel Pintu Frame Aluminium", doors.reduce((a, p) => a + p.qty, 0), "set", 43000, "1 set per daun pintu kaca"));
  }
  let dropEdging = false;
  if (extras.edge === "list_gold" || extras.edge === "list_black" || extras.edge === "tusir") {
    const meters = Math.ceil(results.reduce((a, r) => a + r.edgingMeters.reduce((b, e) => b + e.meters, 0), 0));
    dropEdging = true;
    const name = extras.edge === "list_gold" ? "Profil List Gold / T-Profile Aluminium Gold" : extras.edge === "list_black" ? "Profil List Hitam / T-Profile Aluminium Black" : "Tusir (cat tepi panel)";
    if (extras.edge === "tusir") add.push(line("tusir", "edging", name, 1, "paket", 25000, `Pengganti edging PVC — tepi ${meters} m'`));
    else add.push(line(extras.edge, "edging", name + " (batang 3 m)", Math.ceil(meters / 3), "batang", 48000, `Pengganti edging PVC — tepi ${meters} m'`));
  }
  if (extras.lighting) {
    const hasLed = bom.some((b) => b.id === "led-strip");
    if ((extras.lighting === "led" || extras.lighting === "led_spot") && !hasLed) {
      const bottoms = parts.filter((p) => UPPER.test(p.module_name) && /bawah|bottom|alas/i.test(p.part_name));
      const m = Math.ceil(bottoms.reduce((a, p) => a + (p.length_mm * p.qty) / 1000, 0));
      add.push(line("led-strip", "elektrik", "LED Strip 12V Warm White", m, "m'", 45000, "Panjang bawah kabinet atas"));
    }
    if (extras.lighting === "spot" || extras.lighting === "led_spot")
      add.push(line("lampu-spot", "elektrik", "Lampu Spot LED Kabinet", 1, "titik", 30000, "Jumlah titik spot perlu konfirmasi"));
    if (!bom.some((b) => b.id === "driver-led")) add.push(line("driver-led", "elektrik", "Trafo / Adaptor LED 12V", 1, "pcs", 165000, "1 trafo per sistem lampu"));
    add.push(line("kabel-saklar", "elektrik", "Kabel & Sakelar Sensor Lampu", 1, "set", 75000, "Paket instalasi lampu kabinet"));
  }
  for (const a of extras.otherAccessories ?? []) {
    const m = EXTRA_ACC[a.id];
    add.push(line(a.id, "hardware", m?.name ?? a.id.replace(/-/g, " "), a.qty, m?.unit ?? "pcs", m?.price ?? null, "Aksesori dipilih di KIS"));
  }
  return { add, dropEdging };
}
