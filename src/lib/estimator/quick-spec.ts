import { makeModule } from "./factory";
import { tacoHplId } from "./taco-pricing";

/** HPL luar saat KIS belum mengirim kode — harga kosong, ditandai perlu konfirmasi. */
export const TACO_HPL_PENDING = tacoHplId("TH-BELUM-DIPILIH", undefined, "HPL TACO — kode belum dipilih di KIS");
import type { ModuleSpec, QuickSpec } from "./types";

/** Daftar pertanyaan spek cepat — dipakai UI, satu sumber label. */
export const QUICK_QUESTIONS: {
  key: Exclude<keyof QuickSpec, "accessories" | "hplOutside" | "hplInside">;
  title: string;
  options: { value: string; label: string; hint?: string }[];
}[] = [
  {
    key: "body",
    title: "Bahan bodi kabinet",
    options: [
      { value: "pvc", label: "TACO PVC Board 18 mm (TPB-18)", hint: "Anti air & rayap — umum kelas medium–high" },
      { value: "pvc_eco", label: "ECO PVC Board 18 mm (ECB-18)", hint: "PVC Board versi ekonomis" },
      { value: "ply", label: "Multiplek 18 mm", hint: "Kuat & hemat" },
      { value: "hybrid", label: "Hybrid", hint: "Modul sink PVC Board, lainnya multiplek" },
      { value: "blockboard", label: "Blockboard 18 mm" },
      { value: "blockmin_1s", label: "Blockmin Putih 1 Sisi 18 mm", hint: "Sisi dalam sudah putih" },
      { value: "blockmin_2s", label: "Blockmin Putih 2 Sisi 18 mm", hint: "Kedua sisi sudah putih" },
    ],
  },
  {
    key: "top",
    title: "Top table (meja atas)",
    options: [
      { value: "none", label: "Tanpa top", hint: "Granit / solid surface dari vendor lain" },
      { value: "double", label: "Top dobel 36 mm + HPL", hint: "2 lapis 18 mm" },
    ],
  },
  {
    key: "outside",
    title: "Finishing bagian luar",
    options: [
      { value: "hpl", label: "HPL standar / motif kayu" },
      { value: "hpl_premium", label: "HPL premium / high gloss" },
      { value: "duco", label: "Cat duco" },
    ],
  },
  {
    key: "inside",
    title: "Finishing bagian dalam",
    options: [
      { value: "blockmin", label: "Blockmin putih", hint: "Tanpa HPL dalam" },
      { value: "tacosheet", label: "Tacosheet" },
      { value: "hpl", label: "HPL" },
    ],
  },
  {
    key: "hinge",
    title: "Engsel pintu",
    options: [
      { value: "slowmo", label: "Slowmotion TACO ET-01", hint: "Zinc — standar kabinet" },
      { value: "slowmo_stainless", label: "Slowmotion TACO ET-02", hint: "Stainless anti karat — area sink" },
      { value: "biasa", label: "Engsel biasa TACO ET-06" },
    ],
  },
  {
    key: "slide",
    title: "Rel laci",
    options: [
      { value: "dt_slowmo", label: "Double track slowmo (BBS 008 SC)" },
      { value: "dt_biasa", label: "Double track biasa (BBS 006 FE)" },
      { value: "dt_eco", label: "Double track ekonomis (FE BBS 010)" },
      { value: "push", label: "Push to open (BBS 009 PO)" },
      { value: "tandem", label: "Tandem / undermount (US 001 SC)" },
      { value: "roller", label: "Roller putih (RLT)" },
    ],
  },
  {
    key: "glue",
    title: "Lem kuning HPL",
    options: [
      { value: "active", label: "TACO Active", hint: "Galon 2,5 kg / blek 10 kg" },
      { value: "starmax", label: "TACO Starmax", hint: "Galon 2,5 kg / blek 10 kg" },
    ],
  },
];

export const QUICK_ACCESSORIES = [
  { id: "rak-piring", label: "Rak piring & gelas" },
  { id: "rak-sayur", label: "Rak sayur tarik" },
  { id: "rak-bumbu", label: "Rak bumbu / botol tarik" },
  { id: "tray-sendok", label: "Tray sendok laci" },
];

export const DEFAULT_QUICK_SPEC: QuickSpec = {
  body: "pvc",
  top: "none",
  outside: "hpl",
  inside: "blockmin",
  hinge: "slowmo",
  slide: "dt_slowmo",
  glue: "active",
  accessories: [],
};

