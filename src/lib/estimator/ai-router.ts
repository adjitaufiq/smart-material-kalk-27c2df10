import {
  availableOrder,
  classifyFailure,
  createPool,
  markFailure,
  markSuccess,
  type ProviderPool,
} from "./provider-state";
import { checkFile } from "./providers/file";
import { requestFiles } from "./providers/types";
import { callGemini } from "./providers/gemini";
import { callLovable } from "./providers/lovable";
import type { ExtractionRequest, FetchLike } from "./providers/types";

export const GEMINI_KEY_NAMES = [
  "GEMINI_API_KEY_1",
  "GEMINI_API_KEY_2",
  "GEMINI_API_KEY_3",
  "GEMINI_API_KEY_4",
  "GEMINI_API_KEY_5",
] as const;

export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
/** Kandidat model cadangan bila model utama tidak tersedia (404 / retired). */
export const GEMINI_MODEL_FALLBACKS = ["gemini-3.5-flash", "gemini-2.5-flash"] as const;
export const DEFAULT_LOVABLE_MODEL = "google/gemini-3-flash-preview";

export const MSG_BUSY =
  "Layanan pembacaan gambar sedang sibuk atau limit sementara. Coba lagi beberapa menit.";
export const MSG_FINAL =
  "Pembacaan gambar belum dapat dijalankan saat ini. Silakan coba lagi nanti atau upload ulang file.";
export const MSG_REQUEST =
  "File gambar belum dapat dibaca. Silakan upload ulang dengan file gambar atau PDF yang jelas.";
export const MSG_INTERNAL =
  "Pembacaan gambar gagal karena kendala teknis pada sistem, bukan pada file Anda. Silakan coba lagi.";

export class ExtractionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionServiceError";
  }
}

export interface RouterEnv {
  [key: string]: string | undefined;
}

export interface RouterDeps {
  env?: RouterEnv;
  fetchImpl?: FetchLike;
  now?: () => number;
  pool?: ProviderPool;
  log?: (entry: Record<string, unknown>) => void;
}

/** Pool global per-instance server. Direset otomatis lewat cooldown. */
let globalPool: ProviderPool = createPool(GEMINI_KEY_NAMES.length);

export function resetGlobalPool(): void {
  globalPool = createPool(GEMINI_KEY_NAMES.length);
}

export function getGlobalPool(): ProviderPool {
  return globalPool;
}

function fallbackEnabled(env: RouterEnv): boolean {
  const raw = (env["LOVABLE_AI_FALLBACK_ENABLED"] ?? "").trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  return true;
}

function lovableKey(env: RouterEnv): string | undefined {
  return env["LOVABLE_AI_GATEWAY_KEY"] || env["LOVABLE_API_KEY"] || undefined;
}

/**
 * Router provider untuk AI Drawing Extraction.
 * Rotasi 5 key Gemini (round-robin + cooldown) lalu fallback Lovable AI.
 * Mengembalikan teks mentah model; sanitizer strict tetap di extraction.server.
 */
export async function routeExtraction(
  req: ExtractionRequest,
  deps: RouterDeps = {},
): Promise<string> {
  const env = deps.env ?? (process.env as RouterEnv);
  const now = deps.now ?? Date.now;
  const pool = deps.pool ?? globalPool;
  const log = deps.log ?? ((entry) => console.info("[extraction-router]", entry));

  const files = requestFiles(req);
  if (files.length === 0) {
    log({ outcome: "invalid_file", reason: "empty" });
    throw new ExtractionServiceError(MSG_REQUEST);
  }
  let bytes = 0;
  const mimes: string[] = [];
  for (const f of files) {
    const fileCheck = checkFile(f);
    if (!fileCheck.ok) {
      log({ outcome: "invalid_file", reason: fileCheck.reason, mime: f.mime });
      throw new ExtractionServiceError(MSG_REQUEST);
    }
    bytes += fileCheck.payload.bytes;
    mimes.push(fileCheck.payload.mime);
  }
  const mime = mimes.join(",");
  const fileCount = files.length;

  const models = [
    env["GEMINI_MODEL"]?.trim() || DEFAULT_GEMINI_MODEL,
    ...GEMINI_MODEL_FALLBACKS,
  ].filter((m, i, arr) => arr.indexOf(m) === i);
  let modelIdx = 0;

  const keys = new Map<number, string>();
  GEMINI_KEY_NAMES.forEach((name, i) => {
    const value = env[name]?.trim();
    if (value) keys.set(i + 1, value);
  });

  let attempts = 0;
  let sawQuota = false;
  let sawInternal = false;

  for (const key of availableOrder(pool, now())) {
    const apiKey = keys.get(key.index);
    if (!apiKey) continue;

    // satu key boleh mencoba beberapa model bila model tidak tersedia (404)
    let cls: ReturnType<typeof classifyFailure> = "unknown";
    let status: number | null = null;
    let handled = false;

    while (modelIdx < models.length) {
      const model = models[modelIdx]!;
      attempts += 1;
      const result = await callGemini({ apiKey, model, req, fetchImpl: deps.fetchImpl });
      if (result.ok) {
        markSuccess(pool, key, now());
        log({
          provider: "gemini",
          keyIndex: key.index,
          model,
          attempts,
          mime,
          bytes,
          fileCount,
          outcome: "success",
          fallback: false,
        });
        return result.text;
      }
      cls = classifyFailure(result.status, result.body);
      status = result.status;
      log({
        provider: "gemini",
        keyIndex: key.index,
        model,
        attempts,
        mime,
        bytes,
        status,
        reason: cls,
        outcome: "failed",
      });
      if (cls === "model" && modelIdx < models.length - 1) {
        modelIdx += 1;
        continue;
      }
      handled = true;
      break;
    }
    if (!handled) break;

    if (cls === "file") throw new ExtractionServiceError(MSG_REQUEST);
    if (cls === "request" || cls === "model") {
      sawInternal = true;
      break;
    }
    if (cls === "quota") sawQuota = true;
    markFailure(key, cls, `${status ?? "network"}`, now());
    log({
      provider: "gemini",
      keyIndex: key.index,
      attempts,
      outcome: "cooldown",
      reason: cls,
      cooldownUntil: key.cooldownUntil,
    });
  }

  const fbKey = lovableKey(env);
  if (fallbackEnabled(env) && fbKey) {
    attempts += 1;
    const fbModel = env["LOVABLE_AI_MODEL"]?.trim() || DEFAULT_LOVABLE_MODEL;
    const result = await callLovable({
      apiKey: fbKey,
      model: fbModel,
      req,
      fetchImpl: deps.fetchImpl,
    });
    if (result.ok) {
      log({ provider: "lovable", attempts, mime, bytes, outcome: "success", fallback: true });
      return result.text;
    }
    const cls = classifyFailure(result.status, result.body);
    log({
      provider: "lovable",
      attempts,
      status: result.status,
      mime,
      bytes,
      outcome: "failed",
      reason: cls,
      fallback: true,
    });
    if (cls === "file") throw new ExtractionServiceError(MSG_REQUEST);
    if (cls === "request" || cls === "model") throw new ExtractionServiceError(MSG_INTERNAL);
    throw new ExtractionServiceError(MSG_FINAL);
  }

  if (sawInternal) throw new ExtractionServiceError(MSG_INTERNAL);

  log({ attempts, outcome: "exhausted", fallback: false, sawQuota });
  if (attempts === 0 && keys.size === 0) throw new ExtractionServiceError(MSG_FINAL);
  throw new ExtractionServiceError(sawQuota ? MSG_BUSY : MSG_FINAL);
}
