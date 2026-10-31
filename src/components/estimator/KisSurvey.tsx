import { useEffect, useState } from "react";

import { SectionCard } from "@/components/estimator/shared";
import { Input } from "@/components/ui/input";
import { applySurvey, surveyComplete, surveyOf, type SurveyCm } from "@/lib/estimator/kis-survey";
import { DEFAULT_QUICK_SPEC } from "@/lib/estimator/quick-spec";
import type { FurnitureItem, QuickSpec } from "@/lib/estimator/types";

const LABEL: Record<string, string> = {
  hpl: "HPL",
  hpl_premium: "HPL premium",
  duco: "Duco",
  blockmin: "Blockmin",
  tacosheet: "Tacosheet",
  slowmo: "Slowmo",
  biasa: "Biasa",
  dt_slowmo: "Double track slowmo",
  dt_biasa: "Double track biasa",
  dt_eco: "Double track ekonomis",
  roller: "Roller",
  slowmo_stainless: "Slowmo stainless",
  push: "Push open",
  tandem: "Tandem",
};

function SpecLine({ spec }: { spec: QuickSpec }) {
  const s = [
    `Luar: ${LABEL[spec.outside] ?? spec.outside}`,
    `Dalam: ${LABEL[spec.inside] ?? spec.inside}`,
    `Engsel: ${LABEL[spec.hinge] ?? spec.hinge}`,
    `Rel: ${LABEL[spec.slide] ?? spec.slide}`,
    ...(spec.accessories.length ? [`Aksesori: ${spec.accessories.join(", ").replace(/-/g, " ")}`] : []),
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {s.map((t) => (
        <span key={t} className="rounded-full border bg-muted px-2 py-0.5 text-xs">
          {t}
        </span>
      ))}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label} (cm)</span>
      <Input
        inputMode="decimal"
        value={text}
        placeholder="—"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text.replace(",", "."));
          onChange(text.trim() && n > 0 ? n : null);
        }}
      />
    </label>
  );
}

export function KisSurvey({ items, onChange }: { items: FurnitureItem[]; onChange: (item: FurnitureItem) => void }) {
  const done = items.filter((i) => surveyComplete(surveyOf(i))).length;
  return (
    <SectionCard
      title="Isi Meteran Lapangan"
      description={`Cukup isi ukuran aktual. Modul, bahan & hardware dihitung otomatis dari spek KIS. ${done}/${items.length} item lengkap.`}
    >
      <ul className="space-y-3">
        {items.map((item) => {
          const s = surveyOf(item);
          const set = (k: keyof SurveyCm) => (v: number | null) => onChange(applySurvey(item, { ...s, [k]: v }));
          return (
            <li key={item.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {surveyComplete(s) ? `${item.modules.length} modul` : "Belum diukur"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <NumField label="Panjang" value={s.width} onChange={set("width")} />
                <NumField label="Tinggi" value={s.height} onChange={set("height")} />
                <NumField label="Dalam" value={s.depth} onChange={set("depth")} />
              </div>
              <SpecLine spec={item.quickSpec ?? item.quickSpecHint ?? DEFAULT_QUICK_SPEC} />
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
