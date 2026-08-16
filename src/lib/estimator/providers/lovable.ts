import type { ExtractionRequest, FetchLike, ProviderResult } from "./types";

const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";

function contentBlock(req: ExtractionRequest) {
  const { name, mime, dataUrl } = req.file;
  const isPdf =
    mime === "application/pdf" ||
    dataUrl.startsWith("data:application/pdf") ||
    name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    const normalized = dataUrl.startsWith("data:application/pdf")
      ? dataUrl
      : `data:application/pdf;base64,${dataUrl.split(",")[1] ?? ""}`;
    return { type: "file", file: { filename: name, file_data: normalized } };
  }
  return { type: "image_url", image_url: { url: dataUrl } };
}

/** Fallback terakhir: Lovable AI Gateway. */
export async function callLovable(args: {
  apiKey: string;
  model: string;
  req: ExtractionRequest;
  fetchImpl?: FetchLike | undefined;
}): Promise<ProviderResult> {
  const fetchImpl = args.fetchImpl ?? (fetch as unknown as FetchLike);
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: args.model,
        temperature: 0,
        messages: [
          { role: "system", content: args.req.systemPrompt },
          {
            role: "user",
            content: [{ type: "text", text: args.req.userText }, contentBlock(args.req)],
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, body: await res.text().catch(() => "") };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (json.choices?.[0]?.message?.content ?? "").trim();
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
