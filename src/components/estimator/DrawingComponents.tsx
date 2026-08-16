import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NOT_IN_DRAWING,
  PROVENANCE_LABEL,
  UNDETERMINED,
  dimsLabel,
  updateComponentDim,
  updateComponentField,
  type ComponentFieldKey,
  type ConfirmedExtractionSnapshot,
  type DrawingComponent,
  type Field,
} from "@/lib/estimator/drawing-model";
import { EDGING_MASTER, HPL_MASTER, MATERIAL_MASTER } from "@/lib/estimator/masters";
import { materialLabel } from "@/lib/estimator/terminology";

function SourceBadge({ source }: { source: Field<unknown>["source"] }) {
  if (!source) return null;
  const cls =
    source === "DRAWING"
      ? "border-success/40 bg-success/10 text-success"
      : source === "USER_EDIT"
        ? "border-warning/40 bg-warning/10 text-warning-foreground"
        : "border-primary/40 bg-primary/10 text-primary";
  const mark = source === "DRAWING" ? "✓" : source === "USER_EDIT" ? "✎" : "+";
  return (
    <Badge variant="outline" className={`shrink-0 text-[10px] font-normal ${cls}`}>
      {mark} {PROVENANCE_LABEL[source]}
    </Badge>
  );
}

function FieldRow({
  label,
  field,
  render,
}: {
  label: string;
  field: Field<string | number>;
  render?: (() => React.ReactNode) | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex min-w-0 flex-col items-end gap-1 text-right">
        <span className="text-sm">
          {field.value === null ? (
            <span className="text-muted-foreground">{UNDETERMINED}</span>
          ) : (
            String(field.value)
          )}
        </span>
        <SourceBadge source={field.source} />
        {render?.()}
      </span>
    </div>
  );
}

/** MODEL step — struktur persis seperti gambar kerja. Read-only. */
export function DrawingModelView({ snapshot }: { snapshot: ConfirmedExtractionSnapshot }) {
  const o = snapshot.overall;
  const overall = [o.width_mm.value, o.height_mm.value, o.depth_mm.value];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-surface p-3">
        <p className="text-xs font-medium">Ukuran keseluruhan</p>
        <p className="num mt-1 text-sm">
          {overall.every((v) => v === null)
            ? NOT_IN_DRAWING
            : `${overall.map((v) => v ?? "?").join(" × ")} mm`}
        </p>
      </div>

      <ol className="space-y-2">
        {snapshot.components.map((c, i) => (
          <li key={c.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">
                {i + 1}. {c.name}
              </p>
              <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                Qty {c.qty.value ?? 1}
              </Badge>
            </div>
            <p className="num mt-1 text-sm text-muted-foreground">{dimsLabel(c)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.material.value ?? UNDETERMINED}
              {c.layers.value ? ` · ${c.layers.value} layer` : ""}
              {" · "}
              {c.finishing.value ?? UNDETERMINED}
            </p>
          </li>
        ))}
      </ol>

      {snapshot.relations.length > 0 ? (
        <div className="rounded-lg border bg-surface p-3">
          <p className="text-xs font-medium">Hubungan antar komponen (dari gambar)</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
            {snapshot.relations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {snapshot.otherMeasurements.length > 0 ? (
        <div className="rounded-lg border bg-surface p-3">
          <p className="text-xs font-medium">Ukuran lain pada gambar</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {snapshot.otherMeasurements.map((m) => (
              <li key={`${m.label}-${m.value_mm}`} className="num">
                {m.label}: {m.value_mm} mm
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const materialOptions = MATERIAL_MASTER.map((m) => materialLabel(m.nama_material));
const edgingOptions = EDGING_MASTER.map((e) => e.nama);
const hplBrands = Array.from(new Set(HPL_MASTER.map((h) => h.brand)));
const hplCodes = Array.from(new Set(HPL_MASTER.map((h) => h.kode)));

function EditableRow({
  label,
  field,
  options,
  onChange,
  numeric,
}: {
  label: string;
  field: Field<string | number>;
  options?: string[] | undefined;
  numeric?: boolean | undefined;
  onChange: (v: string | number | null) => void;
}) {
  return (
    <div className="space-y-1.5 border-b py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <SourceBadge source={field.source} />
      </div>
      {options ? (
        <Select
          value={field.value === null ? "__none" : String(field.value)}
          onValueChange={(v) => onChange(v === "__none" ? null : v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={UNDETERMINED} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">{UNDETERMINED}</SelectItem>
            {Array.from(
              new Set([...(field.value !== null ? [String(field.value)] : []), ...options]),
            ).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          className={numeric ? "num h-9" : "h-9"}
          {...(numeric ? { type: "number", inputMode: "numeric" as const } : {})}
          placeholder={UNDETERMINED}
          value={field.value === null ? "" : String(field.value)}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      )}
      {field.drawingValue !== null && field.value !== field.drawingValue ? (
        <p className="text-[11px] text-muted-foreground">
          Nilai gambar: {String(field.drawingValue)}
        </p>
      ) : null}
    </div>
  );
}

/** MATERIAL step — mirror dari model, user boleh mengedit / menambah. */
export function DrawingMaterialEditor({
  components,
  onChange,
}: {
  components: DrawingComponent[];
  onChange: (next: DrawingComponent[]) => void;
}) {
  const patch = (id: string, next: DrawingComponent) =>
    onChange(components.map((c) => (c.id === id ? next : c)));

  const set = (comp: DrawingComponent, key: ComponentFieldKey) => (v: string | number | null) =>
    patch(comp.id, updateComponentField(comp, key, v));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-xs">
        Mengikuti Gambar Kerja — nilai di bawah adalah cerminan hasil pembacaan gambar yang Anda
        konfirmasi. Tidak ada material, edging, atau hardware yang ditambahkan otomatis.
      </div>

      {components.map((c) => (
        <div key={c.id} className="rounded-lg border p-3">
          <p className="font-medium">{c.name}</p>
          <p className="num mt-0.5 text-xs text-muted-foreground">{dimsLabel(c)}</p>

          <div className="mt-2">
            {c.dims.map((d) => (
              <EditableRow
                key={d.key}
                label={`${d.label} (mm)`}
                field={d.value_mm}
                numeric
                onChange={(v) =>
                  patch(c.id, updateComponentDim(c, d.key, v === null ? null : Number(v)))
                }
              />
            ))}
            <EditableRow label="Qty" field={c.qty} numeric onChange={set(c, "qty")} />
            <EditableRow
              label="Material"
              field={c.material}
              options={materialOptions}
              onChange={set(c, "material")}
            />
            <EditableRow
              label="Tebal (mm)"
              field={c.thickness_mm}
              numeric
              onChange={set(c, "thickness_mm")}
            />
            {c.layers.value !== null || c.layers.drawingValue !== null ? (
              <EditableRow label="Layer" field={c.layers} numeric onChange={set(c, "layers")} />
            ) : null}
            <EditableRow label="Finishing" field={c.finishing} onChange={set(c, "finishing")} />
            <EditableRow
              label="Brand HPL"
              field={c.hplBrand}
              options={hplBrands}
              onChange={set(c, "hplBrand")}
            />
            <EditableRow
              label="Kode HPL"
              field={c.hplCode}
              options={hplCodes}
              onChange={set(c, "hplCode")}
            />
            <EditableRow
              label="Edging"
              field={c.edging}
              options={edgingOptions}
              onChange={set(c, "edging")}
            />
            <EditableRow label="Hardware" field={c.hardware} onChange={set(c, "hardware")} />
          </div>
        </div>
      ))}
    </div>
  );
}

export { FieldRow };
