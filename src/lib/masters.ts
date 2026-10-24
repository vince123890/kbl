// Definisi master data: dipakai oleh halaman daftar, form, dan server action generik.

export type FieldType = "text" | "textarea" | "number" | "integer" | "select" | "checkbox" | "branch";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  maxLength?: number;
  /** tidak dapat diubah setelah dibuat */
  createOnly?: boolean;
  help?: string;
  defaultValue?: string | boolean;
}

export interface ColumnDef {
  key: string;
  label: string;
  /** "branch" memetakan branch_id ke nama cabang */
  render?: "branch" | "bool" | "number";
}

export interface MasterDef {
  slug: string;
  table: string;
  label: string;
  singular: string;
  branchScoped: boolean;
  fields: FieldDef[];
  columns: ColumnDef[];
  searchColumns: string[];
  defaultSort: string;
  /** filter tambahan berupa select pada daftar */
  filters?: { name: string; label: string; options: { value: string; label: string }[] | "branch" }[];
  uniqueMessages?: Record<string, string>;
}

const VEHICLE_STATUS = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "OUT_OF_SERVICE", label: "Tidak Beroperasi" },
];

const VENDOR_TYPES = [
  { value: "BENGKEL", label: "Bengkel" },
  { value: "DEREK", label: "Derek" },
  { value: "ASURANSI", label: "Asuransi" },
  { value: "SUPPLIER", label: "Supplier" },
];

