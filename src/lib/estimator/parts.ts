import { findMaterial, findTemplate, templateForKind } from "./masters";
import type { EdgeSpec, ModuleSpec, Part } from "./types";

const NO_EDGE: EdgeSpec = { top: false, bottom: false, left: false, right: false };

let counter = 0;
function pid(): string {
  counter += 1;
  return `p${counter}`;
}
export function resetPartIds() {
  counter = 0;
}

interface PartInput {
  name: string;
  qty: number;
  length_mm: number;
  width_mm: number;
  materialId: string;
  faceA?: string | null;
  faceB?: string | null;
  edge?: Partial<EdgeSpec>;
  notes?: string;
  derivation: string;
}

function build(mod: ModuleSpec, input: PartInput): Part {
  const mat = findMaterial(input.materialId);
  return {
    id: pid(),
    part_name: input.name,
    module_id: mod.id,
    module_name: mod.name,
    qty: input.qty,
    length_mm: Math.round(input.length_mm * 10) / 10,
    width_mm: Math.round(input.width_mm * 10) / 10,
    thickness_mm: mat?.ketebalan_mm ?? 0,
    material_id: input.materialId,
    grain_direction: mat?.grain_direction ?? "none",
    finish_face_a: input.faceA ?? null,
    finish_face_b: input.faceB ?? null,
    edge: { ...NO_EDGE, ...(input.edge ?? {}) },
    edging_id: input.edge ? mod.edgingId : null,
    notes: input.notes ?? "",
    derivation: input.derivation,
  };
}

const CABINET_KINDS = new Set([
  "base_cabinet",
  "wall_cabinet",
  "tall_cabinet",
  "wardrobe",
  "drawer_module",
  "floating_cabinet",
  "shelf_unit",
]);

/** Lebar bersih dalam badan kabinet (selalu lebar luar dikurangi 2 tebal side). */
export function internalWidth(width_mm: number, sideThickness_mm: number): number {
  return width_mm - 2 * sideThickness_mm;
}

export function doorLeafWidth(
  width_mm: number,
  doors: number,
  clearance_mm: number,
  sliding: boolean,
): number {
  if (doors <= 0) return 0;
  if (sliding) {
    const overlap = 30;
    return (width_mm + overlap * (doors - 1)) / doors;
  }
  return (width_mm - clearance_mm * (doors + 1)) / doors;
}

/**
 * PART ENGINE — deterministik. Tidak ada AI di sini.
 * Ukuran turunan mengikuti panel_relationship dari construction template.
 */
