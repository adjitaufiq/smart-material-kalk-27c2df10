import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  files: z.array(z.object({ name: z.string().min(1), mime: z.string().min(1), dataUrl: z.string().min(1) })).min(1).max(4),
  specList: z.array(z.string()).max(300),
  zones: z.array(z.string()).max(20).optional(),
});

const IDS = ["hpl-zona", "dalam-putih", "tusir", "pintu", "laci", "engsel", "rel", "hidrolik", "kaca", "led", "sorot", "list", "handle", "top", "rak-piring", "rak-bumbu", "rak-sayur", "ambalan"] as const;

const SYSTEM = `Kamu auditor QC workshop interior (layer kedua, independen dari desainer KIS).
Ada 3 foto: render tampak luar (pintu tertutup), tampak dalam depan (pintu & laci terbuka), tampak dalam samping/serong 3/4 (laci ditarik).
HITUNG jumlah yang benar-benar terlihat untuk tiap id berikut (gabungkan semua foto, jangan dobel hitung objek sama):
pintu = jumlah daun pintu; laci = jumlah laci; engsel = jumlah engsel (pcs, biasanya 2 per pintu, hitung dari pintu yang terlihat terbuka bila perlu); rel = jumlah set rel laci (1 set per laci); hidrolik = jumlah gas spring/hidrolik pintu angkat (pcs); kaca = jumlah daun pintu kaca; led = jumlah jalur LED strip; sorot = jumlah titik lampu sorot/spot; list = 1 bila ada list profil gold/hitam, 0 bila tidak; handle = jumlah handle/tarikan (0 bila bevel/tanpa handle); top = jumlah lapis top table yang terlihat dari tebal bibir (1 atau 2); rak-piring, rak-bumbu, rak-sayur = jumlah set; ambalan = jumlah papan ambalan/rak dalam; hpl-zona = jumlah zona motif HPL/TACO Sheet dari daftar "Zona motif KIS" yang BENAR-BENAR terlihat sesuai nama resmi + tekstur (woodgrain/solid/stone/pattern) di area pemakaiannya (kabinet/kabinet_atas/top/aksen). Jangan menebak kode dari foto. Bagian dalam Blockmin putih, cat duco, dan top granit BUKAN zona HPL — jangan dihitung. Di evidence sebut zona mana yang cocok/tidak; dalam-putih = 1 bila bagian dalam kabinet (saat pintu/laci terbuka) putih bersih, 0 bila warna kayu/mentah; tusir = 1 bila tepi panel rapi dicat/tusir tanpa edging PVC tempel terlihat, 0 bila tampak edging PVC.
pintu = TOTAL daun (swing + angkat). kaca = daun pintu kaca (biasanya pintu angkat/lift-up). engsel hanya untuk pintu swing (pintu kaca angkat tidak pakai engsel sendok). hidrolik = 2 pcs per pintu angkat.
Di "nonWorkshop" tulis barang non-workshop yang terlihat (sink, kran, kompor, kulkas, top granit/solid surface, backsplash keramik/subway tile, cutlery tray bawaan, dll) — JANGAN masukkan ke "extra".
ATURAN SPEK KIS (mutlak, menang atas tampilan foto): motif HPL bertanda workshop (isWorkshopHpl) tetap HPL TACO walau bercorak marmer/granit/batu. Bila zona menyebut "top table: HPL WORKSHOP", top = HPL (hitung lapis dari bibir; bila tebal ±36mm = 2) dan JANGAN tulis granit/marmer/batu di nonWorkshop/extra. Bila bingkai pintu kaca "kayu multiplek lapis HPL", JANGAN laporkan frame/profil aluminium di extra.
Isi qty null bila benar-benar tidak bisa dipastikan. Jangan menebak di luar yang terlihat.
Di "notes" tulis jenis hardware yang terlihat (mis. jenis rel: double track / tandem / roller; jenis engsel; jenis kaca).
Di "extra" tulis material/hardware/aksesori lain yang terlihat tetapi TIDAK ada di daftar bahan.
Pisahkan juga per level: "levels":{"upper":{"pintu":n,"laci":n},"lower":{"pintu":n,"laci":n}} (upper = kabinet atas/gantung, lower = kabinet bawah). null bila tidak jelas.
Balas HANYA JSON: {"counts":[{"id":"pintu","qty":6,"evidence":"..."}],"levels":{"upper":{"pintu":2,"laci":0},"lower":{"pintu":4,"laci":3}},"notes":["..."],"extra":["..."],"nonWorkshop":["sink"]}`;

export const scanKisQc = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { routeExtraction, ExtractionServiceError } = await import("./estimator/ai-router");
    try {
      const text = await routeExtraction({
        systemPrompt: SYSTEM,
        userText: `Zona motif KIS (spek resmi, foto final KIS sudah mengikuti spek ini):\n${(data.zones ?? []).map((z) => `- ${z}`).join("\n") || "(tidak ada)"}\n\nDaftar bahan dari spek KIS + hitungan SME:\n${data.specList.map((s) => `- ${s}`).join("\n") || "(kosong)"}`,
        files: data.files,
      });
      const m = text.match(/\{[\s\S]*\}/);
      const raw = JSON.parse(m ? m[0] : "{}") as {
        counts?: { id?: string; qty?: unknown; evidence?: string }[];
        notes?: unknown[];
        extra?: unknown[];
        nonWorkshop?: unknown[];
        levels?: Record<string, { pintu?: unknown; laci?: unknown } | undefined>;
      };
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
      const counts = IDS.map((id) => {
        const f = raw.counts?.find((i) => i.id === id);
        return { id, qty: num(f?.qty), evidence: String(f?.evidence ?? "").slice(0, 200) };
      });
      return {
        ok: true as const,
        counts,
        doors: counts[0]!.qty,
        drawers: counts[1]!.qty,
        levels: {
          upper: { doors: num(raw.levels?.["upper"]?.pintu), drawers: num(raw.levels?.["upper"]?.laci) },
          lower: { doors: num(raw.levels?.["lower"]?.pintu), drawers: num(raw.levels?.["lower"]?.laci) },
        },
        notes: (Array.isArray(raw.notes) ? raw.notes : []).map(String).slice(0, 10),
        nonWorkshop: (Array.isArray(raw.nonWorkshop) ? raw.nonWorkshop : []).map(String).slice(0, 10),
        extra: (Array.isArray(raw.extra) ? raw.extra : []).map(String).slice(0, 15),
      };
    } catch (e) {
      console.error("[kis-qc]", e);
      const msg = e instanceof ExtractionServiceError ? e.message : "Scan AI QC gagal. Coba lagi.";
      return { ok: false as const, error: msg };
    }
  });
