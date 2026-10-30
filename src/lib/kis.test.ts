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

import { parseSpecHints, toBase64Url as b64 } from "./kis";
describe("KIS specHints", () => {
  it("decodes base64url specHints", () => {
    const enc = b64(JSON.stringify({ outside: "duco", inside: "tacosheet", hinge: "biasa", slide: "tandem",
      accessories: [{ id: "rak-sayur", position: "kabinet 2" }, { id: "rak-gelas", position: "atas" }] }));
    const r = parseSpecHints({ specHints: enc });
    expect(r.spec).toMatchObject({ outside: "duco", inside: "tacosheet", hinge: "biasa", slide: "tandem" });
    expect(r.spec?.accessories).toEqual(["rak-sayur", "rak-piring"]);
    expect(r.positions["rak-sayur"]).toBe("kabinet 2");
  });
  it("accepts flat params and ignores unknown values", () => {
    const r = parseSpecHints({ outside: "hpl", inside: "kayu" });
    expect(r.spec?.outside).toBe("hpl");
    expect(r.spec?.inside).toBe("blockmin");
  });
  it("returns null without hints", () => {
    expect(parseSpecHints({}).spec).toBeNull();
  });
});
