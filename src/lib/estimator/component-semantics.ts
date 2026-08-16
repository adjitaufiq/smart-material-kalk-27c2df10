/**
 * SEMANTIC COMPONENT GROUPING
 *
 * Lapisan generik yang memetakan satu field hasil pembacaan gambar menjadi:
 *   (a) identitas komponen fisik (component key), dan
 *   (b) atribut komponen (dimensi / spesifikasi / jumlah).
 *
 * Aturan keras:
 * - Field BUKAN komponen. Material, finishing, dimensi, qty, relationship adalah atribut.
 * - Komponen hanya dibuat bila benar-benar disebut pada confirmed extraction.
 * - Tidak ada komponen standar per kategori, tidak ada default.
 */

export type ComponentKey =
  | "TOP"
  | "BOTTOM"
  | "SHELF"
  | "BACK_PANEL"
  | "MODESTY"
  | "LEG"
  | "LEG_LEFT"
  | "LEG_RIGHT"
  | "CARCASS_LEFT"
  | "CARCASS_RIGHT"
  | "DRAWER_FRONT"
  | "DRAWER_SIDE"
  | "DRAWER_BOTTOM"
  | `DOOR_${number}`;

export type ComponentAttribute =
  | "width"
  | "depth"
  | "height"
  | "thickness"
  | "layers"
  | "qty"
  | "material"
  | "finishing"
  | "edging"
  | "hardware"
  | "hplBrand"
  | "hplCode";

