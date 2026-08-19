# Material Maestro

MASTER PROMPT — APPS #3

SMART MATERIAL ESTIMATOR / KALKULATOR MATERIAL INTERIOR

Bertindak sebagai:

- Senior Full-Stack Engineer

- Senior Interior/Furniture Production System Designer

- Senior Quantity Estimator

- Senior UX/Product Engineer

- AI Vision Workflow Architect

Bangun aplikasi baru untuk menghitung kebutuhan material furnitur/interior secara terstruktur, transparan, dan aman.

APLIKASI INI MASIH SATU GARIS DENGAN EKOSISTEM WORKSHOP / RO MEMORY.

Tujuan utama:

Dari:

1. data project RO;

2. ukuran manual;

3. gambar kerja;

4. atau konsep furniture yang belum memiliki gambar kerja;

aplikasi harus mampu menghasilkan:

DIMENSI

→ STRUKTUR FURNITURE

→ MODUL

→ PART / CUT LIST

→ MATERIAL SHEET

→ FINISHING

→ EDGING

→ HARDWARE

→ ELEKTRIK OPSIONAL

→ BILL OF MATERIAL

→ ESTIMASI BIAYA

==================================================

PRINSIP UTAMA — JANGAN SALAH BELI MATERIAL

==================================================

INI PALING PENTING.

Aplikasi DILARANG langsung menghasilkan angka kebutuhan material final hanya berdasarkan tebakan AI.

AI digunakan untuk:

- membaca gambar;

- mengekstrak ukuran;

- mengenali modul;

- membantu membuat alternatif desain;

- membantu menjelaskan hasil.

AI BUKAN sumber akhir perhitungan material.

Perhitungan final harus dilakukan oleh calculation engine deterministik berdasarkan:

- ukuran terkonfirmasi;

- konstruksi terkonfirmasi;

- jumlah modul;

- jumlah part;

- ketebalan material;

- finishing;

- hardware;

- arah serat;

- cutting/nesting;

- waste;

- aturan produksi.

JANGAN menggunakan rumus sederhana:

panjang furniture × faktor tertentu = jumlah plywood.

Itu hanya boleh menjadi estimasi sangat kasar dan HARUS diberi label:

“Estimasi awal — belum siap digunakan untuk pembelian material.”

==================================================

3 LEVEL HASIL

==================================================

Gunakan 3 status perhitungan:

1. ESTIMASI AWAL

Masih ada asumsi/missing data.

Tidak boleh diberi label siap beli.

2. ESTIMASI TERVERIFIKASI

Ukuran dan konstruksi utama sudah dikonfirmasi.

Boleh digunakan sebagai estimasi produksi.

3. BOM SIAP BELANJA

Hanya boleh muncul apabila seluruh input wajib sudah:

- dikonfirmasi;

- tidak ambigu;

- construction specification lengkap;

- material terpilih;

- cutting calculation selesai.

Tampilkan badge/status dengan jelas.

==================================================

SATUAN

==================================================

Gunakan millimeter sebagai INTERNAL UNIT utama.

Contoh:

600 mm

720 mm

2400 mm

UI boleh menerima:

mm

cm

meter

Tetapi convert ke mm sebelum calculation.

Jangan mencampur unit secara diam-diam.

==================================================

1. SUMBER PROJECT

==================================================

User dapat membuat project melalui:

A. PROJECT BARU

atau

B. IMPORT DARI DATA PROJECT RO MEMORY

Jika integrasi RO Memory tersedia, aplikasi dapat membaca field project yang relevan seperti:

- nama workshop;

- nama project;

- lokasi project;

- jenis pekerjaan;

- tanggal visit;

- catatan project.

Import harus READ-ONLY terhadap data RO Memory.

Jangan mengubah data asli RO Memory dari aplikasi ini.

==================================================

2. KATEGORI PROJECT / JENIS FURNITURE

==================================================

Gunakan istilah Bahasa Indonesia yang natural seperti yang biasa digunakan workshop.

Kategori awal:

1. Kitchen Set

2. Lemari Baju

3. Meja

4. Buffet TV

5. Backdrop TV

