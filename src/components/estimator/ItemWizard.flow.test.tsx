// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ItemWizard } from "./ItemWizard";
import { newFurnitureItem } from "@/lib/estimator/factory";
import type {
  DrawingExtraction,
  FurnitureItem,
  StrictExtractionResult,
} from "@/lib/estimator/types";

/* ---------------------------------------------------------------- fixture */

const m = (field: string, label: string, value_mm: number) => ({
  field,
  label,
  raw_value: String(value_mm),
  raw_unit: "mm",
  value_mm,
  source: "dimension_annotation" as const,
  source_text: String(value_mm),
  view: "tampak depan",
  page: 1,
  status: "CONFIRMED_FROM_DRAWING" as const,
  confidence: 1,
});

const sp = (field: string, label: string, value: string) => ({
  field,
  label,
  value,
  source: "text_note" as const,
  source_text: value,
  status: "CONFIRMED_FROM_DRAWING" as const,
  confidence: 1,
});

const MEJA_KANTOR: StrictExtractionResult = {
  provider: "AI Vision",
  model: "test",
  sections: [
    {
      id: "sec_1",
      name: "Meja Kantor",
      furniture_type: "Meja Kantor",
      furniture_type_confidence: 1,
      measurements: [
        m("overall_width", "Overall panjang", 1600),
        m("overall_depth", "Overall depth", 700),
        m("overall_height", "Overall tinggi", 750),
        m("top_width", "Top meja panjang", 1600),
        m("top_depth", "Top meja depth", 700),
        m("kaki_kiri_h", "Kaki panel kiri tinggi", 714),
        m("kaki_kiri_d", "Kaki panel kiri depth", 650),
        m("kaki_kanan_h", "Kaki panel kanan tinggi", 714),
        m("kaki_kanan_d", "Kaki panel kanan depth", 650),
        m("modesty_w", "Modesty panel panjang", 1500),
        m("modesty_h", "Modesty panel tinggi", 400),
        m("inset", "Inset kaki dari tepi top", 50),
      ],
      counts: [],
      specs: [
        sp("top_material", "Top meja material", "Triplek 18 mm"),
        sp("top_layer", "Top meja layer", "double layer"),
        sp("top_finishing", "Top meja finishing", "HPL permukaan atas"),
        sp("kaki_kiri_material", "Kaki panel kiri material", "Triplek 18 mm"),
        sp("kaki_kiri_finishing", "Kaki panel kiri finishing", "Tanpa HPL"),
        sp("kaki_kanan_material", "Kaki panel kanan material", "Triplek 18 mm"),
        sp("kaki_kanan_finishing", "Kaki panel kanan finishing", "Tanpa HPL"),
        sp("modesty_material", "Modesty panel material", "Triplek 18 mm"),
        sp("modesty_finishing", "Modesty panel finishing", "Tanpa HPL"),
      ],
      relations: ["Top menumpu di atas dua kaki panel"],
      notes: [],
    },
  ],
  needs_confirmation: [],
  conflicts: [],
  unreadable_pages: [],
  drawing_scale_note: "NTS",
};

const EXTRACTION: DrawingExtraction = {
  id: "ext_1",
  drawingId: "dwg_1",
  provider: "AI Vision",
  raw: null,
  normalized: [],
  confidence: 1,
  warnings: [],
  confirmed_by_user: false,
  confirmed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  strict: MEJA_KANTOR,
};

vi.mock("@/lib/estimator/ai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/estimator/ai")>("@/lib/estimator/ai");
  return {
    ...actual,
    drawingExtractionService: {
      available: true,
      extract: async () => EXTRACTION,
    },
  };
});

/* ---------------------------------------------------------------- harness */

const LEGACY_STRINGS = [
  "Kabinet Bawah",
  "Swing",
  "Triplek 9 mm",
  "Edging PVC",
  "Pintu",
  "Laci",
  "Shelf",
  "besi",
  "Frame",
];

function Harness({ initial, onItem }: { initial: FurnitureItem; onItem?: (i: FurnitureItem) => void }) {
  const [item, setItem] = useState(initial);
  return (
    <ItemWizard
      item={item}
      projectName="Test"
      revision={1}
      onChange={(next) => {
        setItem(next);
        onItem?.(next);
      }}
      onSaveRevision={() => {}}
    />
  );
}

const goTo = async (user: ReturnType<typeof userEvent.setup>, label: string) =>
  user.click(screen.getByRole("button", { name: new RegExp(`^\\d+\\s*${label}$`, "i") }));

