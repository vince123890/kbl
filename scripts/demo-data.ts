// Data demo untuk pengujian manual. HANYA untuk development/staging, jangan dijalankan di produksi.
// Dipakai oleh scripts/seed-demo.ts dan divalidasi terhadap skema di tests/db/demo-data.test.ts.

export const DEMO_PASSWORD = "Demo12345";

export interface DemoUser {
  email: string;
  name: string;
  phone: string;
  branch: string; // kode cabang
  roles: string[];
  active?: boolean;
  note: string;
}

export const DEMO_BRANCHES = [
  { code: "JKT", name: "Cabang Jakarta", address: "Jl. Raya Cakung No. 1, Jakarta Timur", phone: "021-5550101" },
  { code: "SBY", name: "Cabang Surabaya", address: "Jl. Rungkut Industri No. 8, Surabaya", phone: "031-5550202" },
  { code: "BDG", name: "Cabang Bandung", address: "Jl. Soekarno Hatta No. 20, Bandung", phone: "022-5550303" },
];

export const DEMO_USERS: DemoUser[] = [
  { email: "sysadmin@example.com", name: "Sari Sistem", phone: "081200000001", branch: "HQ", roles: ["SYS_ADMIN"], note: "Master, user, role, parameter, audit" },
  { email: "hqadmin@example.com", name: "Hendra Pusat", phone: "081200000002", branch: "HQ", roles: ["HQ_ADMIN"], note: "Lintas cabang, audit, tanpa master.write" },
  { email: "depthead.jkt@example.com", name: "Dewi Kepala Dept", phone: "081200000003", branch: "JKT", roles: ["DEPT_HEAD"], note: "Approval level lanjut (read-only master)" },
  { email: "supervisor.jkt@example.com", name: "Surya Supervisor", phone: "081200000004", branch: "JKT", roles: ["SUPERVISOR"], note: "Approval level 1 (memutuskan perubahan jadwal), rencana, WO" },
  { email: "warehouse.jkt@example.com", name: "Wawan Gudang", phone: "081200000005", branch: "JKT", roles: ["WAREHOUSE"], note: "Mutasi, opname" },
  { email: "mechanic.jkt@example.com", name: "Maman Mekanik", phone: "081200000006", branch: "JKT", roles: ["MECHANIC"], note: "Menjalankan WO, mengajukan perubahan jadwal WO miliknya" },
  { email: "driver.jkt@example.com", name: "Dedi Driver", phone: "081200000007", branch: "JKT", roles: ["DRIVER"], note: "Pengemudi, kendaraan B 9001 KBL" },
  { email: "warehouse.sby@example.com", name: "Wulan Gudang SBY", phone: "081200000013", branch: "SBY", roles: ["WAREHOUSE"], note: "Mutasi dan opname cabang Surabaya" },
  { email: "supervisor.sby@example.com", name: "Sinta Supervisor SBY", phone: "081200000008", branch: "SBY", roles: ["SUPERVISOR"], note: "Uji isolasi cabang (Surabaya)" },
  { email: "mechanic.sby@example.com", name: "Mulyadi Mekanik SBY", phone: "081200000009", branch: "SBY", roles: ["MECHANIC"], note: "Uji isolasi cabang (Surabaya)" },
  { email: "driver.sby@example.com", name: "Doni Driver SBY", phone: "081200000010", branch: "SBY", roles: ["DRIVER"], note: "Uji isolasi cabang (Surabaya)" },
  { email: "gudang.supervisor.jkt@example.com", name: "Gita Gudang-Supervisor", phone: "081200000011", branch: "JKT", roles: ["WAREHOUSE", "SUPERVISOR"], note: "Dua role: uji segregation of duties" },
  { email: "nonaktif.jkt@example.com", name: "Nanda Nonaktif", phone: "081200000012", branch: "JKT", roles: ["MECHANIC"], active: false, note: "Akun nonaktif: login harus ditolak" },
];

export const DEMO_LOCATIONS = [
  { branch: "HQ", code: "GU-HQ", name: "Gudang Pusat" },
  { branch: "JKT", code: "GU-JKT", name: "Gudang Utama Jakarta" },
  { branch: "JKT", code: "WS-JKT", name: "Workshop Jakarta" },
  { branch: "SBY", code: "GU-SBY", name: "Gudang Utama Surabaya" },
  { branch: "BDG", code: "GU-BDG", name: "Gudang Utama Bandung" },
];

