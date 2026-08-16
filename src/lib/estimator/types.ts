// Core domain types. INTERNAL UNIT IS ALWAYS MILLIMETER (mm).

export type Unit = "mm" | "cm" | "m";

export type GrainDirection = "length" | "width" | "none";

export type MaterialCategory =
  | "plywood"
  | "mdf"
  | "particle_board"
  | "blockboard"
  | "pvc_board"
  | "acrylic"
  | "solid_wood"
  | "lainnya";

export interface MaterialMaster {
  id: string;
  nama_material: string;
  kategori: MaterialCategory;
  panjang_mm: number;
  lebar_mm: number;
  ketebalan_mm: number;
  harga: number | null;
  satuan: string;
  grain_direction: GrainDirection;
  kerf_mm: number;
  waste_default: number; // 0..1
  aktif: boolean;
}

export interface HplMaster {
  id: string;
  brand: string;
  kode: string;
  nama: string;
  panjang_mm: number;
  lebar_mm: number;
  arah_serat: GrainDirection;
  harga: number | null;
  aktif: boolean;
}

export interface EdgingMaster {
  id: string;
  nama: string;
  brand: string;
  warna: string;
  ketebalan_mm: number;
  lebar_mm: number;
  panjang_roll_m: number;
  harga: number | null;
  harga_per_meter: number | null;
  aktif: boolean;
}

export type HardwareCategory =
  | "engsel"
  | "rel_laci"
  | "rel_sliding"
  | "handle"
  | "hanger_rod"
  | "connector"
  | "screw"
  | "minifix"
  | "lampu"
  | "profil_aluminium"
  | "trafo"
  | "aksesori";

export interface HardwareMaster {
  id: string;
  kategori: HardwareCategory;
  brand: string;
  nama: string;
  model: string;
  unit: string;
  pack_size: number;
  harga: number | null;
  rule_default: string;
  aktif: boolean;
}

/** How top/bottom panels meet the side panels. Drives derived part sizes. */
export type PanelRelationship =
  /** top & bottom sit BETWEEN the sides: sides run full height */
  | "top_bottom_between_sides"
  /** top & bottom CAP the sides: top/bottom run full width */
  | "top_bottom_over_sides";

export type ModuleKind =
  | "base_cabinet"
  | "wall_cabinet"
  | "tall_cabinet"
  | "wardrobe"
  | "drawer_module"
  | "floating_cabinet"
  | "floating_shelf"
  | "shelf_unit"
  | "table_top"
  | "table_frame"
  | "backdrop_panel"
  | "partition"
  | "door_panel"
  | "plinth";

export interface ConstructionTemplate {
  id: string;
  kode: string;
  nama: string;
  kind: ModuleKind;
  panel_relationship: PanelRelationship;
  default_height_mm: number | null;
  default_depth_mm: number | null;
  body_material_id: string;
  back_material_id: string | null;
  door_material_id: string | null;
  default_shelves: number;
  /** gap around a door leaf on each side */
  door_clearance_mm: number;
  /** shelf is set back from the front by this amount */
  shelf_setback_mm: number;
  /** back panel is captured in a groove / nailed on the back */
  back_inset_mm: number;
  notes: string;
  aktif: boolean;
}

export type DoorType = "none" | "swing" | "sliding" | "flap" | "glass";

export interface FaceFinish {
  /** hpl master id, or null = unfinished / not selected */
  hplId: string | null;
}

