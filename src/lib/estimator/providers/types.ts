export interface ExtractionRequest {
  systemPrompt: string;
  userText: string;
  file: { name: string; mime: string; dataUrl: string };
}

export type ProviderResult =
  { ok: true; text: string } | { ok: false; status: number | null; body: string };

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
