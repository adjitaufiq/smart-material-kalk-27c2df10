import { useState } from "react";
import { FileSpreadsheet, Info, Printer, Share2 } from "lucide-react";

import { IssueList, StatusBadge } from "@/components/estimator/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_LABEL } from "@/lib/estimator/engine";
import type { BomItem, CalculationResult, FurnitureItem } from "@/lib/estimator/types";
import { dualDim, rupiah } from "@/lib/estimator/units";

function groupLabel(group: BomItem["group"]) {
  return {
    material: "Material",
    finishing: "Finishing",
    edging: "Edging",
    hardware: "Hardware",
    elektrik: "Elektrik",
  }[group];
}

export function ResultTabs({
  item,
  result,
  projectName,
  revision,
  onEditAssumptions,
}: {
  item: FurnitureItem;
  result: CalculationResult;
  projectName: string;
  revision: number;
  onEditAssumptions: () => void;
}) {
  const [trace, setTrace] = useState<BomItem | null>(null);
  const ready = result.status === "bom_siap_belanja";

  const textReport = buildTextReport(item, result, projectName, revision);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <StatusBadge status={result.status} />
        {!ready ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Perhitungan belum dapat difinalkan sebagai BOM siap belanja. Lengkapi item pada daftar
            di bawah.
          </p>
        ) : null}
        <div className="mt-3">
          <IssueList issues={result.issues} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              window.open(`https://wa.me/?text=${encodeURIComponent(textReport)}`, "_blank")
            }
          >
            <Share2 /> WhatsApp
          </Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
          <Button size="sm" variant="secondary" onClick={() => downloadCsv(item, result)}>
            <FileSpreadsheet /> Excel (CSV)
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ringkasan">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="cutlist">Cut List</TabsTrigger>
          <TabsTrigger value="material">Material</TabsTrigger>
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
          <TabsTrigger value="biaya">Biaya</TabsTrigger>
          <TabsTrigger value="asumsi">Asumsi</TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Modul" value={String(item.modules.length)} />
            <Stat
              label="Total part"
              value={String(result.parts.reduce((a, p) => a + p.qty, 0))}
            />
            <Stat
              label="Lembar material"
              value={String(result.sheets.reduce((a, s) => a + s.sheets, 0))}
            />
            <Stat
              label="Lembar HPL"
              value={String(result.hplSheets.reduce((a, s) => a + s.sheets, 0))}
            />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-display text-sm font-semibold">Modul</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {item.modules.map((m) => (
                <li key={m.id} className="flex justify-between gap-3">
                  <span>
                    {m.name} <span className="text-muted-foreground">×{m.qty}</span>
                  </span>
                  <span className="num text-muted-foreground">
                    {dualDim(m.width_mm, m.height_mm, m.depth_mm)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="cutlist" className="mt-4 space-y-4">
          {result.sheets.map((sheet) => (
            <div key={sheet.materialId} className="rounded-xl border bg-card p-4">
              <h3 className="font-display text-sm font-semibold">{sheet.materialName}</h3>
              <table className="mt-2 w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1">Part</th>
                    <th>Ukuran (mm)</th>
                    <th className="text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {result.parts
                    .filter((p) => p.material_id === sheet.materialId)
                    .map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="py-1.5">
                          {p.part_name}
                          <span className="block text-[10px] text-muted-foreground">
                            {p.module_name} · {p.derivation}
                          </span>
                        </td>
                        <td className="num">
                          {p.length_mm} × {p.width_mm}
                        </td>
                        <td className="num text-right">{p.qty}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {sheet.layouts.length > 0 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Nesting: {sheet.layouts.length} lembar, utilisasi{" "}
                  {(sheet.utilization * 100).toFixed(1)}%.
                </p>
              ) : null}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="material" className="mt-4 space-y-3">
          {(["material", "finishing", "edging"] as const).map((group) => (
            <BomGroup
              key={group}
              title={groupLabel(group)}
              items={result.bom.filter((b) => b.group === group)}
              onTrace={setTrace}
            />
          ))}
        </TabsContent>

        <TabsContent value="hardware" className="mt-4 space-y-3">
          <BomGroup title="Hardware" items={result.hardware} onTrace={setTrace} />
          <BomGroup title="Elektrik" items={result.electrical} onTrace={setTrace} />
        </TabsContent>

        <TabsContent value="biaya" className="mt-4">
          <div className="rounded-xl border bg-card p-4">
            <ul className="space-y-2 text-sm">
              <CostRow label="Subtotal material" value={result.cost.material} />
              <CostRow label="Subtotal finishing" value={result.cost.finishing} />
              <CostRow label="Subtotal edging" value={result.cost.edging} />
              <CostRow label="Subtotal hardware" value={result.cost.hardware} />
              <CostRow label="Subtotal elektrik" value={result.cost.elektrik} />
              <li className="flex justify-between border-t pt-2 font-display font-semibold">
                <span>Grand Total</span>
                <span className="num">{rupiah(result.cost.grandTotal)}</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Estimasi material, bukan quotation final.
              {result.cost.incomplete
                ? " Sebagian harga belum tersedia di master, total belum lengkap."
                : ""}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="asumsi" className="mt-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">Asumsi Perhitungan</h3>
              <Button size="sm" variant="outline" onClick={onEditAssumptions}>
                Edit Asumsi
              </Button>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {result.assumptions.map((a) => (
                <li key={a.key} className="flex flex-wrap justify-between gap-2 border-b pb-1.5">
                  <span className="text-muted-foreground">{a.label}</span>
                  <span className="flex items-center gap-2">
                    {a.value}
                    {a.isDefault ? (
                      <Badge variant="outline" className="text-[10px]">
                        default
                      </Badge>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Nilai bertanda <strong>default</strong> berasal dari construction template dan dapat
              diubah pada langkah Material.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={trace !== null} onOpenChange={(o) => !o && setTrace(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dasar hitung — {trace?.name}</DialogTitle>
            <DialogDescription>{trace?.explanation}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {trace?.trace.map((line, i) => (
              <li key={i} className="border-b pb-1">
                {line}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num font-display text-xl font-semibold">{value}</p>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number | null }) {
  return (
    <li className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{rupiah(value)}</span>
    </li>
  );
}

function BomGroup({
  title,
  items,
  onTrace,
}: {
  title: string;
  items: BomItem[];
  onTrace: (item: BomItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      <ul className="mt-2 divide-y">
        {items.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm">{b.name}</p>
              <button
                type="button"
                onClick={() => onTrace(b)}
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary underline-offset-2 hover:underline"
              >
                <Info className="size-3" /> Lihat dasar hitung
              </button>
            </div>
            <span className="num shrink-0 text-sm font-medium">
              {b.qty} {b.unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function buildTextReport(
  item: FurnitureItem,
  result: CalculationResult,
  projectName: string,
  revision: number,
): string {
  const lines: string[] = [];
  lines.push(`*${projectName}* — ${item.name} (${item.category})`);
  lines.push(`Revisi ${revision} · ${new Date().toLocaleDateString("id-ID")}`);
  lines.push(`Status: ${STATUS_LABEL[result.status]}`);
  lines.push("");
  lines.push("DIMENSI");
  for (const m of item.modules) {
    lines.push(`- ${m.name} ×${m.qty}: ${m.width_mm} × ${m.height_mm} × ${m.depth_mm} mm`);
  }
  lines.push("");
  lines.push("KEBUTUHAN MATERIAL");
  for (const b of result.bom) {
    lines.push(`- [${groupLabel(b.group)}] ${b.name}: ${b.qty} ${b.unit}`);
  }
  lines.push("");
  lines.push("ASUMSI");
  for (const a of result.assumptions) {
    lines.push(`- ${a.label}: ${a.value}${a.isDefault ? " (default)" : ""}`);
  }
  lines.push("");
  lines.push(`Estimasi biaya: ${rupiah(result.cost.grandTotal)} (bukan quotation final)`);
  return lines.join("\n");
}

function downloadCsv(item: FurnitureItem, result: CalculationResult) {
  const rows: string[][] = [["Bagian", "Nama", "Ukuran / Qty", "Satuan", "Keterangan"]];
  for (const p of result.parts) {
    rows.push([
      "CUT LIST",
      `${p.module_name} - ${p.part_name}`,
      `${p.length_mm} x ${p.width_mm} x ${p.thickness_mm} (${p.qty} pcs)`,
      "pcs",
      p.derivation,
    ]);
  }
  for (const b of result.bom) {
    rows.push(["BOM " + groupLabel(b.group), b.name, String(b.qty), b.unit, b.explanation]);
  }
  for (const a of result.assumptions) {
    rows.push(["ASUMSI", a.label, a.value, "", a.isDefault ? "default" : "diubah user"]);
  }
  const csv = rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${item.name.replace(/\s+/g, "-").toLowerCase()}-bom.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
