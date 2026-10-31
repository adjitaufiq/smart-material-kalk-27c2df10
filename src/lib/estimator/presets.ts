/**
 * Preset jenis pekerjaan: user cukup klik, tidak perlu mengetik.
 * Setiap pilihan menghasilkan daftar furniture item (kategori + nama) yang deterministik.
 */
export type KitchenShape = "single" | "L";

export interface PresetOption {
  id: string;
  label: string;
  defaultOn: boolean;
}

export interface WorkPreset {
  id: string;
  label: string;
  hint: string;
  options: PresetOption[];
  /** Hanya Kitchen Set: pilihan bentuk lurus / L. */
  hasShape?: boolean;
}

export const WORK_PRESETS: WorkPreset[] = [
  {
    id: "kitchen",
    label: "Kitchen Set",
    hint: "Kabinet bawah, atas, kulkas",
    hasShape: true,
    options: [
      { id: "bawah", label: "Kabinet Bawah", defaultOn: true },
      { id: "atas", label: "Kabinet Atas", defaultOn: true },
      { id: "tall", label: "Kabinet Kulkas / Tall Unit", defaultOn: false },
    ],
  },
  {
    id: "lemari",
    label: "Lemari Pakaian",
    hint: "Wardrobe swing / sliding",
    options: [
      { id: "lemari", label: "Lemari Baju", defaultOn: true },
      { id: "rias", label: "Meja Rias", defaultOn: false },
    ],
  },
  {
    id: "tv",
    label: "Area TV",
    hint: "Backdrop & buffet",
    options: [
      { id: "backdrop", label: "Backdrop TV", defaultOn: true },
      { id: "buffet", label: "Buffet TV", defaultOn: true },
    ],
  },
  {
    id: "meja",
    label: "Meja",
    hint: "Kerja, makan, rias",
    options: [
      { id: "kerja", label: "Meja Kerja", defaultOn: true },
      { id: "makan", label: "Meja Makan", defaultOn: false },
    ],
  },
  {
    id: "kamar",
    label: "Kamar Tidur",
    hint: "Divan, nakas, lemari",
    options: [
      { id: "divan", label: "Divan / Tempat Tidur", defaultOn: true },
      { id: "nakas", label: "Nakas (kiri & kanan)", defaultOn: true },
      { id: "lemari", label: "Lemari Baju", defaultOn: false },
    ],
  },
];

export interface PresetSelection {
  presetId: string;
  options: string[];
  shape?: KitchenShape | undefined;
}

export interface PresetItem {
  category: string;
  name: string;
  /** spek khusus kabinet ini dari KIS (kode HPL dll.) — menimpa spek global */
  specOverride?: Partial<import("./types").QuickSpec> | undefined;
}

export function defaultSelection(presetId: string): PresetSelection {
  const p = WORK_PRESETS.find((x) => x.id === presetId);
  return {
    presetId,
    options: p ? p.options.filter((o) => o.defaultOn).map((o) => o.id) : [],
    shape: p?.hasShape ? "single" : undefined,
  };
}

/** Item kitchen: nama = kategori agar mesin tahu bagian bawah/atas. */
function kitchenItems(sel: PresetSelection): PresetItem[] {
  const out: PresetItem[] = [];
  const L = sel.shape === "L";
  for (const part of ["bawah", "atas"] as const) {
    if (!sel.options.includes(part)) continue;
    const base = part === "bawah" ? "Kitchen Set Bawah" : "Kitchen Set Atas";
    const names = L ? [`${base} - Sisi Utama`, `${base} - Sayap L`] : [base];
    names.forEach((n) => out.push({ category: n, name: n }));
  }
  if (sel.options.includes("tall")) {
    out.push({ category: "Kabinet", name: "Tall Unit / Kabinet Kulkas" });
  }
  return out;
}

const SIMPLE: Record<string, Record<string, PresetItem[]>> = {
  lemari: {
    lemari: [{ category: "Lemari Baju", name: "Lemari Baju" }],
    rias: [{ category: "Meja Rias", name: "Meja Rias" }],
  },
  tv: {
    backdrop: [{ category: "Backdrop TV", name: "Backdrop TV" }],
    buffet: [{ category: "Buffet TV", name: "Buffet TV" }],
  },
  meja: {
    kerja: [{ category: "Meja Kerja", name: "Meja Kerja" }],
    makan: [{ category: "Meja Makan", name: "Meja Makan" }],
  },
  kamar: {
    divan: [{ category: "Divan / Tempat Tidur", name: "Divan / Tempat Tidur" }],
    nakas: [
      { category: "Nakas", name: "Nakas Kiri" },
      { category: "Nakas", name: "Nakas Kanan" },
    ],
    lemari: [{ category: "Lemari Baju", name: "Lemari Baju" }],
  },
};

export function itemsFromSelections(selections: PresetSelection[]): PresetItem[] {
  const out: PresetItem[] = [];
  for (const sel of selections) {
    if (sel.presetId === "kitchen") {
      out.push(...kitchenItems(sel));
      continue;
    }
    const preset = WORK_PRESETS.find((p) => p.id === sel.presetId);
    if (!preset) continue;
    // Urutan mengikuti urutan opsi preset, bukan urutan klik.
    for (const opt of preset.options) {
      if (sel.options.includes(opt.id)) out.push(...(SIMPLE[sel.presetId]?.[opt.id] ?? []));
    }
  }
  // Nama ganda (mis. Lemari Baju dari 2 preset) diberi nomor agar tidak membingungkan.
  const seen = new Map<string, number>();
  return out.map((it) => {
    const n = (seen.get(it.name) ?? 0) + 1;
    seen.set(it.name, n);
    return n > 1 ? { ...it, name: `${it.name} ${n}` } : it;
  });
}

/** Tombol tambah cepat di halaman project (mis. Sayap L, Kabinet Atas). */
export function quickAddItems(existingNames: string[]): PresetItem[] {
  const hasKitchen = existingNames.some((n) => /kitchen|dapur/i.test(n));
  if (!hasKitchen) return [];
  return [
    { category: "Kitchen Set Bawah - Sayap L", name: "Kitchen Set Bawah - Sayap L" },
    { category: "Kitchen Set Atas", name: "Kitchen Set Atas" },
    { category: "Kitchen Set Atas - Sayap L", name: "Kitchen Set Atas - Sayap L" },
    { category: "Kabinet", name: "Tall Unit / Kabinet Kulkas" },
  ];
}
