import { AlertTriangle, CircleAlert, FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Briefing,
  ExtractedMeasurement,
  ExtractionStatus,
  StrictExtractionResult,
} from "@/lib/estimator/types";

const STATUS_UI: Record<ExtractionStatus, { label: string; cls: string }> = {
  CONFIRMED_FROM_DRAWING: {
    label: "Terbaca dari gambar",
    cls: "bg-success/12 text-success border-success/40",
  },
  AMBIGUOUS: {
    label: "Tidak terbaca jelas",
    cls: "bg-warning/15 text-warning-foreground border-warning/40",
  },
  CONFLICT: {
    label: "Nilai bertentangan",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
  },
  NOT_FOUND: {
    label: "Tidak ada di gambar",
    cls: "bg-muted text-muted-foreground border-border",
  },
};

const SOURCE_LABEL: Record<string, string> = {
  dimension_annotation: "Anotasi ukuran",
  dimension_line: "Garis ukuran",
  text_note: "Catatan teks",
  spec_table: "Tabel spesifikasi",
  title_block: "Title block",
  callout: "Callout",
  not_available: "Tidak tersedia",
};

function StatusPill({ status }: { status: ExtractionStatus }) {
  const ui = STATUS_UI[status];
  return (
    <span className={cn("inline-block rounded border px-1.5 py-0.5 text-[10px]", ui.cls)}>
      {ui.label}
    </span>
  );
}

/** Field brief yang bisa diisi langsung dari hasil pembacaan gambar. */
function briefTargetFor(field: string): keyof Briefing | null {
  const f = field.toLowerCase();
  if (/(width|lebar|panjang|length)/.test(f)) return "width_mm";
  if (/(height|tinggi)/.test(f)) return "height_mm";
  if (/(depth|kedalaman|dalam)/.test(f)) return "depth_mm";
  return null;
}

function countTargetFor(label: string): keyof Briefing | null {
  const l = label.toLowerCase();
  if (/pintu|door/.test(l)) return "doors";
  if (/laci|drawer/.test(l)) return "drawers";
  if (/rak|shelf|shelves/.test(l)) return "shelves";
  return null;
}

export function ExtractionReview({
  strict,
  brief,
  setBrief,
}: {
  strict: StrictExtractionResult;
  brief: Briefing;
  setBrief: (p: Partial<Briefing>) => void;
}) {
  const applyMeasurement = (m: ExtractedMeasurement) => {
    const target = briefTargetFor(m.field);
    if (!target || m.value_mm === null) return;
    setBrief({ [target]: m.value_mm } as Partial<Briefing>);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px]">
        Hasil di bawah adalah <strong>pembacaan gambar</strong>, bukan estimasi. Nilai yang tidak
        tertulis pada gambar sengaja dibiarkan kosong dan harus Anda isi manual.
        <br />
        Model: <span className="font-mono">{strict.model}</span> — {strict.provider}
      </div>

      {strict.sections.map((sec) => (
        <div key={sec.id} className="rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{sec.name}</h3>
            <span className="text-[11px] text-muted-foreground">
              Jenis: {sec.furniture_type} ({Math.round(sec.furniture_type_confidence * 100)}%)
            </span>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">Field</th>
                  <th className="py-1 pr-2">Nilai</th>
                  <th className="py-1 pr-2">Sumber</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {sec.measurements.map((m, i) => (
                  <tr key={`${m.field}-${i}`} className="border-t align-top">
                    <td className="py-1.5 pr-2">
                      {m.label}
                      {m.view ? (
                        <span className="block text-[10px] text-muted-foreground">
                          view: {m.view}
                          {m.page ? ` · hal. ${m.page}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="num py-1.5 pr-2">
                      {m.value_mm !== null
                        ? `${m.value_mm} mm`
                        : m.candidates_mm?.length
                          ? `? (${m.candidates_mm.join(" / ")} mm)`
                          : "—"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {SOURCE_LABEL[m.source] ?? m.source}
                      {m.source_text ? (
                        <span className="block text-[10px] italic text-muted-foreground">
                          “{m.source_text}”
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-2">
                      <StatusPill status={m.status} />
                    </td>
                    <td className="py-1.5">
                      {m.value_mm !== null && briefTargetFor(m.field) ? (
                        <Button size="sm" variant="outline" onClick={() => applyMeasurement(m)}>
                          Pakai
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {sec.counts.map((c, i) => {
                  const target = countTargetFor(c.label);
                  return (
                    <tr key={`c-${i}`} className="border-t align-top">
                      <td className="py-1.5 pr-2">{c.label}</td>
                      <td className="num py-1.5 pr-2">{c.value ?? "—"}</td>
                      <td className="py-1.5 pr-2">{SOURCE_LABEL[c.source] ?? c.source}</td>
                      <td className="py-1.5 pr-2">
                        <StatusPill status={c.status} />
                      </td>
                      <td className="py-1.5">
                        {c.value !== null && target ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBrief({ [target]: c.value } as Partial<Briefing>)}
                          >
                            Pakai
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {sec.specs.map((s, i) => (
                  <tr key={`s-${i}`} className="border-t align-top">
                    <td className="py-1.5 pr-2">{s.label}</td>
                    <td className="py-1.5 pr-2">{s.value ?? "—"}</td>
                    <td className="py-1.5 pr-2">{SOURCE_LABEL[s.source] ?? s.source}</td>
                    <td className="py-1.5 pr-2">
                      <StatusPill status={s.status} />
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sec.relations.length > 0 ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Hubungan komponen: {sec.relations.join("; ")}
            </p>
          ) : null}
          {sec.notes.length > 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Catatan: {sec.notes.join("; ")}</p>
          ) : null}
        </div>
      ))}

      {strict.conflicts.length > 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-destructive">
            <CircleAlert className="size-3.5" /> Nilai bertentangan pada gambar
          </p>
          <ul className="mt-1 list-disc pl-5 text-[11px] text-destructive">
            {strict.conflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {strict.needs_confirmation.length > 0 ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-warning-foreground">
            <AlertTriangle className="size-3.5" /> Data yang perlu dikonfirmasi (
            {strict.needs_confirmation.length})
          </p>
          <ul className="mt-1 list-disc pl-5 text-[11px] text-warning-foreground">
            {strict.needs_confirmation.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Isi manual pada langkah Ukuran/Material, atau biarkan tetap “belum diketahui” — status
            BOM Siap Belanja tidak akan terbuka selama data kritis kosong.
          </p>
        </div>
      ) : null}

      {strict.unreadable_pages.length > 0 ? (
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <FileQuestion className="size-3.5" /> Halaman tidak terbaca:{" "}
          {strict.unreadable_pages.join(", ")}
        </p>
      ) : null}
      {strict.drawing_scale_note ? (
        <p className="text-[11px] text-muted-foreground">Skala: {strict.drawing_scale_note}</p>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Ringkasan brief saat ini — L: {brief.width_mm ?? "—"} mm · T: {brief.height_mm ?? "—"} mm ·
        D: {brief.depth_mm ?? "—"} mm.
      </p>
    </div>
  );
}
