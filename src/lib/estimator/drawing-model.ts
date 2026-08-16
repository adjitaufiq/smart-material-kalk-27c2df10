/**
 * CONFIRMED EXTRACTION SNAPSHOT -> MODEL -> MATERIAL (MIRROR 1:1)
 *
 * Aturan keras di modul ini:
 * - Tidak ada default, tidak ada construction template, tidak ada standar furniture.
 * - Tidak menggabungkan / memecah komponen hasil pembacaan gambar.
 * - Field yang tidak ada di gambar bernilai null ("Belum ditentukan").
 * - Setiap field menyimpan provenance: DRAWING | USER_EDIT | USER_ADDED | DEFAULT_CONFIRMED.
 */

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
  notes: string[];
}

// ---------------------------------------------------------------- parsing

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[_\-—–:.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type DimRole = "width" | "height" | "depth" | "thickness" | "other";

const DIM_ROLES: { re: RegExp; role: DimRole; key: string; label: string }[] = [
  { re: /\b(tebal|ketebalan|thickness|thk)\b/, role: "thickness", key: "thickness", label: "Tebal" },
  { re: /\b(depth|kedalaman|dalam)\b/, role: "depth", key: "depth", label: "Depth" },
  { re: /\b(tinggi|height)\b/, role: "height", key: "height", label: "Tinggi" },
  { re: /\b(panjang|lebar|width|length)\b/, role: "width", key: "width", label: "Panjang / Lebar" },
  { re: /\b(inset|jarak|offset|overhang|gap)\b/, role: "other", key: "other", label: "Ukuran lain" },
];

const OVERALL_RE = /\b(overall|keseluruhan|total|global|furniture|unit)\b/;

function roleOf(text: string) {
  const t = norm(text);
  for (const r of DIM_ROLES) if (r.re.test(t)) return r;
  return null;
}

/** Nama komponen = label dikurangi kata peran dimensi/spesifikasi. */
function componentNameFrom(label: string, field: string, strip: RegExp): string {
  const source = label && label.trim() !== "" ? label : field;
  const cleaned = norm(source)
    .replace(strip, " ")
    .replace(/\b(ukuran|dimensi|size|mm|cm)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function titleCase(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type SpecKey =
  | "material"
  | "finishing"
  | "layers"
  | "thickness"
  | "edging"
  | "hardware"
  | "hplBrand"
  | "hplCode";

const SPEC_KEYS: { re: RegExp; key: SpecKey }[] = [
  { re: /\b(brand|merk|merek)\b/, key: "hplBrand" },
  { re: /\b(kode|code|warna hpl)\b/, key: "hplCode" },
  { re: /\b(hpl|finishing|finish|tacon|laminate|cat|duco)\b/, key: "finishing" },
  { re: /\b(layer|lapis|double|ply layer)\b/, key: "layers" },
  { re: /\b(edging|tepi|edge banding|edge)\b/, key: "edging" },
  { re: /\b(hardware|engsel|rel|handle|minifix|dowel|sekrup|screw|connector)\b/, key: "hardware" },
  { re: /\b(tebal|ketebalan|thickness)\b/, key: "thickness" },
  { re: /\b(material|bahan|triplek|plywood|multipleks|mdf|blockboard)\b/, key: "material" },
];

function specKeyOf(text: string): { re: RegExp; key: SpecKey } | null {
  const t = norm(text);
  for (const s of SPEC_KEYS) if (s.re.test(t)) return s;
  return null;
}

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

/**
 * Bangun snapshot immutable dari hasil pembacaan gambar yang dikonfirmasi user.
 * HANYA nilai berstatus CONFIRMED_FROM_DRAWING yang ikut. Sisanya tetap kosong.
 */
export function buildConfirmedSnapshot(
  strict: StrictExtractionResult,
  opts: { id?: string; now?: string } = {},
): ConfirmedExtractionSnapshot {
  const components: DrawingComponent[] = [];
  const byKey = new Map<string, DrawingComponent>();
  const overall = {
    width_mm: emptyField<number>(),
    height_mm: emptyField<number>(),
    depth_mm: emptyField<number>(),
  };
  const relations: string[] = [];
  const notes: string[] = [];
  const generalSpecs: { label: string; value: string }[] = [];
  const otherMeasurements: { label: string; value_mm: number }[] = [];
  let furnitureType = "TIDAK_DIKETAHUI";

  const getComponent = (rawName: string): DrawingComponent => {
    const key = norm(rawName);
    const found = byKey.get(key);
    if (found) return found;
    const comp = blankComponent(`comp_${components.length + 1}`, titleCase(rawName));
    byKey.set(key, comp);
    components.push(comp);
    return comp;
  };

  for (const sec of strict.sections) {
    if (furnitureType === "TIDAK_DIKETAHUI" && sec.furniture_type) {
      furnitureType = sec.furniture_type;
    }
    relations.push(...sec.relations);
    notes.push(...sec.notes);

    for (const m of sec.measurements as ExtractedMeasurement[]) {
      if (!isConfirmed(m) || m.value_mm === null) continue;
      const role = roleOf(`${m.field} ${m.label}`);
      const compName = componentNameFrom(m.label, m.field, role ? role.re : /$^/);
      const isOverall = compName === "" || OVERALL_RE.test(compName);

      if (isOverall && role && role.role !== "other" && role.role !== "thickness") {
        const target = `${role.role === "width" ? "width" : role.role}_mm` as keyof typeof overall;
        if (overall[target].value === null) overall[target] = drawingField(m.value_mm);
        continue;
      }
      if (!role || role.role === "other") {
        otherMeasurements.push({ label: m.label, value_mm: m.value_mm });
        continue;
      }
      const comp = getComponent(compName);
      if (role.role === "thickness") {
        if (comp.thickness_mm.value === null) comp.thickness_mm = drawingField(m.value_mm);
        continue;
      }
      if (!comp.dims.some((d) => d.key === role.key)) {
        comp.dims.push({ key: role.key, label: role.label, value_mm: drawingField(m.value_mm) });
      }
    }

    for (const s of sec.specs as ExtractedSpec[]) {
      if (!isConfirmed(s) || s.value === null) continue;
      const sk = specKeyOf(`${s.field} ${s.label}`);
      const compName = componentNameFrom(s.label, s.field, sk ? sk.re : /$^/);
      if (!sk) {
        generalSpecs.push({ label: s.label, value: s.value });
        continue;
      }
      if (compName === "" || OVERALL_RE.test(compName)) {
        generalSpecs.push({ label: s.label, value: s.value });
        continue;
      }
      const comp = getComponent(compName);
      applySpec(comp, sk.key, s.value);
    }

    for (const c of sec.counts as ExtractedCount[]) {
      if (!isConfirmed(c) || c.value === null) continue;
      const sk = specKeyOf(c.label);
      const compName = componentNameFrom(c.label, c.label, sk ? sk.re : /\b(jumlah|qty|quantity)\b/);
      if (compName === "" || OVERALL_RE.test(compName)) continue;
      const comp = getComponent(compName);
      if (sk?.key === "layers") {
        if (comp.layers.value === null) comp.layers = drawingField(c.value);
      } else if (comp.qty.value === null) {
        comp.qty = drawingField(c.value);
      }
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
      if (n && comp.thickness_mm.value === null) {
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
    (next as Record<string, unknown>)[key] = editField(
      field,
      num === null || Number.isNaN(num) ? null : num,
    );
  } else {
    const field = next[key] as Field<string>;
    const str = value === null || value === "" ? null : String(value);
    (next as Record<string, unknown>)[key] = editField(field, str);
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
