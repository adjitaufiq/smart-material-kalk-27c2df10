import { checkFile } from "./file";
import type { ExtractionRequest, FetchLike, ProviderResult } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Panggilan langsung ke Gemini API (server-side).
 * API key dikirim lewat header `x-goog-api-key`, TIDAK PERNAH di query URL.
 */
export async function callGemini(args: {
  apiKey: string;
  model: string;
  req: ExtractionRequest;
  fetchImpl?: FetchLike | undefined;
}): Promise<ProviderResult> {
  const fetchImpl = args.fetchImpl ?? (fetch as unknown as FetchLike);
  const { req } = args;
  const file = checkFile(req.file);
  if (!file.ok) return { ok: false, status: 0, body: `invalid_file:${file.reason}` };

  try {
    const res = await fetchImpl(`${BASE}/${encodeURIComponent(args.model)}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": args.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.systemPrompt }] },
        generationConfig: { temperature: 0 },
        contents: [
          {
            role: "user",
            parts: [
              { text: req.userText },
              { inline_data: { mime_type: file.payload.mime, data: file.payload.base64 } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, body: await res.text().catch(() => "") };
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) return { ok: false, status: 502, body: "empty response" };
    return { ok: true, text };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: error instanceof Error ? error.message : "network error",
    };
  }
}
