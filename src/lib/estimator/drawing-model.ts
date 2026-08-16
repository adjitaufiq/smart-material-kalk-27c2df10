/**
 * CONFIRMED EXTRACTION SNAPSHOT -> MODEL -> MATERIAL (MIRROR 1:1)
 *
 * Aturan keras di modul ini:
 * - Tidak ada default, tidak ada construction template, tidak ada standar furniture.
 * - Tidak menggabungkan / memecah komponen hasil pembacaan gambar.
 * - Field yang tidak ada di gambar bernilai null ("Belum ditentukan").
 * - Setiap field menyimpan provenance: DRAWING | USER_EDIT | USER_ADDED | DEFAULT_CONFIRMED.
 */

import {
  DIMENSION_ATTRS,
  DIM_LABEL,
  GLOBAL_SPEC_RE,
  OTHER_MEASURE_RE,
  OVERALL_RE,
  attributeOf,
  componentKeyOf,
  componentKeysOf,
  displayNameOf,
  expandTargets,
  normText,
  type ComponentAttribute,
  type ComponentKey,
} from "./component-semantics";
import { materialLabel } from "./terminology";
import type {
  ExtractedCount,
  ExtractedMeasurement,
  ExtractedSpec,
  StrictExtractionResult,
} from "./types";

export type Provenance = "DRAWING" | "USER_EDIT" | "USER_ADDED" | "DEFAULT_CONFIRMED";

/** Nilai satu field beserta asalnya. value null = belum ditentukan. */
export interface Field<T> {
  value: T | null;
  source: Provenance | null;
  /** nilai asli hasil pembacaan gambar — tidak pernah berubah setelah user edit */
  drawingValue: T | null;
  note?: string | undefined;
}

export function emptyField<T>(): Field<T> {
  return { value: null, source: null, drawingValue: null };
}

export function drawingField<T>(value: T, note?: string): Field<T> {
  return { value, source: "DRAWING", drawingValue: value, ...(note ? { note } : {}) };
}

/** Ubah nilai oleh user. Nilai gambar tetap tersimpan. */
export function editField<T>(field: Field<T>, value: T | null): Field<T> {
  const source: Provenance | null =
    value === null ? null : field.drawingValue === null ? "USER_ADDED" : "USER_EDIT";
  return { ...field, value, source };
}

/** User menerima usulan default secara eksplisit. */
export function acceptDefaultField<T>(field: Field<T>, value: T): Field<T> {
  return { ...field, value, source: "DEFAULT_CONFIRMED" };
}

export interface ComponentDimension {
  key: string;
  label: string;
  value_mm: Field<number>;
}

export interface DrawingComponent {
  id: string;
  name: string;
  /** dimensi persis seperti terbaca (tidak ditambah, tidak diubah) */
  dims: ComponentDimension[];
  qty: Field<number>;
  thickness_mm: Field<number>;
  layers: Field<number>;
  material: Field<string>;
  finishing: Field<string>;
  hplBrand: Field<string>;
  hplCode: Field<string>;
  edging: Field<string>;
  hardware: Field<string>;
  /** catatan mentah dari gambar */
  notes: string[];
}

export interface ConfirmedExtractionSnapshot {
  id: string;
  created_at: string;
  furniture_type: string;
  /** salinan hasil pembacaan gambar apa adanya (audit) */
  strict: StrictExtractionResult;
  overall: { width_mm: Field<number>; height_mm: Field<number>; depth_mm: Field<number> };
  components: DrawingComponent[];
  relations: string[];
  /** spesifikasi yang tidak melekat ke komponen tertentu */
  generalSpecs: { label: string; value: string }[];
  /** ukuran lain (inset, jarak) yang bukan dimensi komponen */
  otherMeasurements: { label: string; value_mm: number }[];
  /** field terbaca yang belum bisa dikelompokkan ke komponen fisik */
  ungrouped?: { label: string; value: string }[] | undefined;
  notes: string[];
}

