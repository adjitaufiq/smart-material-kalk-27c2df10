import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, History, Plus } from "lucide-react";
import { toast } from "sonner";

import { ItemWizard } from "@/components/estimator/ItemWizard";
import { KisPanel } from "@/components/estimator/KisPanel";
import { KisSurvey } from "@/components/estimator/KisSurvey";
import { KisAudit } from "@/components/estimator/KisAudit";
import { surveyComplete, surveyOf } from "@/lib/estimator/kis-survey";
import { SectionCard, StatusBadge } from "@/components/estimator/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateItem, mergeProjectBom, summarizeCost } from "@/lib/estimator/engine";
import { newFurnitureItem } from "@/lib/estimator/factory";
import { FURNITURE_CATEGORIES } from "@/lib/estimator/masters";
import { quickAddItems } from "@/lib/estimator/presets";
import type { FurnitureItem, Project } from "@/lib/estimator/types";
import { rupiah } from "@/lib/estimator/units";
import { hydrateProjectDrawings } from "@/lib/drawing-blobs";
import { getProject, snapshotRevision, upsertProject } from "@/lib/store";


export const Route = createFileRoute("/project/$id")({
  head: () => ({
    meta: [
      { title: "Detail Project — Smart Material Estimator" },
      {
        name: "description",
        content:
          "Kelola furniture item, hitung BOM, cut list, dan biaya material untuk satu project interior.",
      },
      { property: "og:title", content: "Detail Project — Smart Material Estimator" },
      {
        property: "og:description",
        content: "Perhitungan material per furniture item dengan status kesiapan belanja.",
      },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = getProject(id);
    if (!stored) {
      setProject(null);
      return;
    }
    setProject(stored);
    // Isi file gambar kerja disimpan di IndexedDB, bukan localStorage.
    void hydrateProjectDrawings(stored).then((hydrated) => {
      if (!cancelled) setProject(hydrated);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);


  const save = (next: Project) => {
    setProject(next);
    upsertProject(next);
  };

  const results = useMemo(
    () => (project ? project.items.map((item) => calculateItem(item)) : []),
    [project],
  );

  if (!project) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Project tidak ditemukan.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-primary underline">
          Kembali ke daftar project
        </Link>
      </main>
    );
  }

  const activeItem = project.items.find((i) => i.id === activeItemId) ?? null;
  const projectBom = mergeProjectBom(results);
  const projectCost = summarizeCost(projectBom);

  const updateItem = (item: FurnitureItem) =>
    save({ ...project, items: project.items.map((i) => (i.id === item.id ? item : i)) });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Semua project
      </Link>
      <h1 className="font-display text-2xl font-bold tracking-tight">{project.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {[project.workshop, project.location, project.visit_date].filter(Boolean).join(" · ")}
        {project.source === "ro_memory" ? " · import RO Memory (read-only)" : ""}
      </p>

      {activeItem ? (
        <div className="mt-6 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveItemId(null)}>
            <ArrowLeft /> Daftar item
          </Button>
          <ItemWizard
            item={activeItem}
            projectName={project.name}
            revision={project.revisions.length + 1}
            onChange={updateItem}
            onSaveRevision={() => {
              const rev = snapshotRevision(project, `Revisi item ${activeItem.name}`);
              save({ ...project, revisions: [...project.revisions, rev] });
              toast.success(`Revisi ${rev.number} disimpan. Data lama tidak ditimpa.`);
            }}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {project.kis ? (
            <KisPanel
              project={project}
              results={results}
              bom={projectBom}
              grandTotal={projectCost.grandTotal}
              ready={project.items.length > 0 && project.items.every((i) => surveyComplete(surveyOf(i)))}
            />
          ) : null}
          {project.kis ? <KisSurvey items={project.items} onChange={updateItem} /> : null}
          {project.kis ? (
            <KisAudit
              kis={project.kis}
              results={results}
              bom={projectBom}
              onChange={(qcVisual) => save({ ...project, kis: { ...project.kis!, qcVisual } })}
            />
          ) : null}
          {!project.kis ? (
          <SectionCard
            title="Furniture Item"
            description="Setiap item dihitung terpisah lalu digabung di level project."
            >
            {project.items.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Belum ada furniture item.
              </p>
            ) : null}
            <ul className="space-y-2">
              {project.items.map((item, idx) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setActiveItemId(item.id)}
                    className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block break-words font-medium">{item.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.modules.length} modul ·{" "}
                          {item.hasDrawing === null
                            ? "gambar kerja belum dijawab"
                            : item.hasDrawing
                              ? "dengan gambar kerja"
                              : "tanpa gambar kerja"}
                        </span>
                      </span>
                      <StatusBadge status={results[idx]?.status ?? "estimasi_awal"} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <AddItem
              existingNames={project.items.map((i) => i.name)}
              onAdd={(category, name) =>
                save({ ...project, items: [...project.items, newFurnitureItem(category, name)] })
              }
            />
          </SectionCard>
          ) : null}

          {projectBom.length > 0 ? (
            <SectionCard
              title="Rekap Project"
              description="Gabungan kebutuhan seluruh furniture item."
            >
              <ul className="divide-y text-sm">
                {projectBom.map((b) => (
                  <li key={b.id} className="flex justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">{b.name}</span>
                    <span className="num shrink-0">
                      {b.qty} {b.unit}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex justify-between border-t pt-2 font-display font-semibold">
                <span>Estimasi total material</span>
                <span className="num">{rupiah(projectCost.grandTotal)}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Estimasi material, bukan quotation final.
              </p>
            </SectionCard>
          ) : null}

          {!project.kis ? (
          <SectionCard title="Riwayat Revisi" description="Snapshot input tersimpan utuh.">
            {project.revisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada revisi tersimpan.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {project.revisions
                  .slice()
                  .reverse()
                  .map((r) => (
                    <li key={r.id} className="flex items-center gap-2 border-b pb-1.5">
                      <History className="size-3.5 text-muted-foreground" />
                      <span className="flex-1">
                        Revisi {r.number} — {r.note}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("id-ID")}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </SectionCard>
          ) : null}
        </div>
      )}
    </main>
  );
}

function AddItem({
  existingNames,
  onAdd,
}: {
  existingNames: string[];
  onAdd: (category: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const quick = quickAddItems(existingNames);
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      {quick.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <Button key={q.name} size="sm" variant="outline" onClick={() => onAdd(q.category, q.name)}>
              <Plus className="size-3.5" /> {q.name.replace("Kitchen Set ", "")}
            </Button>
          ))}
        </div>
      ) : null}
      <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>
        <Plus className="size-3.5" /> Tambah item lain
      </Button>
      {open ? (
        <div className="space-y-2 rounded-lg border bg-surface p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {FURNITURE_CATEGORIES.filter((c) => c !== "Jenis lainnya").map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onAdd(c, c);
                  setOpen(false);
                }}
                className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-accent"
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nama item lain"
              className="text-sm"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!custom.trim()}
              onClick={() => {
                onAdd(custom.trim(), custom.trim());
                setCustom("");
                setOpen(false);
              }}
            >
              Tambah
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
