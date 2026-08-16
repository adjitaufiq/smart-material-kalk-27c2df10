# Perbaikan: Ekstraksi Gambar Gagal Dijalankan

## Apa yang terjadi

Log AI Gateway 7 hari terakhir kosong: **tidak ada satu pun request AI yang terkirim**. Artinya proses berhenti sebelum gambar sampai ke AI — bukan masalah kuota, kredit, atau model.

Penyebabnya ada di penyimpanan file gambar. Untuk mencegah error "penyimpanan penuh", isi file (data gambar) sengaja dihapus saat project disimpan ke penyimpanan browser; yang tersisa hanya nama file. Jadi begitu halaman di-refresh atau dibuka lagi nanti, nama file masih tampil di daftar (seperti di screenshot: file tertanggal 16/8/2026), tapi isinya sudah kosong. Saat tombol "Baca Gambar Kerja" ditekan, server menolak karena file kosong, dan pesan yang muncul hanya "Ekstraksi gambar gagal dijalankan."

Dulu bisa karena gambar diekstrak langsung setelah upload di sesi yang sama — isi file masih ada di memori.

## Rencana perbaikan

1. **Simpan isi gambar secara benar**
   Pindahkan penyimpanan file gambar dari penyimpanan teks browser ke penyimpanan file browser (IndexedDB), sehingga gambar tetap utuh setelah refresh tanpa memicu error kuota. Project tetap mereferensikan gambar lewat ID.

2. **Jangan biarkan gambar "hantu"**
   Jika isi file benar-benar tidak tersedia, kartu gambar ditandai jelas ("File perlu di-upload ulang"), tombol "Baca Gambar Kerja" dinonaktifkan, dan disediakan aksi upload ulang — bukan gagal diam-diam.

3. **Pesan error yang jujur dan spesifik**
   Tampilkan pesan asli dari proses pembacaan (kuota AI habis, kredit habis, file tidak terbaca, file kosong) alih-alih satu pesan generik, agar penyebabnya langsung terlihat.

4. **Dukungan PDF diperiksa ulang**
   File pada screenshot berekstensi PDF. Pastikan tipe file terisi benar saat upload (beberapa browser mengirim tipe kosong) dengan mendeteksi dari ekstensi/isi data URL, supaya PDF dikirim sebagai dokumen dan gambar sebagai gambar.

## Catatan teknis

- `src/lib/store.ts`: `stripHeavyFields` mengosongkan `dataUrl` → ganti dengan penyimpanan blob di IndexedDB (key = drawing id), dan hydrate saat project dibuka.
- `src/lib/estimator/extraction.functions.ts`: `dataUrl: z.string().min(1)` gagal validasi → error zod inilah yang muncul sebagai pesan generik.
- `src/components/estimator/ItemWizard.tsx` (`runExtraction`, sekitar baris 465-479): tampilkan `error.message` untuk semua error, bukan hanya `AiUnavailableError`; disable tombol saat `dataUrl` kosong.
- `src/lib/estimator/extraction.server.ts` `contentBlock`: perkuat deteksi PDF (mime kosong / `application/octet-stream`).
- Verifikasi: setelah perbaikan, jalankan ekstraksi dan pastikan muncul entri baru di log AI Gateway.