export function generateParts(mod: ModuleSpec): Part[] {
  const tpl = findTemplate(mod.templateId) ?? templateForKind(mod.kind);
  if (!tpl) return [];
  const body = findMaterial(mod.bodyMaterialId);
  const t = body?.ketebalan_mm ?? 18;
  const back = findMaterial(mod.backMaterialId);
  const doorMat = findMaterial(mod.doorMaterialId) ?? body;
  const parts: Part[] = [];
  const inside = mod.finish.bodyInside.hplId;
  const outside = mod.finish.bodyOutside.hplId;
  const W = mod.width_mm;
  const H = mod.height_mm;
  const D = mod.depth_mm;
  const iw = internalWidth(W, t);
  const between = tpl.panel_relationship === "top_bottom_between_sides";

  if (CABINET_KINDS.has(mod.kind)) {
    const sideLength = between ? H : H - 2 * t;
    const tbLength = between ? iw : W;
    parts.push(
      build(mod, {
        name: "Side Panel",
        qty: 2,
        length_mm: sideLength,
        width_mm: D,
        materialId: mod.bodyMaterialId,
        faceA: inside,
        faceB: outside,
        edge: { left: true },
        derivation: between
          ? `Side = tinggi ${H} mm (top/bottom di antara side)`
          : `Side = tinggi ${H} - 2 × tebal ${t} (top/bottom menutup side)`,
      }),
      build(mod, {
        name: "Top Panel",
        qty: 1,
        length_mm: tbLength,
        width_mm: D,
        materialId: mod.bodyMaterialId,
        faceA: inside,
        faceB: outside,
        edge: { top: true },
        derivation: between
          ? `Top = lebar ${W} - 2 × tebal ${t} = ${tbLength} mm`
          : `Top = lebar penuh ${W} mm`,
      }),
      build(mod, {
        name: "Bottom Panel",
        qty: 1,
        length_mm: tbLength,
        width_mm: D,
        materialId: mod.bodyMaterialId,
        faceA: inside,
        faceB: outside,
        edge: { top: true },
        derivation: between
          ? `Bottom = lebar ${W} - 2 × tebal ${t} = ${tbLength} mm`
          : `Bottom = lebar penuh ${W} mm`,
      }),
    );

    if (mod.shelves > 0) {
      parts.push(
        build(mod, {
          name: "Shelf",
          qty: mod.shelves,
          length_mm: iw - 2,
          width_mm: Math.max(D - tpl.shelf_setback_mm - (back?.ketebalan_mm ?? 0), 50),
          materialId: mod.bodyMaterialId,
          faceA: inside,
          faceB: inside,
          edge: { top: true },
          derivation: `Shelf = lebar bersih ${iw} - 2 mm toleransi; depth ${D} - setback ${tpl.shelf_setback_mm} - tebal back ${back?.ketebalan_mm ?? 0}`,
        }),
      );
    }

    if (mod.hasBack && back) {
      // Back panel dipecah menjadi lembar bila melebihi lebar sheet.
      const strips = Math.max(1, Math.ceil(H / 1200));
      parts.push(
        build(mod, {
          name: "Back Panel",
          qty: strips,
          length_mm: W,
          width_mm: H / strips,
          materialId: back.id,
          derivation:
            strips === 1
              ? `Back panel penuh ${W} × ${H} mm, material ${back.nama_material}`
              : `Back panel ${W} × ${H} mm dibagi ${strips} lembar setinggi ${Math.round(H / strips)} mm (batas lebar sheet), material ${back.nama_material}`,
        }),
      );
    }

    if (mod.doors > 0 && mod.doorType !== "none" && doorMat) {
      const sliding = mod.doorType === "sliding";
      const leafW = doorLeafWidth(W, mod.doors, tpl.door_clearance_mm, sliding);
      const leafH = sliding ? H - 10 : H - 2 * tpl.door_clearance_mm;
      parts.push(
        build(mod, {
          name: sliding ? "Daun Pintu Sliding" : "Daun Pintu",
          qty: mod.doors,
          length_mm: leafH,
          width_mm: leafW,
          materialId: doorMat.id,
          faceA: mod.finish.doorFaceA.hplId,
          faceB: mod.finish.doorFaceB.hplId,
          edge: { top: true, bottom: true, left: true, right: true },
          derivation: sliding
            ? `Sliding ${mod.doors} daun, overlap 30 mm: (${W} + 30 × ${mod.doors - 1}) / ${mod.doors}`
            : `Swing ${mod.doors} daun, clearance ${tpl.door_clearance_mm} mm: (${W} - ${tpl.door_clearance_mm} × ${mod.doors + 1}) / ${mod.doors}`,
        }),
      );
    }

    if (mod.drawers > 0 && doorMat) {
      const frontH =
        mod.doors > 0
          ? 180
          : (H - tpl.door_clearance_mm * (mod.drawers + 1)) / mod.drawers;
      const frontW = W - 2 * tpl.door_clearance_mm;
      parts.push(
        build(mod, {
          name: "Front Laci",
          qty: mod.drawers,
          length_mm: frontH,
          width_mm: frontW,
          materialId: doorMat.id,
          faceA: mod.finish.doorFaceA.hplId,
          faceB: mod.finish.doorFaceB.hplId,
          edge: { top: true, bottom: true, left: true, right: true },
          derivation:
            mod.doors > 0
              ? `Front laci tinggi default 180 mm (modul campuran pintu + laci)`
              : `Front laci = (${H} - ${tpl.door_clearance_mm} × ${mod.drawers + 1}) / ${mod.drawers}`,
        }),
      );
      const boxMat = findMaterial("ply12") ?? body;
      const boxSideH = Math.max(frontH - 40, 80);
      const boxDepth = Math.max(D - 50, 100);
      const boxInner = iw - 26 - 2 * (boxMat?.ketebalan_mm ?? 12); // 13 mm rel tiap sisi
      if (boxMat) {
        parts.push(
          build(mod, {
            name: "Box Laci - Samping",
            qty: mod.drawers * 2,
            length_mm: boxDepth,
            width_mm: boxSideH,
            materialId: boxMat.id,
            derivation: `Depth ${D} - 50 mm clearance rel; tinggi front ${Math.round(frontH)} - 40 mm`,
          }),
          build(mod, {
            name: "Box Laci - Depan/Belakang",
            qty: mod.drawers * 2,
            length_mm: boxInner,
            width_mm: boxSideH,
            materialId: boxMat.id,
            derivation: `Lebar bersih ${iw} - 26 mm rel - 2 × tebal box ${boxMat.ketebalan_mm}`,
          }),
        );
      }
      const bottomMat = findMaterial("ply4");
      if (bottomMat) {
        parts.push(
          build(mod, {
            name: "Box Laci - Dasar",
            qty: mod.drawers,
            length_mm: boxInner,
            width_mm: boxDepth,
            materialId: bottomMat.id,
            derivation: `Dasar laci ${bottomMat.nama_material}`,
          }),
        );
      }
    }
    return parts;
  }

  if (mod.kind === "table_top") {
    const layers = mod.topLayers ?? 1;
    parts.push(
      build(mod, {
        name: "Top Table",
        qty: layers,
        length_mm: W,
        width_mm: D,
        materialId: mod.bodyMaterialId,
        // HPL HANYA pada top table — kaki/frame tidak dihitung HPL.
        faceA: mod.finish.bodyOutside.hplId,
        faceB: mod.finish.bodyInside.hplId,
        edge: { top: true, bottom: true, left: true, right: true },
        derivation: `Top table ${W} × ${D} mm, ${layers} layer`,
      }),
    );
    return parts;
  }

  if (mod.kind === "table_frame") {
    if (mod.frameMaterial && mod.frameMaterial !== "plywood") {
      // Frame besi / solid wood: bukan sheet material, tidak menghasilkan part panel & tanpa HPL.
      return parts;
    }
    parts.push(
      build(mod, {
        name: "Kaki Panel",
        qty: 2,
        length_mm: H,
        width_mm: D,
        materialId: mod.bodyMaterialId,
        derivation: `Kaki panel plywood ${H} × ${D} mm`,
      }),
      build(mod, {
        name: "Apron / Pengaku",
        qty: 1,
        length_mm: iw,
        width_mm: 150,
        materialId: mod.bodyMaterialId,
        derivation: `Apron = lebar bersih ${iw} mm × 150 mm`,
      }),
    );
    return parts;
  }

  if (mod.kind === "floating_shelf") {
    parts.push(
      build(mod, {
        name: "Panel Atas/Bawah Ambalan",
        qty: 2,
        length_mm: W,
        width_mm: D,
        materialId: mod.bodyMaterialId,
        faceA: outside,
        faceB: inside,
        edge: { top: true },
        derivation: `Ambalan ${W} × ${D} mm`,
      }),
      build(mod, {
        name: "Nosing Depan",
        qty: 1,
        length_mm: W,
        width_mm: Math.max(H, 20),
        materialId: mod.bodyMaterialId,
        faceA: outside,
        edge: { top: true },
        derivation: `Nosing tinggi ${H} mm`,
      }),
    );
    return parts;
  }

  if (mod.kind === "backdrop_panel" || mod.kind === "partition") {
    const stripCount = Math.max(1, Math.ceil(W / 1200));
    const stripWidth = W / stripCount;
    parts.push(
      build(mod, {
        name: mod.kind === "partition" ? "Panel Partisi" : "Panel Backdrop",
        qty: stripCount,
        length_mm: H,
        width_mm: stripWidth,
        materialId: mod.bodyMaterialId,
        faceA: outside,
        faceB: inside,
        edge: { top: true, bottom: true, left: true, right: true },
        derivation: `Bidang ${W} × ${H} mm dibagi ${stripCount} panel selebar ${Math.round(stripWidth)} mm (mengikuti construction: panel di atas rangka, bukan solid 18 mm penuh)`,
      }),
    );
    return parts;
  }

  if (mod.kind === "plinth") {
    parts.push(
      build(mod, {
        name: "Plinth Depan",
        qty: 1,
        length_mm: W,
        width_mm: H,
        materialId: mod.bodyMaterialId,
        faceA: outside,
        edge: { top: true },
        derivation: `Plinth ${W} × ${H} mm`,
      }),
      build(mod, {
        name: "Plinth Samping",
        qty: 2,
        length_mm: D,
        width_mm: H,
        materialId: mod.bodyMaterialId,
        derivation: `Plinth samping ${D} × ${H} mm`,
      }),
    );
    return parts;
  }

  if (mod.kind === "door_panel") {
    const leafW = doorLeafWidth(W, Math.max(mod.doors, 1), tpl.door_clearance_mm, false);
    parts.push(
      build(mod, {
        name: "Daun Pintu",
        qty: Math.max(mod.doors, 1),
        length_mm: H,
        width_mm: leafW,
        materialId: (doorMat ?? body)?.id ?? mod.bodyMaterialId,
        faceA: mod.finish.doorFaceA.hplId,
        faceB: mod.finish.doorFaceB.hplId,
        edge: { top: true, bottom: true, left: true, right: true },
        derivation: `Daun pintu ${Math.round(leafW)} × ${H} mm`,
      }),
    );
  }

  return parts;
}

export function generatePartsForModules(modules: ModuleSpec[]): Part[] {
  const out: Part[] = [];
  for (const mod of modules) {
    const base = generateParts(mod);
    for (const part of base) {
      out.push(mod.qty > 1 ? { ...part, qty: part.qty * mod.qty } : part);
    }
  }
  return out;
}
