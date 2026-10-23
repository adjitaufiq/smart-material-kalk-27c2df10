/**
 * JEMBATAN GAMBAR KERJA -> MESIN HITUNG.
 *
 * - Komponen panel dari gambar (2 ukuran + tebal) -> Part potong apa adanya.
 * - Komponen berbentuk kotak (3 ukuran besar, mis. "Badan Lemari 200×240×60")
 *   atau gambar tampak tanpa rincian komponen (hanya ukuran overall) ->
 *   disusun jadi modul workshop lewat composeModules (bay, plinth, sekat, pintu, laci).
 * - Ukuran dari gambar tidak pernah diubah. Data yang kosong menjadi issue, bukan default diam-diam.
 */
import { composeModules } from "./factory";
import type { ConfirmedExtractionSnapshot, DrawingComponent } from "./drawing-model";
import { EDGING_MASTER, HPL_MASTER, MATERIAL_MASTER } from "./masters";
import type { EdgeSpec, Issue, ModuleSpec, Part } from "./types";

/** batas tebal: ukuran <= ini dianggap ketebalan, bukan dimensi panel */
const THICKNESS_MAX = 50;

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();

function thicknessFromText(text: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*mm/.exec(text);
  return m ? Number(m[1]!.replace(",", ".")) : null;
}

export function matchMaterial(
  text: string | null,
  thickness: number | null,
): { id: string; exact: boolean } {
  const t = lower(text);
  const cat = /mdf/.test(t)
    ? "mdf"
    : /block\s*board|blokboard/.test(t)
      ? "blockboard"
      : "plywood";
  const th = thickness ?? thicknessFromText(t) ?? 18;
  const sameCat = MATERIAL_MASTER.filter((m) => m.aktif && m.kategori === cat);
  const exact = sameCat.find((m) => m.ketebalan_mm === th);
  if (exact) return { id: exact.id, exact: Boolean(text) };
  const ply = MATERIAL_MASTER.filter((m) => m.aktif && m.kategori === "plywood");
  const closest = [...(sameCat.length ? sameCat : ply)].sort(
    (a, b) => Math.abs(a.ketebalan_mm - th) - Math.abs(b.ketebalan_mm - th),
  )[0]!;
  return { id: closest.id, exact: false };
}

function matchHpl(code: string | null, brand: string | null): string | null {
  const c = lower(code).replace(/\s+/g, "");
  if (c) {
    const hit = HPL_MASTER.find((h) => lower(h.kode).replace(/\s+/g, "").includes(c) || c.includes(lower(h.kode).replace(/[\s-]+/g, "")));
    if (hit) return hit.id;
  }
  const b = lower(brand);
  if (b) {
    const hit = HPL_MASTER.find((h) => lower(h.brand) === b);
    if (hit) return hit.id;
  }
  return null;
}

function matchEdging(text: string): string {
  const t = lower(text);
  const two = /2\s*mm/.test(t);
  const oak = /oak|kayu|wood/.test(t);
  const hit = EDGING_MASTER.find(
    (e) => e.ketebalan_mm === (two ? 2 : 1) && (oak ? /oak/i.test(e.nama) : /putih/i.test(e.nama)),
  );
  return (hit ?? EDGING_MASTER[0]!).id;
}

export interface DrawingPartsResult {
  parts: Part[];
  issues: Issue[];
}

let seq = 0;

