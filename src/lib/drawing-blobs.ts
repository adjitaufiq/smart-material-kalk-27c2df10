/**
 * Penyimpanan isi gambar kerja (data URL) di IndexedDB.
 *
 * localStorage tidak sanggup menampung data URL berukuran MB, sehingga
 * project di localStorage hanya menyimpan metadata gambar. Isi filenya
 * disimpan di sini dan di-hydrate kembali saat project dibuka.
 */

import type { Project } from "./estimator/types";

const DB_NAME = "sme-drawings";
const STORE = "blobs";
const VERSION = 1;

function isBrowser() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putDrawingBlob(id: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

export async function getDrawingBlob(id: string): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  const value = await new Promise<string | null>((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
      req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  db.close();
  return value;
}

export async function deleteDrawingBlob(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** Simpan semua data URL yang masih ada di memori ke IndexedDB. */
export async function persistProjectDrawings(project: Project): Promise<void> {
  for (const item of project.items) {
    for (const d of item.drawings) {
      if (d.dataUrl) await putDrawingBlob(d.id, d.dataUrl);
    }
  }
}

/** Kembalikan project dengan data URL gambar terisi dari IndexedDB. */
export async function hydrateProjectDrawings(project: Project): Promise<Project> {
  const items = await Promise.all(
    project.items.map(async (item) => ({
      ...item,
      drawings: await Promise.all(
        item.drawings.map(async (d) =>
          d.dataUrl ? d : { ...d, dataUrl: (await getDrawingBlob(d.id)) ?? "" },
        ),
      ),
    })),
  );
  return { ...project, items };
}
