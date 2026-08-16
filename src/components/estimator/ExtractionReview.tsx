import { AlertTriangle, CheckCircle2, CircleAlert, ScanLine, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  briefTargetFor,
  confirmedBriefFromStrict,
  countTargetFor,
  isMultiPage,
} from "@/lib/estimator/extraction-review";
import { formatSource, friendlyLabel, materialLabel } from "@/lib/estimator/terminology";
import type {
  Briefing,
  ExtractedCount,
  ExtractedMeasurement,
  ExtractedSection,
  ExtractedSpec,
  ExtractionStatus,
  StrictExtractionResult,
} from "@/lib/estimator/types";

const STATUS_UI: Record<
  ExtractionStatus,
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  CONFIRMED_FROM_DRAWING: {
    label: "Terbaca",
    cls: "bg-success/12 text-success border-success/40",
    Icon: CheckCircle2,
  },
  AMBIGUOUS: {
    label: "Perlu diperiksa",
    cls: "bg-warning/15 text-warning-foreground border-warning/40",
    Icon: AlertTriangle,
  },
  CONFLICT: {
    label: "Konflik",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
    Icon: CircleAlert,
  },
  NOT_FOUND: {
    label: "Tidak ditemukan",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
    Icon: XCircle,
  },
};

function StatusPill({ status }: { status: ExtractionStatus }) {
  const ui = STATUS_UI[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
        ui.cls,
      )}
    >
      <ui.Icon className="size-3.5 shrink-0" /> {ui.label}
    </span>
  );
}