6. Rak / Ambalan

7. Kabinet

8. Meja Rias

9. Credenza

10. Partisi

11. Meja Kerja

12. Meja Makan

13. Nakas

14. Divan / Tempat Tidur

15. Counter / Meja Resepsionis

16. Pintu Furniture

17. Custom Furniture

Kategori harus configurable.

Jangan hardcode bahwa hanya kategori tersebut yang boleh digunakan.

Sediakan:

“Jenis lainnya”

dan user dapat menulis jenis furniture sendiri.

==================================================

3. MASTER PROJECT CATEGORY DARI DATA RO

==================================================

Bila project berasal dari RO Memory:

gunakan field:

project

jenis_pekerjaan

sebagai sumber konteks.

Contoh:

Project:

Rumah Bapak Andi

Jenis pekerjaan:

Kitchen set, lemari baju, buffet tv

Maka aplikasi dapat membuat:

Furniture Item 1:

Kitchen Set

Furniture Item 2:

Lemari Baju

Furniture Item 3:

Buffet TV

Jangan menggabungkan semua kebutuhan ke satu calculation object.

Setiap furniture dihitung sendiri kemudian digabung ke BOM project.

==================================================

4. PERTANYAAN WAJIB — GAMBAR KERJA

==================================================

SETIAP furniture item WAJIB menanyakan:

“Apakah ada gambar kerja?”

Pilihan:

[ Ada Gambar Kerja ]

[ Belum Ada Gambar Kerja ]

Pertanyaan ini wajib muncul sebelum calculation detail.

==================================================

5A. JIKA ADA GAMBAR KERJA

==================================================

User dapat upload:

- foto gambar kerja;

- screenshot;

- gambar JPG/PNG;

- PDF drawing;

- sketch;

- shop drawing.

AI Vision membaca gambar untuk mengekstrak:

- jenis furniture;

- overall width;

- overall height;

- overall depth;

- jumlah modul;

- lebar setiap modul;

- tinggi setiap modul;

- jumlah pintu;

- jumlah laci;

- jumlah shelf/rak;

- jenis pintu;

- posisi hardware bila terlihat;

- ketebalan material bila tercantum;

- tulisan/specification;

- kode finishing;

- dimension annotation.

==================================================

HASIL AI JANGAN LANGSUNG DIHITUNG

==================================================

Setelah AI membaca gambar:

TAMPILKAN HALAMAN:

“HASIL EKSTRAKSI GAMBAR”

Contoh:

Kitchen Set

Kabinet bawah:

Panjang total: 3200 mm

Tinggi: 720 mm

Depth: 550 mm

Kabinet atas:

Panjang: 2400 mm

Tinggi: 700 mm

Depth: 350 mm

Tall cabinet:

600 × 2400 × 550 mm

Jumlah pintu:

9

Jumlah laci:

3

Material:

Belum terbaca

Finishing:

TACO 002 AA

Confidence:

92%

[ Konfirmasi ]

[ Edit Data ]

==================================================

AMBIGUOUS VALUE

==================================================

Jika AI tidak yakin terhadap ukuran:

JANGAN menebak.

Contoh:

Lebar modul:

“Tidak terbaca jelas”

atau:

“AI mendeteksi kemungkinan 550–600 mm”

User wajib memilih/mengisi sebelum calculation final.

Tampilkan bagian:

“Perlu dikonfirmasi”

Jangan lanjut ke BOM siap belanja jika masih ada ukuran kritis yang ambigu.

==================================================

GAMBAR ADALAH SUMBER SPEC

==================================================

Jika gambar kerja tersedia:

SPECIFICATION PADA GAMBAR adalah prioritas utama.

Contoh:

Jika gambar menyebut:

Plywood 18 mm

jangan menggantinya menjadi 15 mm berdasarkan default.

Jika gambar menyebut:

depth 520 mm

jangan memakai default 550 mm.

Jika gambar menyebut:

4 engsel

jangan mengganti menjadi 3 berdasarkan rule otomatis tanpa peringatan.

Rule otomatis hanya mengisi data yang TIDAK tercantum.

==================================================