export interface EdgeSpec {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface ModuleSpec {
  id: string;
  kind: ModuleKind;
  name: string;
  templateId: string;
  qty: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  doors: number;
  doorType: DoorType;
  drawers: number;
  shelves: number;
  hasBack: boolean;
  hangingRod?: boolean | undefined;
  bodyMaterialId: string;
  backMaterialId: string | null;
  doorMaterialId: string | null;
  /** finishing per face group */
  finish: {
    bodyOutside: FaceFinish;
    bodyInside: FaceFinish;
    doorFaceA: FaceFinish;
    doorFaceB: FaceFinish;
  };
  edgingId: string | null;
  /** override jumlah engsel per pintu (null = pakai aturan default) */
  hingeOverride?: number | null | undefined;
  /** table_top only: number of stacked layers */
  topLayers?: number | undefined;
  /** table_frame only: frame is not sheet material */
  frameMaterial?: "besi" | "plywood" | "solid_wood" | "lainnya" | undefined;
  led?: { enabled: boolean; length_mm: number; watt_per_m: number; segments: number } | undefined;
}


export interface Part {
  id: string;
  part_name: string;
  module_id: string;
  module_name: string;
  qty: number;
  length_mm: number;
  width_mm: number;
  thickness_mm: number;
  material_id: string;
  grain_direction: GrainDirection;
  finish_face_a: string | null; // hpl id
  finish_face_b: string | null;
  edge: EdgeSpec;
  edging_id: string | null;
  notes: string;
  derivation: string;
}

export type CalculationStatus = "estimasi_awal" | "estimasi_terverifikasi" | "bom_siap_belanja";

export interface Assumption {
  key: string;
  label: string;
  value: string;
  isDefault: boolean;
}

export type IssueSeverity = "error" | "warning";

export interface Issue {
  severity: IssueSeverity;
  code: string;
  message: string;
  moduleId?: string;
}

export interface PlacedPart {
  partId: string;
  part_name: string;
  x: number;
  y: number;
  length_mm: number;
  width_mm: number;
  rotated: boolean;
}

export interface SheetLayout {
  sheetIndex: number;
  materialId: string;
  sheet_length_mm: number;
  sheet_width_mm: number;
  placed: PlacedPart[];
  usedArea_mm2: number;
}

export interface SheetResult {
  materialId: string;
  materialName: string;
  sheets: number;
  layouts: SheetLayout[];
  usedArea_mm2: number;
  sheetArea_mm2: number;
  utilization: number;
  mode: "cepat" | "potong";
  wasteFactor: number | null;
  unplaced: string[];
}

export interface BomItem {
  id: string;
  group: "material" | "finishing" | "edging" | "hardware" | "elektrik";
  name: string;
  qty: number;
  unit: string;
  unitPrice: number | null;
  total: number | null;
  /** traceability: which parts / modules produced this line */
  trace: string[];
  explanation: string;
}

export interface CostSummary {
  material: number | null;
  finishing: number | null;
  edging: number | null;
  hardware: number | null;
  elektrik: number | null;
  grandTotal: number | null;
  incomplete: boolean;
}

export interface CalculationResult {
  status: CalculationStatus;
  parts: Part[];
  sheets: SheetResult[];
  hplSheets: SheetResult[];
  edgingMeters: { edgingId: string; name: string; meters: number; trace: string[] }[];
  hardware: BomItem[];
  electrical: BomItem[];
  bom: BomItem[];
  assumptions: Assumption[];
  issues: Issue[];
  cost: CostSummary;
  computedAt: string;
}

export type FurnitureCategory = string;

export interface FurnitureItem {
  id: string;
  category: FurnitureCategory;
  customCategory?: string | undefined;
  name: string;
  hasDrawing: boolean | null;
  drawings: DrawingRef[];
  extraction: DrawingExtraction | null;
  designOptions: GeneratedDesignOption[];
  selectedOptionId: string | null;
  modules: ModuleSpec[];
  confirmedConstruction: boolean;
  confirmedDimensions: boolean;
  wasteFactor: number; // 0.05 | 0.10 | 0.15 | custom
  sheetMode: "cepat" | "potong";
  briefing?: {
    width_mm: number;
    height_mm: number;
    depth_mm: number;
    doors: number;
    drawers: number;
    shelves: number;
    doorType: DoorType;
    notes: string;
  } | undefined;
}

export interface DrawingRef {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string | number | null;
  unit?: Unit | undefined;
  confidence: number; // 0..1
  ambiguous: boolean;
  range?: [number, number] | undefined;
}

export interface DrawingExtraction {
  id: string;
  drawingId: string;
  provider: string;
  raw: unknown;
  normalized: ExtractedField[];
  confidence: number;
  warnings: string[];
  confirmed_by_user: boolean;
  confirmed_at: string | null;
  created_at: string;
}

export interface GeneratedDesignOption {
  id: string;
  option_number: number;
  name: string;
  description: string;
  structured_model: ModuleSpec[];
  overall_dimensions: { width_mm: number; height_mm: number; depth_mm: number };
  image_reference: string | null;
  selected: boolean;
  created_at: string;
}

export interface ProjectRevision {
  id: string;
  number: number;
  created_at: string;
  note: string;
  snapshot: { items: FurnitureItem[] };
}

export interface Project {
  id: string;
  name: string;
  workshop: string;
  location: string;
  jenis_pekerjaan: string;
  visit_date: string;
  notes: string;
  source: "baru" | "ro_memory";
  created_at: string;
  items: FurnitureItem[];
  revisions: ProjectRevision[];
}
