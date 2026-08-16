import { findTemplate, templateForKind } from "./masters";
import type {
  DoorType,
  FurnitureItem,
  GeneratedDesignOption,
  ModuleKind,
  ModuleSpec,
} from "./types";

let seq = 0;
export function uid(prefix = "id"): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export interface ModuleDraft {
  kind: ModuleKind;
  name: string;
  qty?: number;
  width_mm: number;
  height_mm?: number;
  depth_mm?: number;
  doors?: number;
  doorType?: DoorType;
  drawers?: number;
  shelves?: number;
  hasBack?: boolean;
  hangingRod?: boolean;
  frameMaterial?: ModuleSpec["frameMaterial"];
  topLayers?: number;
}

/** Membuat ModuleSpec dari construction template (default terlihat, bukan tersembunyi). */
export function makeModule(draft: ModuleDraft): ModuleSpec {
  const tpl = templateForKind(draft.kind);
  return {
    id: uid("mod"),
    kind: draft.kind,
    name: draft.name,
    templateId: tpl?.id ?? "",
    qty: draft.qty ?? 1,
    width_mm: draft.width_mm,
    height_mm: draft.height_mm ?? tpl?.default_height_mm ?? 0,
    depth_mm: draft.depth_mm ?? tpl?.default_depth_mm ?? 0,
    doors: draft.doors ?? 0,
    doorType: draft.doorType ?? (draft.doors ? "swing" : "none"),
    drawers: draft.drawers ?? 0,
    shelves: draft.shelves ?? tpl?.default_shelves ?? 0,
    hasBack: draft.hasBack ?? Boolean(tpl?.back_material_id),
    hangingRod: draft.hangingRod ?? false,
    bodyMaterialId: tpl?.body_material_id ?? "ply18",
    backMaterialId: tpl?.back_material_id ?? null,
    doorMaterialId: tpl?.door_material_id ?? null,
    finish: {
      bodyOutside: { hplId: null },
      bodyInside: { hplId: null },
      doorFaceA: { hplId: null },
      doorFaceB: { hplId: null },
    },
    edgingId: "pvc1-white",
    topLayers: draft.topLayers,
    frameMaterial: draft.frameMaterial,
  };
}

export function templateName(mod: ModuleSpec): string {
  return findTemplate(mod.templateId)?.nama ?? mod.kind;
}

export interface Brief {
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  doors: number;
  drawers: number;
  shelves: number;
  doorType: DoorType;
}

/** Brief user (boleh null) -> Brief siap hitung. null count = 0, dimensi null = 0 (diblokir validasi). */
export function resolveBrief(b: {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  doors: number | null;
  drawers: number | null;
  shelves: number | null;
  doorType: DoorType;
}): Brief {
  return {
    width_mm: b.width_mm ?? 0,
    height_mm: b.height_mm ?? 0,
    depth_mm: b.depth_mm ?? 0,
    doors: b.doors ?? 0,
    drawers: b.drawers ?? 0,
    shelves: b.shelves ?? 0,
    doorType: b.doorType,
  };
}

/** Kategori bebas teks -> kategori kanonik untuk pemilihan konstruksi. */
export function normalizeCategory(category: string): string {
  const c = category.trim().toLowerCase();
  if (/lemari\s*baju|wardrobe|lemari\s*pakaian|^lemari$|lemari\s/.test(c)) return "Lemari Baju";
  if (/kitchen|dapur/.test(c)) return "Kitchen Set";
  if (/backdrop/.test(c)) return "Backdrop TV";
  if (/buffet/.test(c)) return "Buffet TV";
  if (/rak|ambalan/.test(c)) return "Rak / Ambalan";
  if (/partisi/.test(c)) return "Partisi";
  if (/pintu/.test(c)) return "Pintu Furniture";
  if (/meja|table|credenza|counter/.test(c)) return "Meja";
  return category;
}

/** Bagi total menjadi n bagian integer, sisa dibagi ke bay pertama (deterministik). */
export function splitEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  let rem = total - base * n;
  return Array.from({ length: n }, () => {
    const extra = rem > 0 ? 1 : 0;
    rem -= extra;
    return base + extra;
  });
}

/**
 * Pembagian bay wardrobe: JANGAN pernah menjadikan seluruh width 1 carcass.
 * Jumlah bay mengikuti jumlah pintu user bila ada, dibatasi max 1000 mm/bay.
 */
