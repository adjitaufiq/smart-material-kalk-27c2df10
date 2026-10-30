import { useEffect, useState } from "react";
import { ExternalLink, Send } from "lucide-react";

import { SectionCard } from "@/components/estimator/shared";
import { Button } from "@/components/ui/button";
import { getDrawingBlob } from "@/lib/drawing-blobs";
import { buildKisEstimate, kisReturnLink } from "@/lib/kis";
import type { BomItem, CalculationResult, Project } from "@/lib/estimator/types";

function useBlob(key: string | undefined, fallback: string) {
  const [src, setSrc] = useState<string>(key ? "" : fallback);
  useEffect(() => {
    if (!key) return;
    void getDrawingBlob(key).then((v) => setSrc(v ?? fallback));
  }, [key, fallback]);
  return src;
}

export function KisPanel({
  project,
  results,
  bom,
  grandTotal,
}: {
  project: Project;
  results: CalculationResult[];
  bom: BomItem[];
  grandTotal: number | null;
}) {
  const kis = project.kis!;
  const before = useBlob(kis.beforeBlobKey, kis.beforeUrl);
  const render = useBlob(kis.renderBlobKey, kis.renderUrl);
  const interior = useBlob(kis.interiorBlobKey, kis.interiorUrl ?? "");
  const positions = Object.entries(kis.accessoryPositions ?? {});

  const send = () => {
    const payload = buildKisEstimate({
      kisProjectId: kis.projectId,
      estimateId: project.id,
      results,
      bom,
      grandTotal,
      deepLinkUrl: `${window.location.origin}/project/${project.id}`,
    });
    window.location.href = kisReturnLink(kis.returnUrl, payload);
  };

  return (
    <SectionCard title="Dari Kerjaku Interior Studio" description={kis.clientName || "Data klien & visual"}>
      {before || render || interior ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[["Sebelum", before], ["Render 3D", render], ...(kis.interiorUrl ? [["Tampak Dalam", interior]] : [])].map(([label, src]) => (
            <figure key={label}>
              {src ? (
                <img src={src} alt={label} className="aspect-[4/3] w-full rounded-md border object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-md border text-xs text-muted-foreground">
                  Tidak ada foto
                </div>
              )}
              <figcaption className="mt-1 text-xs text-muted-foreground">{label}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {positions.length ? (
        <div className="mt-3 rounded-md border p-2 text-xs">
          <p className="font-medium">Posisi aksesori dari KIS</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {positions.map(([id, pos]) => (
              <li key={id}>
                {id.replace(/-/g, " ")}: {pos}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!kis.beforeBlobKey && kis.beforeUrl ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Foto belum tersalin; link dari KIS hanya aktif 1 jam.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {kis.returnUrl ? (
          <Button onClick={send}>
            <Send /> Kirim Hasil ke KIS
          </Button>
        ) : null}
        {kis.returnUrl ? (
          <Button variant="outline" asChild>
            <a href={kis.returnUrl}>
              <ExternalLink /> Buka di KIS
            </a>
          </Button>
        ) : null}
      </div>
    </SectionCard>
  );
}
