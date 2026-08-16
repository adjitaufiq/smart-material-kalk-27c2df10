import { materialLabel } from "./terminology";
import { findMaterial } from "./masters";
import type { Issue, Part, PlacedPart, SheetLayout, SheetResult } from "./types";

interface Piece {
  partId: string;
  part_name: string;
  l: number; // dimensi searah panjang part
  w: number;
  rotatable: boolean;
}

function explode(parts: Part[]): Piece[] {
  const pieces: Piece[] = [];
  for (const p of parts) {
    for (let i = 0; i < p.qty; i += 1) {
      pieces.push({
        partId: p.id,
        part_name: p.part_name,
        l: p.length_mm,
        w: p.width_mm,
        // GRAIN: part dengan arah serat terkunci tidak boleh dirotate saat nesting.
        rotatable: p.grain_direction === "none",
      });
    }
  }
  return pieces;
}

/**
 * MODE 2 — Estimasi Potong.
 * Shelf-based first-fit-decreasing guillotine nesting, memperhitungkan kerf
 * dan mengunci rotasi part yang memiliki arah serat.
 */
export function nestParts(
  parts: Part[],
  sheetLength: number,
  sheetWidth: number,
  kerf: number,
  materialId: string,
): { layouts: SheetLayout[]; unplaced: string[] } {
  const pieces = explode(parts);
  const unplaced: string[] = [];
  const fits = (l: number, w: number) => l <= sheetLength && w <= sheetWidth;

  const usable = pieces.filter((p) => {
    if (fits(p.l, p.w)) return true;
    if (p.rotatable && fits(p.w, p.l)) return true;
    unplaced.push(p.part_name);
    return false;
  });

  // Orientasi awal: sisi terpanjang mengikuti panjang sheet bila diizinkan.
  const oriented = usable.map((p) => {
    let x = p.l;
    let y = p.w;
    let rotated = false;
    if (p.rotatable && y > x && fits(y, x)) {
      x = p.w;
      y = p.l;
      rotated = true;
    }
    if (!fits(x, y)) {
      x = p.w;
      y = p.l;
      rotated = !rotated;
    }
    return { ...p, x, y, rotated };
  });

  oriented.sort((a, b) => b.y - a.y || b.x - a.x);

  const layouts: SheetLayout[] = [];
  interface Row {
    y: number;
    height: number;
    cursorX: number;
  }
  const sheetRows: Row[][] = [];

  const newSheet = () => {
    layouts.push({
      sheetIndex: layouts.length + 1,
      materialId,
      sheet_length_mm: sheetLength,
      sheet_width_mm: sheetWidth,
      placed: [],
      usedArea_mm2: 0,
    });
    sheetRows.push([]);
  };

  for (const piece of oriented) {
    let placed = false;
    for (let s = 0; s < layouts.length && !placed; s += 1) {
      const layout = layouts[s];
      const rows = sheetRows[s];
      if (!layout || !rows) continue;
      for (const row of rows) {
        const needX = piece.x + (row.cursorX > 0 ? kerf : 0);
        if (row.cursorX + needX <= sheetLength && piece.y <= row.height) {
          const x = row.cursorX + (row.cursorX > 0 ? kerf : 0);
          layout.placed.push(pp(piece, x, row.y));
          layout.usedArea_mm2 += piece.x * piece.y;
          row.cursorX = x + piece.x;
          placed = true;
          break;
        }
      }
      if (placed) break;
      const usedY = rows.reduce((acc, r) => Math.max(acc, r.y + r.height), 0);
      const rowY = usedY > 0 ? usedY + kerf : 0;
      if (rowY + piece.y <= sheetWidth) {
        const row: Row = { y: rowY, height: piece.y, cursorX: piece.x };
        rows.push(row);
        layout.placed.push(pp(piece, 0, rowY));
        layout.usedArea_mm2 += piece.x * piece.y;
        placed = true;
      }
    }
    if (!placed) {
      newSheet();
      const layout = layouts[layouts.length - 1];
      const rows = sheetRows[sheetRows.length - 1];
      if (!layout || !rows) continue;
      rows.push({ y: 0, height: piece.y, cursorX: piece.x });
      layout.placed.push(pp(piece, 0, 0));
      layout.usedArea_mm2 += piece.x * piece.y;
    }
  }

  return { layouts, unplaced };
}

