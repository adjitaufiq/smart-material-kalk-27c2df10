import { describe, expect, it } from "vitest";

import {
  DEFAULT_GEMINI_MODEL,
  MSG_BUSY,
  MSG_FINAL,
  MSG_INTERNAL,
  MSG_REQUEST,
  GEMINI_MODEL_FALLBACKS,
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
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: PAYLOAD }] } }] }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
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

/** fetch palsu: rute berdasarkan key pada header x-goog-api-key (bukan URL). */
function makeFetch(handler: (keyIndex: number | null, url: string, init: RequestInit) => Response) {
  const calls: (number | null)[] = [];
  const urls: string[] = [];
  const inits: RequestInit[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const m = /^k(\d)$/.exec(headers["x-goog-api-key"] ?? "");
    const idx = m ? Number(m[1]) : null;
    calls.push(idx);
    urls.push(url);
    inits.push(init);
    return handler(idx, url, init);
  };
  return { fetchImpl: fetchImpl as never, calls, urls, inits };
}

describe("ai-router rotation", () => {
  it("1. sukses di key 1", async () => {
    const { fetchImpl, calls } = makeFetch(() => geminiOk());
    const text = await routeExtraction(req, { env: envAll, fetchImpl, pool: createPool(5) });
    expect(text).toBe(PAYLOAD);
    expect(calls).toEqual([1]);
  });

  it("2. key 1 kena 429 -> key 2 sukses", async () => {
    const { fetchImpl, calls } = makeFetch((i) =>
      i === 1 ? err(429, "RESOURCE_EXHAUSTED") : geminiOk(),
    );
    const text = await routeExtraction(req, { env: envAll, fetchImpl, pool: createPool(5) });
    expect(text).toBe(PAYLOAD);
    expect(calls).toEqual([1, 2]);
  });

  it("3. key 1-4 limit -> key 5 sukses", async () => {
    const { fetchImpl, calls } = makeFetch((i) =>
      i !== null && i < 5 ? err(429, "quota") : geminiOk(),
    );
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
      routeExtraction(req, {
        env: { ...envAll, LOVABLE_API_KEY: "lov" },
        fetchImpl,
        pool: createPool(5),
      }),
    ).rejects.toThrow(MSG_FINAL);
  });

  it("6. error 400 tidak memicu rotasi liar & bukan pesan upload ulang", async () => {
    const { fetchImpl, calls } = makeFetch(() => err(400, "invalid argument"));
    await expect(
      routeExtraction(req, {
        env: { ...envAll, LOVABLE_AI_FALLBACK_ENABLED: "false" },
        fetchImpl,
        pool: createPool(5),
      }),
    ).rejects.toThrow(MSG_INTERNAL);
    expect(calls).toEqual([1]);
  });

  it("6b. file benar-benar invalid -> pesan upload ulang, tanpa call provider", async () => {
    const { fetchImpl, calls } = makeFetch(() => geminiOk());
    await expect(
      routeExtraction(
        {
          ...req,
          file: { name: "a.txt", mime: "text/plain", dataUrl: "data:text/plain;base64,QQ==" },
        },
        { env: envAll, fetchImpl, pool: createPool(5) },
      ),
    ).rejects.toThrow(MSG_REQUEST);
    expect(calls).toEqual([]);
  });

  it("6c. model 404 -> coba model cadangan pada key yang sama", async () => {
    let seen = 0;
    const { fetchImpl, calls, urls } = makeFetch((_i, url) => {
      seen += 1;
      return url.includes(DEFAULT_GEMINI_MODEL) ? err(404, "no longer available") : geminiOk();
    });
    const text = await routeExtraction(req, { env: envAll, fetchImpl, pool: createPool(5) });
    expect(text).toBe(PAYLOAD);
    expect(seen).toBe(2);
    expect(calls).toEqual([1, 1]);
    expect(urls[1]).toContain(GEMINI_MODEL_FALLBACKS[0]);
  });

  it("A. API key tidak pernah ada di URL, dikirim via header", async () => {
    const { fetchImpl, urls, inits } = makeFetch(() => geminiOk());
    await routeExtraction(req, { env: envAll, fetchImpl, pool: createPool(5) });
    expect(urls[0]).not.toContain("k1");
    expect(urls[0]).not.toContain("key=");
    const headers = inits[0]!.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("k1");
    expect(headers["content-type"]).toBe("application/json");
  });

  it("B. payload PNG/JPEG/PDF valid & prefix data URL dibuang", async () => {
    for (const f of [
      { name: "a.png", mime: "image/png", dataUrl: "data:image/png;base64,QUJD" },
      { name: "b.jpg", mime: "image/jpg", dataUrl: "data:image/jpeg;base64,QUJD" },
      {
        name: "c.pdf",
        mime: "application/octet-stream",
        dataUrl: "data:application/pdf;base64,QUJD",
      },
    ]) {
      const { fetchImpl, inits } = makeFetch(() => geminiOk());
      await routeExtraction({ ...req, file: f }, { env: envAll, fetchImpl, pool: createPool(5) });
      const body = JSON.parse(String(inits[0]!.body)) as {
        contents: { parts: { inline_data?: { mime_type: string; data: string } }[] }[];
      };
      const inline = body.contents[0]!.parts[1]!.inline_data!;
      expect(inline.data).toBe("QUJD");
      expect(inline.mime_type).toBe(
        f.name.endsWith(".pdf")
          ? "application/pdf"
          : f.name.endsWith(".png")
            ? "image/png"
            : "image/jpeg",
      );
    }
  });

  it("D. log diagnostik aman: index key, model, status, mime, bytes; tanpa secret", async () => {
    const entries: Record<string, unknown>[] = [];
    const { fetchImpl } = makeFetch((i) => (i === 1 ? err(429, "quota") : geminiOk()));
    await routeExtraction(req, {
      env: envAll,
      fetchImpl,
      pool: createPool(5),
      log: (e) => entries.push(e),
    });
    const dump = JSON.stringify(entries);
    expect(dump).not.toContain("k1");
    expect(dump).not.toContain("AAAA");
    expect(entries.some((e) => e["keyIndex"] === 1 && e["mime"] === "image/png")).toBe(true);
    expect(entries.some((e) => e["status"] === 429)).toBe(true);
    expect(entries.some((e) => typeof e["bytes"] === "number")).toBe(true);
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
