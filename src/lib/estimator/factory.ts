import { findTemplate, templateForKind } from "./masters";
import type {
  DoorType,
  FurnitureItem,
  GeneratedDesignOption,
  ModuleKind,
  ModuleSpec,
  RequirementChange,
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

/**
 * MODULE COMPOSER deterministik. Nilai user (dimensi, pintu, laci, shelf)
 * adalah SOURCE OF TRUTH dan tidak boleh diubah diam-diam.
 */
export function composeModules(category: string, briefInput: Brief): ModuleSpec[] {
  const brief = briefInput;
  const { width_mm: W, height_mm: H, depth_mm: D } = brief;
  switch (normalizeCategory(category)) {
    case "Kitchen Set": {
      const bays = planBays(W, brief.doors > 0 ? Math.ceil(brief.doors / 2) : 0);
      const doorsPer = splitEvenly(brief.doors, bays.length);
      const drawersPer = splitEvenly(brief.drawers, bays.length);
      const shelvesPer = splitEvenly(brief.shelves, bays.length);
      return bays.map((w, i) =>
        makeModule({
          kind: "base_cabinet",
          name: `Kabinet Bawah ${i + 1}`,
          width_mm: w,
          height_mm: H || 720,
          depth_mm: D || 550,
          doors: doorsPer[i] ?? 0,
          doorType: brief.doorType,
          drawers: drawersPer[i] ?? 0,
          shelves: shelvesPer[i] ?? 0,
        }),
      );
    }
    case "Lemari Baju": {
      // Side panel tidak boleh melebihi panjang lembar: badan utama + loft bila perlu.
      const mainHeight = H > 2100 ? 2100 : H;
      const loftHeight = H - mainHeight;
      const bays = planBays(W, brief.doors);
      const doorsPer = splitEvenly(brief.doors, bays.length);
      const drawersPer = splitEvenly(brief.drawers, bays.length);
      const shelvesPer = splitEvenly(brief.shelves, bays.length);
      const mods = bays.map((w, i) =>
        makeModule({
          kind: "wardrobe",
          name: `Bay Lemari ${i + 1}`,
          width_mm: w,
          height_mm: mainHeight,
          depth_mm: D || 600,
          doors: doorsPer[i] ?? 0,
          doorType: brief.doorType,
          drawers: drawersPer[i] ?? 0,
          shelves: shelvesPer[i] ?? 0,
          hangingRod: (shelvesPer[i] ?? 0) === 0 || i === 0,
        }),
      );
      if (loftHeight >= 200) {
        bays.forEach((w, i) =>
          mods.push(
            makeModule({
              kind: "tall_cabinet",
              name: `Loft Cabinet ${i + 1}`,
              width_mm: w,
              height_mm: loftHeight,
              depth_mm: D || 600,
              // Tidak menambah pintu/laci/shelf tanpa persetujuan user.
              doors: 0,
              doorType: "none",
              shelves: 0,
            }),
          ),
        );
      }
      return mods;
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

const CHANGE_LABEL: Record<string, string> = {
  width_mm: "Lebar",
  height_mm: "Tinggi",
  depth_mm: "Depth",
  doors: "Jumlah pintu",
  drawers: "Jumlah laci",
  shelves: "Jumlah shelf",
  doorType: "Tipe pintu",
};

/** Diff antara input user dan brief varian model. */
export function requirementChanges(original: Brief, variant: Brief): RequirementChange[] {
  const out: RequirementChange[] = [];
  for (const key of Object.keys(CHANGE_LABEL) as (keyof Brief)[]) {
    if (original[key] !== variant[key]) {
      out.push({
        field: key,
        label: CHANGE_LABEL[key] ?? key,
        from: original[key],
        to: variant[key],
      });
    }
  }
  return out;
}

/**
 * Alternatif desain deterministik. Model 1 SELALU sama persis dengan input user.
 * Model lain boleh berbeda, tetapi perbedaannya wajib dicatat dan disetujui user.
 */
export function buildDesignOptions(category: string, brief: Brief): GeneratedDesignOption[] {
  const dims = { width_mm: brief.width_mm, height_mm: brief.height_mm, depth_mm: brief.depth_mm };
  const variants: { name: string; description: string; brief: Brief }[] = [
    {
      name: "Model 1 — Sesuai Input Anda",
      description: "Struktur mengikuti persis kebutuhan yang Anda isi.",
      brief: { ...brief },
    },
    {
      name: "Model 2 — Sliding",
      description: "Pintu sliding, tanpa engsel, rak lebih banyak.",
      brief: {
        ...brief,
        doorType: "sliding",
        doors: Math.max(2, Math.min(brief.doors || 2, 3)),
        shelves: Math.max(brief.shelves, 5),
      },
    },
    {
      name: "Model 3 — Kombinasi",
      description: "Kombinasi pintu + laci internal + rak penuh. Part paling banyak.",
      brief: {
        ...brief,
        doorType: "swing",
        doors: Math.max(brief.doors, 4),
        drawers: Math.max(brief.drawers, 4),
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
    brief_snapshot: v.brief,
    requirement_changes: requirementChanges(brief, v.brief),
  }));
}

/**
 * Terapkan model terpilih. Bila model mengubah kebutuhan user dan belum disetujui,
 * item DIKEMBALIKAN APA ADANYA (input user tetap source of truth).
 */
export function applyDesignOption(
  item: FurnitureItem,
  option: GeneratedDesignOption,
  approved: boolean,
): { item: FurnitureItem; blocked: boolean } {
  if (option.requirement_changes.length > 0 && !approved) {
    return { item, blocked: true };
  }
  const b = option.brief_snapshot;
  return {
    item: {
      ...item,
      selectedOptionId: option.id,
      modules: option.structured_model.map((m) => ({ ...m, id: uid("mod") })),
      briefing: item.briefing
        ? {
            ...item.briefing,
            width_mm: b.width_mm,
            height_mm: b.height_mm,
            depth_mm: b.depth_mm,
            doors: b.doors,
            drawers: b.drawers,
            shelves: b.shelves,
            doorType: b.doorType,
          }
        : item.briefing,
    },
    blocked: false,
  };
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
