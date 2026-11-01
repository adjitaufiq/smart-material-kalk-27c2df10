import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  files: z.array(z.object({ name: z.string().min(1), mime: z.string().min(1), dataUrl: z.string().min(1) })).min(1).max(4),
  specList: z.array(z.string()).max(300),
});

const IDS = ["lampu", "kaca", "list", "pintu-angkat", "rak-sayur", "rak-bumbu", "rak-piring"] as const;

const SYSTEM = `Kamu auditor QC workshop interior (layer kedua, independen dari desainer).
Periksa foto render tampak luar & tampak dalam furniture. Laporkan HANYA yang benar-benar terlihat; jangan menebak.
Item yang wajib dinilai (id): lampu (LED strip/lampu sorot), kaca (pintu/panel kaca), list (list profil gold/hitam), pintu-angkat (pintu lipat/angkat ke atas, gas spring), rak-sayur, rak-bumbu, rak-piring.
Nilai tiap item: "ada" (jelas terlihat), "tidak" (jelas tidak ada), "tidak_jelas" (tidak bisa dipastikan dari foto).
Hitung juga jumlah daun pintu dan laci yang terlihat bila bisa dihitung (null bila tidak).
Bandingkan dengan daftar bahan yang diberikan; tulis di "extra" hanya material/hardware/aksesori lain yang terlihat di foto tetapi tidak ada di daftar bahan.
Balas HANYA JSON: {"items":[{"id":"lampu","status":"ada","evidence":"..."}],"doors":number|null,"drawers":number|null,"extra":["..."]}`;

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
        items?: { id?: string; status?: string; evidence?: string }[];
        doors?: number | null;
        drawers?: number | null;
        extra?: string[];
      };
      const items = IDS.map((id) => {
        const f = raw.items?.find((i) => i.id === id);
        const status = f?.status === "ada" || f?.status === "tidak" ? f.status : "tidak_jelas";
        return { id, status, evidence: String(f?.evidence ?? "").slice(0, 200) };
      });
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
      return {
        ok: true as const,
        items,
        doors: num(raw.doors),
        drawers: num(raw.drawers),
        extra: (Array.isArray(raw.extra) ? raw.extra : []).map(String).slice(0, 15),
      };
    } catch (e) {
      console.error("[kis-qc]", e);
      const msg = e instanceof ExtractionServiceError ? e.message : "Scan AI QC gagal. Coba lagi.";
      return { ok: false as const, error: msg };
    }
  });
