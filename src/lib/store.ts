import { uid } from "./estimator/factory";
import type { FurnitureItem, Project, ProjectRevision } from "./estimator/types";

const KEY = "sme.projects.v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadProjects(): Project[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(projects));
  window.dispatchEvent(new Event("sme:projects"));
}

export function getProject(id: string): Project | null {
  return loadProjects().find((p) => p.id === id) ?? null;
}

export function upsertProject(project: Project) {
  const all = loadProjects();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.unshift(project);
  saveProjects(all);
}

export function deleteProject(id: string) {
  saveProjects(loadProjects().filter((p) => p.id !== id));
}

export function newProject(partial: Partial<Project> = {}): Project {
  return {
    id: uid("prj"),
    name: partial.name ?? "Project Baru",
    workshop: partial.workshop ?? "",
    location: partial.location ?? "",
    jenis_pekerjaan: partial.jenis_pekerjaan ?? "",
    visit_date: partial.visit_date ?? new Date().toISOString().slice(0, 10),
    notes: partial.notes ?? "",
    source: partial.source ?? "baru",
    created_at: new Date().toISOString(),
    items: partial.items ?? [],
    revisions: [],
  };
}

/** Revision tidak menimpa data lama: snapshot input disimpan utuh. */
export function snapshotRevision(project: Project, note: string): ProjectRevision {
  const revision: ProjectRevision = {
    id: uid("rev"),
    number: project.revisions.length + 1,
    created_at: new Date().toISOString(),
    note,
    snapshot: { items: JSON.parse(JSON.stringify(project.items)) as FurnitureItem[] },
  };
  return revision;
}

/* ------------------------------------------------------------------ */
/* RO MEMORY IMPORT — READ ONLY                                        */
/* ------------------------------------------------------------------ */

export interface RoMemoryProject {
  workshop: string;
  project: string;
  lokasi: string;
  jenis_pekerjaan: string;
  tanggal_visit: string;
  catatan: string;
}

/**
 * Integrasi RO Memory belum tersambung ke sumber data manapun.
 * Fungsi ini hanya menyediakan kontrak import READ-ONLY: data RO Memory
 * tidak pernah ditulis ulang dari aplikasi ini.
 */
export const roMemory = {
  available: false as const,
  async list(): Promise<RoMemoryProject[]> {
    throw new Error(
      "Integrasi RO Memory belum tersambung. Data project dapat dimasukkan manual atau di-paste dari RO Memory.",
    );
  },
};

export function projectFromRoMemory(ro: RoMemoryProject): Project {
  return newProject({
    name: ro.project,
    workshop: ro.workshop,
    location: ro.lokasi,
    jenis_pekerjaan: ro.jenis_pekerjaan,
    visit_date: ro.tanggal_visit,
    notes: ro.catatan,
    source: "ro_memory",
  });
}

/** "Kitchen set, lemari baju, buffet tv" → 3 furniture item terpisah. */
export function splitJenisPekerjaan(value: string): string[] {
  return value
    .split(/[,;+\/]|\bdan\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}
