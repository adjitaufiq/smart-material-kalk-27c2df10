import { describe, expect, it } from "vitest";

import {
  DEFAULT_GEMINI_MODEL,
  MSG_BUSY,
  MSG_FINAL,
  MSG_REQUEST,
  routeExtraction,
} from "./ai-router";
import { createPool } from "./provider-state";
import { normalizeStrictResult } from "./extraction.server";
import type { ExtractionRequest } from "./providers/types";

const req: ExtractionRequest = {
  systemPrompt: "sys",
  userText: "user",
  file: { name: "gambar.png", mime: "image/png", dataUrl: "data:image/png;base64,AAAA" },
};

const envAll = {
  GEMINI_API_KEY_1: "k1",
  GEMINI_API_KEY_2: "k2",
  GEMINI_API_KEY_3: "k3",
  GEMINI_API_KEY_4: "k4",
  GEMINI_API_KEY_5: "k5",
};

const PAYLOAD = '{"sections":[]}';

function geminiOk() {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: PAYLOAD }] } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
function lovableOk() {
  return new Response(JSON.stringify({ choices: [{ message: { content: PAYLOAD } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
function err(status: number, body = "") {
  return new Response(body, { status });
}

/** fetch palsu: rute berdasarkan key yang ada di URL. */
function makeFetch(handler: (keyIndex: number | null, url: string) => Response) {
  const calls: (number | null)[] = [];
  const fetchImpl = async (url: string) => {
    const m = /key=k(\d)/.exec(url);
    const idx = m ? Number(m[1]) : null;
    calls.push(idx);
    return handler(idx, url);
  };
  return { fetchImpl: fetchImpl as never, calls };
}

describe("ai-router rotation", () => {
  it("1. sukses di key 1", async () => {
    const { fetchImpl, calls } = makeFetch(() => geminiOk());
    const text = await routeExtraction(req, { env: envAll, fetchImpl, pool: createPool(5) });
    expect(text).toBe(PAYLOAD);
    expect(calls).toEqual([1]);
  });

  it("2. key 1 kena 429 -> key 2 sukses", async () => {
    const { fetchImpl, calls } = makeFetch((i) => (i === 1 ? err(429, "RESOURCE_EXHAUSTED") : geminiOk()));
    const text = await routeExtraction(req, { env: envAll, fetchImpl, pool: createPool(5) });
    expect(text).toBe(PAYLOAD);
    expect(calls).toEqual([1, 2]);
  });

  it("3. key 1-4 limit -> key 5 sukses", async () => {
    const { fetchImpl, calls } = makeFetch((i) => (i !== null && i < 5 ? err(429, "quota") : geminiOk()));
    await routeExtraction(req, { env: envAll, fetchImpl, pool: createPool(5) });
    expect(calls).toEqual([1, 2, 3, 4, 5]);
  });

  it("4. semua key limit -> fallback Lovable dipakai", async () => {
    const { fetchImpl, calls } = makeFetch((i) => (i === null ? lovableOk() : err(429, "quota")));
    const text = await routeExtraction(req, {
      env: { ...envAll, LOVABLE_API_KEY: "lov" },
      fetchImpl,
      pool: createPool(5),
    });
    expect(text).toBe(PAYLOAD);
    expect(calls).toEqual([1, 2, 3, 4, 5, null]);
  });

  it("5. semua gagal & fallback mati -> pesan user-friendly", async () => {
    const { fetchImpl } = makeFetch(() => err(429, "quota"));
    await expect(
      routeExtraction(req, {
        env: { ...envAll, LOVABLE_API_KEY: "lov", LOVABLE_AI_FALLBACK_ENABLED: "false" },
        fetchImpl,
        pool: createPool(5),
      }),
    ).rejects.toThrow(MSG_BUSY);
  });

  it("5b. fallback Lovable gagal kredit -> pesan final", async () => {
    const { fetchImpl } = makeFetch((i) => (i === null ? err(402, "credits") : err(429, "quota")));
    await expect(
      routeExtraction(req, { env: { ...envAll, LOVABLE_API_KEY: "lov" }, fetchImpl, pool: createPool(5) }),
    ).rejects.toThrow(MSG_FINAL);
  });

  it("6. error 400 tidak memicu rotasi liar", async () => {
    const { fetchImpl, calls } = makeFetch(() => err(400, "invalid image payload"));
    await expect(
      routeExtraction(req, { env: envAll, fetchImpl, pool: createPool(5) }),
    ).rejects.toThrow(MSG_REQUEST);
    expect(calls).toEqual([1]);
  });

  it("7. invalid auth membuat key disabled dan diskip", async () => {
    const pool = createPool(5);
    const { fetchImpl } = makeFetch((i) => (i === 1 ? err(403, "API key not valid") : geminiOk()));
    await routeExtraction(req, { env: envAll, fetchImpl, pool });
    expect(pool.keys[0]!.status).toBe("disabled");

    const second = makeFetch((i) => {
      expect(i).not.toBe(1);
      return geminiOk();
    });
    await routeExtraction(req, { env: envAll, fetchImpl: second.fetchImpl, pool });
    expect(second.calls).not.toContain(1);
  });

  it("8. key cooldown aktif lagi setelah waktu lewat", async () => {
    const pool = createPool(5);
    let t = 1_000_000;
    const first = makeFetch((i) => (i === 1 ? err(429, "quota") : geminiOk()));
    await routeExtraction(req, { env: envAll, fetchImpl: first.fetchImpl, pool, now: () => t });
    expect(pool.keys[0]!.status).toBe("cooling_down");

    t += 6 * 60_000;
    pool.cursor = 0;
    const second = makeFetch(() => geminiOk());
    await routeExtraction(req, { env: envAll, fetchImpl: second.fetchImpl, pool, now: () => t });
    expect(second.calls).toEqual([1]);
    expect(pool.keys[0]!.status).toBe("ready");
  });

  it("9. pesan error tidak membocorkan key / provider / model", async () => {
    const { fetchImpl } = makeFetch(() => err(429, "quota"));
    const error = await routeExtraction(req, { env: envAll, fetchImpl, pool: createPool(5) }).catch(
      (e: Error) => e,
    );
    const msg = (error as Error).message;
    for (const leak of ["k1", "gemini", "Gemini", "Lovable", DEFAULT_GEMINI_MODEL, "429"]) {
      expect(msg).not.toContain(leak);
    }
  });

  it("10. kontrak output extraction tidak berubah", async () => {
    const result = normalizeStrictResult(JSON.parse(PAYLOAD));
    expect(result).toMatchObject({ sections: [], conflicts: [], unreadable_pages: [] });
    expect(result.provider).toBe("AI Vision");
  });

  it("round-robin: request berikutnya mulai dari key setelah yang sukses", async () => {
    const pool = createPool(5);
    const a = makeFetch(() => geminiOk());
    await routeExtraction(req, { env: envAll, fetchImpl: a.fetchImpl, pool });
    const b = makeFetch(() => geminiOk());
    await routeExtraction(req, { env: envAll, fetchImpl: b.fetchImpl, pool });
    expect(a.calls).toEqual([1]);
    expect(b.calls).toEqual([2]);
  });
});
