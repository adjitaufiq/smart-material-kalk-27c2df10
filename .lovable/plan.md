# Perbaikan Integrasi: Confirmed Drawing Snapshot Harus Menang di Step Material

## Root cause paling mungkin (berdasarkan source yang diinspeksi)

Pipeline data-nya sendiri sehat. `buildConfirmedSnapshot` pada fixture Meja Kantor sudah menghasilkan 4 komponen tanpa hardware/edging karangan (`src/lib/estimator/extraction-sample.test.ts:100-130`). Masalahnya murni di wiring state UI:

1. **Tidak ada branch DRAWING_CONFIRMED di step Material.** `src/components/estimator/ItemWizard.tsx:267-295` merender `DrawingMaterialEditor` **dan** seluruh `item.modules` (`ModuleEditor`) **dan** tombol `AddModule` sekaligus, tanpa kondisi. Jadi kalau `drawingComponents` kosong sementara `item.modules` berisi satu modul legacy, yang tampil hanya card legacy — persis gejala yang dilaporkan (Kabinet Bawah / Swing / Triplek 18 & 9 mm / Edging PVC / Pintu-Laci-Shelf 0).

2. **Mirror snapshot -> material hanya terjadi sekali, di detik klik Konfirmasi.** `ItemWizard.tsx:599-614` adalah satu-satunya tempat `drawingComponents` diisi. Tidak ada derivasi ulang di step Material. Konsekuensinya:
   - item yang snapshot-nya sudah ada tapi `drawingComponents` hilang/kosong (hasil sesi lama, atau `extraction.strict` null pada extraction versi lama) selamanya jatuh ke jalur legacy;
   - urutan aksi user (susun modul dulu, konfirmasi belakangan) tidak pernah membatalkan modul lama.

3. **Konfirmasi tidak membersihkan state legacy.** Patch di `ItemWizard.tsx:602-614` hanya menambahkan `drawingSnapshot` + `drawingComponents`; `item.modules`, `designOptions`, `selectedOptionId` dibiarkan. Modul legacy 160×75×0 itu bentuknya persis output `composeModules(item.category, resolveBrief(brief))` (`ItemWizard.tsx:674-682`, `factory.ts:142` + branch `default` di `factory.ts:283-300`): width/height dari brief, depth 0 karena `resolveBrief` mengubah `depth_mm: null` jadi `0` (`factory.ts:92-94`), nama modul = nama kategori, `base_cabinet` + `swing` + material default dari `makeModule`. Tombol pembuatnya tetap aktif walau snapshot sudah ada.

4. **Persistensi bisa menghapus snapshot secara diam-diam.** `saveProjects` (`src/lib/store.ts:46-58`) menelan error kuota localStorage hanya dengan `console.error`. `drawingSnapshot` menyimpan salinan penuh `strict` sehingga payload membengkak. Bila penulisan gagal, state di memori terlihat benar, tetapi setelah refresh/navigasi `getProject` mengembalikan versi lama: modul legacy ada, snapshot tidak. `hydrateProjectDrawings` sendiri aman (hanya menyentuh `drawings`).

Kesimpulan: bug integrasi, bukan bug ekstraksi. Sumber kebenaran sudah dibuat tetapi tidak pernah menjadi branch utama, tidak pernah diturunkan ulang, dan bisa hilang saat persist.

## Perubahan minimal yang diusulkan

**A. `src/components/estimator/ItemWizard.tsx` — branch eksplisit di step Material**
- Hitung `drawingMode = Boolean(item.drawingSnapshot)`.
- Bila `drawingMode`: render **hanya** `DrawingMaterialEditor`. `ModuleEditor` + `AddModule` dipindahkan ke blok tertutup "Modul default konstruksi (opsional)" yang hanya muncul kalau user memang punya modul default dan menekan toggle untuk membukanya.
- Bila tidak `drawingMode`: perilaku sekarang persis tidak berubah.

**B. `src/components/estimator/ItemWizard.tsx` — derivasi ulang yang self-healing**
- Di step Material, kalau `drawingSnapshot` ada tapi `drawingComponents` null/kosong, turunkan lagi lewat `materialStateFromModel(modelFromSnapshot(snapshot))` dan simpan sekali via `patch`. Menyelamatkan item lama tanpa perlu ekstraksi ulang.