const SLIDE_ID: Record<QuickSpec["slide"], string> = {
  dt_slowmo: "taco-bbs008sc",
  dt_biasa: "taco-bbs006fe",
  dt_eco: "taco-bbs010fe",
  push: "taco-bbs009po",
  tandem: "taco-us001sc",
  roller: "taco-rlt",
};
const HINGE_ID: Record<QuickSpec["hinge"], string> = {
  slowmo: "engsel-sendok",
  slowmo_stainless: "engsel-et02",
  biasa: "engsel-biasa",
};
const PVC_ID = (spec: QuickSpec) => (spec.body === "pvc_eco" ? "ecb18" : "pvc18");
/** Papan olahan non-PVC dari KIS → master bahan bodi. */
const BOARD_ID: Partial<Record<QuickSpec["body"], string>> = {
  blockboard: "blockboard18",
  blockmin_1s: "blockmin18",
  blockmin_2s: "blockmin2s18",
};
const isPvcBody = (spec: QuickSpec) => spec.body === "pvc" || spec.body === "pvc_eco";

const CABINET_KINDS = new Set([
  "base_cabinet",
  "wall_cabinet",
  "tall_cabinet",
  "wardrobe",
  "floating_cabinet",
  "drawer_module",
  "shelf_unit",
]);

export const QUICK_TOP_PREFIX = "Top Table Kitchen";

/**
 * Terapkan jawaban spek cepat ke seluruh modul. Ukuran TIDAK diubah;
 * hanya bahan, finishing, hardware & aksesori. Top dobel ditambah sebagai modul terpisah.
 */
export function applyQuickSpec(modules: ModuleSpec[], spec: QuickSpec): ModuleSpec[] {
  const base = modules.filter((m) => m.name !== QUICK_TOP_PREFIX);
  const kisOut = spec.hplOutside?.code ? tacoHplId(spec.hplOutside.code, spec.hplOutside.group, spec.hplOutside.name) : null;
  const kisIn = spec.hplInside?.code ? tacoHplId(spec.hplInside.code, spec.hplInside.group, spec.hplInside.name) : null;
  // Tanpa kode dari KIS: HPL TACO "kode belum dipilih" (harga kosong → perlu konfirmasi), bukan motif tebakan.
  const outsideHpl = spec.outside === "duco" ? null : (kisOut ?? TACO_HPL_PENDING);
  // Blockmin sudah putih di sisi dalam: tidak perlu HPL/TACO Sheet dalam.
  const insideHpl = spec.body === "blockmin_1s" || spec.body === "blockmin_2s" ? null :
    spec.inside === "hpl" ? (kisIn ?? "taco-001") : spec.inside === "tacosheet" ? "tacosheet-white" : null;
  let accessoriesPlaced = false;

  const out = base.map((m) => {
    if (!CABINET_KINDS.has(m.kind)) {
      // plinth dll: hanya bahan bodi
      if (m.kind === "plinth") return { ...m, bodyMaterialId: isPvcBody(spec) || spec.body === "hybrid" ? PVC_ID(spec) : "ply18" };
      return m;
    }
    const isSink = /sink|cuci/i.test(m.name);
    const usePvc = isPvcBody(spec) || (spec.body === "hybrid" && isSink);
    const body = usePvc ? PVC_ID(spec) : BOARD_ID[spec.body] ?? (spec.inside === "blockmin" ? "blockmin18" : "ply18");
    let extra: string[] | undefined = m.extraHardware;
    if (!accessoriesPlaced && (m.kind === "base_cabinet" || m.kind === "drawer_module")) {
      extra = [...spec.accessories];
      accessoriesPlaced = true;
    } else {
      extra = undefined;
    }
    return {
      ...m,
      bodyMaterialId: body,
      doorMaterialId: body,
      backMaterialId: m.hasBack ? (usePvc ? PVC_ID(spec) : "ply9") : m.backMaterialId,
      finish: {
        bodyOutside: { hplId: outsideHpl },
        bodyInside: { hplId: insideHpl },
        doorFaceA: { hplId: outsideHpl },
        doorFaceB: { hplId: insideHpl },
      },
      hingeId: HINGE_ID[spec.hinge] ?? "engsel-sendok",
      drawerSlideId: SLIDE_ID[spec.slide] ?? "taco-bbs008sc",
      glueType: spec.glue ?? "active",
      ducoFinish: spec.outside === "duco",
      extraHardware: extra,
    };
  });
  if (!accessoriesPlaced && spec.accessories.length > 0 && out[0]) {
    out[0] = { ...out[0], extraHardware: [...spec.accessories] };
  }

  const bases = out.filter((m) => m.kind === "base_cabinet");
  if (spec.top === "double" && bases.length > 0) {
    const width = bases.reduce((s, m) => s + m.width_mm * m.qty, 0);
    const depth = Math.max(...bases.map((m) => m.depth_mm));
    const top = makeModule({ kind: "table_top", name: QUICK_TOP_PREFIX, width_mm: width, height_mm: 36, depth_mm: depth });
    out.push({
      ...top,
      topLayers: 2,
      bodyMaterialId: isPvcBody(spec) || spec.body === "hybrid" ? PVC_ID(spec) : BOARD_ID[spec.body] ?? "ply18",
      finish: {
        ...top.finish,
        bodyOutside: { hplId: outsideHpl ?? TACO_HPL_PENDING },
        bodyInside: { hplId: null },
      },
    });
  }
  return out;
}