function pp(
  piece: { partId: string; part_name: string; x: number; y: number; rotated: boolean },
  x: number,
  y: number,
): PlacedPart {
  return {
    partId: piece.partId,
    part_name: piece.part_name,
    x,
    y,
    length_mm: piece.x,
    width_mm: piece.y,
    rotated: piece.rotated,
  };
}

/** MODE 1 — Estimasi Cepat: area-based + waste. Hanya untuk "Estimasi awal". */
export function quickSheetEstimate(
  parts: Part[],
  sheetArea_mm2: number,
  wasteFactor: number,
): { sheets: number; usedArea_mm2: number } {
  const usedArea_mm2 = parts.reduce((acc, p) => acc + p.qty * p.length_mm * p.width_mm, 0);
  // Waste hanya diterapkan SEKALI di sini, tidak diterapkan ulang di BOM.
  const sheets = Math.ceil((usedArea_mm2 * (1 + wasteFactor)) / sheetArea_mm2);
  return { sheets, usedArea_mm2 };
}

export function calculateSheets(
  parts: Part[],
  mode: "cepat" | "potong",
  wasteFactor: number,
): { results: SheetResult[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const byMaterial = new Map<string, Part[]>();
  for (const p of parts) {
    const list = byMaterial.get(p.material_id);
    if (list) list.push(p);
    else byMaterial.set(p.material_id, [p]);
  }

  const results: SheetResult[] = [];
  for (const [materialId, group] of byMaterial) {
    const mat = findMaterial(materialId);
    if (!mat) {
      issues.push({
        severity: "error",
        code: "MATERIAL_NOT_FOUND",
        message: `Material "${materialId}" tidak ada di master material.`,
      });
      continue;
    }
    const sheetArea = mat.panjang_mm * mat.lebar_mm;
    if (mode === "cepat") {
      const { sheets, usedArea_mm2 } = quickSheetEstimate(group, sheetArea, wasteFactor);
      results.push({
        materialId,
        materialName: materialLabel(mat.nama_material),
        sheets,
        layouts: [],
        usedArea_mm2,
        sheetArea_mm2: sheetArea,
        utilization: sheets > 0 ? usedArea_mm2 / (sheets * sheetArea) : 0,
        mode,
        wasteFactor,
        unplaced: [],
      });
      continue;
    }

    const { layouts, unplaced } = nestParts(
      group,
      mat.panjang_mm,
      mat.lebar_mm,
      mat.kerf_mm,
      materialId,
    );
    for (const name of new Set(unplaced)) {
      issues.push({
        severity: "error",
        code: "PART_LARGER_THAN_SHEET",
        message: `Part "${name}" lebih besar dari lembar ${materialLabel(mat.nama_material)} (${mat.panjang_mm} × ${mat.lebar_mm} mm) atau tidak muat karena arah serat terkunci.`,
      });
    }
    const usedArea_mm2 = layouts.reduce((acc, l) => acc + l.usedArea_mm2, 0);
    results.push({
      materialId,
      materialName: materialLabel(mat.nama_material),
      sheets: layouts.length,
      layouts,
      usedArea_mm2,
      sheetArea_mm2: sheetArea,
      utilization: layouts.length > 0 ? usedArea_mm2 / (layouts.length * sheetArea) : 0,
      mode,
      // Waste tidak ditambahkan lagi: sisa lembar sudah menjadi hasil nesting.
      wasteFactor: null,
      unplaced,
    });
  }

  results.sort((a, b) => a.materialName.localeCompare(b.materialName));
  return { results, issues };
}