export const DEMO_VEHICLES = [
  { plate_no: "B 9001 KBL", type: "Truk", model: "Hino 500", year: 2021, branch: "JKT", odometer: 84250, driver: "driver.jkt@example.com" },
  { plate_no: "B 9002 KBL", type: "Truk", model: "Mitsubishi Fuso", year: 2020, branch: "JKT", odometer: 121900 },
  { plate_no: "B 7101 KBL", type: "Bus", model: "Hino RK8", year: 2019, branch: "JKT", odometer: 215400 },
  { plate_no: "B 5201 KBL", type: "Pick-up", model: "Suzuki Carry", year: 2022, branch: "JKT", odometer: 38100 },
  { plate_no: "L 8001 KBL", type: "Truk", model: "Isuzu Giga", year: 2021, branch: "SBY", odometer: 97600, driver: "driver.sby@example.com" },
  { plate_no: "L 8002 KBL", type: "Pick-up", model: "Daihatsu Gran Max", year: 2023, branch: "SBY", odometer: 21500 },
  { plate_no: "D 6001 KBL", type: "Minibus", model: "Toyota HiAce", year: 2022, branch: "BDG", odometer: 45300 },
  { plate_no: "B 1000 PST", type: "Minibus", model: "Toyota Innova", year: 2022, branch: "HQ", odometer: 30200, status: "OUT_OF_SERVICE" },
];

export const DEMO_SPAREPARTS = [
  { code: "OLI-MSN-15W40", name: "Oli Mesin 15W-40 (20 L)", category: "Pelumas", uom: "pail", min_stock: 5 },
  { code: "OLI-GRD-90", name: "Oli Gardan SAE 90", category: "Pelumas", uom: "liter", min_stock: 40 },
  { code: "FLT-OLI-01", name: "Filter Oli Hino 500", category: "Filter", uom: "pcs", min_stock: 10 },
  { code: "FLT-UDR-01", name: "Filter Udara Hino 500", category: "Filter", uom: "pcs", min_stock: 6 },
  { code: "FLT-SLR-01", name: "Filter Solar Primer", category: "Filter", uom: "pcs", min_stock: 8 },
  { code: "KMP-RM-DP", name: "Kampas Rem Depan", category: "Rem", uom: "set", min_stock: 4 },
  { code: "KMP-RM-BK", name: "Kampas Rem Belakang", category: "Rem", uom: "set", min_stock: 4 },
  { code: "MNY-RM-DOT4", name: "Minyak Rem DOT 4", category: "Rem", uom: "liter", min_stock: 12 },
  { code: "AKI-12V-100", name: "Aki 12V 100Ah", category: "Kelistrikan", uom: "pcs", min_stock: 3 },
  { code: "LMP-H4-24V", name: "Lampu Depan H4 24V", category: "Kelistrikan", uom: "pcs", min_stock: 10 },
  { code: "BAN-295-22", name: "Ban 295/80 R22.5", category: "Ban", uom: "pcs", min_stock: 8 },
  { code: "BAN-185-14", name: "Ban 185 R14", category: "Ban", uom: "pcs", min_stock: 8 },
  { code: "VBL-A60", name: "V-Belt A60", category: "Mesin", uom: "pcs", min_stock: 6 },
  { code: "KPL-SET-01", name: "Kopling Set (plat + cover)", category: "Transmisi", uom: "set", min_stock: 2 },
  { code: "CLNT-5L", name: "Coolant Radiator (5 L)", category: "Pendingin", uom: "pail", min_stock: 6 },
  { code: "WPR-24", name: "Wiper Blade 24\"", category: "Body", uom: "pcs", min_stock: 10 },
];

export const DEMO_VENDORS = [
  { name: "Bengkel Resmi Hino Cakung", type: "BENGKEL", phone: "021-5551001", region: "Jakarta", pic: "Pak Rudi", address: "Jl. Cakung Cilincing, Jakarta" },
  { name: "Bengkel Umum Maju Jaya", type: "BENGKEL", phone: "031-5551002", region: "Surabaya", pic: "Pak Joko", address: "Jl. Margomulyo, Surabaya" },
  { name: "Derek Cepat Jabodetabek", type: "DEREK", phone: "081300000001", region: "Jakarta", pic: "Dispatcher 24 jam", address: null },
  { name: "Derek Sigap Jawa Timur", type: "DEREK", phone: "081300000002", region: "Surabaya", pic: "Dispatcher 24 jam", address: null },
  { name: "Asuransi Armada Nusantara", type: "ASURANSI", phone: "1500-123", region: "Nasional", pic: "Claim Center", address: null },
  { name: "PT Suku Cadang Sentosa", type: "SUPPLIER", phone: "021-5551003", region: "Jakarta", pic: "Bu Rina", address: "Jl. Pulogadung, Jakarta" },
  { name: "CV Ban Sejahtera", type: "SUPPLIER", phone: "031-5551004", region: "Surabaya", pic: "Pak Tono", address: "Jl. Ahmad Yani, Surabaya" },
];

