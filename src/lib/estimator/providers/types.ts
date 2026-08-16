export interface ExtractionFile {
  name: string;
  mime: string;
  dataUrl: string;
}

export interface ExtractionRequest {
  systemPrompt: string;
  userText: string;
  /** jalur lama: satu file gambar kerja */
  file?: ExtractionFile | undefined;
  /** drawing set: beberapa file dibaca sebagai satu paket */
  files?: ExtractionFile[] | undefined;
}

/** Semua file aktif pada request, urut sesuai urutan upload. */
export function requestFiles(req: ExtractionRequest): ExtractionFile[] {
  if (req.files && req.files.length > 0) return req.files;
  return req.file ? [req.file] : [];
}

export type ProviderResult =
  { ok: true; text: string } | { ok: false; status: number | null; body: string };

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