// ---------------------------------------------------------------- parsing

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[_\-—–:.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type SpecKey =
  | "material"
  | "finishing"
  | "layers"
  | "thickness"
  | "edging"
  | "hardware"
  | "hplBrand"
  | "hplCode";

const SPEC_ATTRS: SpecKey[] = [
  "material",
  "finishing",
  "layers",
  "thickness",
  "edging",
  "hardware",
  "hplBrand",
  "hplCode",
];

const isSpecAttr = (a: ComponentAttribute | null): a is SpecKey =>
  a !== null && (SPEC_ATTRS as string[]).includes(a);

const isConfirmed = (s: { status: string }) => s.status === "CONFIRMED_FROM_DRAWING";

function blankComponent(id: string, name: string): DrawingComponent {
  return {
    id,
    name,
    dims: [],
    qty: emptyField<number>(),
    thickness_mm: emptyField<number>(),
    layers: emptyField<number>(),
    material: emptyField<string>(),
    finishing: emptyField<string>(),
    hplBrand: emptyField<string>(),
    hplCode: emptyField<string>(),
    edging: emptyField<string>(),
    hardware: emptyField<string>(),
    notes: [],
  };
}

const textOf = (field: string, label: string) => `${field} ${label}`.trim();

/**
 * Bangun snapshot immutable dari hasil pembacaan gambar yang dikonfirmasi user.
 * HANYA nilai berstatus CONFIRMED_FROM_DRAWING yang ikut. Sisanya tetap kosong.
 *
 * Dua fase:
 *  1. identitas komponen fisik (semantic component key)
 *  2. penempelan atribut (dimensi / spesifikasi / jumlah) ke komponen tersebut
 */
export function buildConfirmedSnapshot(
  strict: StrictExtractionResult,
  opts: { id?: string; now?: string } = {},
): ConfirmedExtractionSnapshot {
  const overall = {
    width_mm: emptyField<number>(),
    height_mm: emptyField<number>(),
    depth_mm: emptyField<number>(),
  };
  const relations: string[] = [];
  const notes: string[] = [];
  const generalSpecs: { label: string; value: string }[] = [];
  const otherMeasurements: { label: string; value_mm: number }[] = [];
  const ungrouped: { label: string; value: string }[] = [];
  let furnitureType = "TIDAK_DIKETAHUI";

  for (const sec of strict.sections) {
    if (furnitureType === "TIDAK_DIKETAHUI" && sec.furniture_type) {
      furnitureType = sec.furniture_type;
    }
    relations.push(...sec.relations);
    notes.push(...sec.notes);
  }

  // ---------------- fase 1: identitas komponen
  const order: ComponentKey[] = [];
  const remember = (key: ComponentKey) => {
    if (!order.includes(key)) order.push(key);
  };

  for (const sec of strict.sections) {
    for (const m of sec.measurements as ExtractedMeasurement[]) {
      if (!isConfirmed(m) || m.value_mm === null) continue;
      const text = textOf(m.field, m.label);
      const t = normText(text);
      if (OTHER_MEASURE_RE.test(t) || OVERALL_RE.test(t)) continue;
      const attr = attributeOf(text);
      if (attr === null || (!DIMENSION_ATTRS.includes(attr) && attr !== "thickness")) continue;
      const key = componentKeyOf(text);
      if (key) remember(key);
    }
    for (const s of sec.specs as ExtractedSpec[]) {
      if (!isConfirmed(s) || s.value === null) continue;
      const text = textOf(s.field, s.label);
      if (OVERALL_RE.test(normText(text)) || GLOBAL_SPEC_RE.test(normText(text))) continue;
      const keys = componentKeysOf(text);
      // spesifikasi hanya membentuk komponen bila subjeknya tunggal & jelas
      if (keys.length === 1 && keys[0]) remember(keys[0]);
    }
    for (const c of sec.counts as ExtractedCount[]) {
      if (!isConfirmed(c) || c.value === null) continue;
      if (OVERALL_RE.test(normText(c.label))) continue;
      const keys = componentKeysOf(c.label);
      if (keys.length === 1 && keys[0]) remember(keys[0]);
    }
  }

  const known = order.filter((k) => !(k === "LEG" && (order.includes("LEG_LEFT") || order.includes("LEG_RIGHT"))));
  const components: DrawingComponent[] = known.map((key, i) =>
    blankComponent(`comp_${i + 1}`, displayNameOf(key)),
  );
  const byKey = new Map<ComponentKey, DrawingComponent>();
  known.forEach((key, i) => byKey.set(key, components[i]!));

  /** tebal yang ditulis sebagai TOTAL (mis. "tebal total 36 mm") */
  const totalThickness = new Map<DrawingComponent, number>();

  const targetsFor = (text: string): DrawingComponent[] =>
    expandTargets(componentKeysOf(text), known)
      .map((k) => byKey.get(k))
      .filter((c): c is DrawingComponent => Boolean(c));

  // ---------------- fase 2: atribut
  for (const sec of strict.sections) {
    for (const m of sec.measurements as ExtractedMeasurement[]) {
      if (!isConfirmed(m) || m.value_mm === null) continue;
      const text = textOf(m.field, m.label);
      const t = normText(text);
      const attr = attributeOf(text);

      if (OTHER_MEASURE_RE.test(t)) {
        otherMeasurements.push({ label: m.label, value_mm: m.value_mm });
        continue;
      }
      if (attr && DIMENSION_ATTRS.includes(attr) && OVERALL_RE.test(t)) {
        const slot = `${attr}_mm` as keyof typeof overall;
        if (overall[slot].value === null) overall[slot] = drawingField(m.value_mm);
        continue;
      }
      const targets = targetsFor(text);
      if (attr === null || targets.length === 0) {
        ungrouped.push({ label: m.label, value: `${m.value_mm} mm` });
        continue;
      }
      for (const comp of targets) {
        if (attr === "thickness") {
          if (/\btotal\b/.test(t)) totalThickness.set(comp, m.value_mm);
          if (comp.thickness_mm.value === null) comp.thickness_mm = drawingField(m.value_mm);
          continue;
        }
        if (!DIMENSION_ATTRS.includes(attr)) continue;
        if (!comp.dims.some((d) => d.key === attr)) {
          comp.dims.push({
            key: attr,
            label: DIM_LABEL[attr] ?? attr,
            value_mm: drawingField(m.value_mm),
          });
        }
      }
    }

    for (const s of sec.specs as ExtractedSpec[]) {
      if (!isConfirmed(s) || s.value === null) continue;
      const text = textOf(s.field, s.label);
      const attr = attributeOf(text);
      const targets = targetsFor(text);

      if (!isSpecAttr(attr)) {
        generalSpecs.push({ label: s.label, value: s.value });
        continue;
      }
      if (targets.length === 0) {
        // spesifikasi global: ditempel ke komponen yang belum punya nilai tersebut
        generalSpecs.push({ label: s.label, value: s.value });
        for (const comp of components) applySpec(comp, attr, s.value);
        continue;
      }
      for (const comp of targets) applySpec(comp, attr, s.value);
    }

    for (const c of sec.counts as ExtractedCount[]) {
      if (!isConfirmed(c) || c.value === null) continue;
      const text = c.label;
      if (OVERALL_RE.test(normText(text))) continue;
      const attr = attributeOf(text);
      const targets = targetsFor(text);
      if (targets.length === 0) {
        ungrouped.push({ label: c.label, value: String(c.value) });
        continue;
      }
      for (const comp of targets) {
        if (attr === "layers") {
          if (comp.layers.value === null) comp.layers = drawingField(c.value);
        } else if (comp.qty.value === null) {
          comp.qty = drawingField(c.value);
        }
      }
    }
  }


  // tebal total dengan multi layer -> tebal per lembar, agar total tetap konsisten
  for (const [comp, total] of totalThickness) {
    const layers = comp.layers.value;
    if (layers && layers >= 2 && comp.thickness_mm.value === total && total % layers === 0) {
      comp.thickness_mm = drawingField(total / layers);
    }
  }

  return {
    id: opts.id ?? `snap_${Date.now().toString(36)}`,
    created_at: opts.now ?? new Date().toISOString(),
    furniture_type: furnitureType,
    strict,
    overall,
    components,
    relations,
    generalSpecs,
    otherMeasurements,
    ungrouped,
    notes,
  };
}

function applySpec(comp: DrawingComponent, key: SpecKey, raw: string) {
  const value = raw.trim();
  switch (key) {
    case "material": {
      if (comp.material.value === null) comp.material = drawingField(materialLabel(value));
      const t = /(\d{1,2})\s*mm/.exec(value);
      if (t && comp.thickness_mm.value === null) {
        comp.thickness_mm = drawingField(Number(t[1]));
      }
      break;
    }
    case "finishing":
      if (comp.finishing.value === null) comp.finishing = drawingField(value);
      break;
    case "layers": {
      const n = /(\d+)/.exec(value);
      const double = /\bdouble|dobel|2\s*lapis\b/i.test(value);
      const layers = n ? Number(n[1]) : double ? 2 : null;
      if (layers !== null && comp.layers.value === null) comp.layers = drawingField(layers);
      break;
    }
    case "thickness": {
      const n = /(\d+(?:[.,]\d+)?)/.exec(value);
      if (n?.[1] && comp.thickness_mm.value === null) {
        comp.thickness_mm = drawingField(Number(n[1].replace(",", ".")));
      }
      break;
    }
    case "edging":
      if (comp.edging.value === null) comp.edging = drawingField(value);
      break;
    case "hardware":
      if (comp.hardware.value === null) comp.hardware = drawingField(value);
      break;
    case "hplBrand":
      if (comp.hplBrand.value === null) comp.hplBrand = drawingField(value);
      break;
    case "hplCode":
      if (comp.hplCode.value === null) comp.hplCode = drawingField(value);
      break;
  }
}

// ---------------------------------------------------------------- mirroring

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** MODEL = cerminan snapshot. Tidak menambah/menggabung/memecah komponen. */
export function modelFromSnapshot(snapshot: ConfirmedExtractionSnapshot): DrawingComponent[] {
  return clone(snapshot.components);
}

/** MATERIAL STATE awal = cerminan MODEL. Tanpa default apa pun. */
export function materialStateFromModel(components: DrawingComponent[]): DrawingComponent[] {
  return clone(components);
}

/** Bentuk kanonik untuk assertion mirror 1:1. */
export function canonicalizeComponents(components: DrawingComponent[]): string {
  return JSON.stringify(
    components.map((c) => ({
      name: norm(c.name),
      dims: c.dims
        .map((d) => ({ key: d.key, value: d.value_mm.value }))
        .sort((a, b) => a.key.localeCompare(b.key)),
      qty: c.qty.value,
      thickness_mm: c.thickness_mm.value,
      layers: c.layers.value,
      material: c.material.value,
      finishing: c.finishing.value,
      hplBrand: c.hplBrand.value,
      hplCode: c.hplCode.value,
      edging: c.edging.value,
      hardware: c.hardware.value,
    })),
  );
}

export function canonicalizeSnapshot(snapshot: ConfirmedExtractionSnapshot): string {
  return canonicalizeComponents(snapshot.components);
}

export type ComponentFieldKey =
  | "qty"
  | "thickness_mm"
  | "layers"
  | "material"
  | "finishing"
  | "hplBrand"
  | "hplCode"
  | "edging"
  | "hardware";

const NUMERIC_KEYS: ComponentFieldKey[] = ["qty", "thickness_mm", "layers"];

/** Edit satu field komponen; provenance otomatis USER_EDIT / USER_ADDED. */
export function updateComponentField(
  comp: DrawingComponent,
  key: ComponentFieldKey,
  value: string | number | null,
): DrawingComponent {
  const next = clone(comp);
  if (NUMERIC_KEYS.includes(key)) {
    const field = next[key] as Field<number>;
    const num = value === null || value === "" ? null : Number(value);
    (next as unknown as Record<string, unknown>)[key] = editField(
      field,
      num === null || Number.isNaN(num) ? null : num,
    );
  } else {
    const field = next[key] as Field<string>;
    const str = value === null || value === "" ? null : String(value);
    (next as unknown as Record<string, unknown>)[key] = editField(field, str);
  }
  return next;
}

export function updateComponentDim(
  comp: DrawingComponent,
  dimKey: string,
  value_mm: number | null,
): DrawingComponent {
  const next = clone(comp);
  next.dims = next.dims.map((d) =>
    d.key === dimKey ? { ...d, value_mm: editField(d.value_mm, value_mm) } : d,
  );
  return next;
}

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  DRAWING: "Dari gambar kerja",
  USER_EDIT: "Diubah user",
  USER_ADDED: "Ditambahkan user",
  DEFAULT_CONFIRMED: "Default dikonfirmasi user",
};

export const NOT_IN_DRAWING = "Tidak tercantum pada gambar";
export const UNDETERMINED = "Belum ditentukan";

export function dimsLabel(comp: DrawingComponent): string {
  const dims = comp.dims.filter((d) => d.value_mm.value !== null);
  if (dims.length === 0) return UNDETERMINED;
  const base = dims.map((d) => d.value_mm.value).join(" × ");
  const total =
    comp.thickness_mm.value !== null
      ? ` × ${comp.thickness_mm.value * (comp.layers.value ?? 1)}`
      : "";
  return `${base}${total} mm`;
}
