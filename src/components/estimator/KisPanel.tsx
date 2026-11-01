import { useEffect, useState } from "react";
import { ExternalLink, Send } from "lucide-react";

import { SectionCard } from "@/components/estimator/shared";
import { Button } from "@/components/ui/button";
import { getDrawingBlob } from "@/lib/drawing-blobs";
import { buildKisEstimate, kisReturnLink } from "@/lib/kis";
import { auditSpec } from "@/lib/kis-audit";
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
  ready = true,
}: {
  ready?: boolean;
  project: Project;
  results: CalculationResult[];
  bom: BomItem[];
  grandTotal: number | null;
}) {
  const kis = project.kis!;
  const render = useBlob(kis.renderBlobKey, kis.renderUrl);
  const interior = useBlob(kis.interiorBlobKey, kis.interiorUrl ?? "");
  const interiorSide = useBlob(kis.interiorSideBlobKey, kis.interiorSideUrl ?? "");
  const positions = Object.entries(kis.accessoryPositions ?? {});

  const send = () => {
    const payload = buildKisEstimate({
      kisProjectId: kis.projectId,
      estimateId: project.id,
      results,
      bom,
      grandTotal,
      extras: kis.finishExtras,
      audit: auditSpec({ results, bom, extras: kis.finishExtras, quick: project.items[0]?.quickSpecHint, ai: kis.qcAi }),
      deepLinkUrl: `${window.location.origin}/project/${project.id}`,
    });
    window.location.href = kisReturnLink(kis.returnUrl, payload);
  };

  return (
    <SectionCard title="Dari Kerjaku Interior Studio" description={kis.clientName || "Data klien & visual"}>
      <div className="grid grid-cols-3 gap-2">
        {([
          ["Tampak Luar", render, "renderBlobKey"],
          ["Dalam Depan", interior, "interiorBlobKey"],
          ["Dalam Samping", interiorSide, "interiorSideBlobKey"],
        ] as const).map(([label, src, keyName]) => (
          <figure key={label}>
            <label className="block cursor-pointer">
              {src ? (
                <img src={src} alt={label} className="aspect-[4/3] w-full rounded-md border object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed text-center text-xs text-muted-foreground">
                  + Upload foto
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const data = await new Promise<string>((res) => {
                    const r = new FileReader();
                    r.onload = () => res(String(r.result));
                    r.readAsDataURL(f);
                  });
                  const key = `kis-${keyName}-${project.id}-${Date.now()}`;
                  await putDrawingBlob(key, data);
                  onKis({ ...kis, [keyName]: key, qcAi: undefined });
                }}
              />
            </label>
            <figcaption className="mt-1 text-xs text-muted-foreground">{label} · ganti</figcaption>
          </figure>
        ))}
      </div>
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
      <div className="mt-3 flex flex-wrap gap-2">
        {kis.returnUrl ? (
          <Button onClick={send} disabled={!ready}>
            <Send /> {ready ? "Finalkan & Kirim ke KIS" : "Lengkapi meteran dulu"}
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
