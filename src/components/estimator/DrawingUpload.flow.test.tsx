// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ItemWizard } from "./ItemWizard";
import { newFurnitureItem } from "@/lib/estimator/factory";
import type { DrawingExtraction, FurnitureItem } from "@/lib/estimator/types";

/* --------------------------------------------------------------- mocking */

const deleted: string[] = [];
vi.mock("@/lib/drawing-blobs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/drawing-blobs")>("@/lib/drawing-blobs");
  return {
    ...actual,
    deleteDrawingBlob: async (id: string) => {
      deleted.push(id);
    },
  };
});

const extractCalls: { name: string }[][] = [];
vi.mock("@/lib/estimator/ai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/estimator/ai")>("@/lib/estimator/ai");
  return {
    ...actual,
    drawingExtractionService: {
      available: true,
      providerName: "AI Vision",
      extract: async (drawings: { id: string; name: string }[]) => {
        const list = Array.isArray(drawings) ? drawings : [drawings];
        extractCalls.push(list.map((d) => ({ name: d.name })));
        const extraction: DrawingExtraction = {
          id: "ext_1",
          drawingId: list[0]!.id,
          drawingIds: list.map((d) => d.id),
          provider: "AI Vision",
          raw: null,
          normalized: [],
          confidence: 1,
          warnings: [],
          confirmed_by_user: false,
          confirmed_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          strict: null,
        };
        return extraction;
      },
    },
  };
});

/* --------------------------------------------------------------- harness */

function Harness({ initial }: { initial: FurnitureItem }) {
  const [item, setItem] = useState(initial);
  return (
    <ItemWizard
      item={item}
      projectName="Test"
      revision={1}
      onChange={setItem}
      onSaveRevision={() => {}}
    />
  );
}

const png = (name: string, size = 1200, lastModified = 1000) => {
  const file = new File([new Uint8Array(size)], name, { type: "image/png", lastModified });
  return file;
};

const pdf = (name: string) =>
  new File([new Uint8Array(3000)], name, { type: "application/pdf", lastModified: 2000 });

async function openStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^\d+\s*Gambar\/Ukuran$/i }));
}

const fileInput = () => screen.getByLabelText(/pilih file gambar kerja/i) as HTMLInputElement;
const rows = () => screen.queryAllByRole("button", { name: /^Hapus file /i });

beforeAll(() => {
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

beforeEach(() => {
  deleted.length = 0;
  extractCalls.length = 0;
});
afterEach(cleanup);

const baseItem = (): FurnitureItem => ({
  ...newFurnitureItem("Meja Kantor", "Meja kantor"),
  hasDrawing: true,
});

/* ----------------------------------------------------------------- tests */

describe("UX upload gambar kerja (drawing set)", () => {
  it("upload 1 image menampilkan 1 file", async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseItem()} />);
    await openStep(user);
    await user.upload(fileInput(), png("Tampak Depan.png"));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByText("Tampak Depan.png")).toBeTruthy();
  });

  it("upload 3 file sekaligus menampilkan 3 file, lalu tambah 1 lagi jadi 4 tanpa menghapus lama", async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseItem()} />);
    await openStep(user);
    await user.upload(fileInput(), [png("A.png", 100, 1), png("B.png", 200, 2), png("C.png", 300, 3)]);
    await waitFor(() => expect(rows()).toHaveLength(3));

    await user.upload(fileInput(), pdf("Detail.pdf"));
    await waitFor(() => expect(rows()).toHaveLength(4));
    for (const n of ["A.png", "B.png", "C.png", "Detail.pdf"]) {
      expect(screen.getByText(n)).toBeTruthy();
    }
  });

  it("hapus file kedua hanya menghapus file itu, dan cancel dialog mempertahankan file", async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseItem()} />);
    await openStep(user);
    await user.upload(fileInput(), [png("A.png", 100, 1), png("B.png", 200, 2), png("C.png", 300, 3)]);
    await waitFor(() => expect(rows()).toHaveLength(3));

    // Batal
    await user.click(screen.getByRole("button", { name: "Hapus file B.png" }));
    await user.click(await screen.findByRole("button", { name: /^Batal$/i }));
    await waitFor(() => expect(rows()).toHaveLength(3));

    // Konfirmasi hapus
    await user.click(screen.getByRole("button", { name: "Hapus file B.png" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/hapus gambar kerja ini\?/i)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: /hapus file/i }));

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByText("B.png")).toBeNull();
    expect(deleted).toHaveLength(1);
  });

  it("duplicate exact file tidak ditambahkan dua kali, nama sama beda size tetap masuk", async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseItem()} />);
    await openStep(user);
    await user.upload(fileInput(), png("A.png", 100, 1));
    await waitFor(() => expect(rows()).toHaveLength(1));

    await user.upload(fileInput(), png("A.png", 100, 1));
    await new Promise((r) => setTimeout(r, 50));
    expect(rows()).toHaveLength(1);

    await user.upload(fileInput(), png("A.png", 555, 9));
    await waitFor(() => expect(rows()).toHaveLength(2));
  });

  it("tombol Baca Gambar Kerja disabled bila semua file dihapus", async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseItem()} />);
    await openStep(user);
    const readBtn = () => screen.getByRole("button", { name: /baca gambar kerja/i });
    expect((readBtn() as HTMLButtonElement).disabled).toBe(true);

    await user.upload(fileInput(), png("A.png"));
    await waitFor(() => expect((readBtn() as HTMLButtonElement).disabled).toBe(false));

    await user.click(screen.getByRole("button", { name: "Hapus file A.png" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: /hapus file/i,
    }));
    await waitFor(() => expect((readBtn() as HTMLButtonElement).disabled).toBe(true));
  });

  it("multi-file extraction mengirim semua file aktif; file terhapus tidak ikut; perubahan file menandai stale", async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseItem()} />);
    await openStep(user);
    await user.upload(fileInput(), [png("Depan.png", 100, 1), png("Samping.png", 200, 2), pdf("Detail.pdf")]);
    await waitFor(() => expect(rows()).toHaveLength(3));

    await user.click(screen.getByRole("button", { name: "Hapus file Detail.pdf" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: /hapus file/i,
    }));
    await waitFor(() => expect(rows()).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: /baca gambar kerja/i }));
    await waitFor(() => expect(extractCalls).toHaveLength(1));
    expect(extractCalls[0]!.map((f) => f.name)).toEqual(["Depan.png", "Samping.png"]);
    expect(screen.queryByText(/daftar gambar kerja berubah/i)).toBeNull();

    // Tambah file setelah extraction -> stale
    await user.upload(fileInput(), pdf("Detail Revisi.pdf"));
    expect(await screen.findByText(/daftar gambar kerja berubah/i)).toBeTruthy();
  });

  it("jalur single-file lama tetap bekerja", async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseItem()} />);
    await openStep(user);
    await user.upload(fileInput(), png("Solo.png"));
    await waitFor(() => expect(rows()).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /baca gambar kerja/i }));
    await waitFor(() => expect(extractCalls).toHaveLength(1));
    expect(extractCalls[0]!.map((f) => f.name)).toEqual(["Solo.png"]);
  });
});
