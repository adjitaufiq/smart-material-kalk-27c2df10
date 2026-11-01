import { CheckCircle2, AlertTriangle, ScanSearch, Loader2 } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { getDrawingBlob } from "@/lib/drawing-blobs";
import { scanKisQc } from "@/lib/kis-qc.functions";

import { SectionCard } from "@/components/estimator/shared";
import { Button } from "@/components/ui/button";
import type { KisLink } from "@/lib/kis";
import { auditSpec, shoppingBreakdown, VISUAL_CHECKS, type AiQcResult, type VisualQc } from "@/lib/kis-audit";

async function toDataUrl(key: string | undefined, url: string | undefined) {
  const cached = key ? await getDrawingBlob(key) : null;
  if (cached) return cached;
  if (!url) return null;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
import type { BomItem, CalculationResult } from "@/lib/estimator/types";

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export function KisAudit({
  kis,
  results,
  bom,
  onChange,
  onAi,
}: {
  kis: KisLink;
  results: CalculationResult[];
  bom: BomItem[];
  onChange: (v: VisualQc) => void;
  onAi: (r: AiQcResult) => void;
}) {
  const visual = kis.qcVisual ?? {};
  const ai = kis.qcAi;
  const findings = auditSpec({ results, bom, extras: kis.finishExtras, visual, ai });
  const scan = useServerFn(scanKisQc);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const runScan = async () => {
    setBusy(true);
    setErr(null);
    try {
      const imgs = [
        ["render-luar", await toDataUrl(kis.renderBlobKey, kis.renderUrl)],
        ["tampak-dalam-depan", await toDataUrl(kis.interiorBlobKey, kis.interiorUrl)],
        ["tampak-dalam-samping", await toDataUrl(kis.interiorSideBlobKey, kis.interiorSideUrl)],
      ] as const;
      const files = imgs.flatMap(([name, d]) => (d && d.startsWith("data:") ? [{ name, mime: d.slice(5, d.indexOf(";")), dataUrl: d }] : []));
      if (files.length === 0) throw new Error("Foto render dari KIS tidak tersedia. Buka ulang proyek dari KIS.");
      const r = await scan({ data: { files, specList: bom.map((b) => `${b.name} (${b.qty} ${b.unit})`) } });
      if (!r.ok) throw new Error(r.error);
      onAi({ scannedAt: new Date().toISOString(), items: r.items, doors: r.doors, drawers: r.drawers, extra: r.extra });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Scan AI QC gagal.");
    } finally {
      setBusy(false);
    }
  };
  const shop = shoppingBreakdown(bom);
  const set = (id: keyof VisualQc, v: boolean) => onChange({ ...visual, [id]: visual[id] === v ? undefined : v });

  return (
    <>
      <SectionCard title="Audit Spek Bahan (QC)" description="Cocokkan foto render & tampak dalam dengan spek KIS">
        <Button className="w-full" onClick={runScan} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
          {ai ? "Scan ulang AI QC (luar, dalam depan & samping)" : "Jalankan AI QC (luar, dalam depan & samping)"}
        </Button>
        {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
        {ai ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Discan {new Date(ai.scannedAt).toLocaleString("id-ID")} · AI lihat {ai.doors ?? "?"} pintu, {ai.drawers ?? "?"} laci. Tombol Ada/Tidak hanya untuk koreksi.
          </p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {VISUAL_CHECKS.map((c) => {
            const a = ai?.items.find((i) => i.id === c.id);
            return (
            <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {c.label}
                {a ? (
                  <span className="block text-xs text-muted-foreground">
                    AI: {a.status === "ada" ? "terlihat" : a.status === "tidak" ? "tidak ada" : "tidak jelas"}
                    {a.evidence ? ` — ${a.evidence}` : ""}
                  </span>
                ) : null}
              </span>
              <span className="flex gap-1">
                <Button size="sm" variant={visual[c.id] === true ? "default" : "outline"} onClick={() => set(c.id, true)}>
                  Ada
                </Button>
                <Button size="sm" variant={visual[c.id] === false ? "default" : "outline"} onClick={() => set(c.id, false)}>
                  Tidak
                </Button>
              </span>
            </li>
            );
          })}
        </ul>
        {findings.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-md border p-2 text-sm text-primary">
            <CheckCircle2 className="size-4" /> Audit spek lolos — tidak ada selisih.
          </p>
        ) : (
          <div className="mt-3 rounded-md border border-destructive/50 p-2 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="size-4" /> {findings.length} selisih — dikirim balik ke KIS
            </p>
            <ul className="mt-1 space-y-0.5">
              {findings.map((f, i) => (
                <li key={i}>
                  <b>{f.type === "kurang" ? "Kurang" : "Lebih"}:</b> {f.item} — <span className="text-muted-foreground">{f.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Rincian Belanja Bahan" description="Kebutuhan × harga acuan sistem">
        <div className="space-y-4">
          {shop.categories.map((c) => (
            <div key={c.category}>
              <p className="flex justify-between text-sm font-semibold">
                <span>{c.category}</span>
                <span>{rp(c.total)}</span>
              </p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {c.rows.map((r, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      {r.name} <span className="text-muted-foreground">· {r.qty.toLocaleString("id-ID")} {r.unit} × {r.unitPrice == null ? "harga?" : rp(r.unitPrice)}</span>
                    </span>
                    <span className="shrink-0">{r.subtotal == null ? "—" : rp(r.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="flex justify-between border-t pt-2 font-bold">
            <span>Total estimasi belanja</span>
            <span>{rp(shop.total)}</span>
          </p>
          {shop.missingPrice ? (
            <p className="text-xs text-destructive">{shop.missingPrice} baris belum ada harga — perlu konfirmasi.</p>
          ) : null}
        </div>
      </SectionCard>
    </>
  );
}
