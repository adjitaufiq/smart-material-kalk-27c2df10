import { materialLabel } from "./terminology";
import { calculateSheets, nestParts } from "./cutlist";
import {
  findEdging,
  findHardware,
  findHpl,
  findMaterial,
  findTemplate,
  hingeCountForDoor,
  hingeCountForDoorHeight,

  LED_DRIVER_SAFETY_MARGIN,
} from "./masters";
import { generatePartsForModules, resetPartIds } from "./parts";
import { meters } from "./units";
import type {
  Assumption,
  BomItem,
  CalculationResult,
  CalculationStatus,
  CostSummary,
  FurnitureItem,
  Issue,
  ModuleSpec,
  Part,
  SheetResult,
} from "./types";

/* ------------------------------------------------------------------ */
/* FINISHING / HPL                                                     */
/* ------------------------------------------------------------------ */

/** Setiap finished FACE menjadi satu part HPL tersendiri (bisa 2 sisi berbeda). */
export function hplFaceParts(parts: Part[]): Map<string, Part[]> {
  const byHpl = new Map<string, Part[]>();
  for (const p of parts) {
    for (const face of [p.finish_face_a, p.finish_face_b]) {
      if (!face) continue;
      const hpl = findHpl(face);
      if (!hpl) continue;
      const facePart: Part = {
        ...p,
        id: `${p.id}-hpl-${face}`,
        part_name: `${p.part_name} (HPL ${hpl.kode})`,
        material_id: face,
        grain_direction: hpl.arah_serat,
      };
      const list = byHpl.get(face);
      if (list) list.push(facePart);
      else byHpl.set(face, [facePart]);
    }
  }
  return byHpl;
}