5B. JIKA TIDAK ADA GAMBAR KERJA

==================================================

Jangan langsung menghitung material.

Minta ukuran dasar terlebih dahulu:

- panjang;

- tinggi;

- depth;

- jumlah pintu;

- jumlah laci;

- kebutuhan fungsi;

- material preferensi;

- tipe konstruksi jika diketahui.

Kemudian aplikasi menawarkan:

“Buat Contoh Model”

AI dapat menghasilkan:

1–3 ALTERNATIF MODEL BERBEDA

berdasarkan ukuran user.

==================================================

ALTERNATIF MODEL AI

==================================================

Contoh:

User input:

Lemari Baju

Lebar:

2400 mm

Tinggi:

2600 mm

Depth:

600 mm

AI menghasilkan:

MODEL 1

Minimalis Swing

4 pintu

2 laci

rak + gantungan

MODEL 2

Sliding

3 panel

4 laci

rak lebih banyak

MODEL 3

Combination

2 pintu kaca

2 pintu solid

drawer internal

Setiap model harus mempunyai:

- visual AI;

- layout/modul;

- dimension scheme;

- struktur furniture;

- jumlah pintu;

- jumlah laci;

- jumlah shelf;

- asumsi material.

==================================================

PENTING — VISUAL AI BUKAN SUMBER HITUNG

==================================================

JANGAN:

generate gambar

→ melihat gambar AI

→ menebak material.

Flow harus:

ukuran user

→ structured model

→ module specification

→ AI visualization

→ user pilih

→ user konfirmasi

→ calculation engine.

Artinya visual dibuat BERDASARKAN model struktural.

Bukan model struktural dibuat dengan menebak visual.

==================================================

VISUAL AI

==================================================

Visual 1–3 model harus terlihat seperti visual furniture nyata / realistic concept rendering.

Tetapi wajib diberi label:

“Visual konsep — bukan gambar kerja produksi.”

Selain visual, tampilkan schematic dimension sederhana.

Contoh:

MODEL 1

2400 W × 2600 H × 600 D

Module:

600 | 600 | 600 | 600

Dengan demikian user tidak hanya memilih berdasarkan gambar cantik.

==================================================

SETELAH PILIH MODEL

==================================================

User memilih:

[ Gunakan Model Ini ]

Kemudian tampilkan:

“KONFIRMASI KONSTRUKSI”

baru setelah confirmed:

Generate Cut List

Generate BOM

==================================================

6. MASTER MATERIAL

==================================================

Buat tabel master material.

FIELD:

id

nama_material

kategori

panjang_mm

lebar_mm

ketebalan_mm

harga

satuan

grain_direction

kerf_mm

waste_default

aktif

Kategori:

- plywood;

- MDF;

- particle board;

- blockboard;

- PVC board;

- acrylic;

- solid wood;

- lainnya.

Contoh:

Plywood 18 mm

1220 × 2440 mm

Plywood 9 mm

1220 × 2440 mm

Plywood 4 mm

1220 × 2440 mm

==================================================

7. MASTER HPL / FINISHING

==================================================

FIELD:

brand

kode

nama

panjang

lebar

arah_serat

harga

aktif

Brand dapat menggunakan master yang sudah familiar di RO Memory:

- TACO

- CARTA

- AICA

- JAVACO

- AIDI

- lainnya.

Support brand tambahan.

==================================================

8. MASTER EDGING

==================================================

FIELD:

nama

brand

warna

ketebalan

lebar

panjang_roll

harga

harga_per_meter

aktif

==================================================

9. MASTER HARDWARE

==================================================

FIELD:

kategori

brand

nama

model

unit

pack_size

harga

rule_default

Kategori:

- engsel;

- rel laci;

- rel sliding;

- handle;

- hanger rod;

- connector;

- screw;

- minifix;

- lampu;

- profil aluminium;

- trafo;

- aksesori.

Brand optional:

TACO

HUBEN

LENAGA

HARFIT

HAFELE

DEKSON

I-TECH

XEEP

MAPLA

lainnya.

==================================================

10. MASTER CONSTRUCTION

==================================================

INI WAJIB.