export const MASTERS: MasterDef[] = [
  {
    slug: "branches",
    table: "branches",
    label: "Cabang",
    singular: "Cabang",
    branchScoped: false,
    fields: [
      { name: "code", label: "Kode", type: "text", required: true, maxLength: 20 },
      { name: "name", label: "Nama", type: "text", required: true, maxLength: 120 },
      { name: "is_hq", label: "Kantor Pusat", type: "checkbox", help: "Hanya satu cabang yang boleh menjadi pusat" },
      { name: "address", label: "Alamat", type: "textarea" },
      { name: "phone", label: "Telepon", type: "text", maxLength: 30 },
      { name: "region", label: "Wilayah", type: "text", maxLength: 80, help: "Dipakai mencocokkan kontak darurat bercakupan wilayah" },
    ],
    columns: [
      { key: "code", label: "Kode" },
      { key: "name", label: "Nama" },
      { key: "region", label: "Wilayah" },
      { key: "is_hq", label: "Pusat", render: "bool" },
      { key: "phone", label: "Telepon" },
    ],
    searchColumns: ["code", "name"],
    defaultSort: "code",
    uniqueMessages: { code: "Kode sudah dipakai", is_hq: "Hanya satu cabang pusat" },
  },
  {
    slug: "vehicles",
    table: "vehicles",
    label: "Kendaraan",
    singular: "Kendaraan",
    branchScoped: true,
    fields: [
      { name: "plate_no", label: "No. Polisi", type: "text", required: true, maxLength: 15 },
      { name: "type", label: "Tipe", type: "text", required: true, maxLength: 60 },
      { name: "model", label: "Model", type: "text", maxLength: 80 },
      { name: "year", label: "Tahun", type: "integer", min: 1950, max: 2100 },
      { name: "branch_id", label: "Cabang", type: "branch", required: true },
      {
        name: "odometer",
        label: "Odometer awal (km)",
        type: "number",
        required: true,
        min: 0,
        createOnly: true,
        defaultValue: "0",
        help: "Perubahan berikutnya lewat aksi Update Odometer",
      },
      { name: "status", label: "Status", type: "select", options: VEHICLE_STATUS, defaultValue: "ACTIVE" },
      { name: "notes", label: "Catatan", type: "textarea" },
    ],
    columns: [
      { key: "plate_no", label: "No. Polisi" },
      { key: "type", label: "Tipe" },
      { key: "model", label: "Model" },
      { key: "year", label: "Tahun" },
      { key: "branch_id", label: "Cabang", render: "branch" },
      { key: "odometer", label: "Odometer (km)", render: "number" },
      { key: "status", label: "Status" },
    ],
    searchColumns: ["plate_no", "type", "model"],
    defaultSort: "plate_no",
    filters: [
      { name: "branch_id", label: "Cabang", options: "branch" },
      {
        name: "status",
        label: "Status kendaraan",
        options: [...VEHICLE_STATUS, { value: "IN_MAINTENANCE", label: "Dalam Perawatan" }],
      },
    ],
    uniqueMessages: { plate_norm: "Nomor polisi sudah dipakai" },
  },
  {
    slug: "spareparts",
    table: "spareparts",
    label: "Sparepart",
    singular: "Sparepart",
    branchScoped: false,
    fields: [
      { name: "code", label: "Kode", type: "text", required: true, maxLength: 40 },
      { name: "name", label: "Nama", type: "text", required: true, maxLength: 160 },
      { name: "category", label: "Kategori", type: "text", required: true, maxLength: 80 },
      { name: "uom", label: "Satuan", type: "text", required: true, maxLength: 20, help: "Mis. pcs, liter, set" },
      { name: "min_stock", label: "Stok minimum", type: "number", min: 0, defaultValue: "0" },
      { name: "description", label: "Deskripsi", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Kode" },
      { key: "name", label: "Nama" },
      { key: "category", label: "Kategori" },
      { key: "uom", label: "Satuan" },
      { key: "min_stock", label: "Stok Min", render: "number" },
    ],
    searchColumns: ["code", "name", "category"],
    defaultSort: "code",
    uniqueMessages: { code: "Kode sudah dipakai" },
  },
  {
    slug: "locations",
    table: "locations",
    label: "Lokasi / Gudang",
    singular: "Lokasi",
    branchScoped: true,
    fields: [
      { name: "branch_id", label: "Cabang", type: "branch", required: true },
      { name: "code", label: "Kode", type: "text", required: true, maxLength: 20 },
      { name: "name", label: "Nama", type: "text", required: true, maxLength: 120 },
      { name: "notes", label: "Keterangan", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Kode" },
      { key: "name", label: "Nama" },
      { key: "branch_id", label: "Cabang", render: "branch" },
    ],
    searchColumns: ["code", "name"],
    defaultSort: "code",
    filters: [{ name: "branch_id", label: "Cabang", options: "branch" }],
    uniqueMessages: { code: "Kode sudah dipakai pada cabang ini", branch_id: "Kode sudah dipakai pada cabang ini" },
  },
  {
    slug: "vendors",
    table: "vendors",
    label: "Vendor / Bengkel",
    singular: "Vendor",
    branchScoped: false,
    fields: [
      { name: "name", label: "Nama", type: "text", required: true, maxLength: 160 },
      { name: "type", label: "Tipe", type: "select", required: true, options: VENDOR_TYPES },
      { name: "phone", label: "Telepon", type: "text", required: true, maxLength: 30 },
      { name: "region", label: "Wilayah", type: "text", maxLength: 80 },
      { name: "pic", label: "Kontak PIC", type: "text", maxLength: 80 },
      { name: "address", label: "Alamat", type: "textarea" },
    ],
    columns: [
      { key: "name", label: "Nama" },
      { key: "type", label: "Tipe" },
      { key: "phone", label: "Telepon" },
      { key: "region", label: "Wilayah" },
    ],
    searchColumns: ["name", "region", "phone"],
    defaultSort: "name",
    filters: [{ name: "type", label: "Tipe", options: VENDOR_TYPES }],
  },
  {
    slug: "reason-codes",
    table: "reason_codes",
    label: "Kategori Alasan",
    singular: "Kategori Alasan",
    branchScoped: false,
    fields: [
      { name: "code", label: "Kode", type: "text", required: true, maxLength: 40 },
      { name: "name", label: "Nama", type: "text", required: true, maxLength: 120 },
      {
        name: "used_for",
        label: "Dipakai untuk",
        type: "select",
        required: true,
        options: [
          { value: "ALL", label: "Semua" },
          { value: "SCHEDULE_CHANGE", label: "Perubahan Jadwal" },
          { value: "OPNAME_DIFF", label: "Selisih Opname" },
          { value: "REJECT", label: "Penolakan" },
        ],
        defaultValue: "SCHEDULE_CHANGE",
      },
      { name: "require_note", label: "Wajib keterangan teks", type: "checkbox" },
    ],
    columns: [
      { key: "code", label: "Kode" },
      { key: "name", label: "Nama" },
      { key: "used_for", label: "Dipakai untuk" },
      { key: "require_note", label: "Wajib keterangan", render: "bool" },
    ],
    searchColumns: ["code", "name"],
    defaultSort: "name",
    uniqueMessages: { code: "Kode sudah dipakai" },
  },
];

export function getMaster(slug: string): MasterDef | undefined {
  return MASTERS.find((m) => m.slug === slug);
}

export type FieldValues = Record<string, string | number | boolean | null>;

/** Validasi + normalisasi input form master. Mengembalikan nilai bersih atau galat per field. */
export function parseMasterInput(
  def: MasterDef,
  raw: Record<string, FormDataEntryValue | boolean | null | undefined>,
  mode: "create" | "edit",
  branchIds: string[] = [],
): { values: FieldValues; errors: Record<string, string> } {
  const values: FieldValues = {};
  const errors: Record<string, string> = {};

  for (const f of def.fields) {
    if (f.createOnly && mode === "edit") continue;
    const input = raw[f.name];

    if (f.type === "checkbox") {
      values[f.name] = input === true || input === "on" || input === "true";
      continue;
    }

    const text = typeof input === "string" ? input.trim() : "";
    if (!text) {
      if (f.required) errors[f.name] = `${f.label} wajib diisi`;
      else values[f.name] = null;
      continue;
    }
    if (f.maxLength && text.length > f.maxLength) {
      errors[f.name] = `${f.label} maksimal ${f.maxLength} karakter`;
      continue;
    }

    switch (f.type) {
      case "number":
      case "integer": {
        const n = Number(text.replace(",", "."));
        if (!Number.isFinite(n)) errors[f.name] = `${f.label} harus berupa angka`;
        else if (f.type === "integer" && !Number.isInteger(n)) errors[f.name] = `${f.label} harus bilangan bulat`;
        else if (f.min !== undefined && n < f.min) errors[f.name] = `${f.label} minimal ${f.min}`;
        else if (f.max !== undefined && n > f.max) errors[f.name] = `${f.label} maksimal ${f.max}`;
        else values[f.name] = n;
        break;
      }
      case "select":
        if (!f.options?.some((o) => o.value === text)) errors[f.name] = `${f.label} tidak valid`;
        else values[f.name] = text;
        break;
      case "branch":
        if (branchIds.length && !branchIds.includes(text)) errors[f.name] = `${f.label} tidak valid`;
        else values[f.name] = text;
        break;
      default:
        values[f.name] = text;
    }
  }
  return { values, errors };
}
