import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Database, FolderPlus, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/estimator/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteProject,
  loadProjects,
  newProject,
  projectFromRoMemory,
  roMemory,
  splitJenisPekerjaan,
  upsertProject,
} from "@/lib/store";
import { newFurnitureItem } from "@/lib/estimator/factory";
import {
  WORK_PRESETS,
  defaultSelection,
  itemsFromSelections,
  type PresetSelection,
} from "@/lib/estimator/presets";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";
import type { Project } from "@/lib/estimator/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Material Estimator — Kalkulator Material Interior" },
      {
        name: "description",
        content:
          "Hitung kebutuhan material furnitur custom: BOM, cut list, dan estimasi biaya yang terstruktur dan dapat ditelusuri.",
      },
      { property: "og:title", content: "Smart Material Estimator" },
      {
        property: "og:description",
        content: "BOM, cut list, dan estimasi biaya material furnitur dalam satuan milimeter.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const sync = () => setProjects(loadProjects());
    sync();
    window.addEventListener("sme:projects", sync);
    return () => window.removeEventListener("sme:projects", sync);
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          RO Memory Ecosystem
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Smart Material Estimator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kalkulator material interior berbasis input terstruktur. Semua perhitungan deterministik
          dalam satuan milimeter — AI hanya membantu membaca gambar dan menyusun konsep.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md border bg-surface px-2 py-1">
            <Ruler className="size-3" /> Internal unit: mm
          </span>
          <Link
            to="/master"
            className="inline-flex items-center gap-1 rounded-md border bg-surface px-2 py-1 hover:bg-accent"
          >
            <Database className="size-3" /> Master Data
          </Link>
        </div>
      </header>

      <SectionCard
        title="Project"
        description="Mulai project baru atau import dari RO Memory (read-only)."
        action={
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            <FolderPlus /> Baru
          </Button>
        }
      >
        {creating ? (
          <NewProjectForm
            onCancel={() => setCreating(false)}
            onCreated={(p) => {
              upsertProject(p);
              setCreating(false);
              void navigate({ to: "/project/$id", params: { id: p.id } });
            }}
          />
        ) : null}

        {projects.length === 0 && !creating ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Belum ada project. Buat project baru untuk mulai menghitung material.
          </p>
        ) : null}

        <ul className="mt-2 space-y-2">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg border p-3">
              <Link
                to="/project/$id"
                params={{ id: p.id }}
                className="min-w-0 flex-1"
              >
                <p className="truncate font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[p.workshop, p.location, `${p.items.length} item`, `rev ${p.revisions.length}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Hapus project"
                onClick={() => {
                  deleteProject(p.id);
                  toast.success("Project dihapus.");
                }}
              >
                <Trash2 className="size-4" />
              </Button>
              <ArrowRight className="size-4 text-muted-foreground" />
            </li>
          ))}
        </ul>
      </SectionCard>
    </main>
  );
}