export function calculateHpl(parts: Part[]): { results: SheetResult[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const results: SheetResult[] = [];
  for (const [hplId, faceParts] of hplFaceParts(parts)) {
    const hpl = findHpl(hplId);
    if (!hpl) continue;
    const { layouts, unplaced } = nestParts(
      faceParts,
      hpl.panjang_mm,
      hpl.lebar_mm,
      3,
      hplId,
    );
    for (const name of new Set(unplaced)) {
      issues.push({
        severity: "error",
        code: "HPL_PART_LARGER_THAN_SHEET",
        message: `Face "${name}" tidak muat pada lembar HPL ${hpl.brand} ${hpl.kode} (${hpl.panjang_mm} × ${hpl.lebar_mm} mm)${hpl.arah_serat !== "none" ? " dengan arah serat terkunci" : ""}.`,
      });
    }
    const usedArea = layouts.reduce((a, l) => a + l.usedArea_mm2, 0);
    const sheetArea = hpl.panjang_mm * hpl.lebar_mm;
    results.push({
      materialId: hplId,
      materialName: `${hpl.brand} ${hpl.kode} — ${hpl.nama}`,
      sheets: layouts.length,
      layouts,
      usedArea_mm2: usedArea,
      sheetArea_mm2: sheetArea,
      utilization: layouts.length ? usedArea / (layouts.length * sheetArea) : 0,
      mode: "potong",
      wasteFactor: null,
      unplaced,
    });
  }
  return { results, issues };
}

/* ------------------------------------------------------------------ */
/* EDGING                                                              */
/* ------------------------------------------------------------------ */

export function calculateEdging(parts: Part[], wasteFactor: number) {
  const map = new Map<string, { meters: number; trace: string[] }>();
  for (const p of parts) {
    if (!p.edging_id) continue;
    let length = 0;
    if (p.edge.top) length += p.length_mm;
    if (p.edge.bottom) length += p.length_mm;
    if (p.edge.left) length += p.width_mm;
    if (p.edge.right) length += p.width_mm;
    if (length <= 0) continue;
    const total = (length * p.qty) / 1000;
    const entry = map.get(p.edging_id) ?? { meters: 0, trace: [] };
    entry.meters += total;
    entry.trace.push(
      `${p.module_name} — ${p.part_name} ×${p.qty}: ${Math.round(length)} mm/pc = ${total.toFixed(2)} m`,
    );
    map.set(p.edging_id, entry);
  }
  return [...map.entries()].map(([edgingId, v]) => {
    const master = findEdging(edgingId);
    return {
      edgingId,
      name: master?.nama ?? edgingId,
      meters: Math.round(v.meters * (1 + wasteFactor) * 100) / 100,
      trace: [...v.trace, `Waste edging ${(wasteFactor * 100).toFixed(0)}% ditambahkan sekali.`],
    };
  });
}

/* ------------------------------------------------------------------ */
/* HARDWARE AUTOMATOR                                                  */
/* ------------------------------------------------------------------ */

function addHw(
  map: Map<string, BomItem>,
  hardwareId: string,
  qty: number,
  trace: string,
  group: BomItem["group"] = "hardware",
) {
  const master = findHardware(hardwareId);
  if (!master || qty <= 0) return;
  const existing = map.get(hardwareId);
  if (existing) {
    existing.qty += qty;
    existing.trace.push(trace);
    existing.total = existing.unitPrice !== null ? existing.unitPrice * existing.qty : null;
    return;
  }
  map.set(hardwareId, {
    id: hardwareId,
    group,
    name: `${master.nama}${master.brand ? ` (${master.brand})` : ""}`,
    qty,
    unit: master.unit,
    unitPrice: master.harga,
    total: master.harga !== null ? master.harga * qty : null,
    trace: [trace],
    explanation: master.rule_default,
  });
}

export function calculateHardware(
  modules: ModuleSpec[],
  overrides: Record<string, number> = {},
): BomItem[] {
  const map = new Map<string, BomItem>();
  for (const mod of modules) {
    const tpl = findTemplate(mod.templateId);
    const clearance = tpl?.door_clearance_mm ?? 3;
    const factor = mod.qty;
    if (mod.doors > 0) {
      if (mod.doorType === "sliding") {
        // Sliding TIDAK menggunakan engsel.
        addHw(
          map,
          "rel-sliding",
          mod.doors * factor,
          `${mod.name}: ${mod.doors} daun sliding × ${factor} modul = ${mod.doors * factor} set (track + roller + stopper)`,
        );
      } else if (mod.doorType !== "none") {
        const leafHeight = mod.height_mm - 2 * clearance;
        const leafWidth = (mod.width_mm - clearance * (mod.doors + 1)) / Math.max(mod.doors, 1);
        const doorMat = findMaterial(mod.doorMaterialId) ?? findMaterial(mod.bodyMaterialId);
        const rule = hingeCountForDoor({
          height_mm: leafHeight,
          width_mm: leafWidth,
          thickness_mm: doorMat?.ketebalan_mm ?? 18,
        });
        const override = mod.hingeOverride ?? overrides[`hinge:${mod.id}`] ?? null;
        const perDoor = override ?? rule.count;
        addHw(
          map,
          "engsel-sendok",
          perDoor * mod.doors * factor,
          `${mod.name}: ${override !== null ? `override user ${override} engsel/pintu` : rule.reason} × ${mod.doors} pintu × ${factor} modul`,
        );
      }

      addHw(
        map,
        "handle",
        mod.doors * factor,
        `${mod.name}: 1 handle per daun pintu × ${mod.doors} × ${factor}`,
      );
    }
    if (mod.drawers > 0) {
      addHw(
        map,
        "rel-laci",
        mod.drawers * factor,
        `${mod.name}: 1 set rel per laci × ${mod.drawers} × ${factor}`,
      );
      addHw(
        map,
        "handle",
        mod.drawers * factor,
        `${mod.name}: 1 handle per front laci × ${mod.drawers} × ${factor}`,
      );
    }
    if (mod.hangingRod) {
      addHw(map, "hanger-rod", factor, `${mod.name}: 1 hanger rod per hanging section`);
    }
    if (
      ["base_cabinet", "wall_cabinet", "tall_cabinet", "wardrobe", "floating_cabinet", "shelf_unit", "drawer_module"].includes(
        mod.kind,
      )
    ) {
      const joints = 2 + mod.shelves;
      addHw(
        map,
        "minifix",
        joints * 4 * factor,
        `${mod.name}: ${joints} sambungan struktural × 4 set × ${factor} modul`,
      );
    }
  }
  return [...map.values()];
}

export function calculateElectrical(modules: ModuleSpec[]): BomItem[] {
  const items: BomItem[] = [];
  let totalMeters = 0;
  let totalWatt = 0;
  const trace: string[] = [];
  for (const mod of modules) {
    if (!mod.led?.enabled) continue;
    const m = (mod.led.length_mm * mod.led.segments * mod.qty) / 1000;
    totalMeters += m;
    totalWatt += m * mod.led.watt_per_m;
    trace.push(
      `${mod.name}: ${mod.led.segments} segmen × ${mod.led.length_mm} mm × ${mod.qty} modul = ${m.toFixed(2)} m @ ${mod.led.watt_per_m} W/m`,
    );
  }
  if (totalMeters <= 0) return items;
  const strip = findHardware("led-strip");
  const profile = findHardware("profil-alu");
  const driver = findHardware("driver-led");
  const meterQty = Math.round(totalMeters * 100) / 100;
  if (strip) {
    items.push({
      id: "led-strip",
      group: "elektrik",
      name: strip.nama,
      qty: meterQty,
      unit: "meter",
      unitPrice: strip.harga,
      total: strip.harga !== null ? strip.harga * meterQty : null,
      trace,
      explanation: "Total panjang seluruh segmen LED.",
    });
  }
  if (profile) {
    const profQty = Math.ceil(totalMeters);
    items.push({
      id: "profil-alu",
      group: "elektrik",
      name: profile.nama,
      qty: profQty,
      unit: "meter",
      unitPrice: profile.harga,
      total: profile.harga !== null ? profile.harga * profQty : null,
      trace: [`Dibulatkan ke atas dari ${meterQty} m LED`],
      explanation: "1 meter profil per meter LED (dibulatkan ke atas).",
    });
  }
  if (driver) {
    const required = totalWatt * (1 + LED_DRIVER_SAFETY_MARGIN);
    const qty = Math.max(1, Math.ceil(required / 60));
    items.push({
      id: "driver-led",
      group: "elektrik",
      name: `${driver.nama} 60W`,
      qty,
      unit: "pcs",
      unitPrice: driver.harga,
      total: driver.harga !== null ? driver.harga * qty : null,
      trace: [
        `Total beban ${totalWatt.toFixed(1)} W + safety margin ${(LED_DRIVER_SAFETY_MARGIN * 100).toFixed(0)}% = ${required.toFixed(1)} W → ${qty} driver 60 W`,
      ],
      explanation: "Kapasitas driver dengan safety margin configurable.",
    });
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* VALIDATION — ANTI SALAH BELI                                        */
/* ------------------------------------------------------------------ */

export function validateItem(item: FurnitureItem): Issue[] {
  const issues: Issue[] = [];
  if (item.modules.length === 0) {
    issues.push({
      severity: "error",
      code: "NO_MODULE",
      message: "Belum ada modul furniture. Tambahkan minimal satu modul.",
    });
  }
  for (const mod of item.modules) {
    const dims: [string, number][] = [
      ["width", mod.width_mm],
      ["height", mod.height_mm],
      ["depth", mod.depth_mm],
    ];
    for (const [label, value] of dims) {
      if (mod.kind === "door_panel" && label === "depth") continue;
      if (!Number.isFinite(value) || value === 0) {
        issues.push({
          severity: "error",
          code: "DIMENSION_ZERO",
          message: `${mod.name}: ${label} belum diisi (0 mm).`,
          moduleId: mod.id,
        });
      } else if (value < 0) {
        issues.push({
          severity: "error",
          code: "DIMENSION_NEGATIVE",
          message: `${mod.name}: ${label} bernilai negatif.`,
          moduleId: mod.id,
        });
      }
    }
    const body = findMaterial(mod.bodyMaterialId);
    if (!body) {
      issues.push({
        severity: "error",
        code: "THICKNESS_UNAVAILABLE",
        message: `${mod.name}: material body / ketebalan belum dipilih.`,
        moduleId: mod.id,
      });
    }
    if (!findTemplate(mod.templateId)) {
      issues.push({
        severity: "error",
        code: "CONSTRUCTION_MISSING",
        message: `${mod.name}: tipe konstruksi belum dipilih.`,
        moduleId: mod.id,
      });
    }
    if (mod.hasBack && !mod.backMaterialId) {
      issues.push({
        severity: "warning",
        code: "BACK_MATERIAL_MISSING",
        message: `${mod.name}: back panel aktif tetapi material back belum dipilih.`,
        moduleId: mod.id,
      });
    }
    if (
      mod.doors > 0 &&
      !mod.finish.doorFaceA.hplId &&
      !mod.finish.doorFaceB.hplId
    ) {
      issues.push({
        severity: "warning",
        code: "HPL_FACE_NOT_SELECTED",
        message: `${mod.name}: finishing face pintu belum dipilih.`,
        moduleId: mod.id,
      });
    }
    if (mod.doorType === "sliding" && mod.doors < 2) {
      issues.push({
        severity: "warning",
        code: "HARDWARE_INCOMPATIBLE",
        message: `${mod.name}: sistem sliding umumnya membutuhkan minimal 2 daun.`,
        moduleId: mod.id,
      });
    }
  }
  if (item.extraction && !item.extraction.confirmed_by_user) {
    issues.push({
      severity: "error",
      code: "EXTRACTION_UNCONFIRMED",
      message: "Hasil ekstraksi gambar belum dikonfirmasi user.",
    });
  }
  const ambiguous = item.extraction?.normalized.filter((f) => f.ambiguous) ?? [];
  if (ambiguous.length > 0) {
    issues.push({
      severity: "error",
      code: "AMBIGUOUS_DRAWING_DIMENSION",
      message: `Ukuran pada gambar masih ambigu: ${ambiguous.map((f) => f.label).join(", ")}.`,
    });
  }
  if (!item.confirmedDimensions) {
    issues.push({
      severity: "error",
      code: "DIMENSION_UNCONFIRMED",
      message: "Ukuran belum dikonfirmasi user.",
    });
  }
  if (!item.confirmedConstruction) {
    issues.push({
      severity: "error",
      code: "CONSTRUCTION_UNCONFIRMED",
      message: "Konstruksi belum dikonfirmasi user.",
    });
  }
  if (item.sheetMode === "cepat") {
    issues.push({
      severity: "warning",
      code: "SHEET_MODE_CEPAT",
      message:
        "Mode Estimasi Cepat memakai waste factor, bukan nesting nyata. Untuk BOM siap belanja gunakan Estimasi Potong.",
    });
  }
  return issues;

}

/* ------------------------------------------------------------------ */
/* ASSUMPTIONS                                                         */
/* ------------------------------------------------------------------ */

export function collectAssumptions(item: FurnitureItem): Assumption[] {
  const out: Assumption[] = [];
  for (const mod of item.modules) {
    const tpl = findTemplate(mod.templateId);
    const body = findMaterial(mod.bodyMaterialId);
    const back = findMaterial(mod.backMaterialId);
    out.push({
      key: `${mod.id}-body`,
      label: `${mod.name} — Body`,
      value: materialLabel(body?.nama_material) ?? "belum dipilih",
      isDefault: body?.id === tpl?.body_material_id,
    });
    if (mod.hasBack) {
      out.push({
        key: `${mod.id}-back`,
        label: `${mod.name} — Back panel`,
        value: materialLabel(back?.nama_material) ?? "belum dipilih",
        isDefault: back?.id === tpl?.back_material_id,
      });
    }
    out.push({
      key: `${mod.id}-depth`,
      label: `${mod.name} — Depth`,
      value: `${mod.depth_mm} mm`,
      isDefault: tpl?.default_depth_mm === mod.depth_mm,
    });
    out.push({
      key: `${mod.id}-construction`,
      label: `${mod.name} — Konstruksi`,
      value:
        tpl?.panel_relationship === "top_bottom_between_sides"
          ? "Top/bottom di antara side panel"
          : "Top/bottom menutup side panel",
      isDefault: true,
    });
    if (mod.doors > 0 && mod.doorType !== "sliding" && mod.doorType !== "none") {
      const clearance = tpl?.door_clearance_mm ?? 3;
      const doorMat = findMaterial(mod.doorMaterialId) ?? findMaterial(mod.bodyMaterialId);
      const rule = hingeCountForDoor({
        height_mm: mod.height_mm - 2 * clearance,
        width_mm: (mod.width_mm - clearance * (mod.doors + 1)) / mod.doors,
        thickness_mm: doorMat?.ketebalan_mm ?? 18,
      });
      out.push({
        key: `${mod.id}-hinge`,
        label: `${mod.name} — Engsel`,
        value:
          mod.hingeOverride != null
            ? `${mod.hingeOverride} per pintu (override user)`
            : `${rule.count} per pintu — ${rule.reason}`,
        isDefault: mod.hingeOverride == null,
      });
      out.push({
        key: `${mod.id}-clearance`,
        label: `${mod.name} — Clearance pintu`,
        value: `${clearance} mm per sisi`,
        isDefault: true,
      });
    }
    if (mod.drawers > 0) {
      const rel = findHardware("rel-laci");
      out.push({
        key: `${mod.id}-drawer`,
        label: `${mod.name} — Konstruksi laci`,
        value: `Box plywood 12 mm, dasar plywood 4 mm, clearance rel 13 mm/sisi${rel ? `, rel ${rel.brand} ${rel.nama}` : ""}`,
        isDefault: true,
      });
    }
    if (mod.shelves > 0) {
      out.push({
        key: `${mod.id}-shelf`,
        label: `${mod.name} — Setback shelf`,
        value: `${tpl?.shelf_setback_mm ?? 20} mm dari muka`,
        isDefault: true,
      });
    }
    const bodyMat = findMaterial(mod.bodyMaterialId);
    if (bodyMat) {
      out.push({
        key: `${mod.id}-kerf`,
        label: `${mod.name} — Kerf mata potong`,
        value: `${bodyMat.kerf_mm} mm`,
        isDefault: true,
      });
    }
  }
  for (const hw of calculateHardware(item.modules)) {
    out.push({
      key: `hw-${hw.id}`,
      label: `Hardware default — ${hw.name}`,
      value: `${hw.qty} ${hw.unit} — ${hw.explanation}`,
      isDefault: true,
    });
  }
  out.push({
    key: "waste",
    label: "Waste",
    value:
      item.sheetMode === "potong"
        ? "Tidak ditambahkan — sisa dihitung dari nesting"
        : `${(item.wasteFactor * 100).toFixed(0)}% (fallback estimasi cepat)`,
    isDefault: item.wasteFactor === 0.1,
  });
  out.push({
    key: "mode",
    label: "Mode perhitungan lembar",
    value: item.sheetMode === "potong" ? "Estimasi Potong (nesting)" : "Estimasi Cepat (area-based)",
    isDefault: item.sheetMode === "cepat",
  });
  return out;
}


/* ------------------------------------------------------------------ */
/* MAIN ENGINE                                                         */
/* ------------------------------------------------------------------ */

export function calculateItem(item: FurnitureItem): CalculationResult {
  resetPartIds();
  const parts = generatePartsForModules(item.modules);
  const validation = validateItem(item);
  const { results: sheets, issues: sheetIssues } = calculateSheets(
    parts,
    item.sheetMode,
    item.wasteFactor,
  );
  const { results: hplSheets, issues: hplIssues } = calculateHpl(parts);
  const edgingMeters = calculateEdging(parts, item.wasteFactor);
  const hardware = calculateHardware(item.modules);
  const electrical = calculateElectrical(item.modules);
  const issues = [...validation, ...sheetIssues, ...hplIssues];

  const bom: BomItem[] = [];
  for (const s of sheets) {
    const mat = findMaterial(s.materialId);
    bom.push({
      id: `mat-${s.materialId}`,
      group: "material",
      name: s.materialName,
      qty: s.sheets,
      unit: mat?.satuan ?? "lembar",
      unitPrice: mat?.harga ?? null,
      total: mat?.harga != null ? mat.harga * s.sheets : null,
      trace: traceForSheets(s, parts),
      explanation:
        s.mode === "potong"
          ? `Hasil nesting: ${s.layouts.length} lembar, utilisasi ${(s.utilization * 100).toFixed(1)}%, kerf ${mat?.kerf_mm ?? 0} mm.`
          : `Area-based: total luas part ${(s.usedArea_mm2 / 1e6).toFixed(2)} m² + waste ${((s.wasteFactor ?? 0) * 100).toFixed(0)}% ÷ ${(s.sheetArea_mm2 / 1e6).toFixed(2)} m² per lembar.`,
    });
  }
  for (const s of hplSheets) {
    const hpl = findHpl(s.materialId);
    bom.push({
      id: `hpl-${s.materialId}`,
      group: "finishing",
      name: s.materialName,
      qty: s.sheets,
      unit: "lembar",
      unitPrice: hpl?.harga ?? null,
      total: hpl?.harga != null ? hpl.harga * s.sheets : null,
      trace: traceForSheets(s, parts),
      explanation: `Dihitung per FACE. Utilisasi ${(s.utilization * 100).toFixed(1)}%${hpl && hpl.arah_serat !== "none" ? ", arah serat dikunci" : ""}.`,
    });
  }
  for (const e of edgingMeters) {
    const master = findEdging(e.edgingId);
    bom.push({
      id: `edg-${e.edgingId}`,
      group: "edging",
      name: e.name,
      qty: e.meters,
      unit: "meter",
      unitPrice: master?.harga_per_meter ?? null,
      total: master?.harga_per_meter != null ? master.harga_per_meter * e.meters : null,
      trace: e.trace,
      explanation: "Total panjang sisi part yang di-edging.",
    });
  }
  bom.push(...hardware, ...electrical);

  const cost = summarizeCost(bom);
  const status = resolveStatus(item, issues);

  return {
    status,
    parts,
    sheets,
    hplSheets,
    edgingMeters,
    hardware,
    electrical,
    bom,
    assumptions: collectAssumptions(item),
    issues,
    cost,
    computedAt: new Date().toISOString(),
  };
}

function traceForSheets(s: SheetResult, parts: Part[]): string[] {
  const names = new Set(s.layouts.flatMap((l) => l.placed.map((p) => p.partId)));
  const related = parts.filter(
    (p) => p.material_id === s.materialId || names.has(p.id) || names.has(`${p.id}-hpl-${s.materialId}`),
  );
  const lines = related.map(
    (p) =>
      `${p.module_name} — ${p.part_name}: ${p.qty} pcs @ ${p.length_mm} × ${p.width_mm} mm`,
  );
  if (s.layouts.length > 0) {
    lines.push(
      ...s.layouts.map(
        (l) =>
          `Sheet ${l.sheetIndex}: ${l.placed.length} part, terpakai ${(l.usedArea_mm2 / 1e6).toFixed(2)} m²`,
      ),
    );
  }
  return lines;
}

export function summarizeCost(bom: BomItem[]): CostSummary {
  let incomplete = false;
  const sum = (group: BomItem["group"]) => {
    const items = bom.filter((b) => b.group === group);
    if (items.length === 0) return 0;
    let total = 0;
    for (const i of items) {
      if (i.total === null) incomplete = true;
      else total += i.total;
    }
    return total;
  };
  const material = sum("material");
  const finishing = sum("finishing");
  const edging = sum("edging");
  const hardware = sum("hardware");
  const elektrik = sum("elektrik");
  return {
    material,
    finishing,
    edging,
    hardware,
    elektrik,
    grandTotal: material + finishing + edging + hardware + elektrik,
    incomplete,
  };
}

export function resolveStatus(item: FurnitureItem, issues: Issue[]): CalculationStatus {
  const hasError = issues.some((i) => i.severity === "error");
  if (hasError) return "estimasi_awal";
  const hasWarning = issues.some((i) => i.severity === "warning");
  if (item.sheetMode !== "potong" || hasWarning) return "estimasi_terverifikasi";
  return "bom_siap_belanja";
}

export const STATUS_LABEL: Record<CalculationStatus, string> = {
  estimasi_awal: "Estimasi Awal — belum siap digunakan untuk pembelian material",
  estimasi_terverifikasi: "Estimasi Terverifikasi — boleh dipakai untuk estimasi produksi",
  bom_siap_belanja: "BOM Siap Belanja",
};

export function mergeProjectBom(results: CalculationResult[]): BomItem[] {
  const map = new Map<string, BomItem>();
  for (const r of results) {
    for (const item of r.bom) {
      const existing = map.get(item.id);
      if (existing) {
        existing.qty += item.qty;
        existing.trace.push(...item.trace);
        existing.total = existing.unitPrice !== null ? existing.unitPrice * existing.qty : null;
      } else {
        map.set(item.id, { ...item, trace: [...item.trace] });
      }
    }
  }
  return [...map.values()];
}

export { meters };