function itemWithDrawing(): FurnitureItem {
  return {
    ...newFurnitureItem("Meja Kantor", "Meja kantor"),
    hasDrawing: true,
    drawings: [
      {
        id: "dwg_1",
        name: "meja.png",
        mime: "image/png",
        dataUrl: "data:image/png;base64,QUJDRA==",
        uploadedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

beforeAll(() => {
  // Radix + jsdom
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(cleanup);

/* ------------------------------------------------------------------ tests */

describe("alur gambar kerja: extract -> pakai semua -> konfirmasi -> model -> material", () => {
  it("Material hanya menampilkan 4 komponen drawing, tanpa jalur legacy", async () => {
    const user = userEvent.setup();
    let latest: FurnitureItem = itemWithDrawing();
    render(<Harness initial={latest} onItem={(i) => (latest = i)} />);

    await goTo(user, "Gambar/Ukuran");
    await user.click(screen.getByRole("button", { name: /baca gambar kerja/i }));
    await screen.findByRole("button", { name: /pakai semua data terbaca/i });

    await user.click(screen.getByRole("button", { name: /pakai semua data terbaca/i }));
    await user.click(screen.getByRole("button", { name: /konfirmasi hasil ekstraksi/i }));

    expect(latest.drawingSnapshot).toBeTruthy();
    expect(latest.modules).toEqual([]);
    expect(latest.designOptions).toEqual([]);
    expect(latest.selectedOptionId).toBeNull();

    // Step Model
    await goTo(user, "Model");
    expect(await screen.findByText(/struktur dari gambar kerja/i)).toBeTruthy();

    // Step Material
    await goTo(user, "Material");
    await screen.findByText(/mengikuti gambar kerja/i);
    const text = document.body.textContent ?? "";

    for (const name of ["Top Meja", "Kaki Panel Kiri", "Kaki Panel Kanan", "Modesty Panel"]) {
      expect(text).toContain(name);
    }
    expect(text).toContain("1600 \u00d7 700 \u00d7 36 mm");
    expect(text).toContain("714 \u00d7 650 \u00d7 18 mm");
    expect(text).toContain("1500 \u00d7 400 \u00d7 18 mm");
    expect(text).toContain("HPL permukaan atas");
    expect((text.match(/Tanpa HPL/g) ?? []).length).toBe(3);
    expect((text.match(/Triplek 18 mm/g) ?? []).length).toBeGreaterThanOrEqual(4);

    for (const legacy of LEGACY_STRINGS) {
      expect(text.toLowerCase()).not.toContain(legacy.toLowerCase());
    }
  });

  it("self-heal: snapshot ada tapi drawingComponents kosong tetap mirror 1:1", async () => {
    const user = userEvent.setup();
    let latest: FurnitureItem = itemWithDrawing();
    const { unmount } = render(<Harness initial={latest} onItem={(i) => (latest = i)} />);

    await goTo(user, "Gambar/Ukuran");
    await user.click(screen.getByRole("button", { name: /baca gambar kerja/i }));
    await screen.findByRole("button", { name: /pakai semua data terbaca/i });
    await user.click(screen.getByRole("button", { name: /pakai semua data terbaca/i }));
    await user.click(screen.getByRole("button", { name: /konfirmasi hasil ekstraksi/i }));
    unmount();

    // Simulasi item lama: material state hilang, snapshot masih ada.
    const stale: FurnitureItem = { ...latest, drawingComponents: null };
    render(<Harness initial={stale} onItem={(i) => (latest = i)} />);
    await goTo(user, "Material");

    await waitFor(() => {
      expect(screen.getAllByText("Modesty Panel").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Kaki Panel Kiri").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kaki Panel Kanan").length).toBeGreaterThan(0);
  });
});

describe("regresi jalur manual / tanpa gambar kerja", () => {
  it("tetap memakai modul legacy seperti sebelumnya", async () => {
    const user = userEvent.setup();
    const initial: FurnitureItem = {
      ...newFurnitureItem("Lemari Baju", "Lemari baju"),
      hasDrawing: false,
      briefing: {
        width_mm: 1800,
        height_mm: 2400,
        depth_mm: 600,
        doors: 3,
        drawers: 2,
        shelves: 4,
        doorType: "swing",
        notes: "",
      },
    };
    let latest = initial;
    render(<Harness initial={initial} onItem={(i) => (latest = i)} />);

    await goTo(user, "Model");
    await user.click(screen.getByRole("button", { name: /susun modul dari ukuran/i }));
    expect(latest.modules.length).toBeGreaterThan(0);

    await goTo(user, "Material");
    await screen.findByText(/material & konstruksi/i);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Construction template");
    expect(text).toContain("Qty modul");
    expect(text).toMatch(/Tambah modul/i);
  });
});
