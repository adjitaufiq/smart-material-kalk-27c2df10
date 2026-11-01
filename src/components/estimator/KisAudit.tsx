import { CheckCircle2, AlertTriangle } from "lucide-react";

import { SectionCard } from "@/components/estimator/shared";
import { Button } from "@/components/ui/button";
import type { KisLink } from "@/lib/kis";
import { auditSpec, shoppingBreakdown, VISUAL_CHECKS, type VisualQc } from "@/lib/kis-audit";
import type { BomItem, CalculationResult } from "@/lib/estimator/types";

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export function KisAudit({
  kis,
  results,
  bom,
  onChange,
}: {
  kis: KisLink;
  results: CalculationResult[];
  bom: BomItem[];
  onChange: (v: VisualQc) => void;
}) {
  const visual = kis.qcVisual ?? {};
  const findings = auditSpec({ results, bom, extras: kis.finishExtras, visual });
  const shop = shoppingBreakdown(bom);
  const set = (id: keyof VisualQc, v: boolean) => onChange({ ...visual, [id]: visual[id] === v ? undefined : v });

  return (
    <>
      <SectionCard title="Audit Spek Bahan (QC)" description="Cocokkan foto render & tampak dalam dengan spek KIS">
        <ul className="space-y-2">
          {VISUAL_CHECKS.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{c.label}</span>
              <span className="flex gap-1">
                <Button size="sm" variant={visual[c.id] === true ? "default" : "outline"} onClick={() => set(c.id, true)}>
                  Ada
                </Button>
                <Button size="sm" variant={visual[c.id] === false ? "default" : "outline"} onClick={() => set(c.id, false)}>
                  Tidak
                </Button>
              </span>
            </li>
          ))}
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