function NewProjectForm({
  onCreated,
  onCancel,
}: {
  onCreated: (p: Project) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    workshop: "",
    name: "",
    location: "",
    jenis_pekerjaan: "",
    visit_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const set = (p: Partial<typeof form>) => setForm({ ...form, ...p });
  const [selections, setSelections] = useState<PresetSelection[]>([]);

  const presetItems = itemsFromSelections(selections);
  const customItems = splitJenisPekerjaan(form.jenis_pekerjaan).map((label) => ({
    category: label,
    name: label,
  }));
  const allItems = [...presetItems, ...customItems];
  const jenisText = allItems.map((i) => i.name).join(", ");

  const togglePreset = (id: string) =>
    setSelections((prev) =>
      prev.some((s) => s.presetId === id)
        ? prev.filter((s) => s.presetId !== id)
        : [...prev, defaultSelection(id)],
    );
  const updateSel = (id: string, fn: (s: PresetSelection) => PresetSelection) =>
    setSelections((prev) => prev.map((s) => (s.presetId === id ? fn(s) : s)));

  const submit = (source: "baru" | "ro_memory") => {
    const base =
      source === "ro_memory"
        ? projectFromRoMemory({
            workshop: form.workshop,
            project: form.name,
            lokasi: form.location,
            jenis_pekerjaan: jenisText,
            tanggal_visit: form.visit_date,
            catatan: form.notes,
          })
        : newProject({ ...form, jenis_pekerjaan: jenisText, source: "baru" });
    const items = allItems.map((it) => newFurnitureItem(it.category, it.name));
    onCreated({ ...base, items });
  };

  return (
    <div className="mb-4 space-y-3 rounded-lg border bg-surface p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Workshop" value={form.workshop} onChange={(v) => set({ workshop: v })} />
        <Field label="Nama project" value={form.name} onChange={(v) => set({ name: v })} />
        <Field label="Lokasi" value={form.location} onChange={(v) => set({ location: v })} />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tanggal visit</Label>
          <Input
            type="date"
            value={form.visit_date}
            onChange={(e) => set({ visit_date: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Jenis pekerjaan (tap untuk pilih)</Label>
        <div className="grid grid-cols-2 gap-2">
          {WORK_PRESETS.map((p) => {
            const on = selections.some((s) => s.presetId === p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => togglePreset(p.id)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  on ? "border-primary bg-primary/10" : "bg-background hover:bg-accent"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {on ? <Check className="size-4 text-primary" /> : null}
                  {p.label}
                </span>
                <span className="block text-[11px] text-muted-foreground">{p.hint}</span>
              </button>
            );
          })}
        </div>

        {selections.map((sel) => {
          const p = WORK_PRESETS.find((x) => x.id === sel.presetId);
          if (!p) return null;
          return (
            <div key={sel.presetId} className="space-y-2 rounded-lg border bg-background p-2.5">
              <p className="text-sm font-medium">{p.label}</p>
              {p.hasShape ? (
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["single", "Lurus (1 sisi)"],
                      ["L", "Bentuk L (2 sisi)"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={sel.shape === val}
                      onClick={() => updateSel(sel.presetId, (s) => ({ ...s, shape: val }))}
                      className={`rounded-md border px-2 py-2 text-xs ${
                        sel.shape === val ? "border-primary bg-primary/10 font-medium" : ""
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="space-y-1.5">
                {p.options.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={sel.options.includes(o.id)}
                      onCheckedChange={(c) =>
                        updateSel(sel.presetId, (s) => ({
                          ...s,
                          options: c
                            ? [...s.options, o.id]
                            : s.options.filter((x) => x !== o.id),
                        }))
                      }
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        <Field
          label="Pekerjaan lain (opsional, pisahkan dengan koma)"
          value={form.jenis_pekerjaan}
          onChange={(v) => set({ jenis_pekerjaan: v })}
        />
      </div>

      {allItems.length > 0 ? (
        <div className="rounded-lg border bg-background p-2.5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Item yang akan dibuat ({allItems.length})
          </p>
          <ol className="list-decimal space-y-0.5 pl-5 text-sm">
            {allItems.map((it, i) => (
              <li key={`${it.name}-${i}`}>{it.name}</li>
            ))}
          </ol>
        </div>
      ) : null}

      <Textarea
        placeholder="Catatan"
        value={form.notes}
        onChange={(e) => set({ notes: e.target.value })}
      />
      <p className="text-[11px] text-muted-foreground">
        Setiap item dihitung terpisah dengan perhitungan sendiri.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!form.name} onClick={() => submit("baru")}>
          Buat Project Baru
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!form.name}
          onClick={() => {
            if (!roMemory.available) {
              toast.info(
                "RO Memory belum tersambung otomatis. Data yang Anda isi disimpan sebagai import read-only.",
              );
            }
            submit("ro_memory");
          }}
        >
          Import dari RO Memory
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