export const normText = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[_\-—–:.]+/g, " ")
    .replace(/[/&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** ukuran yang bukan dimensi komponen (inset, jarak, overhang) */
export const OTHER_MEASURE_RE = /\b(inset|jarak|offset|overhang|gap|clearance|celah)\b/;

/** ukuran keseluruhan furniture */
export const OVERALL_RE = /\b(overall|keseluruhan|total unit|global|furniture|unit)\b/;

/** kata yang menandakan spesifikasi berlaku untuk seluruh komponen */
export const GLOBAL_SPEC_RE = /\b(utama|umum|global|semua|seluruh)\b/;

const SIDE_LEFT = /\b(kiri|left|l)\b/;
const SIDE_RIGHT = /\b(kanan|right|r)\b/;

interface KeyRule {
  re: RegExp;
  resolve: (text: string) => ComponentKey;
}

/** urutan penting: paling spesifik lebih dulu */
const KEY_RULES: KeyRule[] = [
  { re: /\bmodesty\b/, resolve: () => "MODESTY" },
  { re: /\b(back panel|panel belakang|backing)\b/, resolve: () => "BACK_PANEL" },
  { re: /\b(front laci|drawer front|muka laci)\b/, resolve: () => "DRAWER_FRONT" },
  { re: /\b(samping laci|drawer side)\b/, resolve: () => "DRAWER_SIDE" },
  { re: /\b(dasar laci|alas laci|drawer bottom)\b/, resolve: () => "DRAWER_BOTTOM" },
  {
    re: /\b(pintu|door)\b/,
    resolve: (t) => {
      const n = /\b(?:pintu|door)\s*(\d+)\b/.exec(t);
      return `DOOR_${n ? Number(n[1]) : 1}` as ComponentKey;
    },
  },
  {
    re: /\b(carcass|body|badan|karkas)\b/,
    resolve: (t) => (SIDE_RIGHT.test(t) ? "CARCASS_RIGHT" : "CARCASS_LEFT"),
  },
  {
    re: /\b(kaki|leg)\b/,
    resolve: (t) => (SIDE_LEFT.test(t) ? "LEG_LEFT" : SIDE_RIGHT.test(t) ? "LEG_RIGHT" : "LEG"),
  },
  { re: /\b(rak|shelf|shelves|ambalan)\b/, resolve: () => "SHELF" },
  { re: /\b(top|tabletop|table top|daun atas|meja atas|panel atas)\b/, resolve: () => "TOP" },
  { re: /\b(bottom|panel bawah|alas)\b/, resolve: () => "BOTTOM" },
];

const DISPLAY_NAME: Record<string, string> = {
  TOP: "Top Meja",
  BOTTOM: "Panel Bawah",
  SHELF: "Rak",
  BACK_PANEL: "Panel Belakang",
  MODESTY: "Modesty Panel",
  LEG: "Kaki Panel",
  LEG_LEFT: "Kaki Panel Kiri",
  LEG_RIGHT: "Kaki Panel Kanan",
  CARCASS_LEFT: "Badan Kiri",
  CARCASS_RIGHT: "Badan Kanan",
  DRAWER_FRONT: "Front Laci",
  DRAWER_SIDE: "Samping Laci",
  DRAWER_BOTTOM: "Dasar Laci",
};

export function displayNameOf(key: ComponentKey): string {
  if (key.startsWith("DOOR_")) return `Pintu ${key.slice(5)}`;
  return DISPLAY_NAME[key] ?? key;
}

/** Semua komponen yang disebut pada satu teks label (bisa lebih dari satu subjek). */
export function componentKeysOf(text: string): ComponentKey[] {
  const t = normText(text);
  const keys: ComponentKey[] = [];
  for (const rule of KEY_RULES) {
    if (!rule.re.test(t)) continue;
    if (rule.re.source.includes("kaki")) {
      // kaki bisa disebut dua sisi sekaligus: "kaki kiri dan kanan"
      const left = SIDE_LEFT.test(t);
      const right = SIDE_RIGHT.test(t);
      if (left) keys.push("LEG_LEFT");
      if (right) keys.push("LEG_RIGHT");
      if (!left && !right) keys.push("LEG");
      continue;
    }
    keys.push(rule.resolve(t));
  }
  return Array.from(new Set(keys));
}

/** Komponen utama (subjek pertama) pada satu label. */
export function componentKeyOf(text: string): ComponentKey | null {
  return componentKeysOf(text)[0] ?? null;
}

const ATTRIBUTE_RULES: { re: RegExp; attr: ComponentAttribute }[] = [
  { re: /\b(tebal|ketebalan|thickness|thk)\b/, attr: "thickness" },
  { re: /\b(layer|lapis|double|dobel|ply layer)\b/, attr: "layers" },
  { re: /\b(jumlah|qty|quantity|banyak|pcs|unit qty)\b/, attr: "qty" },
  { re: /\b(brand|merk|merek)\b/, attr: "hplBrand" },
  { re: /\b(kode|code)\b/, attr: "hplCode" },
  { re: /\b(edging|edge banding|edge|tepi)\b/, attr: "edging" },
  {
    re: /\b(hardware|engsel|rel|handle|minifix|dowel|sekrup|screw|connector)\b/,
    attr: "hardware",
  },
  { re: /\b(material|bahan|triplek|plywood|multipleks|mdf|blockboard|hpl board)\b/, attr: "material" },
  { re: /\b(hpl|finishing|finish|laminate|cat|duco|melamin)\b/, attr: "finishing" },
  { re: /\b(depth|kedalaman|dalam)\b/, attr: "depth" },
  { re: /\b(tinggi|height)\b/, attr: "height" },
  { re: /\b(panjang|lebar|width|length)\b/, attr: "width" },
];

/**
 * Atribut yang dimaksud satu label. Label ambigu ("Lebar/Kedalaman") diselesaikan
 * dengan prioritas semantik pada daftar di atas, bukan urutan kata.
 */
export function attributeOf(text: string): ComponentAttribute | null {
  const t = normText(text);
  for (const rule of ATTRIBUTE_RULES) if (rule.re.test(t)) return rule.attr;
  return null;
}

export const DIMENSION_ATTRS: ComponentAttribute[] = ["width", "depth", "height"];

export const DIM_LABEL: Record<string, string> = {
  width: "Panjang / Lebar",
  depth: "Depth",
  height: "Tinggi",
};

/**
 * Perluas subjek label menjadi komponen yang benar-benar ada pada snapshot.
 * - LEG generik -> LEG_LEFT + LEG_RIGHT bila keduanya ada.
 * - BACK_PANEL <-> MODESTY saling menggantikan bila hanya salah satu yang ada.
 */
export function expandTargets(keys: ComponentKey[], known: ComponentKey[]): ComponentKey[] {
  const has = (k: ComponentKey) => known.includes(k);
  const out: ComponentKey[] = [];
  for (const key of keys) {
    if (key === "LEG" && (has("LEG_LEFT") || has("LEG_RIGHT"))) {
      if (has("LEG_LEFT")) out.push("LEG_LEFT");
      if (has("LEG_RIGHT")) out.push("LEG_RIGHT");
      continue;
    }
    if (key === "BACK_PANEL" && !has("BACK_PANEL") && has("MODESTY")) {
      out.push("MODESTY");
      continue;
    }
    if (key === "MODESTY" && !has("MODESTY") && has("BACK_PANEL")) {
      out.push("BACK_PANEL");
      continue;
    }
    if (has(key)) out.push(key);
  }
  return Array.from(new Set(out));
}
