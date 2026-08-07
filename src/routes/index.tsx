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

  const submit = (source: "baru" | "ro_memory") => {
    const base =
      source === "ro_memory"
        ? projectFromRoMemory({
            workshop: form.workshop,
            project: form.name,
            lokasi: form.location,
            jenis_pekerjaan: form.jenis_pekerjaan,
            tanggal_visit: form.visit_date,
            catatan: form.notes,
          })
        : newProject({ ...form, source: "baru" });
    const items = splitJenisPekerjaan(form.jenis_pekerjaan).map((label) =>
      newFurnitureItem(label, label),
    );
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
      <Field
        label="Jenis pekerjaan (pisahkan dengan koma)"
        value={form.jenis_pekerjaan}
        onChange={(v) => set({ jenis_pekerjaan: v })}
      />
      <Textarea
        placeholder="Catatan"
        value={form.notes}
        onChange={(e) => set({ notes: e.target.value })}
      />
      <p className="text-[11px] text-muted-foreground">
        Setiap jenis pekerjaan menjadi furniture item terpisah dengan perhitungan sendiri.
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
