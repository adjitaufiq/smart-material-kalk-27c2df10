import { materialLabel } from "@/lib/estimator/terminology";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { SectionCard } from "@/components/estimator/shared";
import {
  CONSTRUCTION_TEMPLATES,
  EDGING_MASTER,
  HARDWARE_MASTER,
  HPL_MASTER,
  MATERIAL_MASTER,
} from "@/lib/estimator/masters";
import { rupiah } from "@/lib/estimator/units";

export const Route = createFileRoute("/master")({
  head: () => ({
    meta: [
      { title: "Master Data Material — Smart Material Estimator" },
      {
        name: "description",
        content:
          "Daftar master material, HPL, edging, hardware, dan construction template yang dipakai mesin perhitungan.",
      },
      { property: "og:title", content: "Master Data Material" },
      {
        property: "og:description",
        content: "Referensi material, finishing, edging, hardware, dan template konstruksi.",
      },
    ],
  }),
  component: MasterPage,
});

function MasterPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Kembali
      </Link>
      <h1 className="font-display text-2xl font-bold tracking-tight">Master Data</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Semua angka perhitungan mengacu ke tabel ini. Harga kosong berarti biaya belum lengkap.
      </p>

      <div className="mt-6 space-y-4">
        <SectionCard title="Material Lembaran">
          <ul className="divide-y text-sm">
            {MATERIAL_MASTER.map((m) => (
              <li key={m.id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{materialLabel(m.nama_material)}</span>
                  <span className="num block text-xs text-muted-foreground">
                    {m.panjang_mm} × {m.lebar_mm} × {m.ketebalan_mm} mm · grain {m.grain_direction}
                  </span>
                </span>
                <span className="num shrink-0 text-xs">{rupiah(m.harga)} / {m.satuan}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="HPL / Finishing">
          <ul className="divide-y text-sm">
            {HPL_MASTER.map((h) => (
              <li key={h.id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate">
                    {h.brand} {h.kode} — {h.nama}
                  </span>
                  <span className="num block text-xs text-muted-foreground">
                    {h.panjang_mm} × {h.lebar_mm} mm
                  </span>
                </span>
                <span className="num shrink-0 text-xs">{rupiah(h.harga)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Edging">
          <ul className="divide-y text-sm">
            {EDGING_MASTER.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2">
                <span className="truncate">{e.nama}</span>
                <span className="num shrink-0 text-xs">{rupiah(e.harga_per_meter)} / m</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Hardware">
          <ul className="divide-y text-sm">
            {HARDWARE_MASTER.map((h) => (
              <li key={h.id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{h.nama}</span>
                  <span className="block text-xs text-muted-foreground">{h.kategori}</span>
                </span>
                <span className="num shrink-0 text-xs">
                  {rupiah(h.harga)} / {h.unit}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Construction Template"
          description="Default konstruksi selalu terlihat dan dapat diubah per modul."
        >
          <ul className="divide-y text-sm">
            {CONSTRUCTION_TEMPLATES.map((t) => (
              <li key={t.id} className="py-2">
                <p className="font-medium">
                  {t.nama} <span className="text-xs text-muted-foreground">({t.kode})</span>
                </p>
                <p className="num text-xs text-muted-foreground">
                  {t.default_height_mm} H × {t.default_depth_mm} D · clearance pintu {t.door_clearance_mm} mm ·
                  hubungan panel: {t.panel_relationship}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </main>
  );
}