export function planBays(width_mm: number, doors: number): number[] {
  let n = doors > 0 ? doors : Math.max(1, Math.round(width_mm / 600));
  while (width_mm / n > 1000) n += 1;
  return splitEvenly(Math.round(width_mm), n);
}

    case "Meja":
    case "Meja Kerja":
    case "Meja Makan":
      // Meja: top table dan frame DIPISAH.
      return [
        makeModule({
          kind: "table_top",
          name: "Top Table",
          width_mm: W,
          height_mm: 36,
          depth_mm: D || 600,
          topLayers: 2,
        }),
        makeModule({
          kind: "table_frame",
          name: "Kaki / Frame",
          width_mm: W,
          height_mm: (H || 750) - 36,
          depth_mm: D || 600,
          frameMaterial: "besi",
        }),
      ];
    case "Buffet TV":
      return [
        makeModule({
          kind: "base_cabinet",
          name: "Body Buffet",
          width_mm: W,
          height_mm: H || 450,
          depth_mm: D || 400,
          doors: brief.doors,
          doorType: brief.doorType === "sliding" ? "sliding" : "swing",
          drawers: brief.drawers,
          shelves: brief.shelves,
        }),
        makeModule({
          kind: "plinth",
          name: "Kaki / Plinth",
          width_mm: W,
          height_mm: 100,
          depth_mm: D || 400,
        }),
      ];
    case "Backdrop TV":
      return [
        makeModule({
          kind: "backdrop_panel",
          name: "Panel Backdrop",
          width_mm: W,
          height_mm: H,
          depth_mm: 40,
        }),
        makeModule({
          kind: "floating_shelf",
          name: "Ambalan Gantung",
          width_mm: Math.min(W, 1200),
          height_mm: 40,
          depth_mm: 250,
        }),
      ];
    case "Rak / Ambalan":
      return [
        makeModule({
          kind: "shelf_unit",
          name: "Rak",
          width_mm: W,
          height_mm: H,
          depth_mm: D || 350,
          shelves: brief.shelves || 4,
        }),
      ];
    case "Partisi":
      return [makeModule({ kind: "partition", name: "Partisi", width_mm: W, height_mm: H })];
    case "Pintu Furniture":
      return [
        makeModule({
          kind: "door_panel",
          name: "Pintu",
          width_mm: W,
          height_mm: H,
          doors: brief.doors || 1,
        }),
      ];
    default:
      return [
        makeModule({
          kind: "base_cabinet",
          name: category,
          width_mm: W,
          height_mm: H,
          depth_mm: D,
          doors: brief.doors,
          doorType: brief.doorType,
          drawers: brief.drawers,
          shelves: brief.shelves,
        }),
      ];
  }
}

/**
 * Alternatif desain BUKAN AI: 3 varian struktural deterministik dari ukuran user.
 * Bila provider AI tersedia, service AI dapat menggantikan/melengkapi fungsi ini,
 * tetapi setiap opsi tetap wajib memiliki structured model + BOM sendiri.
 */
export function buildDesignOptions(
  category: string,
  brief: Brief,
): GeneratedDesignOption[] {
  const dims = { width_mm: brief.width_mm, height_mm: brief.height_mm, depth_mm: brief.depth_mm };
  const variants: { name: string; description: string; brief: Brief }[] = [
    {
      name: "Model 1 — Minimalis Swing",
      description: "Pintu swing, laci minimal, rak standar. Part paling sedikit.",
      brief: {
        ...brief,
        doorType: "swing",
        doors: Math.max(2, Math.round(brief.width_mm / 600)),
        drawers: Math.max(brief.drawers, 2),
        shelves: Math.max(brief.shelves, 3),
      },
    },
    {
      name: "Model 2 — Sliding",
      description: "Pintu sliding, tanpa engsel, rak lebih banyak, laci lebih banyak.",
      brief: {
        ...brief,
        doorType: "sliding",
        doors: 3,
        drawers: Math.max(brief.drawers, 4),
        shelves: Math.max(brief.shelves, 5),
      },
    },
    {
      name: "Model 3 — Kombinasi",
      description: "Kombinasi pintu swing + laci internal + rak penuh. Part paling banyak.",
      brief: {
        ...brief,
        doorType: "swing",
        doors: Math.max(4, Math.round(brief.width_mm / 500)),
        drawers: Math.max(brief.drawers, 6),
        shelves: Math.max(brief.shelves, 7),
      },
    },
  ];

  return variants.map((v, i) => ({
    id: uid("opt"),
    option_number: i + 1,
    name: v.name,
    description: v.description,
    structured_model: composeModules(category, v.brief),
    overall_dimensions: dims,
    image_reference: null,
    selected: false,
    created_at: new Date().toISOString(),
  }));
}

export function newFurnitureItem(category: string, name: string): FurnitureItem {
  return {
    id: uid("item"),
    category,
    name,
    hasDrawing: null,
    drawings: [],
    extraction: null,
    designOptions: [],
    selectedOptionId: null,
    modules: [],
    confirmedConstruction: false,
    confirmedDimensions: false,
    wasteFactor: 0.1,
    sheetMode: "potong",
  };
}
