import { checkFile } from "./file";
import { requestFiles } from "./types";
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
  const files = requestFiles(req);
  if (files.length === 0) return { ok: false, status: 0, body: "invalid_file:empty" };
  const parts: { inline_data: { mime_type: string; data: string } }[] = [];
  const labels: { text: string }[] = [];
  for (const f of files) {
    const check = checkFile(f);
    if (!check.ok) return { ok: false, status: 0, body: `invalid_file:${check.reason}` };
    labels.push({ text: `FILE: ${f.name}` });
    parts.push({ inline_data: { mime_type: check.payload.mime, data: check.payload.base64 } });
  }

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
            parts: [{ text: req.userText }, ...files.flatMap((_f, i) => [labels[i]!, parts[i]!])],
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