function Row({
  label,
  value,
  status,
  source,
  actions,
}: {
  label: string;
  value: string;
  status: ExtractionStatus;
  source: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num mt-0.5 break-words text-base font-semibold">{value}</p>
      <div className="mt-1.5">
        <StatusPill status={status} />
      </div>
      {source ? (
        <p className="mt-1.5 break-words text-xs text-muted-foreground">Sumber: {source}</p>
      ) : null}
      {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function sectionStatusLabel(sec: ExtractedSection) {
  const dims = sec.measurements.filter((m) => briefTargetFor(m.field, m.label));
  const ok = dims.length > 0 && dims.every((m) => m.status === "CONFIRMED_FROM_DRAWING");
  if (ok) return { text: "Data utama terbaca", cls: "text-success", Icon: CheckCircle2 };
  return { text: "Ada data yang perlu diperiksa", cls: "text-warning-foreground", Icon: AlertTriangle };
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
  const multiPage = isMultiPage(strict);

  const applyMeasurement = (m: ExtractedMeasurement, value?: number) => {
    const target = briefTargetFor(m.field, m.label);
    const v = value ?? m.value_mm;
    if (!target || v === null || v === undefined) return;
    setBrief({ [target]: v } as Partial<Briefing>);
  };

  const applyAll = () => setBrief(confirmedBriefFromStrict(strict));

  const measurementRow = (m: ExtractedMeasurement, i: number) => {
    const target = briefTargetFor(m.field, m.label);
    const candidates = m.candidates_mm ?? [];
    const value =
      m.value_mm !== null
        ? `${m.value_mm} mm`
        : candidates.length
          ? candidates.map((c) => `${c} mm`).join(" atau ")
          : "Belum ada data";
    return (
      <Row
        key={`${m.field}-${i}`}
        label={friendlyLabel(m.label)}
        value={value}
        status={m.status}
        source={formatSource(m, multiPage)}
        actions={
          target ? (
            m.status === "CONFIRMED_FROM_DRAWING" && m.value_mm !== null ? (
              <Button size="sm" variant="outline" onClick={() => applyMeasurement(m)}>
                Pakai
              </Button>
            ) : candidates.length ? (
              candidates.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant="outline"
                  onClick={() => applyMeasurement(m, c)}
                >
                  Gunakan {c}
                </Button>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Isi manual pada langkah Ukuran</span>
            )
          ) : null
        }
      />
    );
  };

  const countRow = (c: ExtractedCount, i: number) => {
    const target = countTargetFor(c.label);
    return (
      <Row
        key={`c-${i}`}
        label={friendlyLabel(c.label)}
        value={c.value !== null ? `${c.value} pcs` : "Belum ada data"}
        status={c.status}
        source={formatSource({ view: null, page: null, source_text: c.source_text }, multiPage)}
        actions={
          target && c.value !== null && c.status === "CONFIRMED_FROM_DRAWING" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBrief({ [target]: c.value } as Partial<Briefing>)}
            >
              Pakai
            </Button>
          ) : null
        }
      />
    );
  };

  const specRow = (s: ExtractedSpec, i: number) => (
    <Row
      key={`s-${i}`}
      label={friendlyLabel(s.label)}
      value={s.value ? materialLabel(s.value) : "Belum ada data"}
      status={s.status}
      source={formatSource({ view: null, page: null, source_text: s.source_text }, multiPage)}
    />
  );

  const isFinishing = (label: string) => /hpl|finishing|finish|cat|duco|veneer/i.test(label);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <ScanLine className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Hasil Pembacaan Gambar Kerja</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Periksa ukuran dan spesifikasi sebelum digunakan untuk perhitungan. Data yang tidak
            terbaca atau tidak pasti akan ditandai untuk dikonfirmasi.
          </p>
        </div>
      </div>

      {strict.sections.map((sec) => {
        const st = sectionStatusLabel(sec);
        const mains = sec.measurements.filter((m) => briefTargetFor(m.field, m.label));
        const others = sec.measurements.filter((m) => !briefTargetFor(m.field, m.label));
        const finishing = sec.specs.filter((s) => isFinishing(s.label));
        const materials = sec.specs.filter((s) => !isFinishing(s.label));
        return (
          <div key={sec.id} className="space-y-4">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold uppercase">{sec.name}</h3>
              <p className="text-xs text-muted-foreground">
                Jenis: {sec.furniture_type === "TIDAK_DIKETAHUI" ? "Belum dikenali" : sec.furniture_type}
              </p>
              <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", st.cls)}>
                <st.Icon className="size-3.5 shrink-0" /> {st.text}
              </p>
            </div>

            {mains.length > 0 ? <Group title="Ukuran Utama">{mains.map(measurementRow)}</Group> : null}
            {others.length > 0 || sec.counts.length > 0 ? (
              <Group title="Komponen">
                {others.map(measurementRow)}
                {sec.counts.map(countRow)}
              </Group>
            ) : null}
            {materials.length > 0 ? (
              <Group title="Material & Konstruksi">{materials.map(specRow)}</Group>
            ) : null}
            {finishing.length > 0 ? <Group title="Finishing">{finishing.map(specRow)}</Group> : null}

            {sec.relations.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Hubungan komponen: {sec.relations.join("; ")}
              </p>
            ) : null}
            {sec.notes.length > 0 ? (
              <p className="text-xs text-muted-foreground">Catatan: {sec.notes.join("; ")}</p>
            ) : null}
          </div>
        );
      })}

      {strict.conflicts.length > 0 || strict.needs_confirmation.length > 0 ? (
        <div
          id="perlu-dikonfirmasi"
          className="rounded-lg border border-warning/40 bg-warning/10 p-3"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-warning-foreground">
            <AlertTriangle className="size-4 shrink-0" /> Data yang perlu dikonfirmasi
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-warning-foreground">
            {strict.conflicts.map((c, i) => (
              <li key={`k-${i}`}>{c}</li>
            ))}
            {strict.needs_confirmation.map((w, i) => (
              <li key={`n-${i}`}>{w}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Isi manual pada langkah Ukuran/Material. Data ini tidak akan dipakai otomatis.
          </p>
        </div>
      ) : null}

      {strict.unreadable_pages.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Halaman tidak terbaca: {strict.unreadable_pages.join(", ")}
        </p>
      ) : null}
      {strict.drawing_scale_note ? (
        <p className="text-xs text-muted-foreground">Skala: {strict.drawing_scale_note}</p>
      ) : null}

      <Button className="w-full" onClick={applyAll}>
        Pakai Semua Data Terbaca
      </Button>

      <div className="rounded-lg border bg-surface p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Struktur Terbaca
        </p>
        <p className="num mt-1 text-sm">
          Ukuran: {brief.width_mm ?? "—"} × {brief.depth_mm ?? "—"} × {brief.height_mm ?? "—"} mm
          (L × D × T)
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Data di atas berasal dari gambar kerja dan belum merupakan hasil perhitungan material.
        </p>
      </div>
    </div>
  );
}
