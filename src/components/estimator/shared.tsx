import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/estimator/engine";
import type { CalculationStatus, Issue, Unit } from "@/lib/estimator/types";
import { DEFAULT_INPUT_UNIT, displayIn, toMm } from "@/lib/estimator/units";


export function StatusBadge({ status }: { status: CalculationStatus }) {
  const map: Record<CalculationStatus, { cls: string; icon: ReactNode }> = {
    estimasi_awal: {
      cls: "bg-destructive/10 text-destructive border-destructive/30",
      icon: <CircleAlert className="size-3.5" />,
    },
    estimasi_terverifikasi: {
      cls: "bg-warning/15 text-warning-foreground border-warning/40",
      icon: <AlertTriangle className="size-3.5" />,
    },
    bom_siap_belanja: {
      cls: "bg-success/12 text-success border-success/40",
      icon: <CheckCircle2 className="size-3.5" />,
    },
  };
  const cfg = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium leading-tight",
        cfg.cls,
      )}
    >
      <span className="mt-px">{cfg.icon}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ConfidenceDot({ level }: { level: "green" | "yellow" | "red" }) {
  const cls =
    level === "green" ? "bg-success" : level === "yellow" ? "bg-warning" : "bg-destructive";
  return <span className={cn("inline-block size-2.5 rounded-full", cls)} />;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-4 shadow-sm sm:p-5", className)}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * Input ukuran user-facing. Default unit = cm (natural untuk tukang),
 * nilai selalu DISIMPAN dalam mm. Kosong = belum diisi (bukan 0).
 */
export function DimensionInput({
  label,
  value_mm,
  onChange,
  hint,
  placeholder_cm,
}: {
  label: string;
  value_mm: number | null;
  onChange: (mm: number | null) => void;
  hint?: string;
  placeholder_cm?: number;
}) {
  const [unit, setUnit] = useState<Unit>(DEFAULT_INPUT_UNIT);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? displayIn(value_mm, unit);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="decimal"
          className="num"
          placeholder={placeholder_cm ? `contoh: ${placeholder_cm}` : "contoh: 240"}
          value={shown}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            if (raw.trim() === "") onChange(null);
            else if (Number.isFinite(Number(raw))) onChange(toMm(Number(raw), unit));
          }}
          onBlur={() => setDraft(null)}
        />
        <Select
          value={unit}
          onValueChange={(v) => {
            setDraft(null);
            setUnit(v as Unit);
          }}
        >
          <SelectTrigger className="w-[76px] shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cm">cm</SelectItem>
            <SelectItem value="mm">mm</SelectItem>
            <SelectItem value="m">m</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {hint ?? (value_mm === null ? "Belum diisi." : `Internal: ${Math.round(value_mm)} mm.`)}
      </p>
    </div>
  );
}

/** Input angka biasa (pintu/laci/shelf). Kosong = belum diisi, BUKAN 0. */
export function CountInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        className="num"
        placeholder={placeholder ?? "contoh: 4"}
        value={value === null || !Number.isFinite(value) ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw.trim() === "" ? null : Number(raw));
        }}
      />
    </div>
  );
}


export function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="size-4" /> Tidak ada blocker.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {issues.map((issue, i) => (
        <li
          key={`${issue.code}-${i}`}
          className={cn(
            "flex gap-2 rounded-md border px-3 py-2 text-xs",
            issue.severity === "error"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-warning/40 bg-warning/10 text-warning-foreground",
          )}
        >
          {issue.severity === "error" ? (
            <CircleAlert className="mt-px size-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
          )}
          <span>
            <span className="font-mono text-[10px] opacity-70">{issue.code}</span>
            <br />
            {issue.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: string[];
  current: number;
  onSelect: (i: number) => void;
}) {
  return (
    <ol className="flex gap-1 overflow-x-auto pb-1">
      {steps.map((label, i) => (
        <li key={label} className="min-w-fit flex-1">
          <button
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "w-full rounded-md border px-2.5 py-2 text-left text-[11px] font-medium transition-colors",
              i === current
                ? "border-primary bg-primary text-primary-foreground"
                : i < current
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground",
            )}
          >
            <span className="block text-[10px] opacity-70">{i + 1}</span>
            {label}
          </button>
        </li>
      ))}
    </ol>
  );
}
