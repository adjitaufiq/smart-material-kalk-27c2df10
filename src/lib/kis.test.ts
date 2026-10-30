import { describe, expect, it } from "vitest";
import { buildKisEstimate, kisReturnLink, parseKisSearch, safeReturnUrl } from "./kis";

describe("KIS integration", () => {
  it("menolak returnUrl di luar domain KIS", () => {
    expect(safeReturnUrl("https://evil.com/x")).toBe("");
    expect(safeReturnUrl("https://kerjaku-design-forge.lovable.app/leads/1")).toContain("/leads/1");
  });

  it("tanpa projectId tidak bisa import", () => {
    expect(parseKisSearch({ clientName: "A" })).toBeNull();
  });

  it("kitchen_set membuat item kabinet bawah & atas", () => {
    const d = parseKisSearch({ projectId: "p1", jobType: "kitchen_set" })!;
    expect(d.items.map((i) => i.name)).toEqual(["Kitchen Set Bawah", "Kitchen Set Atas"]);
  });

  it("payload balik berisi projectId KIS dan bisa didecode", () => {
    const payload = buildKisEstimate({
      kisProjectId: "kis-1", estimateId: "e1", results: [], bom: [], grandTotal: 1000, deepLinkUrl: "x",
    });
    expect(payload.projectId).toBe("kis-1");
    expect(payload.estimatedMaterialCost).toBe(1000);
    const url = new URL(kisReturnLink("https://kerjaku-design-forge.lovable.app/leads/1", payload));
    const b64 = url.searchParams.get("estimate")!.replace(/-/g, "+").replace(/_/g, "/");
    expect(JSON.parse(atob(b64)).projectId).toBe("kis-1");
  });
});