// ---------------------------------------------------------------- transaksi demo (dibuat lewat jalur resmi oleh seed-demo)
export interface DemoStockLine {
  location: string; // kode lokasi
  items: { code: string; qty: number }[];
}

/** Stok awal per lokasi. Sebagian sengaja di bawah stok minimum agar widget Stok Kritis terisi. */
export const DEMO_STOCK: { branch: string; warehouseUser: string; lines: DemoStockLine[] }[] = [
  {
    branch: "JKT",
    warehouseUser: "warehouse.jkt@example.com",
    lines: [
      {
        location: "GU-JKT",
        items: [
          { code: "OLI-MSN-15W40", qty: 14 },
          { code: "OLI-GRD-90", qty: 60 },
          { code: "FLT-OLI-01", qty: 18 },
          { code: "FLT-UDR-01", qty: 3 },
          { code: "FLT-SLR-01", qty: 12 },
          { code: "KMP-RM-DP", qty: 2 },
          { code: "KMP-RM-BK", qty: 6 },
          { code: "MNY-RM-DOT4", qty: 20 },
          { code: "AKI-12V-100", qty: 5 },
          { code: "BAN-295-22", qty: 10 },
        ],
      },
      { location: "WS-JKT", items: [{ code: "OLI-MSN-15W40", qty: 4 }, { code: "FLT-OLI-01", qty: 4 }, { code: "LMP-H4-24V", qty: 14 }] },
    ],
  },
  {
    branch: "SBY",
    warehouseUser: "warehouse.sby@example.com",
    lines: [{ location: "GU-SBY", items: [{ code: "OLI-MSN-15W40", qty: 8 }, { code: "FLT-OLI-01", qty: 12 }, { code: "BAN-185-14", qty: 9 }, { code: "KPL-SET-01", qty: 1 }] }],
  },
];

/** Rencana perawatan demo. lastDaysAgo/lastKm menentukan seberapa dekat jatuh tempo. */
export const DEMO_PLANS = [
  { supervisor: "supervisor.jkt@example.com", plate: "B 9001 KBL", task: "Ganti oli mesin dan filter oli", days: 90, km: 10000, lastDaysAgo: 85, lastKm: 78000, parts: [{ code: "OLI-MSN-15W40", qty: 2 }, { code: "FLT-OLI-01", qty: 1 }] },
  { supervisor: "supervisor.jkt@example.com", plate: "B 9001 KBL", task: "Servis rem depan dan belakang", days: 180, km: 20000, lastDaysAgo: 60, lastKm: 66000, parts: [{ code: "KMP-RM-DP", qty: 1 }] },
  { supervisor: "supervisor.jkt@example.com", plate: "B 9002 KBL", task: "Servis berkala 120.000 km", days: 365, km: 40000, lastDaysAgo: 200, lastKm: 82000, parts: [{ code: "FLT-SLR-01", qty: 1 }, { code: "FLT-UDR-01", qty: 1 }] },
  { supervisor: "supervisor.jkt@example.com", plate: "B 5201 KBL", task: "Ganti oli mesin", days: 90, km: 5000, lastDaysAgo: 30, lastKm: 36000, parts: [{ code: "OLI-MSN-15W40", qty: 1 }] },
  { supervisor: "supervisor.sby@example.com", plate: "L 8001 KBL", task: "Ganti oli mesin dan filter oli", days: 90, km: 10000, lastDaysAgo: 40, lastKm: 90000, parts: [{ code: "OLI-MSN-15W40", qty: 2 }, { code: "FLT-OLI-01", qty: 1 }] },
];

/** Kontak darurat tambahan (kontak Global pusat sudah ada dari migrasi). Nomor contoh. */
export const DEMO_CONTACTS = [
  { scope: "BRANCH", branch: "JKT", role_label: "Derek Jakarta", name: "Derek Cepat Jabodetabek", phone: "081300000001", priority: 2, service_hours: "24 jam" },
  { scope: "BRANCH", branch: "JKT", role_label: "Atasan langsung", name: "Surya Supervisor", phone: "081200000004", priority: 3 },
  { scope: "BRANCH", branch: "SBY", role_label: "Derek Surabaya", name: "Derek Sigap Jawa Timur", phone: "081300000002", priority: 2, service_hours: "24 jam" },
];
