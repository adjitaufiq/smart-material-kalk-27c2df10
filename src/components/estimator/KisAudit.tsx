import { CheckCircle2, AlertTriangle, ScanSearch, Loader2 } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { getDrawingBlob } from "@/lib/drawing-blobs";
import { scanKisQc } from "@/lib/kis-qc.functions";

import { SectionCard } from "@/components/estimator/shared";
import { Button } from "@/components/ui/button";
import type { KisLink } from "@/lib/kis";
import { AUDIT_GROUPS, hplZones, auditSpec, auditTable, shoppingBreakdown, type AiQcResult } from "@/lib/kis-audit";

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
import type { BomItem, CalculationResult, QuickSpec } from "@/lib/estimator/types";

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export function KisAudit({
  kis,
  results,
  bom,
  quick,
  onAi,
  surveyDone,
  onCalculate,
  applied,
  onApply,
}: {
  kis: KisLink;
  results: CalculationResult[];
  bom: BomItem[];
  quick?: QuickSpec | null | undefined;
  onAi: (r: AiQcResult) => void;
  surveyDone: boolean;
  onCalculate: () => void;
  applied: boolean;
  onApply: () => void;
}) {
  const ai = kis.qcAi;
  const findings = auditSpec({ results, bom, extras: kis.finishExtras, quick, ai, applied });
  const rows = auditTable({ results, bom, extras: kis.finishExtras, quick, ai, applied });
  const gaps = rows.filter((r) => r.status === "kurang" || r.status === "lebih").length;
  const allPass = !!ai && applied && findings.length === 0;
  const scan = useServerFn(scanKisQc);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const zoneList = () => {
    const z = hplZones(quick, kis.finishExtras).map((m) => `${m.usage}: TACO ${m.code}${m.name ? ` — ${m.name}` : ""}${m.texture ? ` (${m.texture})` : ""}`);
    if (quick?.outside === "duco") z.unshift(`kabinet: cat DUCO${quick.ducoHex ? ` warna ${quick.ducoHex}` : ""} (bukan zona HPL)`);
    if (quick?.outside === "tacosheet") z.push("bodi luar memakai TACO Sheet (PVC), dihitung sebagai zona motif");
    if (/granit/.test(quick?.topMaterial ?? "")) z.push("top table: GRANIT (bukan zona HPL, non-workshop)");
    if (quick?.inside === "blockmin" || quick?.body?.startsWith("blockmin")) z.push("bagian dalam: Blockmin putih (BUKAN zona HPL)");
    return z;
  };
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
      const r = await scan({ data: { files, specList: bom.map((b) => `${b.name} (${b.qty} ${b.unit})`), zones: zoneList() } });
      if (!r.ok) throw new Error(r.error);
      onAi({ scannedAt: new Date().toISOString(), counts: r.counts, doors: r.doors, drawers: r.drawers, levels: r.levels, notes: r.notes, extra: r.extra, nonWorkshop: r.nonWorkshop });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Scan AI QC gagal.");
    } finally {
      setBusy(false);
    }
  };
  const shop = shoppingBreakdown(bom);

  return (
    <>
      <SectionCard title="Audit Spek Bahan (QC)" description="Cocokkan foto render & tampak dalam dengan spek KIS">
        <Button className="w-full" onClick={runScan} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
          {ai ? "Scan ulang AI Audit (3 foto)" : "Jalankan AI Audit (3 foto)"}
        </Button>
        {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
        {ai ? (
          <p className="mt-2 text-xs text-muted-foreground">Discan {new Date(ai.scannedAt).toLocaleString("id-ID")}</p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Tekan tombol di atas: AI menghitung semua item dari 3 foto lalu dibandingkan dengan spek.</p>
        )}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1 pr-2 font-medium">Item</th>
                <th className="px-1 text-center font-medium">Spek</th>
                <th className="px-1 text-center font-medium">Gambar</th>
                <th className="pl-1 text-right font-medium">Status</th>
              </tr>
            </thead>
            {AUDIT_GROUPS.map((g) => (
              <tbody key={g}>
                <tr>
                  <td colSpan={4} className="pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</td>
                </tr>
                {rows.filter((r) => r.group === g).map((r) => (
                  <tr key={r.id} className="border-b align-top last:border-0">
                    <td className="py-1.5 pr-2">
                      {r.label} <span className="text-xs text-muted-foreground">({r.unit})</span>
                      {r.evidence ? <span className="block text-xs text-muted-foreground">{r.evidence}</span> : null}
                    </td>
                    <td className="px-1 text-center">{r.spec ?? "—"}</td>
                    <td className="px-1 text-center">{r.seen ?? "?"}</td>
                    <td className={`pl-1 text-right text-xs font-semibold ${r.status === "pass" ? "text-primary" : r.status === "tidak_jelas" ? "text-muted-foreground" : "text-destructive"}`}>
                      {r.status === "pass" ? "PASS" : r.status === "kurang" ? "GAP: kurang" : r.status === "lebih" ? "GAP: lebih" : ai ? "Tidak jelas" : "Belum scan"}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        {ai?.notes?.length ? (
          <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
            {ai.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        ) : null}
        {ai?.nonWorkshop?.length ? (
          <div className="mt-3 rounded-md border p-2 text-xs">
            <p className="font-semibold">Info lapangan (non-workshop, bukan kekurangan bahan)</p>
            <p className="text-muted-foreground">{ai.nonWorkshop.join(", ")} — cukup siapkan coakan/penyesuaian meja.</p>
          </div>
        ) : null}
        {ai && !applied ? (
          <Button className="mt-3 w-full" variant="secondary" onClick={onApply}>
            Terapkan Hasil Audit ({gaps} gap) — pintu, laci, engsel, hidrolik, sorot, handle
          </Button>
        ) : null}
        {!ai ? null : findings.length === 0 ? (
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

      <SectionCard title="Hitung Estimasi Material" description="Urutan wajib: isi meteran → scan AI Audit → hitung">
        <ol className="mb-3 space-y-1 text-sm">
          <li>{surveyDone ? "✓" : "1."} Meteran lapangan {surveyDone ? "lengkap" : "belum lengkap"}</li>
          <li>{ai ? "✓" : "2."} Scan AI Audit {ai ? "sudah" : "belum"} (jumlah pintu & laci dari foto dipakai untuk engsel & rel)</li>
          <li>{allPass ? "✓" : "3."} Audit 100% PASS {allPass ? "" : applied ? "— masih ada gap, cek tabel / scan ulang" : "— klik Terapkan Hasil Audit"}</li>
          <li>{kis.calculatedAt ? "✓" : "4."} {kis.calculatedAt ? `Dihitung ${new Date(kis.calculatedAt).toLocaleString("id-ID")}` : "Belum dihitung"}</li>
        </ol>
        <Button className="w-full" onClick={onCalculate} disabled={!surveyDone || !allPass}>
          {kis.calculatedAt ? "Hitung ulang" : "Hitung Estimasi Material"}
        </Button>
      </SectionCard>

      {kis.calculatedAt ? (
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
      ) : null}
    </>
  );
}