/** Komponen panel (2 dimensi besar) -> Part potong. Komponen kotak dilewati (lihat modulesFromDrawing). */
export function partsFromDrawingComponents(components: DrawingComponent[]): DrawingPartsResult {
  seq = 0;
  const parts: Part[] = [];
  const issues: Issue[] = [];
  for (const comp of components) {
    const dimValues = comp.dims
      .map((d) => d.value_mm.value)
      .filter((v): v is number => v !== null && v > 0);
    const big = dimValues.filter((v) => v > THICKNESS_MAX).sort((a, b) => b - a);
    const small = dimValues.filter((v) => v <= THICKNESS_MAX);
    if (big.length >= 3) continue; // kotak -> modul
    if (big.length < 2) {
      issues.push({
        severity: "error",
        code: "DRAWING_DIM_MISSING",
        message: `${comp.name}: ukuran panel belum lengkap di gambar (butuh panjang & lebar). Lengkapi di step Material.`,
      });
      continue;
    }
    const layers = comp.layers.value && comp.layers.value > 1 ? comp.layers.value : 1;
    const thickness = comp.thickness_mm.value ?? small[0] ?? thicknessFromText(lower(comp.material.value));
    if (thickness === null) {
      issues.push({
        severity: "error",
        code: "DRAWING_THICKNESS_MISSING",
        message: `${comp.name}: ketebalan belum tercantum. Sementara dihitung Plywood 18 mm.`,
      });
    }
    const mat = matchMaterial(comp.material.value, thickness);
    if (!comp.material.value) {
      issues.push({
        severity: "warning",
        code: "DRAWING_MATERIAL_MISSING",
        message: `${comp.name}: jenis material tidak tercantum, dihitung sebagai plywood.`,
      });
    } else if (!mat.exact) {
      issues.push({
        severity: "warning",
        code: "DRAWING_MATERIAL_APPROX",
        message: `${comp.name}: "${comp.material.value}" tidak ada di master, dipakai material terdekat.`,
      });
    }

    const fin = lower(comp.finishing.value);
    const hasHpl = /hpl/.test(fin) || comp.hplCode.value !== null || comp.hplBrand.value !== null;
    let hplId: string | null = null;
    if (hasHpl) {
      hplId = matchHpl(comp.hplCode.value, comp.hplBrand.value);
      if (!hplId) {
        hplId = HPL_MASTER[0]!.id;
        issues.push({
          severity: "warning",
          code: "DRAWING_HPL_CODE_MISSING",
          message: `${comp.name}: kode HPL belum tercantum/tidak ada di master — harga memakai ${HPL_MASTER[0]!.brand} ${HPL_MASTER[0]!.kode}.`,
        });
      }
    }
    const bothSides = /2\s*sisi|dua\s*sisi|both|bolak/.test(fin);

    const edgeText = comp.edging.value;
    const edge: EdgeSpec = edgeText
      ? { top: true, bottom: true, left: true, right: true }
      : { top: false, bottom: false, left: false, right: false };

    const qty = (comp.qty.value && comp.qty.value > 0 ? comp.qty.value : 1) * layers;
    const L = big[0]!;
    const W = big[1]!;
    seq += 1;
    parts.push({
      id: `d${seq}`,
      part_name: layers > 1 ? `${comp.name} (${layers} lapis)` : comp.name,
      module_id: comp.id,
      module_name: "Gambar Kerja",
      qty,
      length_mm: L,
      width_mm: W,
      thickness_mm: MATERIAL_MASTER.find((m) => m.id === mat.id)?.ketebalan_mm ?? thickness ?? 18,
      material_id: mat.id,
      grain_direction: "length",
      // multi-layer: HPL hanya permukaan atas (lapis teratas), bukan tiap lapis
      finish_face_a: hplId && layers === 1 ? hplId : null,
      finish_face_b: hplId && bothSides && layers === 1 ? hplId : null,
      edge,
      edging_id: edgeText ? matchEdging(edgeText) : null,
      notes: comp.notes.join("; "),
      derivation: `Ukuran dari gambar kerja: ${L} × ${W} mm${layers > 1 ? `, ${layers} lapis` : ""}.`,
    });
    if (hplId && layers > 1) {
      seq += 1;
      // HPL ditempel pada lapis teratas saja: tambahkan face part (qty komponen)
      parts[parts.length - 1]!.qty = qty - (qty / layers);
      parts.push({
        ...parts[parts.length - 1]!,
        id: `d${seq}`,
        part_name: `${comp.name} (lapis atas, HPL)`,
        qty: qty / layers,
        finish_face_a: hplId,
        finish_face_b: bothSides ? hplId : null,
      });
    }
  }
  return { parts, issues };
}

/** hitung jumlah pintu/laci/ambalan dari counts gambar (bila tertulis) */
function countsFromSnapshot(snapshot: ConfirmedExtractionSnapshot) {
  let doors = 0;
  let drawers = 0;
  let shelves = 0;
  for (const sec of snapshot.strict.sections) {
    for (const c of sec.counts) {
      if (c.status !== "CONFIRMED_FROM_DRAWING" || c.value === null) continue;
      const t = lower(c.label);
      if (/pintu|door/.test(t)) doors = Math.max(doors, c.value);
      else if (/laci|drawer/.test(t)) drawers = Math.max(drawers, c.value);
      else if (/ambalan|rak|shelf|papan sekat horizontal/.test(t)) shelves = Math.max(shelves, c.value);
    }
  }
  const sliding = snapshot.strict.sections.some((s) =>
    s.specs.some((sp) => /sliding|geser/.test(lower(`${sp.label} ${sp.value ?? ""}`))),
  );
  return { doors, drawers, shelves, doorType: (sliding ? "sliding" : "swing") as "sliding" | "swing" };
}

/**
 * Komponen kotak & gambar tampak (hanya ukuran overall) -> modul workshop.
 * Gambar yang sudah merinci panel tidak disintesis ulang (hindari dobel hitung).
 */
export function modulesFromDrawing(
  snapshot: ConfirmedExtractionSnapshot,
  category: string,
  components: DrawingComponent[] = snapshot.components,
): ModuleSpec[] {
  const counts = countsFromSnapshot(snapshot);
  const out: ModuleSpec[] = [];
  const boxes = components.filter(
    (c) => c.dims.filter((d) => (d.value_mm.value ?? 0) > THICKNESS_MAX).length >= 3,
  );
  for (const box of boxes) {
    const get = (k: string) => box.dims.find((d) => d.key === k)?.value_mm.value ?? 0;
    const mods = composeModules(category, {
      width_mm: get("width"),
      height_mm: get("height"),
      depth_mm: get("depth"),
      ...counts,
    });
    out.push(...mods.map((m) => ({ ...m, name: `${box.name} · ${m.name}` })));
  }
  const panelComps = components.filter((c) => !boxes.includes(c));
  const W = snapshot.overall.width_mm.value;
  const H = snapshot.overall.height_mm.value;
  const D = snapshot.overall.depth_mm.value;
  if (out.length === 0 && panelComps.length === 0 && W && H && D) {
    out.push(...composeModules(category, { width_mm: W, height_mm: H, depth_mm: D, ...counts }));
  }
  return out;
}
