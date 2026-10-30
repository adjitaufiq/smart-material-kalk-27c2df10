/**
 * Integrasi Kerjaku Interior Studio (KIS).
 * Masuk: KIS membuka /import?projectId=...&returnUrl=...
 * Balik: SME membuka returnUrl?estimate=<base64url JSON>
 */
import { defaultSelection, itemsFromSelections, type PresetItem } from "./estimator/presets";
import { DEFAULT_QUICK_SPEC } from "./estimator/quick-spec";
import type { BomItem, CalculationResult, CalculationStatus, QuickSpec } from "./estimator/types";

export const KIS_ORIGIN = "https://kerjaku-design-forge.lovable.app";

export interface KisLink {
  projectId: string;
  workspaceId: string;
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

const OPTS = {
  outside: ["hpl", "hpl_premium", "duco"],
  inside: ["blockmin", "tacosheet", "hpl"],
  hinge: ["slowmo", "biasa"],
  slide: ["dt_slowmo", "dt_biasa", "push", "tandem"],
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
    if (typeof v === "string" && (allowed as readonly string[]).includes(v)) {
      (spec as unknown as Record<string, string>)[k] = v;
      found = true;
    }
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

export function parseKisSearch(search: Record<string, unknown>): KisImport | null {
  const projectId = str(search["projectId"]);
  if (!projectId) return null;
  const jobType = str(search["jobType"]) || "custom";
  const clientName = str(search["clientName"]);
  const hints = parseSpecHints(search);
  return {
    specHint: hints.spec,
    link: {
      projectId,
      workspaceId: str(search["workspaceId"]),
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
    items: itemsForJobType(jobType),
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
  return {
    projectId: input.kisProjectId,
    estimateId: input.estimateId,
    status: lowest ? STATUS[lowest] : "draft",
    estimatedMaterialCost: input.grandTotal ?? 0,
    summary: {
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