Jangan menanam seluruh formula konstruksi secara permanen di source.

Buat construction template.

Contoh:

BASE CABINET

Default:

height = 720

depth = 550

body = plywood 18

back panel = plywood 9

shelf = 1

WALL CABINET

TALL CABINET

WARDROBE

DRAWER MODULE

FLOATING CABINET

BACKDROP PANEL

TABLE TOP

BUFFET TV

dan lainnya.

==================================================

11. CONSTRUCTION METHOD

==================================================

Perhitungan part bergantung pada metode sambungan.

Contoh:

Top/bottom di antara side panel

BERBEDA dengan:

Top/bottom menutup side panel.

Maka construction template harus mendefinisikan:

panel_relationship.

Jangan menggunakan rumus internal width universal.

==================================================

12. PRIMITIVE / MODULE ENGINE

==================================================

Jangan membuat rumus besar seperti:

Kitchen Engine

Wardrobe Engine

sebagai monolit.

Gunakan primitive furniture modules:

- Base Cabinet

- Wall Cabinet

- Tall Cabinet

- Swing Door

- Sliding Door

- Drawer

- Shelf

- Panel

- Floating Cabinet

- Floating Shelf

- Table Top

- Back Panel

- Plinth

- Partition

- Door Panel

Kategori furniture merupakan gabungan module tersebut.

==================================================

CONTOH

==================================================

Kitchen Set:

Base Cabinets

+

Wall Cabinets

+

Tall Cabinet

+

Door

+

Drawer.

Lemari Baju:

Tall Modules

+

Shelf

+

Hanging Section

+

Drawer

+

Swing/Sliding Door.

Buffet TV:

Base cabinet

+

drawer

+

swing/flap door

+

top panel.

==================================================

13. KITCHEN SET

==================================================

Dynamic form dapat meminta:

- panjang kabinet bawah;

- panjang kabinet atas;

- tinggi kabinet;

- depth;

- tall unit;

- jumlah pintu;

- jumlah drawer;

- open shelf;

- sink cabinet;

- kompor;

- cooker hood;

- LED;

- finishing.

Tetapi jika gambar kerja tersedia:

prioritaskan spec gambar.

==================================================

14. LEMARI BAJU

==================================================

Input:

- width;

- height;

- depth;

- swing/sliding;

- jumlah pintu;

- jumlah drawer;

- jumlah shelf;

- hanging section;

- loft cabinet;

- finishing;

- mirror optional.

==================================================

15. MEJA

==================================================

JANGAN memperlakukan meja seperti kabinet.

Untuk meja:

pisahkan:

TOP TABLE

dan:

SUPPORT / KAKI / FRAME.

Contoh:

Top:

plywood 18 mm

double layer

HPL atas

HPL bawah

edging.

Frame:

besi

plywood

solid wood

atau lainnya.

PENTING:

Jika konstruksi meja hanya menggunakan HPL pada top table:

JANGAN menghitung HPL untuk kaki/frame.

HPL harus dihitung hanya pada permukaan yang memang dipilih.

==================================================

16. BUFFET TV

==================================================

Input:

- width;

- height;

- depth;

- jumlah pintu;

- jumlah laci;

- open shelf;

- top panel;

- kaki/plinth;

- finishing;

- cable management.

Module dapat berupa:

drawer

door cabinet

open shelf

top panel.

==================================================

17. BACKDROP TV

==================================================

Input:

- width;

- height;

- depth;

- panel area;

- floating cabinet;

- floating shelf;

- LED;

- wall cladding.

Jangan menghitung seluruh bidang sebagai plywood 18 mm jika konstruksinya hanya framing + panel tipis.

Harus mengikuti construction choice.

==================================================

18. CUT LIST ENGINE

==================================================

JANTUNG SISTEM ADALAH CUT LIST.

Setiap furniture harus diubah menjadi daftar part.

Contoh:

Base Cabinet 600:

Side Left

Qty 1

720 × 550

Plywood 18

Side Right

Qty 1

720 × 550

Plywood 18

Bottom

Qty 1

ukuran berdasarkan construction rule

Shelf

Qty 1

Back Panel

