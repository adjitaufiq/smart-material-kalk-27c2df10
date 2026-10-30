import { makeModule } from "./factory";
import type { ModuleSpec, QuickSpec } from "./types";

/** Daftar pertanyaan spek cepat — dipakai UI, satu sumber label. */
export const QUICK_QUESTIONS: {
  key: Exclude<keyof QuickSpec, "accessories">;
  title: string;
  options: { value: string; label: string; hint?: string }[];
}[] = [
  {
    key: "body",
    title: "Bahan bodi kabinet",
    options: [
      { value: "pvc", label: "PVC Board 18 mm", hint: "Anti air & rayap — umum kelas medium–high" },
      { value: "ply", label: "Multiplek 18 mm", hint: "Kuat & hemat" },
      { value: "hybrid", label: "Hybrid", hint: "Modul sink PVC Board, lainnya multiplek" },
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
      { value: "slowmo", label: "Slowmotion (soft close)" },
      { value: "biasa", label: "Engsel biasa" },
    ],
  },
  {
    key: "slide",
    title: "Rel laci",
    options: [
      { value: "dt_slowmo", label: "Double track slowmo" },
      { value: "dt_biasa", label: "Double track biasa" },
      { value: "push", label: "Push to open" },
      { value: "tandem", label: "Tandem / undermount" },
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
  accessories: [],
};

const SLIDE_ID: Record<QuickSpec["slide"], string> = {
  dt_slowmo: "rel-dt-slowmo",
  dt_biasa: "rel-dt-biasa",
  push: "rel-push",
  tandem: "rel-laci",
};

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
  const outsideHpl = spec.outside === "duco" ? null : spec.outside === "hpl" ? "taco-002aa" : "aica-hg";
  const insideHpl =
    spec.inside === "hpl" ? "taco-001" : spec.inside === "tacosheet" ? "tacosheet-white" : null;
  let accessoriesPlaced = false;

  const out = base.map((m) => {
    if (!CABINET_KINDS.has(m.kind)) {
      // plinth dll: hanya bahan bodi
      if (m.kind === "plinth") return { ...m, bodyMaterialId: spec.body === "pvc" ? "pvc18" : "ply18" };
      return m;
    }
    const isSink = /sink|cuci/i.test(m.name);
    const usePvc = spec.body === "pvc" || (spec.body === "hybrid" && isSink);
    const body = usePvc ? "pvc18" : spec.inside === "blockmin" ? "blockmin18" : "ply18";
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
      backMaterialId: m.hasBack ? (usePvc ? "pvc18" : "ply9") : m.backMaterialId,
      finish: {
        bodyOutside: { hplId: outsideHpl },
        bodyInside: { hplId: insideHpl },
        doorFaceA: { hplId: outsideHpl },
        doorFaceB: { hplId: insideHpl },
      },
      hingeId: spec.hinge === "slowmo" ? "engsel-sendok" : "engsel-biasa",
      drawerSlideId: SLIDE_ID[spec.slide],
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
      bodyMaterialId: spec.body === "ply" ? "ply18" : "pvc18",
      finish: {
        ...top.finish,
        bodyOutside: { hplId: outsideHpl ?? "taco-002aa" },
        bodyInside: { hplId: null },
      },
    });
  }
  return out;
}
