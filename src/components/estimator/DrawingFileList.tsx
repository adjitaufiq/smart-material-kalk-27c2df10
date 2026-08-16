import { useState } from "react";
import { FileText, Image as ImageIcon, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { fileKindLabel, formatFileSize } from "@/lib/estimator/drawing-set";
import type { DrawingRef } from "@/lib/estimator/types";

/** Daftar file gambar kerja dengan kontrol hapus per file (mobile-first). */
export function DrawingFileList({
  drawings,
  onDelete,
}: {
  drawings: DrawingRef[];
  onDelete: (drawing: DrawingRef) => void;
}) {
  const [pending, setPending] = useState<DrawingRef | null>(null);

  if (drawings.length === 0) return null;

  return (
    <>
      <ul className="space-y-2">
        {drawings.map((d) => {
          const kind = fileKindLabel(d.mime, d.name);
          const isPdf = kind === "PDF";
          return (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-lg border bg-surface px-3 py-2"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                {isPdf ? (
                  <FileText className="size-4 text-muted-foreground" />
                ) : d.dataUrl ? (
                  <img
                    src={d.dataUrl}
                    alt={`Pratinjau ${d.name}`}
                    className="size-9 rounded-md object-cover"
                  />
                ) : (
                  <ImageIcon className="size-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {kind} · {formatFileSize(d.size)}
                  {d.dataUrl ? "" : " · Perlu di-upload ulang"}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Hapus file ${d.name}`}
                onClick={() => setPending(d)}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus gambar kerja ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Nama file: {pending?.name}. File akan dihapus dari item ini dan tidak digunakan untuk
              pembacaan AI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) onDelete(pending);
                setPending(null);
              }}
            >
              Hapus File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