Qty 1

Plywood 9

Door

Qty sesuai design.

==================================================

19. PART MODEL

==================================================

Setiap part menyimpan:

part_name

module_id

qty

length_mm

width_mm

thickness_mm

material_id

grain_direction

finish_face_a

finish_face_b

edge_top

edge_bottom

edge_left

edge_right

notes.

==================================================

20. SHEET CALCULATION

==================================================

Jangan hanya:

total luas / luas plywood.

Sediakan dua mode:

MODE 1:

Estimasi Cepat

area-based + waste.

Label:

“Estimasi awal”

MODE 2:

Estimasi Potong

gunakan part dimension + sheet size + kerf + grain direction.

Lakukan nesting/cutting optimization.

MODE 2 yang digunakan untuk:

“BOM Siap Belanja”

==================================================

21. WASTE

==================================================

Waste tidak boleh otomatis selalu 10%.

Gunakan:

cutting optimization

+

kerf

+

remaining usable area.

Master waste 10–15% hanya fallback untuk estimasi cepat.

User dapat memilih:

5%

10%

15%

custom.

Tampilkan nilai waste yang digunakan.

==================================================

22. GRAIN DIRECTION

==================================================

HPL motif kayu dan panel tertentu mempunyai arah serat.

Cutting optimizer harus mempertimbangkan grain_direction.

Jangan rotate part secara bebas jika arah serat dikunci.

==================================================

23. FINISHING MAPPER

==================================================

HPL dihitung berdasarkan FACE.

Contoh Door:

Face A:

TACO 001

Face B:

White HPL.

Jangan otomatis menganggap HPL hanya satu sisi.

Body cabinet dapat mempunyai:

outside

inside

dengan finishing berbeda.

==================================================

24. HPL CALCULATION

==================================================

Setiap finished face menjadi cutting part HPL.

Gunakan ukuran lembar HPL aktual.

Hitung:

- jumlah lembar;

- kode;

- brand;

- waste;

- grain direction.

==================================================

25. EDGING

==================================================

Edging dihitung berdasarkan sisi part.

Contoh:

Door:

top = edging

bottom = edging

left = edging

right = edging.

Shelf:

front only.

Hitung total panjang meter.

Tambah waste configurable.

==================================================

26. HARDWARE AUTOMATOR

==================================================

Hardware dihitung dari furniture structure.

Contoh engsel:

Rule default configurable:

Door height <= 900 mm

→ 2 engsel

901–1600

→ 3

1601–2100

→ 4

>2100

→ configurable.

Tetapi jika gambar kerja menyebut jumlah engsel:

gambar kerja memiliki prioritas.

==================================================

27. DRAWER

==================================================

Setiap drawer:

1 set rel laci

kecuali hardware specification menyatakan lain.

Handle sesuai jumlah front panel bila menggunakan handle.

==================================================

28. SLIDING DOOR

==================================================

Jangan menghitung hardware sliding seperti swing.

Gunakan:

track

roller

stopper

handle/profile

sesuai system yang dipilih.

==================================================

29. ELECTRICAL

==================================================

Jika LED aktif:

input:

- panjang LED;

- jenis LED;

- watt/meter;

- jumlah segment.

Hitung:

LED strip meter

aluminium profile

driver capacity

Driver diberi safety margin configurable.

==================================================

30. PROJECT STRUCTURE

==================================================

Project

→ Furniture Items

→ Modules

→ Parts

→ Cut List

→ Material Requirements

→ BOM

→ Cost Estimate

→ Revision.

==================================================

31. REVISION

==================================================

Setiap project harus mendukung:

Revision 1

Revision 2

Revision 3

Jangan overwrite hasil lama.

Simpan snapshot input + BOM tiap revision.

==================================================

32. USER FLOW FINAL

==================================================

HOME

→ Buat Project / Import dari RO Memory

→ Pilih jenis furniture

→ Apakah ada gambar kerja?

==================================================

JIKA ADA:

Upload gambar

→ AI Extract

→ Review ukuran

→ User Confirm/Edit

→ Pilih material & construction

→ Generate structured module

→ Generate cut list

