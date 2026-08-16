import { useMemo, useState } from "react";
import { Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { ResultTabs } from "@/components/estimator/ResultTabs";
import {
  ConfidenceDot,
  CountInput,

  DimensionInput,
  IssueList,
  SectionCard,
  StatusBadge,
  Stepper,
} from "@/components/estimator/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ExtractionReview } from "@/components/estimator/ExtractionReview";
import { AiUnavailableError, designGenerationService, drawingExtractionService } from "@/lib/estimator/ai";
import { calculateItem } from "@/lib/estimator/engine";
import { missingCriticalDimensions } from "@/lib/estimator/extraction-review";
import { materialLabel } from "@/lib/estimator/terminology";
import { dualDim } from "@/lib/estimator/units";
import {
  applyDesignOption,
  buildDesignOptions,
  composeModules,
  makeModule,
  resolveBrief,
  templateName,
  uid,
} from "@/lib/estimator/factory";
import {
  CONSTRUCTION_TEMPLATES,
  EDGING_MASTER,
  HPL_MASTER,
  MATERIAL_MASTER,
} from "@/lib/estimator/masters";
import type {
  Briefing,
  DoorType,
  DrawingRef,
  FurnitureItem,
  ModuleKind,
  ModuleSpec,
} from "@/lib/estimator/types";

const STEPS = ["Project", "Gambar/Ukuran", "Model", "Material", "Review", "Hasil"];

const MODULE_KINDS: { kind: ModuleKind; label: string }[] = [
  { kind: "base_cabinet", label: "Base Cabinet" },
  { kind: "wall_cabinet", label: "Wall Cabinet" },
  { kind: "tall_cabinet", label: "Tall Cabinet" },
  { kind: "wardrobe", label: "Wardrobe" },
  { kind: "drawer_module", label: "Drawer Module" },
  { kind: "floating_cabinet", label: "Floating Cabinet" },
  { kind: "floating_shelf", label: "Floating Shelf" },
  { kind: "shelf_unit", label: "Rak Terbuka" },
  { kind: "table_top", label: "Top Table" },
  { kind: "table_frame", label: "Kaki / Frame" },
  { kind: "backdrop_panel", label: "Panel Backdrop" },
  { kind: "partition", label: "Partisi" },
  { kind: "plinth", label: "Plinth" },
  { kind: "door_panel", label: "Pintu" },
];

export function ItemWizard({
  item,
  projectName,
  revision,
  onChange,
  onSaveRevision,
}: {
  item: FurnitureItem;
  projectName: string;
  revision: number;
  onChange: (item: FurnitureItem) => void;
  onSaveRevision: () => void;
}) {
  const [step, setStep] = useState(0);
  const result = useMemo(() => calculateItem(item), [item]);

  const patch = (partial: Partial<FurnitureItem>) => onChange({ ...item, ...partial });
  const patchModule = (id: string, partial: Partial<ModuleSpec>) =>
    patch({ modules: item.modules.map((m) => (m.id === id ? { ...m, ...partial } : m)) });

  const brief: Briefing = item.briefing ?? {
    width_mm: null,
    height_mm: null,
    depth_mm: null,
    doors: null,
    drawers: null,
    shelves: null,
    doorType: "swing" as DoorType,
    notes: "",
  };
  const setBrief = (p: Partial<Briefing>) => patch({ briefing: { ...brief, ...p } });


  return (
    <div className="space-y-4">
      <Stepper steps={STEPS} current={step} onSelect={setStep} />
      <StatusBadge status={result.status} />

      {step === 0 ? (
        <SectionCard title="Furniture Item" description="Setiap furniture dihitung terpisah.">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nama item</Label>
              <Input value={item.name} onChange={(e) => patch({ name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kategori</Label>
              <Input value={item.category} onChange={(e) => patch({ category: e.target.value })} />
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium">Apakah ada gambar kerja?</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant={item.hasDrawing === true ? "default" : "outline"}
                  onClick={() => patch({ hasDrawing: true })}
                >
                  Ada Gambar Kerja
                </Button>
                <Button
                  size="sm"
                  variant={item.hasDrawing === false ? "default" : "outline"}
                  onClick={() => patch({ hasDrawing: false })}
                >
                  Belum Ada Gambar Kerja
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Pertanyaan ini wajib dijawab sebelum perhitungan detail.
              </p>
            </div>
            <Button
              className="w-full"
              disabled={item.hasDrawing === null}
              onClick={() => setStep(1)}
            >
              Lanjut
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {step === 1 ? (
        item.hasDrawing ? (
          <DrawingStep
            item={item}
            patch={patch}
            brief={brief}
            setBrief={setBrief}
            onNext={() => setStep(2)}
          />
        ) : (
          <SectionCard
            title="Ukuran Dasar"
            description="Tanpa gambar kerja, ukuran dasar wajib diisi lebih dulu."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <DimensionInput
                label="Panjang / Lebar"
                value_mm={brief.width_mm}
                onChange={(v) => setBrief({ width_mm: v })}
              />
              <DimensionInput
                label="Tinggi"
                value_mm={brief.height_mm}
                onChange={(v) => setBrief({ height_mm: v })}
              />
              <DimensionInput
                label="Depth"
                value_mm={brief.depth_mm}
                onChange={(v) => setBrief({ depth_mm: v })}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <CountInput label="Jumlah pintu" value={brief.doors} onChange={(v) => setBrief({ doors: v })} placeholder="contoh: 4" />
              <CountInput label="Jumlah laci" value={brief.drawers} onChange={(v) => setBrief({ drawers: v })} placeholder="contoh: 2" />
              <CountInput label="Jumlah shelf" value={brief.shelves} onChange={(v) => setBrief({ shelves: v })} placeholder="contoh: 3" />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipe pintu</Label>
                <Select
                  value={brief.doorType}
                  onValueChange={(v) => setBrief({ doorType: v as DoorType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="swing">Swing</SelectItem>
                    <SelectItem value="sliding">Sliding</SelectItem>
                    <SelectItem value="flap">Flap</SelectItem>
                    <SelectItem value="glass">Kaca</SelectItem>
                    <SelectItem value="none">Tanpa pintu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              className="mt-3"
              placeholder="Kebutuhan fungsi / catatan"
              value={brief.notes}
              onChange={(e) => setBrief({ notes: e.target.value })}
            />
            <Button
              className="mt-3 w-full"
              disabled={!brief.width_mm || !brief.height_mm}
              onClick={() => setStep(2)}
            >
              Lanjut ke Model
            </Button>
          </SectionCard>
        )
      ) : null}

      {step === 2 ? (
        <ModelStep
          item={item}
          brief={brief}
          patch={patch}
          onNext={() => setStep(3)}
        />
      ) : null}

      {step === 3 ? (
        <SectionCard
          title="Material & Konstruksi"
          description="Spesifikasi gambar kerja selalu menang atas default template."
        >
          <div className="space-y-4">
            {item.modules.map((mod) => (
              <ModuleEditor
                key={mod.id}
                mod={mod}
                onChange={(p) => patchModule(mod.id, p)}
                onRemove={() =>
                  patch({ modules: item.modules.filter((m) => m.id !== mod.id) })
                }
              />
            ))}
            <AddModule
              onAdd={(kind) =>
                patch({
                  modules: [
                    ...item.modules,
                    makeModule({
                      kind,
                      name: MODULE_KINDS.find((k) => k.kind === kind)?.label ?? kind,
                      width_mm: brief.width_mm ?? 600,
                    }),
                  ],
                })
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mode perhitungan lembar</Label>
                <Select
                  value={item.sheetMode}
                  onValueChange={(v) => patch({ sheetMode: v as "cepat" | "potong" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cepat">Estimasi Cepat (area + waste)</SelectItem>
                    <SelectItem value="potong">Estimasi Potong (nesting + kerf)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Waste (hanya dipakai pada Estimasi Cepat & edging)
                </Label>
                <Select
                  value={String(item.wasteFactor)}
                  onValueChange={(v) => patch({ wasteFactor: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.05">5%</SelectItem>
                    <SelectItem value="0.1">10%</SelectItem>
                    <SelectItem value="0.15">15%</SelectItem>
                    <SelectItem value="0.2">20% (custom)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={() => setStep(4)}>
              Lanjut ke Review
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {step === 4 ? (
        <SectionCard
          title="Konfirmasi Konstruksi & Ukuran"
          description="Tanpa konfirmasi, hasil tetap berstatus Estimasi Awal."
        >
          <div className="space-y-3">
            <IssueList issues={result.issues} />
            <div className="rounded-lg border bg-surface p-3">
              <p className="text-xs font-medium">Ringkasan ukuran (cm & mm)</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {item.modules.map((m) => (
                  <li key={m.id} className="num">
                    {m.name}: {dualDim(m.width_mm, m.height_mm, m.depth_mm)} · {m.doors} pintu ·{" "}
                    {m.drawers} laci · {m.shelves} shelf
                  </li>
                ))}
              </ul>
            </div>
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={item.confirmedDimensions}
                onCheckedChange={(v) => patch({ confirmedDimensions: Boolean(v) })}
              />
              <span>
                Saya mengonfirmasi seluruh ukuran di atas sudah benar.
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={item.confirmedConstruction}
                onCheckedChange={(v) => patch({ confirmedConstruction: Boolean(v) })}
              />
              <span>Saya mengonfirmasi konstruksi, material, dan finishing.</span>
            </label>
            <div className="rounded-lg border bg-surface p-3">
              <p className="text-xs font-medium">Asumsi yang dipakai</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {result.assumptions.map((a) => (
                  <li key={a.key}>
                    {a.label}: <strong>{a.value}</strong>
                    {a.isDefault ? " (default digunakan)" : ""}
                  </li>
                ))}
              </ul>
            </div>
            <Button className="w-full" onClick={() => setStep(5)}>
              Hitung & Lihat Hasil
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {step === 5 ? (
        <>
          <ResultTabs
            item={item}
            result={result}
            projectName={projectName}
            revision={revision}
            onEditAssumptions={() => setStep(3)}
          />
          <Button variant="outline" className="w-full" onClick={onSaveRevision}>
            Simpan sebagai Revisi Baru
          </Button>
        </>
      ) : null}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        className="num"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function DrawingStep({
  item,
  patch,
  brief,
  setBrief,
  onNext,
}: {
  item: FurnitureItem;
  patch: (p: Partial<FurnitureItem>) => void;
  brief: Briefing;
  setBrief: (p: Partial<Briefing>) => void;
  onNext: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const onUpload = async (files: FileList | null) => {
    if (!files) return;
    const drawings: DrawingRef[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      drawings.push({
        id: uid("dwg"),
        name: file.name,
        mime: file.type,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
    }
    patch({ drawings: [...item.drawings, ...drawings] });
  };

  const runExtraction = async () => {
    const first = item.drawings[0];
    if (!first) return;
    setBusy(true);
    try {
      const extraction = await drawingExtractionService.extract(first, item.category);
      patch({ extraction });
    } catch (error) {
      toast.error(
        error instanceof AiUnavailableError
          ? error.message
          : "Ekstraksi gambar gagal dijalankan.",
      );
    } finally {
      setBusy(false);
    }
  };

  const extraction = item.extraction;

  return (
    <SectionCard
      title="Gambar Kerja"
      description="Upload foto/screenshot/PDF gambar kerja. Spesifikasi pada gambar menjadi prioritas."
    >
      <div className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-sm">Pilih file gambar / PDF</span>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => void onUpload(e.target.files)}
          />
        </label>

        {item.drawings.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {item.drawings.map((d) => (
              <li key={d.id} className="flex justify-between rounded border bg-surface px-2 py-1.5">
                <span className="truncate">{d.name}</span>
                <span className="text-muted-foreground">
                  {new Date(d.uploadedAt).toLocaleDateString("id-ID")}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="rounded-lg border bg-surface p-3">
          <div className="flex items-center gap-2">
            <ConfidenceDot level={extraction ? (extraction.confirmed_by_user ? "green" : "yellow") : "red"} />
            <p className="text-sm font-medium">Hasil Pembacaan Gambar Kerja</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Pembacaan ketat: hanya angka yang tertulis pada gambar yang diambil. Ukuran yang tidak
            ada tetap kosong — tidak ditebak, tidak memakai standar furniture.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={busy || item.drawings.length === 0}
            onClick={() => void runExtraction()}
          >
            <Sparkles /> {busy ? "Membaca gambar…" : "Baca Gambar Kerja"}
          </Button>

          {extraction ? (
            <div className="mt-3 space-y-3">
              {extraction.strict ? (
                <ExtractionReview
                  strict={extraction.strict}
                  brief={brief}
                  setBrief={setBrief}
                />
              ) : (
                <ul className="space-y-1 text-xs">
                  {extraction.normalized.map((f) => (
                    <li key={f.key} className="flex justify-between gap-2 border-b pb-1">
                      <span>{f.label}</span>
                      <span className={f.ambiguous ? "text-destructive" : ""}>
                        {f.ambiguous ? "Tidak terbaca jelas" : `${f.value ?? "—"} ${f.unit ?? ""}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  const missing = missingCriticalDimensions(brief);
                  if (missing.length > 0) {
                    toast.error(
                      `Masih ada ukuran yang perlu dilengkapi: ${missing.join(", ")}.`,
                    );
                    document
                      .getElementById("perlu-dikonfirmasi")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    return;
                  }
                  patch({
                    extraction: {
                      ...extraction,
                      confirmed_by_user: true,
                      confirmed_at: new Date().toISOString(),
                    },
                  });
                }}
              >
                {extraction.confirmed_by_user
                  ? "Hasil Ekstraksi Telah Dikonfirmasi"
                  : "Konfirmasi Hasil Ekstraksi"}
              </Button>
            </div>
          ) : null}
        </div>


        <Button className="w-full" onClick={onNext}>
          Lanjut ke Model
        </Button>
      </div>
    </SectionCard>
  );
}

function ModelStep({
  item,
  brief,
  patch,
  onNext,
}: {
  item: FurnitureItem;
  brief: Briefing;
  patch: (p: Partial<FurnitureItem>) => void;
  onNext: () => void;
}) {
  const options = item.designOptions;
  const [approved, setApproved] = useState<Record<string, boolean>>({});


  return (
    <div className="space-y-4">
      <SectionCard
        title="Struktur Furniture"
        description="Modul dibuat dari ukuran terstruktur, bukan dari menebak gambar."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              patch({
                modules: composeModules(item.category, resolveBrief(brief)),
              })
            }
            disabled={!brief.width_mm}
          >
            Susun Modul dari Ukuran
          </Button>
          {!item.hasDrawing ? (
            <Button
              size="sm"
              variant="outline"
              disabled={!brief.width_mm}
              onClick={() =>
                patch({
                  designOptions: buildDesignOptions(item.category, resolveBrief(brief)),
                })
              }
            >
              Buat Contoh Model (1–3)
            </Button>
          ) : null}
        </div>
        {item.modules.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm">
            {item.modules.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 border-b pb-1">
                <span>
                  {m.name} <span className="text-muted-foreground">({templateName(m)})</span>
                </span>
                <span className="num text-xs text-muted-foreground">
                  {m.width_mm}×{m.height_mm}×{m.depth_mm} · {m.doors} pintu · {m.drawers} laci
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </SectionCard>

      {options.length > 0 ? (
        <SectionCard
          title="Alternatif Model"
          description="Setiap alternatif memiliki struktur dan BOM sendiri."
        >
          <div className="space-y-3">
            {options.map((opt) => {
              const optResult = calculateItem({
                ...item,
                modules: opt.structured_model,
                confirmedConstruction: true,
                confirmedDimensions: true,
                extraction: null,
              });
              const sheets = optResult.sheets.reduce((a, s) => a + s.sheets, 0);
              return (
                <div
                  key={opt.id}
                  className={`rounded-lg border p-3 ${
                    item.selectedOptionId === opt.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-sm font-semibold">{opt.name}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                    <Badge variant="outline" className="num shrink-0 text-[10px]">
                      {sheets} lembar
                    </Badge>
                  </div>
                  <p className="num mt-2 text-xs text-muted-foreground">
                    {opt.overall_dimensions.width_mm} W × {opt.overall_dimensions.height_mm} H ×{" "}
                    {opt.overall_dimensions.depth_mm} D — Module:{" "}
                    {opt.structured_model.map((m) => m.width_mm).join(" | ")}
                  </p>
                  {opt.requirement_changes.length > 0 ? (
                    <div className="mt-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning-foreground">
                      <p className="font-medium">
                        Model ini mengubah kebutuhan yang Anda isi — perlu persetujuan:
                      </p>
                      <ul className="mt-1 list-disc pl-4">
                        {opt.requirement_changes.map((c) => (
                          <li key={c.field}>
                            {c.label}: {String(c.from)} → {String(c.to)}
                          </li>
                        ))}
                      </ul>
                      <label className="mt-2 flex items-center gap-2">
                        <Checkbox
                          checked={approved[opt.id] ?? false}
                          onCheckedChange={(v) =>
                            setApproved((s) => ({ ...s, [opt.id]: v === true }))
                          }
                        />
                        <span>Saya setuju perubahan ini.</span>
                      </label>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="flex h-16 flex-1 items-center justify-center rounded border border-dashed bg-surface text-[10px] text-muted-foreground">
                      {designGenerationService.available
                        ? "Visual konsep — bukan gambar kerja produksi."
                        : "Visual AI belum tersambung — skema dimensi di atas yang berlaku."}
                    </div>
                    <Button
                      size="sm"
                      disabled={
                        opt.requirement_changes.length > 0 && !(approved[opt.id] ?? false)
                      }
                      onClick={() => {
                        const res = applyDesignOption(item, opt, approved[opt.id] ?? false);
                        if (res.blocked) return;
                        patch({
                          selectedOptionId: res.item.selectedOptionId,
                          modules: res.item.modules,
                          ...(res.item.briefing ? { briefing: res.item.briefing } : {}),
                        });
                      }}
                    >
                      Gunakan Model Ini
                    </Button>
                  </div>

                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      <Button className="w-full" disabled={item.modules.length === 0} onClick={onNext}>
        Lanjut ke Material
      </Button>
    </div>
  );
}

function ModuleEditor({
  mod,
  onChange,
  onRemove,
}: {
  mod: ModuleSpec;
  onChange: (p: Partial<ModuleSpec>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={mod.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-8 font-medium"
        />
        <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Hapus modul">
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <DimensionInput label="Width" value_mm={mod.width_mm} onChange={(v) => onChange({ width_mm: v ?? 0 })} />
        <DimensionInput label="Height" value_mm={mod.height_mm} onChange={(v) => onChange({ height_mm: v ?? 0 })} />
        <DimensionInput label="Depth" value_mm={mod.depth_mm} onChange={(v) => onChange({ depth_mm: v ?? 0 })} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <NumField label="Qty modul" value={mod.qty} onChange={(v) => onChange({ qty: v })} />
        <NumField label="Pintu" value={mod.doors} onChange={(v) => onChange({ doors: v })} />
        <NumField label="Laci" value={mod.drawers} onChange={(v) => onChange({ drawers: v })} />
        <NumField label="Shelf" value={mod.shelves} onChange={(v) => onChange({ shelves: v })} />
      </div>

      {mod.doors > 0 && mod.doorType !== "none" && mod.doorType !== "sliding" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <CountInput
            label="Engsel per pintu (override)"
            value={mod.hingeOverride ?? null}
            onChange={(v) => onChange({ hingeOverride: v })}
            placeholder="kosong = aturan default"
          />
          <p className="self-end text-[11px] text-muted-foreground">
            Default dihitung dari tinggi, lebar, dan berat estimasi daun pintu.
          </p>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Pick
          label="Construction template"
          value={mod.templateId}
          onChange={(v) => onChange({ templateId: v })}
          options={CONSTRUCTION_TEMPLATES.map((t) => ({ value: t.id, label: `${t.nama} — ${t.kode}` }))}
        />
        <Pick
          label="Tipe pintu"
          value={mod.doorType}
          onChange={(v) => onChange({ doorType: v as DoorType })}
          options={[
            { value: "none", label: "Tanpa pintu" },
            { value: "swing", label: "Swing" },
            { value: "sliding", label: "Sliding" },
            { value: "flap", label: "Flap" },
            { value: "glass", label: "Kaca" },
          ]}
        />
        <Pick
          label="Material body"
          value={mod.bodyMaterialId}
          onChange={(v) => onChange({ bodyMaterialId: v })}
          options={MATERIAL_MASTER.map((m) => ({ value: m.id, label: m.nama_material }))}
        />
        <Pick
          label="Material back panel"
          value={mod.backMaterialId ?? "none"}
          onChange={(v) => onChange({ backMaterialId: v === "none" ? null : v, hasBack: v !== "none" })}
          options={[
            { value: "none", label: "Tanpa back panel" },
            ...MATERIAL_MASTER.map((m) => ({ value: m.id, label: m.nama_material })),
          ]}
        />
        <Pick
          label="HPL body luar"
          value={mod.finish.bodyOutside.hplId ?? "none"}
          onChange={(v) =>
            onChange({ finish: { ...mod.finish, bodyOutside: { hplId: v === "none" ? null : v } } })
          }
          options={hplOptions()}
        />
        <Pick
          label="HPL body dalam"
          value={mod.finish.bodyInside.hplId ?? "none"}
          onChange={(v) =>
            onChange({ finish: { ...mod.finish, bodyInside: { hplId: v === "none" ? null : v } } })
          }
          options={hplOptions()}
        />
        <Pick
          label="HPL pintu — Face A"
          value={mod.finish.doorFaceA.hplId ?? "none"}
          onChange={(v) =>
            onChange({ finish: { ...mod.finish, doorFaceA: { hplId: v === "none" ? null : v } } })
          }
          options={hplOptions()}
        />
        <Pick
          label="HPL pintu — Face B"
          value={mod.finish.doorFaceB.hplId ?? "none"}
          onChange={(v) =>
            onChange({ finish: { ...mod.finish, doorFaceB: { hplId: v === "none" ? null : v } } })
          }
          options={hplOptions()}
        />
        <Pick
          label="Edging"
          value={mod.edgingId ?? "none"}
          onChange={(v) => onChange({ edgingId: v === "none" ? null : v })}
          options={[
            { value: "none", label: "Tanpa edging" },
            ...EDGING_MASTER.map((e) => ({ value: e.id, label: e.nama })),
          ]}
        />
        {mod.kind === "table_frame" ? (
          <Pick
            label="Material frame"
            value={mod.frameMaterial ?? "besi"}
            onChange={(v) => onChange({ frameMaterial: v as ModuleSpec["frameMaterial"] })}
            options={[
              { value: "besi", label: "Besi (tanpa HPL & tanpa panel)" },
              { value: "plywood", label: "Plywood" },
              { value: "solid_wood", label: "Solid wood" },
              { value: "lainnya", label: "Lainnya" },
            ]}
          />
        ) : null}
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs">
        <Checkbox
          checked={mod.led?.enabled ?? false}
          onCheckedChange={(v) =>
            onChange({
              led: {
                enabled: Boolean(v),
                length_mm: mod.led?.length_mm ?? mod.width_mm,
                watt_per_m: mod.led?.watt_per_m ?? 9.6,
                segments: mod.led?.segments ?? 1,
              },
            })
          }
        />
        LED strip pada modul ini
      </label>
      {mod.led?.enabled ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <NumField
            label="Panjang LED (mm)"
            value={mod.led.length_mm}
            onChange={(v) => onChange({ led: { ...mod.led!, length_mm: v } })}
          />
          <NumField
            label="Watt / meter"
            value={mod.led.watt_per_m}
            onChange={(v) => onChange({ led: { ...mod.led!, watt_per_m: v } })}
          />
          <NumField
            label="Jumlah segmen"
            value={mod.led.segments}
            onChange={(v) => onChange({ led: { ...mod.led!, segments: v } })}
          />
        </div>
      ) : null}
    </div>
  );
}

function hplOptions() {
  return [
    { value: "none", label: "Tanpa HPL" },
    ...HPL_MASTER.map((h) => ({ value: h.id, label: `${h.brand} ${h.kode} — ${h.nama}` })),
  ];
}

function Pick({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AddModule({ onAdd }: { onAdd: (kind: ModuleKind) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Select onValueChange={(v) => onAdd(v as ModuleKind)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Tambah modul primitif…" />
        </SelectTrigger>
        <SelectContent>
          {MODULE_KINDS.map((k) => (
            <SelectItem key={k.kind} value={k.kind}>
              {k.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Plus className="size-4 shrink-0 text-muted-foreground" />
    </div>
  );
}
