import type { ExtractionRequest, FetchLike, ProviderResult } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function base64Of(dataUrl: string): string {
  return dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : dataUrl;
}

/** Panggilan langsung ke Google AI Studio / Gemini API dengan satu API key. */
export async function callGemini(
  args: { apiKey: string; model: string; req: ExtractionRequest; fetchImpl?: FetchLike },
): Promise<ProviderResult> {
  const fetchImpl = args.fetchImpl ?? (fetch as unknown as FetchLike);
  const { req } = args;
  try {
    const res = await fetchImpl(
      `${BASE}/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.systemPrompt }] },
          generationConfig: { temperature: 0 },
          contents: [
            {
              role: "user",
              parts: [
                { text: req.userText },
                { inline_data: { mime_type: req.file.mime, data: base64Of(req.file.dataUrl) } },
              ],
            },
          ],
        }),
      },
    );

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
    return { ok: false, status: null, body: error instanceof Error ? error.message : "network error" };
  }
}