→ Generate material

→ Generate BOM.

==================================================

JIKA TIDAK ADA:

Input overall dimension

→ Input kebutuhan fungsi

→ AI generate 1–3 model berbeda

→ tampilkan visual + schematic dimensions

→ user pilih model

→ review structured modules

→ user confirm

→ generate cut list

→ material

→ BOM.

==================================================

33. ESTIMASI AI TANPA GAMBAR

==================================================

Jika AI membuat alternatif desain:

setiap alternatif WAJIB memiliki BOM sendiri.

Contoh:

Model 1:

8 lembar plywood

Model 2:

10 lembar

Model 3:

12 lembar.

Karena beda desain = beda jumlah part = beda material.

Jangan menggunakan satu estimasi material untuk seluruh alternatif.

==================================================

34. ASSUMPTION PANEL

==================================================

Setiap hasil calculation harus menampilkan:

“Asumsi Perhitungan”

Contoh:

Body:

Plywood 18 mm

Back:

Plywood 9 mm

Depth:

550 mm

Finishing:

HPL dua sisi

Waste:

10%

Engsel:

3/pintu

User dapat memilih:

[ Edit Asumsi ]

Kemudian:

[ Hitung Ulang ]

==================================================

35. BLOCKER VALIDATION

==================================================

Jangan izinkan BOM SIAP BELANJA jika ada critical field kosong seperti:

- width;

- height;

- depth;

- material thickness;

- construction type;

- unclear drawing dimension.

Tampilkan:

“Perhitungan belum dapat difinalkan.”

Kemudian sebutkan field yang harus dilengkapi.

==================================================

36. OUTPUT CUT LIST

==================================================

Contoh:

CUT LIST

Plywood 18 mm

Side Cabinet

720 × 550

8 pcs

Bottom

564 × 550

4 pcs

Shelf

564 × 520

4 pcs

Door

...

==================================================

37. OUTPUT BOM

==================================================

KEBUTUHAN MATERIAL

Plywood 18 mm

8 lembar

Plywood 9 mm

2 lembar

FINISHING

TACO 001

5 lembar

TACO 002

3 lembar

Edging PVC 1 mm

31 meter

HARDWARE

Engsel

18 pcs

Rel laci

4 set

Handle

10 pcs

ELEKTRIK

LED strip

3.2 meter

Profile aluminium

4 meter

Driver

1 pcs.

==================================================

38. ESTIMASI BIAYA

==================================================

Harga optional.

Jika master price tersedia:

quantity × unit price.

Tampilkan:

Subtotal material

Subtotal hardware

Subtotal finishing

Grand Total.

Label:

“Estimasi material, bukan quotation final.”

==================================================

39. EXPORT

==================================================

Sediakan:

Share WhatsApp

PDF

Excel

Print.

Export harus mencantumkan:

- project;

- revision;

- tanggal;

- dimensions;

- assumptions;

- cut list;

- BOM;

- harga optional.

==================================================

40. DASHBOARD

==================================================

Dashboard sederhana:

Project Aktif

Draft

Menunggu Konfirmasi

BOM Verified

Revision terbaru.

Jangan terlalu ramai.

==================================================

41. HISTORY

==================================================

User dapat membuka project lama.

Tampilkan:

Revision history

Gambar kerja

AI extraction

Input confirmed

Cut list

BOM.

==================================================

42. DATABASE TABLES MINIMAL

==================================================

projects

project_furniture_items

drawings

drawing_extractions

furniture_modules

furniture_parts

material_master

hpl_master

edging_master

hardware_master

construction_templates

calculation_runs

cut_lists

cut_list_items

bom

bom_items

project_revisions

generated_design_options.

Gunakan schema relational yang bersih.

==================================================

43. generated_design_options

==================================================

Simpan:

id

project_id

furniture_item_id

option_number

name

description

structured_model_json

overall_dimensions

image_reference

selected

created_at.

Jangan menggunakan generated image sebagai satu-satunya sumber structured_model_json.

==================================================

44. AI DRAWING EXTRACTION

==================================================

Store extraction:

raw AI result

normalized result

confidence

warnings

