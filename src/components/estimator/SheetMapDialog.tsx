import { Ruler } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { materialLabel } from "@/lib/estimator/terminology";
import type { CalculationResult, SheetResult } from "@/lib/estimator/types";

/** Gabungkan hasil nesting semua item per material (lembar dinomori ulang). */
function merge(list: SheetResult[]) {
  const map = new Map<string, { name: string; sheets: { parts: { name: string; l: number; w: number }[]; used: number; area: number }[] }>();
  for (const r of list) {
    const e = map.get(r.materialId) ?? { name: r.materialName, sheets: [] };
    for (const l of r.layouts) {
      e.sheets.push({
        parts: l.placed.map((p) => ({ name: p.part_name, l: Math.round(p.length_mm), w: Math.round(p.width_mm) })),
        used: l.usedArea_mm2,
        area: l.sheet_length_mm * l.sheet_width_mm,
      });
    }
    map.set(r.materialId, e);
  }
  return [...map.values()];
}

function group(parts: { name: string; l: number; w: number }[]) {
  const m = new Map<string, number>();
  for (const p of parts) {
    const k = `${p.name}|${p.l}×${p.w}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => {
    const [name, size] = k.split("|");
    return { name: name!, size: size!, n };
  });
}

function MapList({ data, label }: { data: ReturnType<typeof merge>; label: string }) {
  if (!data.length) return <p className="py-4 text-sm text-muted-foreground">Tidak ada {label}.</p>;
  return (
    <div className="space-y-4">
      {data.map((m) => (
        <section key={m.name}>
          <h4 className="font-display text-sm font-semibold">
            {materialLabel(m.name)} — {m.sheets.length} lembar
          </h4>
          <ol className="mt-1 space-y-2">
            {m.sheets.map((s, i) => (
              <li key={i} className="rounded-md border p-2 text-xs">
                <p className="flex justify-between font-medium">
                  <span>Lembar {i + 1}</span>
                  <span className="num text-muted-foreground">terpakai {Math.round((s.used / s.area) * 100)}%</span>
                </p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {group(s.parts).map((p) => (
                    <li key={p.name + p.size} className="flex justify-between gap-2">
                      <span className="min-w-0 break-words">{p.n}× {p.name}</span>
                      <span className="num shrink-0">{p.size} mm</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** Panduan potong 1 setel: lembar bodi + lembar HPL pelapisnya. */
export function SheetMapDialog({ results }: { results: CalculationResult[] }) {
  const body = merge(results.flatMap((r) => r.sheets));
  const hpl = merge(results.flatMap((r) => r.hplSheets));
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Ruler /> Pemetaan lembar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pemetaan Lembar — Bodi & HPL</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="body">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="body">Bodi / Triplek</TabsTrigger>
            <TabsTrigger value="hpl">Lapisan HPL</TabsTrigger>
          </TabsList>
          <TabsContent value="body">
            <MapList data={body} label="lembar bodi" />
          </TabsContent>
          <TabsContent value="hpl">
            <MapList data={hpl} label="lembar HPL" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
