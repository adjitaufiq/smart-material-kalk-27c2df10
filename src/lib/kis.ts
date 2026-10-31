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
}) {
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
  for (const b of input.bom) {
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
  const bom = input.bom.map((b) => ({
    group: b.group,
    name: b.name,
    qty: b.qty,
    unit: b.unit,
    unitPrice: b.unitPrice,
    total: b.total,
    needsConfirmation: b.unitPrice == null,
  }));
  // Kontrak 1 jalur KIS: shoppingList { name, code, qty, unit, unitPrice, subtotal }.
  const shoppingList = input.bom.map((b) => {
    const code = b.id.startsWith("taco:") ? (b.id.slice(b.id.indexOf(":", 5) + 1).split("|")[0] ?? b.id) : b.id;
    return { name: b.name, code, qty: b.qty, unit: b.unit, unitPrice: b.unitPrice, subtotal: b.total, needsConfirmation: b.unitPrice == null };
  });
  return {
    projectId: input.kisProjectId,
    estimateId: input.estimateId,
    status: lowest ? STATUS[lowest] : "draft",
    materialCost: input.grandTotal ?? 0,
    workdays: estimatedDays,
    shoppingList,
    estimatedMaterialCost: input.grandTotal ?? 0,
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
