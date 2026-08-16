import type { ExtractionRequest } from "./types";

export const SUPPORTED_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export interface FilePayload {
  mime: string;
  base64: string;
  bytes: number;
}

export type FileCheck =
  | { ok: true; payload: FilePayload }
  | { ok: false; reason: "empty" | "unsupported_mime" | "not_base64" };

const BASE64_RE = /^[A-Za-z0-9+/=\s]+$/;

/** Deteksi mime yang bisa dipercaya: header data URL > mime input > ekstensi nama. */
export function resolveMime(file: ExtractionRequest["file"]): string {
  const fromDataUrl = /^data:([^;,]+)[;,]/.exec(file.dataUrl)?.[1]?.toLowerCase();
  if (fromDataUrl && fromDataUrl !== "application/octet-stream") return normalizeMime(fromDataUrl);
  const declared = (file.mime || "").toLowerCase();
  if (declared && declared !== "application/octet-stream") return normalizeMime(declared);
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return declared || "application/octet-stream";
}

function normalizeMime(mime: string): string {
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

/** Buang prefix data URL, sisakan base64 murni. */
export function stripDataUrl(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  const raw = dataUrl.startsWith("data:") && idx !== -1 ? dataUrl.slice(idx + 1) : dataUrl;
  return raw.replace(/\s+/g, "");
}

/** Validasi payload file sebelum dikirim ke provider (tanpa melog isi file). */
export function checkFile(file: ExtractionRequest["file"]): FileCheck {
  const mime = resolveMime(file);
  const base64 = stripDataUrl(file.dataUrl);
  if (base64.length === 0) return { ok: false, reason: "empty" };
  if (!(SUPPORTED_MIMES as readonly string[]).includes(mime)) {
    return { ok: false, reason: "unsupported_mime" };
  }
  if (!BASE64_RE.test(base64)) return { ok: false, reason: "not_base64" };
  return {
    ok: true,
    payload: { mime: normalizeMime(mime), base64, bytes: Math.floor((base64.length * 3) / 4) },
  };
}