confirmed_by_user

confirmed_at.

Jangan menghapus raw extraction setelah user edit.

==================================================

45. CALCULATION AUDITABILITY

==================================================

Setiap BOM item harus dapat dilacak:

BOM

→ material

→ cut list item

→ furniture part

→ module

→ furniture.

User harus dapat klik:

“Kenapa butuh 8 lembar?”

dan sistem menjelaskan sumber calculation.

==================================================

46. TRACEABILITY

==================================================

Contoh:

Plywood 18 mm: 8 lembar

[ Lihat Dasar Hitung ]

→ 36 part

→ total cutting layout

→ sheet 1–8.

Ini penting untuk mencegah hasil AI yang tidak transparan.

==================================================

47. ERROR PREVENTION

==================================================

Tambahkan warning bila:

- part lebih besar dari sheet;

- grain tidak muat;

- dimension = 0;

- negative dimension;

- thickness tidak tersedia;

- HPL face belum dipilih;

- hardware incompatible;

- drawing dimensions tidak konsisten.

==================================================

48. NO SILENT ASSUMPTION

==================================================

Jangan diam-diam mengisi critical spec.

Jika memakai default:

tampilkan jelas:

“Default digunakan: depth kabinet bawah 550 mm.”

User harus bisa melihat dan mengubahnya.

==================================================

49. SAVE & RECALCULATE

==================================================

Jika user mengubah:

ukuran

material

ketebalan

jumlah shelf

jumlah door

HPL

hardware

maka:

cut list

material

BOM

cost

harus dihitung ulang.

Jangan mempertahankan stale calculation.

==================================================

50. PERFORMANCE

==================================================

Calculation engine harus terpisah dari UI.

Gunakan pure functions sebanyak mungkin.

AI hanya dipanggil untuk:

- extraction;

- design generation;

- explanation.

Jangan panggil AI hanya untuk melakukan arithmetic yang bisa dilakukan deterministic engine.

==================================================

51. SECURITY

==================================================

Project harus terisolasi berdasarkan user.

Jika multi-user:

user hanya dapat melihat project miliknya kecuali diberikan permission.

Gunakan RLS / ownership guard.

Uploaded drawing bersifat private.

Signed URL drawing harus short-lived.

==================================================

52. TEST WAJIB — CORE ENGINE

==================================================

Buat regression tests.

Minimal:

1. Cabinet 600×720×550 menghasilkan part yang benar sesuai construction template.

2. Mengubah plywood thickness mengubah derived dimension bila construction rule membutuhkannya.

3. Back panel 9mm masuk material 9mm, bukan 18mm.

4. Door dengan HPL dua sisi menghasilkan dua finishing faces.

5. Door motif grain tidak boleh dirotate salah pada nesting.

6. Meja yang hanya memakai HPL di tabletop tidak menghitung HPL pada kaki/frame.

7. Drawer menghasilkan hardware sesuai jumlah.

8. Swing door dan sliding door menghasilkan hardware berbeda.

9. Gambar kerja dengan dimension confirmed mengoverride default.

10. AI extraction ambigu tidak boleh menghasilkan BOM siap belanja.

11. No drawing → generated option 1/2/3 memiliki BOM masing-masing.

12. Perubahan model menghasilkan jumlah material berbeda jika part berbeda.

13. Part > sheet memunculkan validation error.

14. Waste tidak dihitung dua kali.

15. Recalculate tidak menghasilkan stale BOM.

==================================================

53. TEST KATEGORI

==================================================

Test minimal:

Kitchen Set

Lemari Baju

Meja

Buffet TV

Backdrop TV

Custom Furniture.

==================================================

54. TEST DARI GAMBAR

==================================================

Gunakan mock drawing extraction:

width 2400

height 2600

depth 600

4 doors

3 drawers.

Pastikan:

AI result

→ confirmation

→ structured module

→ cut list

→ BOM.

==================================================

55. TEST TANPA GAMBAR

==================================================

Input:

Lemari Baju

2400 × 2600 × 600

hasilkan 3 design options.

Pastikan:

- structured models berbeda;

- visual descriptions berbeda;

