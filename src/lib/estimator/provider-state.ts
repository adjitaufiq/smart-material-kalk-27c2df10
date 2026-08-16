/**
 * State pool untuk rotasi API key (server-side only).
 * Tidak pernah menyimpan atau membocorkan nilai key — hanya index & status.
 */

export type KeyStatus = "ready" | "cooling_down" | "disabled";

export type FailureClass =
  | "quota" // 429 / RESOURCE_EXHAUSTED / QUOTA_EXCEEDED
  | "transient" // 5xx / timeout / network
  | "auth" // 401 / 403 / invalid key
  | "request" // 400 / payload salah -> JANGAN rotate
  | "unknown";

export interface KeyState {
  index: number; // 1-based
  status: KeyStatus;
  lastError: string | null;
  cooldownUntil: number | null;
  failCount: number;
  lastSuccessAt: number | null;
}

export const COOLDOWN_MS: Record<Exclude<FailureClass, "request">, number> = {
  quota: 5 * 60_000,
  auth: 30 * 60_000,
  transient: 60_000,
  unknown: 60_000,
};

export interface ProviderPool {
  keys: KeyState[];
  cursor: number; // index array untuk round-robin
}

export function createPool(count: number): ProviderPool {
  return {
    keys: Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      status: "ready" as KeyStatus,
      lastError: null,
      cooldownUntil: null,
      failCount: 0,
      lastSuccessAt: null,
    })),
    cursor: 0,
  };
}

/** Reaktivasi key yang cooldown-nya sudah lewat. */
export function refreshPool(pool: ProviderPool, now: number): void {
  for (const k of pool.keys) {
    if (k.status !== "ready" && k.cooldownUntil !== null && now >= k.cooldownUntil) {
      k.status = "ready";
      k.cooldownUntil = null;
      k.failCount = 0;
    }
  }
}

/** Urutan percobaan mulai dari cursor (round-robin), hanya key yang ready. */
export function availableOrder(pool: ProviderPool, now: number): KeyState[] {
  refreshPool(pool, now);
  const n = pool.keys.length;
  const out: KeyState[] = [];
  for (let i = 0; i < n; i++) {
    const k = pool.keys[(pool.cursor + i) % n]!;
    if (k.status === "ready") out.push(k);
  }
  return out;
}

export function markSuccess(pool: ProviderPool, key: KeyState, now: number): void {
  key.status = "ready";
  key.lastError = null;
  key.cooldownUntil = null;
  key.failCount = 0;
  key.lastSuccessAt = now;
  // request berikutnya mulai dari key setelah yang sukses
  pool.cursor = (key.index % pool.keys.length + pool.keys.length) % pool.keys.length;
}

export function markFailure(
  key: KeyState,
  cls: Exclude<FailureClass, "request">,
  reason: string,
  now: number,
): void {
  key.failCount += 1;
  key.lastError = reason;
  const base = COOLDOWN_MS[cls];
  // exponential backoff sederhana, dibatasi 8x
  const factor = Math.min(2 ** (key.failCount - 1), 8);
  key.cooldownUntil = now + base * factor;
  key.status = cls === "auth" ? "disabled" : "cooling_down";
}

/** Klasifikasi error provider berdasarkan status HTTP dan pesan. */
export function classifyFailure(status: number | null, body: string): FailureClass {
  const text = body.toLowerCase();
  if (
    status === 429 ||
    text.includes("resource_exhausted") ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("rate_limit")
  ) {
    return "quota";
  }
  if (status === 401 || status === 403 || text.includes("api key not valid") || text.includes("permission denied")) {
    return "auth";
  }
  if (status !== null && status >= 500) return "transient";
  if (status === null) return "transient"; // network/timeout
  if (status === 400 || status === 404 || status === 422) return "request";
  return "unknown";
}
