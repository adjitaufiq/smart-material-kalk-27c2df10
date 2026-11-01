import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  files: z.array(z.object({ name: z.string().min(1), mime: z.string().min(1), dataUrl: z.string().min(1) })).min(1).max(4),
  specList: z.array(z.string()).max(300),
});

const IDS = ["pintu", "laci", "engsel", "rel", "hidrolik", "kaca", "led", "sorot", "list", "handle", "top", "rak-piring", "rak-bumbu", "rak-sayur", "ambalan"] as const;

const SYSTEM = `Kamu auditor QC workshop interior (layer kedua, independen dari desainer KIS).
Ada 3 foto: render tampak luar (pintu tertutup), tampak dalam depan (pintu & laci terbuka), tampak dalam samping/serong 3/4 (laci ditarik).
HITUNG jumlah yang benar-benar terlihat untuk tiap id berikut (gabungkan semua foto, jangan dobel hitung objek sama):
pintu = jumlah daun pintu; laci = jumlah laci; engsel = jumlah engsel (pcs, biasanya 2 per pintu, hitung dari pintu yang terlihat terbuka bila perlu); rel = jumlah set rel laci (1 set per laci); hidrolik = jumlah gas spring/hidrolik pintu angkat (pcs); kaca = jumlah daun pintu kaca; led = jumlah jalur LED strip; sorot = jumlah titik lampu sorot/spot; list = 1 bila ada list profil gold/hitam, 0 bila tidak; handle = jumlah handle/tarikan (0 bila bevel/tanpa handle); top = jumlah lapis top table yang terlihat dari tebal bibir (1 atau 2); rak-piring, rak-bumbu, rak-sayur = jumlah set; ambalan = jumlah papan ambalan/rak dalam.
Isi qty null bila benar-benar tidak bisa dipastikan. Jangan menebak di luar yang terlihat.
Di "notes" tulis jenis hardware yang terlihat (mis. jenis rel: double track / tandem / roller; jenis engsel; jenis kaca).
Di "extra" tulis material/hardware/aksesori lain yang terlihat tetapi TIDAK ada di daftar bahan.
Balas HANYA JSON: {"counts":[{"id":"pintu","qty":6,"evidence":"..."}],"notes":["..."],"extra":["..."]}`;

export const scanKisQc = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { routeExtraction, ExtractionServiceError } = await import("./estimator/ai-router");
    try {
      const text = await routeExtraction({
        systemPrompt: SYSTEM,
        userText: `Daftar bahan dari spek KIS + hitungan SME:\n${data.specList.map((s) => `- ${s}`).join("\n") || "(kosong)"}`,
        files: data.files,
      });
      const m = text.match(/\{[\s\S]*\}/);
      const raw = JSON.parse(m ? m[0] : "{}") as {
        counts?: { id?: string; qty?: unknown; evidence?: string }[];
        notes?: unknown[];
        extra?: unknown[];
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
        notes: (Array.isArray(raw.notes) ? raw.notes : []).map(String).slice(0, 10),
        extra: (Array.isArray(raw.extra) ? raw.extra : []).map(String).slice(0, 15),
      };
    } catch (e) {
      console.error("[kis-qc]", e);
      const msg = e instanceof ExtractionServiceError ? e.message : "Scan AI QC gagal. Coba lagi.";
      return { ok: false as const, error: msg };
    }
  });