- part count berbeda bila design berbeda;

- BOM masing-masing berbeda.

==================================================

56. UX MOBILE FIRST

==================================================

Target user:

surveyor

RO

workshop

tukang

owner.

UI harus mudah dipakai di HP.

Gunakan:

stepper

1 Project

2 Gambar/Ukuran

3 Model

4 Material

5 Review

6 Hasil.

==================================================

57. UI HASIL

==================================================

Tab:

Ringkasan

Cut List

Material

Hardware

Biaya

Asumsi.

==================================================

58. STATUS CONFIDENCE

==================================================

Untuk drawing extraction:

Hijau:

confirmed

Kuning:

needs review

Merah:

missing critical data.

Jangan menggunakan confidence AI sebagai pengganti konfirmasi user.

==================================================

59. PRIORITAS IMPLEMENTASI

==================================================

JANGAN mulai dari fitur visual AI paling kompleks.

Urutan implementasi:

PHASE 1

Database master

Project

Furniture items

Construction templates

Cabinet module

Part engine

Cut list

Basic material calculation.

PHASE 2

Kitchen Set

Lemari Baju

Meja

Buffet TV

Backdrop TV

Finishing

Hardware.

PHASE 3

Drawing upload

AI extraction

Confirmation workflow.

PHASE 4

Generated design options 1–3 untuk project tanpa gambar.

PHASE 5

Advanced nesting

PDF

Excel

WhatsApp

Costing.

==================================================

60. IMPLEMENTASI AWAL

==================================================

Untuk prompt pertama ini:

Bangun foundation architecture secara lengkap.

Implementasikan MVP yang usable dengan minimal:

- project;

- furniture category;

- pertanyaan “Apakah ada gambar kerja?”;

- manual dimension input;

- drawing upload UI;

- extraction workflow structure;

- generated-design workflow structure;

- material master;

- construction master;

- module model;

- cut-list engine foundation;

- BOM foundation;

- assumptions;

- revision structure.

Jangan mengarang integration/API yang belum tersedia.

Jika AI Vision atau image generation provider belum tersedia:

buat interface/service abstraction + UI state yang benar.

Jangan membuat fake AI result seolah production.

==================================================

61. JANGAN PUBLISH

==================================================

Jangan publish otomatis.

==================================================

62. VERIFIKASI

==================================================

Setelah implementasi:

jalankan:

typecheck

lint

unit tests

regression tests

production build.

==================================================

63. LAPORAN AKHIR

==================================================

Laporkan:

1. Architecture.

2. Database schema.

3. Project flow.

4. Kategori furniture yang dibuat.

5. Integrasi data project RO Memory.

6. Flow ada gambar kerja.

7. Flow tanpa gambar kerja.

8. Cara AI extraction bekerja.

9. Cara generated design bekerja.

10. Construction template system.

11. Part engine.

12. Cut-list engine.

13. Material calculation.

14. HPL/finishing calculation.

15. Edging.

16. Hardware rules.

17. Meja/tabletop special rule.

18. Buffet TV.

19. Kitchen.

20. Lemari Baju.

21. Backdrop.

22. Validation anti-salah-beli.

23. Assumption tracking.

24. Traceability “kenapa butuh material ini”.

25. Revision system.

26. Security.

27. Test results.

28. Typecheck.

29. Lint.

30. Build.

31. Fitur/integration apa yang masih belum aktif.

Jika ada formula yang belum dapat dipastikan secara teknis:

JANGAN membuat asumsi tersembunyi.

Tandai:

“REQUIRES CONSTRUCTION RULE CONFIRMATION.”

Tujuan utama aplikasi ini bukan menghasilkan angka sebanyak mungkin.

Tujuan utama adalah menghasilkan kebutuhan material yang:

- dapat ditelusuri;

- dapat dikoreksi;

- mengikuti gambar/spec;

- dapat dihitung ulang;

- tidak menyesatkan user dalam pembelian material.

BERHENTI setelah implementasi MVP foundation + verifikasi.

JANGAN publish otomatis.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://smart-material-kalk.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e7b00b5a-524a-4698-9d5c-cb249454a2ae).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
