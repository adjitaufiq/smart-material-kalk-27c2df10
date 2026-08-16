/**
 * TERMINOLOGI USER-FACING.
 * Internal key/ID (mis. kategori "plywood", id "ply18") TIDAK diubah —
 * hanya label yang ditampilkan ke user yang dinormalisasi ke bahasa tukang.
 * Raw text dari gambar tetap disimpan apa adanya untuk audit trail.
 */

/** Jenis material spesifik yang TIDAK boleh diganti menjadi "Triplek". */
const SPECIFIC_MATERIALS: { match: RegExp; label: string }[] = [
  { match: /\bmulti\s*-?\s*(plex|pleks|plek)\b/i, label: "Multipleks" },
  { match: /\bblock\s*-?\s*board\b/i, label: "Blockboard" },
  { match: /\bmulti\s*-?\s*board\b/i, label: "Multiboard" },
  { match: /\bmdf\b/i, label: "MDF" },
  { match: /\bparticle\s*-?\s*board\b|\bpartikel\b/i, label: "Particle Board" },
  { match: /\bpvc\b/i, label: "PVC Board" },
  { match: /\bacrylic\b|\bakrilik\b/i, label: "Acrylic" },
  { match: /\b(kayu\s*solid|solid\s*wood)\b/i, label: "Kayu Solid" },
  { match: /\bhpl\b/i, label: "HPL" },
];

/** Istilah general: plywood/triplek → "Triplek". */
const GENERIC_MATERIAL = /\b(ply\s*-?\s*wood|plywood|triplek|tripleks)\b/i;

/** Pilihan jenis material user-facing (configurable, bukan hardcode engine). */
export const MATERIAL_TYPE_OPTIONS = [
  "Triplek",
  "Multipleks",
  "Blockboard",
  "MDF",
  "Particle Board",
  "PVC Board",
  "Multiboard",
  "Acrylic",
  "Kayu Solid",
  "Lainnya",
] as const;

/**
 * Ubah teks material apa pun menjadi terminologi user-facing.
 * "Plywood 18 mm" → "Triplek 18 mm"; "Blockboard 18 mm" tetap "Blockboard 18 mm".
 */
export function materialLabel(raw: string | null | undefined): string {
  if (!raw) return "";
  let out = raw;
  for (const s of SPECIFIC_MATERIALS) {
    if (s.match.test(out)) {
      out = out.replace(s.match, s.label);
      return out;
    }
  }
  if (GENERIC_MATERIAL.test(out)) return out.replace(GENERIC_MATERIAL, "Triplek");
  return out;
}

/** Rapikan label measurement agar natural untuk tukang. */
const LABEL_FIXES: { match: RegExp; label: string }[] = [
  { match: /jarak\s+top\s+ke\s+kaki.*/i, label: "Jarak kaki dari tepi top" },
  { match: /^(overall\s+)?width$|^lebar\s+keseluruhan$/i, label: "Lebar" },
  { match: /^(overall\s+)?height$|^tinggi\s+keseluruhan$/i, label: "Tinggi" },
  { match: /^(overall\s+)?depth$|^kedalaman\s+keseluruhan$/i, label: "Kedalaman" },
];

export function friendlyLabel(raw: string): string {
  const t = raw.trim();
  for (const f of LABEL_FIXES) if (f.match.test(t)) return f.label;
  return t;
}

/** "Tampak Atas" dari "TAMPAK ATAS (TOP VIEW)". */
export function friendlyView(view: string | null): string | null {
  if (!view) return null;
  const base = view.replace(/\(.*?\)/g, "").trim();
  if (!base) return null;
  return base
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Sumber ringkas: `Tampak Atas · "1600"`, dengan halaman hanya untuk gambar multi-halaman.
 */
export function formatSource(
  opts: { view: string | null; page: number | null; source_text: string | null },
  multiPage: boolean,
): string | null {
  const bits: string[] = [];
  if (multiPage && opts.page && opts.page > 0) bits.push(`Hal. ${opts.page}`);
  const v = friendlyView(opts.view);
  if (v) bits.push(v);
  if (opts.source_text) bits.push(`“${opts.source_text.trim()}”`);
  return bits.length ? bits.join(" · ") : null;
}