**C. `src/components/estimator/ItemWizard.tsx` — konfirmasi membersihkan jalur legacy**
- Saat snapshot berhasil dibuat, patch juga `modules: []`, `designOptions: []`, `selectedOptionId: null`, dan reset `confirmedConstruction/confirmedDimensions` ke false. Tanpa snapshot, tidak ada yang dibersihkan.

**D. `src/components/estimator/ItemWizard.tsx` — tombol default konstruksi di step Model**
- Bila `drawingSnapshot` ada, tombol "Gunakan Default Konstruksi" butuh konfirmasi dua langkah (klik pertama menampilkan peringatan bahwa data gambar tidak lagi jadi satu-satunya sumber). Tidak menghapus fiturnya.

**E. `src/lib/store.ts` — kegagalan simpan tidak boleh senyap**
- Pada `catch` kuota: tampilkan pesan error ke user (toast/state) alih-alih hanya `console.error`, dan coba simpan ulang tanpa salinan `strict` di dalam `drawingSnapshot` (audit strict tetap tersedia lewat `item.extraction.strict`).

Tidak ada perubahan pada engine ekstraksi, provider, `drawing-model.ts`, maupun BOM/Review.

## Acceptance criteria (runtime, bukan helper)

Alur: buka item -> "Ada Gambar Kerja" -> upload fixture -> Baca Gambar Kerja (fetch di-mock ke fixture Meja Kantor) -> "Pakai Semua" -> "Konfirmasi Hasil Ekstraksi" -> Model -> Material.

Di step Material harus:
1. Tampil tepat 4 komponen: Top Meja (1600×700, tebal 18 mm × 2 layer = 36 mm), Kaki Panel Kiri (714×650), Kaki Panel Kanan (714×650), Modesty Panel (1500×400).
2. Kaki kiri dan kanan tetap 2 card terpisah (tidak digabung jadi frame).
3. TIDAK mengandung teks: "Kabinet Bawah"/BASE_CABINET, "Swing", "Triplek 9 mm", "Edging PVC", dan tidak ada field Pintu/Laci/Shelf.
4. Field yang tidak ada di gambar tampil "Belum ditentukan"/"Tidak tercantum pada gambar", bukan default master.
5. HPL hanya pada Top Meja; kaki dan modesty tanpa HPL.
6. Setelah unmount + remount komponen dengan item hasil round-trip `upsertProject` -> `getProject`, hasil 1–5 tetap sama (tidak jatuh ke legacy).
7. Regresi jalur manual: item tanpa gambar kerja tetap bisa "Susun Modul dari Ukuran" dan tetap melihat `ModuleEditor` seperti sekarang.

## Test yang akan ditambah

- Dev dependency baru: `@testing-library/react`, `@testing-library/user-event`, `jsdom` (+ `test.environment: "jsdom"`), karena saat ini belum ada test render sama sekali.
- `src/components/estimator/ItemWizard.flow.test.tsx`
  - `alur gambar kerja: extract -> pakai semua -> konfirmasi -> material menampilkan 4 komponen drawing` (assert kriteria 1–5, termasuk assertion negatif atas string legacy).
  - `state hasil konfirmasi bertahan setelah reload dari store` (kriteria 6, localStorage mock).
  - `item tanpa gambar kerja tetap memakai modul legacy` (kriteria 7).
- `src/lib/estimator/drawing-model.test.ts`: tambah kasus snapshot ada tapi `drawingComponents` kosong -> derivasi ulang menghasilkan mirror 1:1 (menopang perubahan B).

## Risiko regresi

- **Jalur manual/no-drawing**: risiko utama. Dimitigasi karena semua perubahan dijaga oleh `Boolean(item.drawingSnapshot)`; tanpa snapshot tidak ada perubahan perilaku, dan ditutup oleh test kriteria 7.
- **Item lama yang sengaja mencampur snapshot + modul default**: modul tetap ada di data, hanya pindah ke blok opsional; perubahan C hanya berjalan pada aksi konfirmasi baru, bukan retroaktif.
- **Engine/BOM**: `calculateItem` masih membaca `item.modules`, jadi item mode gambar bisa berakhir tanpa modul terhitung. Itu di luar cakupan perbaikan ini (BOM/Review dibahas terpisah) dan tidak diubah sekarang.

## File yang kemungkinan berubah

- `src/components/estimator/ItemWizard.tsx` (utama)
- `src/lib/store.ts` (kegagalan simpan tidak senyap)
- `src/components/estimator/ItemWizard.flow.test.tsx` (baru), `src/lib/estimator/drawing-model.test.ts`
- `package.json` + config vitest (environment jsdom)
