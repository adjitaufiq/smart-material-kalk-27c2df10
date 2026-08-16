# Step Model — Semantic Component Grouping dari Confirmed Snapshot

## Root cause (dari source yang diinspeksi)

`buildConfirmedSnapshot` (`src/lib/estimator/drawing-model.ts`) membuat identity komponen dengan cara **string-stripping per field**: `componentNameFrom(label, field, role.re)` menghapus kata peran ("tinggi", "lebar", "material", ...) lalu sisa teks dipakai apa adanya sebagai nama komponen, dan `getComponent(norm(nama))` membuat komponen baru untuk setiap varian string.

Akibatnya, satu komponen fisik pecah jadi banyak card:

- "Lebar/Kedalaman Kaki Panel" → strip `lebar|width|panjang` → sisa `"kedalaman kaki panel"`/`"/ kaki panel"` → komponen baru "Lebar / Kaki Panel".
- "Panjang/Tinggi Modesty Panel" → sisa `"/panjang modesty panel"` → komponen baru.
- Spec "Material Utama: Plywood 18 mm" → strip `material` → sisa `"utama"` → komponen "Utama".
- Spec finishing "Kaki dan panel belakang tanpa HPL" → sisa `"kaki & panel belakang"` → komponen baru.
- Label dengan dua kata peran (mis. "Lebar/Kedalaman") hanya di-strip satu regex pertama yang cocok, jadi kata peran sisa ikut jadi bagian nama.

Selain itu `DrawingModelView` menampilkan overall sebagai `width × height × depth` (`DrawingComponents.tsx`), sehingga tampil 1600 × 750 × 700, bukan L × D × T.

Kesimpulan: identity komponen tidak boleh diturunkan dari sisa string; harus lewat lapisan semantik field → component key.

## Perubahan minimal

### A. Modul baru `src/lib/estimator/component-semantics.ts`

Lapisan generik (bukan hardcode Meja Kantor):

1. `stripRoleWords(label)` — buang **semua** kata peran (dimensi, spec, qty, satuan, separator `/`, `&`, `dan`), bukan hanya regex pertama.
2. `componentKeyOf(text)` → key kanonik + label tampilan, dari kamus generik:
   - `TOP` (top, tabletop, meja atas, daun atas), `BOTTOM`, `SHELF`, `BACK_PANEL`, `MODESTY`,
   - `LEG` + sisi: `LEG_LEFT`/`LEG_RIGHT` (kiri/left, kanan/right), `LEG` bila tanpa sisi,
   - `CARCASS_LEFT`/`CARCASS_RIGHT`, `DOOR_n`, `DRAWER_FRONT`/`DRAWER_SIDE`/`DRAWER_BOTTOM`.
   - Tidak cocok → `null` (tidak membuat komponen).
3. `attributeOf(text)` → `width | depth | height | thickness | layers | qty | material | finishing | edging | hardware | hplBrand | hplCode`. Untuk label ambigu "lebar/kedalaman" dipakai prioritas semantik (depth menang bila kata depth/kedalaman hadir), dan untuk komponen vertikal (LEG, MODESTY, DOOR) "panjang/tinggi" dipetakan ke `height`.
4. `expandTargets(text, knownKeys)` — satu field boleh menyasar beberapa komponen:
   - key generik `LEG` sementara snapshot punya `LEG_LEFT` + `LEG_RIGHT` → nilai ditempel ke keduanya;
   - finishing rule multi-subjek ("kaki dan panel belakang tanpa HPL") → target `LEG_LEFT`, `LEG_RIGHT`, `MODESTY`/`BACK_PANEL` sesuai subjek yang dikenali;
   - spec global ("material utama") → target semua komponen yang belum punya material.

### B. `src/lib/estimator/drawing-model.ts` — grouping dua fase

Ganti loop tunggal menjadi:

- **Fase 1 (identity)**: kumpulkan semua measurement/spec/count CONFIRMED, resolve `componentKeyOf`; buat komponen HANYA untuk key yang muncul sebagai subjek dimensi/spesifik. Nama tampilan diambil dari label terbersih yang mengarah ke key itu (mis. "Kaki Panel Kiri"), bukan sisa strip.
- **Fase 2 (atribut)**: tempelkan tiap field ke komponen sesuai `attributeOf` + `expandTargets`. Dimensi masuk `dims` (`width`/`depth`/`height`), tebal ke `thickness_mm`, layer ke `layers`, qty ke `qty`, spec ke field spec.
- **Overall**: dipetakan semantik (`width_mm`/`depth_mm`/`height_mm`), tidak bergantung urutan array.
- **Fallback**: field CONFIRMED yang tidak punya component key dan bukan overall/relation → masuk field baru `snapshot.ungrouped: { label, value }[]` (section "Data belum terkelompok"), BUKAN komponen. `otherMeasurements` (inset/overhang/gap) tetap seperti sekarang.
- Tidak menambah default, tidak menebak, tidak memakai kategori untuk generate komponen standar.
- `ConfirmedExtractionSnapshot` bertambah satu field opsional `ungrouped`, sehingga snapshot lama tetap terbaca.

### C. `src/components/estimator/DrawingComponents.tsx` — rendering Model

- Ukuran keseluruhan: `L × D × T` (width × depth × height) dengan label unit eksplisit.
- Kartu komponen: `dimsLabel` diurutkan width → depth → height, tebal total = `thickness × layers`, baris "Konstruksi: Double layer" bila `layers >= 2` (tetap satu kartu, tidak dipecah per layer), `Qty n`, `Finishing`.
- Section baru "Data belum terkelompok" bila `snapshot.ungrouped` tidak kosong.
- Relationship & ukuran lain tetap section terpisah seperti sekarang.
- Tidak ada perubahan pada `DrawingMaterialEditor` selain mengikuti urutan dims yang sama.

### D. Test

`src/lib/estimator/drawing-model.test.ts` + fixture yang sudah ada di `src/lib/estimator/extraction-sample.test.ts`:

- overall: width 1600, depth 700, height 750;
- `components.length === 4` dengan nama persis: Top Meja, Kaki Panel Kiri, Kaki Panel Kanan, Modesty Panel;
- Top: 1600 × 700, thickness 18, layers 2, total 36, material Triplek 18 mm, finishing HPL permukaan atas;
- Kaki kiri & kanan: 714 × 650, Triplek 18 mm, tanpa HPL;
- Modesty: 1500 × 400, Triplek 18 mm, tanpa HPL;
- assertion negatif: tidak ada komponen bernama mengandung "Lebar", "/panjang", "Utama", "Kaki & Panel Belakang";
- regresi mirror: `modelFromSnapshot` / `materialStateFromModel` tetap 1:1 dan Material step tetap 4 komponen (test flow yang ada tidak boleh berubah hasilnya).

## Yang tidak disentuh

Upload/multi-file, delete file, provider Gemini, AI router, strict extraction prompt, sanitizer, Material step logic, Review, Cut List, BOM, costing.

## File yang berubah

- `src/lib/estimator/component-semantics.ts` (baru)
- `src/lib/estimator/drawing-model.ts`
- `src/components/estimator/DrawingComponents.tsx`
- `src/lib/estimator/drawing-model.test.ts` (+ assert di `extraction-sample.test.ts`)

## Risiko

- Label di luar kamus semantik akan jatuh ke "Data belum terkelompok" (lebih aman daripada membuat komponen palsu); kamus mudah diperluas.
- Snapshot lama yang sudah tersimpan tetap dirender dengan komponen lamanya; grouping baru berlaku saat konfirmasi ekstraksi berikutnya. Bila diinginkan re-derive dari `snapshot.strict`, itu tambahan kecil di self-heal dan bisa dimasukkan pada eksekusi.
