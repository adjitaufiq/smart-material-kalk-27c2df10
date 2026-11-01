import { DEFAULT_QUICK_SPEC } from "@/lib/estimator/quick-spec";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { newFurnitureItem } from "@/lib/estimator/factory";
import { putDrawingBlob } from "@/lib/drawing-blobs";
import { fetchAsDataUrl, parseKisSearch } from "@/lib/kis";
import { loadProjects, newProject, upsertProject } from "@/lib/store";

export const Route = createFileRoute("/import")({
  validateSearch: (s: Record<string, unknown>) => s,
  head: () => ({
    meta: [
      { title: "Import dari Kerjaku Interior Studio — Smart Material Estimator" },
      { name: "description", content: "Terima data klien dan visual dari KIS untuk dihitung material." },
      { property: "og:title", content: "Import dari KIS — Smart Material Estimator" },
      { property: "og:description", content: "Data klien & render KIS jadi project estimasi material." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const data = parseKisSearch(search);
    if (!data) {
      setError("Link dari KIS tidak lengkap (projectId kosong).");
      return;
    }
    // Project KIS yang sama → buka yang sudah ada, jangan dobel.
    const existing = loadProjects().find((p) => p.kis?.projectId === data.link.projectId);
    if (existing) {
      // Perbarui foto/link baru dari KIS (mis. foto tampak dalam samping) tanpa hapus meteran.
      void (async () => {
        const link = { ...existing.kis!, ...data.link, qcAi: existing.kis!.qcAi };
        const slots = [
          ["renderUrl", "renderBlobKey"],
          ["interiorUrl", "interiorBlobKey"],
          ["interiorSideUrl", "interiorSideBlobKey"],
        ] as const;
        for (const [u, k] of slots) {
          const url = data.link[u];
          link[k] = existing.kis![k];
          if (url && url !== existing.kis![u]) {
            const d = await fetchAsDataUrl(url);
            if (d) {
              link[k] = `kis-${k}-${existing.id}-${Date.now()}`;
              await putDrawingBlob(link[k]!, d);
              link.qcAi = undefined;
            }
          }
        }
        upsertProject({ ...existing, kis: link });
        void navigate({ to: "/project/$id", params: { id: existing.id }, replace: true });
      })();
      return;
    }
    void (async () => {
      const project = newProject({
        name: data.projectName || "Project dari KIS",
        location: data.location,
        notes: [data.link.clientName && `Klien: ${data.link.clientName}`, data.link.phone && `HP: ${data.link.phone}`, data.notes]
          .filter(Boolean)
          .join("\n"),
        jenis_pekerjaan: data.link.jobType,
        source: "kis",
        items: data.items.map((i) => ({
          ...newFurnitureItem(i.category, i.name),
          quickSpecHint:
            data.specHint || i.specOverride
              ? { ...(data.specHint ?? DEFAULT_QUICK_SPEC), ...(i.specOverride ?? {}) }
              : undefined,
        })),
      });
      const [before, render, interior, interiorSide] = await Promise.all([
        fetchAsDataUrl(data.link.beforeUrl),
        fetchAsDataUrl(data.link.renderUrl),
        fetchAsDataUrl(data.link.interiorUrl ?? ""),
        fetchAsDataUrl(data.link.interiorSideUrl ?? ""),
      ]);
      const link = { ...data.link };
      if (before) {
        link.beforeBlobKey = `kis-before-${project.id}`;
        await putDrawingBlob(link.beforeBlobKey, before);
      }
      if (render) {
        link.renderBlobKey = `kis-render-${project.id}`;
        await putDrawingBlob(link.renderBlobKey, render);
      }
      if (interior) {
        link.interiorBlobKey = `kis-interior-${project.id}`;
        await putDrawingBlob(link.interiorBlobKey, interior);
      }
      if (interiorSide) {
        link.interiorSideBlobKey = `kis-interior-side-${project.id}`;
        await putDrawingBlob(link.interiorSideBlobKey, interiorSide);
      }
      upsertProject({ ...project, kis: link });
      void navigate({ to: "/project/$id", params: { id: project.id }, replace: true });
    })();
  }, [search, navigate]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      {error ? (
        <>
          <p className="text-sm text-destructive">{error}</p>
          <Link to="/" className="mt-3 inline-block text-sm text-primary underline">
            Ke daftar project
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Menyiapkan project dari Kerjaku Interior Studio…</p>
      )}
    </main>
  );
}
