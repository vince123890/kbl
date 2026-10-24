# Spesifikasi Menu & Sub Menu — Sistem Manajemen Perawatan & Sparepart Kendaraan (KBL)

| | |
|---|---|
| Dokumen | MS-01 |
| Versi | 1.0 (draft) |
| Tanggal | 2026-10-24 |
| Sudut pandang | Developer — "layar apa saja yang saya buat dan apa isinya" |
| Turunan dari | [requirement.docx](requirement.docx), [PRD.md](PRD.md), [TECHNICAL_LOGIC.md](TECHNICAL_LOGIC.md), [assumption.md](assumption.md) |

## Untuk siapa dokumen ini

| Pembaca | Kegunaan |
|---|---|
| Developer (FE/BE) | Daftar layar, aksi, validasi, dan yang sengaja tidak dibangun |
| QA | Dasar skenario uji per layar dan per role |
| Product owner | Memeriksa apakah setiap kebutuhan sudah punya layar; mengonfirmasi asumsi |
| Estimator | Bahan breakdown Module > Feature > Task > Sub Task (Tahap ③) |

## Cara membaca

Setiap sub menu dibahas dari lima sudut pandang yang sama:

| # | Sudut pandang | Isi |
|---|---|---|
| ① | List | Kolom, search, filter, sort, paging, export, batch |
| ② | Sync | Integrasi dengan sistem lain |
| ③ | Create / Edit / Upload | Field, validasi, template, unggah massal |
| ④ | View Detail + Approval | Isi detail, aksi approve/revise/reject, log |
| ⑤ | Delete | Nonaktif / batal / reversal |

Bagian yang tidak berlaku ditulis **"— tidak ada —"** beserta alasannya. Itu keputusan, bukan kelalaian.

| Penanda | Arti |
|---|---|
| ✅ **TERKONFIRMASI** | Disebut eksplisit di [requirement.docx](requirement.docx) |
| ⚠️ **ASUMSI** | Turunan rancangan, merujuk ID di [assumption.md](assumption.md) |
| 🔒 **MENUNGGU** | Bergantung pertanyaan terbuka |

> Karena [requirement.docx](requirement.docx) hanya berisi 6 poin, hampir semua detail di bawah berstatus ⚠️ ASUMSI. Yang ✅ hanya keberadaan enam kemampuan intinya (R1–R6).

## Isi dokumen

1. [Keputusan yang Mengubah Bentuk Aplikasi](#keputusan-yang-mengubah-bentuk-aplikasi)
2. [Peta Menu Lengkap](#peta-menu-lengkap)
3. [0. Role & Kewenangan](#0-role--kewenangan-per-modul)
4. [1. Dashboard](#1-dashboard)
5. [2. Master Data](#2-master-data)
6. [3. Inventori Sparepart](#3-inventori-sparepart)
7. [4. Perawatan & Penjadwalan](#4-perawatan--penjadwalan)
8. [5. Emergensi](#5-emergensi)
9. [6. Approval](#6-approval)
10. [7. Laporan](#7-laporan)
11. [8. Administrasi](#8-administrasi)
12. [Perilaku Lintas Menu](#perilaku-lintas-menu)
13. [Yang Sengaja TIDAK Dibangun](#yang-sengaja-tidak-dibangun)
14. [Rekapitulasi](#rekapitulasi)
15. [Yang Perlu Dikonfirmasi](#yang-perlu-dikonfirmasi)

---

## Keputusan yang Mengubah Bentuk Aplikasi

Tujuh pertanyaan penentu bentuk aplikasi dijawab memakai asumsi yang ada (atas arahan: "sementara menggunakan asumsi yang ada").

| # | Keputusan | Dasar | Akibat pada menu |
|---|---|---|---|
| 1 | **Aplikasi berdiri sendiri** (login, user, role dikelola sendiri). Tidak ada SSO/portal induk. | Tidak ada integrasi sistem lain di [assumption.md](assumption.md) A-4, H-3 | Ada Login, Profil, serta menu User dan Role. Tidak ada Auth Redirect/Role Setting ke sistem induk. |
| 2 | **Semua master data diinput di aplikasi ini** (CRUD penuh). Tidak ada ERP/GPS. | A-4 | Tidak ada tombol Sync di master mana pun. Master memakai Create/Edit/Nonaktifkan. |
| 3 | **Approval sungguhan**, berjenjang dan bisa dikonfigurasi, bukan sekadar pencatatan. | Requirement poin 5, F-1 s/d F-5 | Ada Approval Inbox, Semua Antrean (pusat), dan Konfigurasi Alur Approval. Pengaju tidak boleh menyetujui dokumennya sendiri. |
| 4 | **Dokumen stok yang sudah diposting tidak boleh dihapus/diubah**; koreksi lewat dokumen pembalik (reversal). Master hanya dinonaktifkan. | B-4 | Tidak ada tombol Hapus pada transaksi stok. Ada aksi "Buat Pembalik". |
| 5 | **Satu-satunya integrasi keluar adalah kanal notifikasi** (push, WhatsApp/SMS). Tidak ada integrasi data. | G-7, A-4 | Semua sudut pandang ② Sync bertuliskan "tidak ada", kecuali Log Notifikasi di Administrasi. |
| 6 | **Laporan bersifat tetap** (kolom sudah ditentukan), bukan report builder. | Konsisten untuk audit | Katalog laporan fix; tidak ada menu perancang laporan. |
| 7 | **Emergensi boleh dikerjakan dulu, di-approve belakangan** (batas ±24 jam). | D-4 | WO Emergensi tidak terblokir approval; ada antrean "Validasi Pasca-Kejadian". |
| 8 | **Stok dicatat kuantitas saja, tanpa harga.** | A-5 | Tidak ada kolom harga/valuasi. Ambang "biaya di atas nilai tertentu" pada [PRD.md](PRD.md) FR-5.1 **tidak dapat dipakai**, diganti ambang jumlah item/qty (lihat Yang Perlu Dikonfirmasi no. 7). |

---

## Peta Menu Lengkap

```
KBL — Perawatan & Sparepart Kendaraan
│
├── 🔐 Login / Lupa Password / Profil Saya     /login  /forgot-password  /profile
├── 📊 Dashboard                                /
├── 📁 Master Data                              /master
│   ├── Cabang                                  /master/branches
│   ├── Kendaraan                               /master/vehicles
│   │   └── Detail Kendaraan                    /master/vehicles/[id]
│   ├── Sparepart                               /master/spareparts
│   ├── Lokasi / Gudang                         /master/locations
│   ├── Vendor / Bengkel                        /master/vendors
│   └── Kategori Alasan                         /master/reason-codes
├── 📦 Inventori Sparepart                      /inventory
│   ├── Mutasi Sparepart                        /inventory/movements
│   │   ├── Baru                                /inventory/movements/new
│   │   └── Detail                              /inventory/movements/[id]
│   ├── Saldo Stok                              /inventory/balances
│   ├── Kartu Stok                              /inventory/stock-cards
│   │   └── Detail per Sparepart                /inventory/stock-cards/[sparepartId]
│   └── Stock Opname                            /inventory/counts
│       ├── Baru                                /inventory/counts/new
│       └── Detail / Hitung                     /inventory/counts/[id]
├── 🔧 Perawatan & Penjadwalan                  /maintenance
│   ├── Rencana Perawatan                       /maintenance/plans
│   ├── Work Order                              /maintenance/work-orders
│   │   ├── Baru                                /maintenance/work-orders/new
│   │   └── Detail                              /maintenance/work-orders/[id]
│   ├── Kalender Jadwal                         /maintenance/calendar
│   └── Perubahan Jadwal (Anomali)              /maintenance/schedule-changes
├── 🚨 Emergensi                                /emergency
│   ├── Lapor Darurat (Pengemudi)               /emergency/report
│   ├── Insiden                                 /emergency/incidents
│   │   └── Detail Insiden                      /emergency/incidents/[id]
│   ├── Kontak Darurat                          /emergency/contacts
│   └── Langkah Cepat (Playbook)                /emergency/playbooks
├── ✅ Approval                                 /approvals
│   ├── Kotak Masuk                             /approvals/inbox
│   ├── Semua Antrean (Pusat)                   /approvals/all
│   └── Riwayat                                 /approvals/history
├── 📑 Laporan                                  /reports
│   └── Penampil Laporan                        /reports/[code]
└── ⚙️ Administrasi                             /admin
    ├── User                                    /admin/users
    ├── Role & Permission                       /admin/roles
    ├── Alur Approval                           /admin/approval-flows
    ├── Parameter Sistem                        /admin/parameters
    ├── Audit Log                               /admin/audit-logs
    └── Log Notifikasi                          /admin/notifications
```

**Hitungan: 8 menu utama · 42 halaman · 4 titik approval** (mutasi sparepart, penyesuaian opname, perubahan jadwal, validasi WO emergensi).

Rincian halaman: Autentikasi 3 · Dashboard 1 · Master 7 · Inventori 9 · Perawatan 6 · Emergensi 5 · Approval 3 · Laporan 2 · Administrasi 6 = **42**.

> Form tambah/ubah master memakai dialog/drawer di halaman daftar, tidak dihitung sebagai halaman terpisah.

### Menu × Role

C = Create · R = Read · U = Update · D = Nonaktif/Batal · A = Approve · — = tidak terlihat

| Menu | DRIVER | MECHANIC | WAREHOUSE | SUPERVISOR | DEPT_HEAD | HQ_ADMIN | SYS_ADMIN |
|---|---|---|---|---|---|---|---|
| Dashboard | R (ringkas) | R (ringkas) | R | R | R | R (semua cabang) | R |
| Master Data | — | R | R (sparepart, lokasi) | R | R | R | CRUD |
| Mutasi Sparepart | — | C, R (OUT untuk WO sendiri) | C, R, U, D | R | R, A | R, A | — |
| Saldo/Kartu Stok | — | R | R | R | R | R | R |
| Stock Opname | — | — | C, R, U, D | R | R, A | R, A | — |
| Rencana Perawatan | — | R | R | C, R, U, D | R | C, R, U, D | — |
| Work Order | R (kendaraannya) | R, U (status) | R | C, R, U, D | R | C, R, U, D | — |
| Kalender Jadwal | R (kendaraannya) | R | R | R | R | R | — |
| Perubahan Jadwal | — | R | — | C, R | R, A | R, A | — |
| Lapor Darurat | C, R | C, R | C, R | C, R | C, R | C, R | — |
| Insiden | R (miliknya) | R | R | R, U | R | CRUD | — |
| Kontak/Playbook | R | R | R | R | R | CRUD | — |
| Approval Inbox | — | — | — | A | A | A | — |
| Semua Antrean | — | — | — | — | — | R, A, Override | — |
| Laporan | — | R (terbatas) | R (stok) | R | R | R | R |
| Administrasi | — | — | — | — | — | Audit Log (R) | CRUD |

---

# 0. 👥 Role & Kewenangan per Modul

## 0.1 Daftar role ⚠️ ASUMSI (A-2)

| Role | Wewenang inti | Yang TIDAK boleh |
|---|---|---|
| DRIVER | Lapor darurat, melihat langkah cepat dan kontak, melihat WO kendaraannya | Melihat stok, menyetujui apa pun, mengubah jadwal |
| MECHANIC | Menjalankan WO, membuat mutasi OUT untuk WO miliknya, melapor temuan | Menyetujui, mengubah master, mengubah jadwal |
| WAREHOUSE | Mutasi masuk/keluar/retur/transfer, stock opname | Menyetujui dokumen yang ia buat, mengubah jadwal |
| SUPERVISOR | Approval level 1, menyusun jadwal dan rencana, mengajukan perubahan jadwal | Menyetujui dokumen yang ia ajukan sendiri |
| DEPT_HEAD | Approval level lanjut (sesuai departemen) | Mengubah master, mengatur alur approval |
| HQ_ADMIN | Pengawasan lintas cabang, approval akhir, override, menangani insiden, mengelola kontak dan playbook | Mengatur user/role, mengubah alur approval |
| SYS_ADMIN | Master data, user, role, alur approval, parameter | Menyetujui transaksi, membuat transaksi operasional |

## 0.2 Matriks permission

Role hanyalah pengelompokan. Backend memeriksa **permission**. ✔ = diberikan secara default.

| Permission | DRV | MEK | WH | SPV | DEPT | HQ | SYS |
|---|---|---|---|---|---|---|---|
| `master.read` |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `master.write` |  |  |  |  |  |  | ✔ |
| `stock.read` |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `stock.create` |  | ✔* | ✔ |  |  |  |  |
| `stock.cancel` |  |  | ✔ |  |  |  |  |
| `count.create` / `count.enter` |  |  | ✔ |  |  |  |  |
| `plan.write` |  |  |  | ✔ |  | ✔ |  |
| `wo.read` | ✔** | ✔ | ✔ | ✔ | ✔ | ✔ |  |
| `wo.write` |  |  |  | ✔ |  | ✔ |  |
| `wo.execute` |  | ✔ |  | ✔ |  |  |  |
| `schedule.request` |  |  |  | ✔ |  | ✔ |  |
| `incident.report` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |
| `incident.handle` |  |  |  | ✔ |  | ✔ |  |
| `contact.manage` |  |  |  |  |  | ✔ |  |
| `approval.act` |  |  |  | ✔ | ✔ | ✔ |  |
| `approval.viewall` |  |  |  |  |  | ✔ |  |
| `approval.override` |  |  |  |  |  | ✔ |  |
| `report.view` |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `report.export` |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |
| `admin.user` / `admin.role` / `admin.flow` / `admin.param` |  |  |  |  |  |  | ✔ |
| `audit.view` |  |  |  |  |  | ✔ | ✔ |

\* hanya tipe OUT untuk WO yang ditugaskan kepadanya · \*\* hanya kendaraan yang ditugaskan.

Data dibatasi **`branch_id`** kecuali HQ_ADMIN. Pemeriksaan di layer backend; menyembunyikan tombol hanyalah UX.

## 0.3 Rincian per modul: siapa bisa apa

| Modul | Aksi → role yang boleh |
|---|---|
| Mutasi | Buat/ubah draft → WAREHOUSE, MECHANIC (OUT) · Ajukan → pembuat · Approve/Reject/Revisi → SPV → DEPT (sesuai alur) · Batalkan draft → WAREHOUSE · Buat pembalik → WAREHOUSE |
| Opname | Buka sesi, hitung, ajukan → WAREHOUSE · Approve selisih → SPV/DEPT/HQ sesuai ambang |
| Jadwal | Buat rencana & WO → SPV, HQ · Mulai/selesaikan WO → MECHANIC, SPV · Ajukan perubahan jadwal → SPV, HQ |
| Emergensi | Lapor → semua role login · Acknowledge/tindak lanjut → SPV, HQ · Kelola kontak & playbook → HQ |
| Approval | Lihat inbox → role approver · Lihat semua → HQ · Override → HQ (catatan wajib) |

## 0.4 Bila satu orang memegang dua role

Aturan **Segregation of Duties** diperiksa **per record**: `approved_by ≠ created_by`. Seseorang yang memegang role WAREHOUSE dan SUPERVISOR tetap tidak dapat menyetujui mutasi yang ia buat sendiri. Pemeriksaan per role tidak cukup, karena konfigurasi role bisa berubah. ⚠️ ASUMSI (F-3)

---

# 1. 📊 Dashboard

**Rute**: `/` · **Permission**: login

## 1.1 Prinsip

Satu dashboard, isi widget menyesuaikan role dan cabang. HQ_ADMIN melihat lintas cabang dengan filter cabang. ⚠️ ASUMSI

## 1.2 Daftar widget

| Kode | Widget | Isi | Sumber angka |
|---|---|---|---|
| W1 | Insiden Emergensi Aktif | Daftar insiden berstatus bukan Closed, beserta waktu sejak dilaporkan; merah bila belum di-ACK | `incidents` |
| W2 | Antrean Approval Saya | Jumlah dan 5 teratas dokumen menunggu keputusan saya; penanda terlambat SLA | `approval_requests` |
| W3 | Semua Antrean Approval | Jumlah per jenis dokumen, per cabang, yang terlambat SLA | `approval_requests` |
| W4 | WO Hari Ini & Minggu Ini | Jumlah terjadwal, berjalan, selesai | `work_orders` |
| W5 | WO Overdue | Kendaraan melewati jatuh tempo, urut keterlambatan | `work_orders.is_overdue` |
| W6 | Perawatan Jatuh Tempo ≤ 7 hari | Daftar plan yang segera jatuh tempo | `maintenance_plans` |
| W7 | Stok Kritis | Sparepart `qty_on_hand < min_stock` | `stock_balances` |
| W8 | Anomali Jadwal 30 Hari | Jumlah percepatan/penundaan, 3 alasan teratas | `schedule_changes` |
| W9 | Validasi Pasca-Kejadian | WO emergensi yang belum divalidasi, hitung mundur 24 jam | `work_orders` |
| W10 | Status Armada | Aktif / dalam perawatan / tidak beroperasi | `vehicles` |
| W11 | Tugas Saya | WO yang ditugaskan, jadwal terdekat | `work_orders` |
| W12 | Tombol Darurat | Tombol besar menuju Lapor Darurat | — |

## 1.3 Widget × Role

| Widget | DRV | MEK | WH | SPV | DEPT | HQ | SYS | Alasan |
|---|---|---|---|---|---|---|---|---|
| W1 | ✔ (miliknya) | | | ✔ | | ✔ | | Pusat harus melihat semua; pengemudi hanya laporannya |
| W2 | | | | ✔ | ✔ | ✔ | | Hanya approver |
| W3 | | | | | | ✔ | | Kontrol pusat |
| W4 | | | | ✔ | ✔ | ✔ | | |
| W5 | | | | ✔ | ✔ | ✔ | | |
| W6 | | | | ✔ | | ✔ | | |
| W7 | | | ✔ | ✔ | ✔ | ✔ | ✔ | |
| W8 | | | | ✔ | ✔ | ✔ | | |
| W9 | | | | | ✔ | ✔ | | |
| W10 | | | | ✔ | ✔ | ✔ | ✔ | |
| W11 | ✔ (kendaraannya) | ✔ | | | | | | |
| W12 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | | Semua yang bisa melapor |

## 1.4 Perilaku umum

- Tiap widget dapat diklik menuju daftar terfilter (drilldown).
- Penyegaran otomatis tiap 60 detik untuk W1 dan W2; lainnya manual.
- Widget kosong menampilkan teks "Tidak ada data", bukan angka 0 polos.

## 1.5 Lima sudut pandang

| ① List | ② Sync | ③ Create/Edit | ④ Detail + Approval | ⑤ Delete |
|---|---|---|---|---|
| — tidak ada — (drilldown ke daftar modul lain) | — tidak ada — | — tidak ada — | — tidak ada — | — tidak ada — |

---

# 2. 📁 Master Data

Semua master memakai pola yang sama; yang berbeda hanya kolom dan field. Untuk menghindari pengulangan, pola dasar ditulis sekali, lalu rincian tiap master.

## 2.0 Pola dasar master ⚠️ ASUMSI

**② Sync**: **— tidak ada —**. Tidak ada sistem sumber; semua diinput di aplikasi ini (keputusan #2).

**④ Detail + Approval**: **Approval — tidak ada —**. Master tidak melewati persetujuan; perubahan langsung berlaku dan tercatat di Audit Log. Detail dibuka sebagai drawer (kecuali Kendaraan: halaman penuh).

**⑤ Delete**:

| Aksi | Tersedia? | Keterangan |
|---|---|---|
| Hapus fisik | ❌ **TIDAK ADA** | `DELETE` sengaja `404`. Data historis harus utuh. |
| **Nonaktifkan** | ✅ Ada | `is_active = false`. Tidak muncul pada pilihan form baru, tetap tampil di riwayat. |
| Aktifkan kembali | ✅ Ada | Hanya SYS_ADMIN |
| Nonaktifkan yang masih dipakai | Tombol disabled + tooltip menyebut jumlah dokumen aktif yang memakai | |

**① List (umum)**: pencarian debounce 300 ms · filter status (Aktif/Nonaktif/Semua, default Aktif) · sort semua kolom · paging server-side 50/halaman · filter tersimpan di URL · Export Excel (`report.export`). Batch action: **— tidak ada —** kecuali Upload Excel di Sparepart dan Kendaraan.

**③ Create/Edit (umum)**: form dalam dialog/drawer · kolom bertanda * wajib · kode unik (cek real-time) · `If-Match`/rowVersion untuk mencegah timpa-menimpa.

## 2.1 Cabang

**Rute**: `/master/branches` · **Permission**: `master.read` / `master.write`

| ① List kolom | Kode · Nama · Pusat? (`is_hq`) · Jumlah kendaraan · Jumlah gudang · Status |
|---|---|
| ③ Field | Kode * · Nama * · Penanda Pusat (hanya boleh ada **satu** cabang pusat) · Alamat · Telepon |
| Validasi | Hanya satu `is_hq = true`; kode tidak dapat diubah setelah dipakai transaksi |

## 2.2 Kendaraan

**Rute**: `/master/vehicles`, `/master/vehicles/[id]`

| ① List kolom | No. Polisi · Tipe · Model · Tahun · Cabang · Odometer · Status (Aktif / Dalam Perawatan / Tidak Beroperasi) · Aksi |
|---|---|
| Filter | Cabang · Tipe · Status |
| Batch | Upload Excel (template: no. polisi, tipe, model, tahun, cabang, odometer awal) → Pratinjau → Konfirmasi |

**③ Field**: No. Polisi * (unik) · Tipe * · Model · Tahun · Cabang * · Odometer * · Status · Pengemudi utama (opsional) · Catatan.
- **Update odometer** adalah aksi tersendiri (dialog kecil): nilai baru harus ≥ nilai lama; riwayat disimpan. ⚠️ ASUMSI D-2
- Status "Dalam Perawatan" diatur otomatis oleh WO (mulai/selesai), tidak diedit manual.

**④ Detail (halaman penuh), tab:**

| Tab | Isi |
|---|---|
| Ringkasan | Identitas, odometer terakhir, status |
| Rencana Perawatan | Plan aktif beserta jatuh tempo berikutnya |
| Work Order | Riwayat WO |
| Pemakaian Sparepart | Mutasi OUT untuk kendaraan ini |
| Insiden | Riwayat emergensi |
| Riwayat Odometer & Perubahan | Log |

## 2.3 Sparepart

**Rute**: `/master/spareparts`

| ① List kolom | Kode · Nama · Kategori · Satuan · Stok Min · Total Stok (semua lokasi) · Status |
|---|---|
| Filter | Kategori · Status · "Di bawah stok minimum" |
| Batch | Upload Excel (template: kode, nama, kategori, satuan, stok min) |

**③ Field**: Kode * (unik) · Nama * · Kategori * · Satuan * · Stok Minimum · Deskripsi · Foto.
- Satuan tidak dapat diubah setelah ada mutasi.
- Saldo awal **tidak** diisi di sini; masuk lewat mutasi tipe Masuk atau penyesuaian opname.

## 2.4 Lokasi / Gudang

**Rute**: `/master/locations`

| ① List kolom | Kode · Nama · Cabang · Jumlah item · Status |
|---|---|
| ③ Field | Kode * · Nama * · Cabang * · Keterangan |
| Syarat nonaktif | Saldo stok semua sparepart di lokasi ini harus 0 |

## 2.5 Vendor / Bengkel

**Rute**: `/master/vendors`

| ① List kolom | Nama · Tipe (Bengkel / Derek / Asuransi / Supplier) · Telepon · Wilayah · Status |
|---|---|
| ③ Field | Nama * · Tipe * · Telepon * · Alamat · Wilayah · Kontak PIC |
| Catatan | Vendor tipe Derek dan Asuransi dapat dipakai sebagai sumber kontak darurat (§5.4) |

## 2.6 Kategori Alasan

**Rute**: `/master/reason-codes`

| ① List kolom | Kode · Nama · Dipakai untuk (Perubahan Jadwal / Selisih Opname / Reject) · Wajib Keterangan? · Status |
|---|---|
| ③ Field | Kode * · Nama * · Dipakai untuk * · Wajib keterangan teks (centang) |
| Isi awal | Kendaraan masih beroperasi · Sparepart belum tersedia · Kerusakan mendadak · Permintaan operasional · Cuaca/kondisi jalan · Bengkel penuh · Lainnya (wajib keterangan) ⚠️ ASUMSI E-1 |
| Nonaktif | Boleh; alasan lama tetap tampil di riwayat |

---

# 3. 📦 Inventori Sparepart

## 3.1 Mutasi Sparepart ✅ TERKONFIRMASI (R1: keluar-masuk sparepart)

**Rute**: `/inventory/movements`, `/new`, `/[id]` · **Permission**: `stock.read` / `stock.create` / `stock.cancel`

> ⚠️ **Baca sebelum coding.** Stok **hanya berubah saat dokumen berstatus POSTED** (B-3). Dokumen POSTED tidak bisa diubah atau dihapus; koreksi memakai pembalik. Jangan menulis ke `stock_balances` dari tempat lain selain proses Posting.

### ① List

| Kolom | Catatan |
|---|---|
| No. Dokumen | Format `{PREFIX}-{CABANG}-{YYYYMM}-{urut}` |
| Tanggal | |
| Tipe | Masuk / Keluar / Retur / Transfer / Penyesuaian |
| Kendaraan | Untuk tipe Keluar |
| No. WO | Bila ada |
| Lokasi | Asal → tujuan |
| Jumlah Item | |
| Status | Draft · Diajukan · Disetujui · Diposting · Ditolak · Dibatalkan |
| Dibuat Oleh · Aksi | |

| Elemen | Perilaku |
|---|---|
| 🔍 Pencarian | No. dokumen, kode/nama sparepart, no. polisi |
| Filter | Tipe · Status · Rentang tanggal · Cabang · Lokasi · Kendaraan · Pembuat |
| Sort | Semua kolom, default Tanggal terbaru |
| Export | ✅ Excel/PDF (cetak form kartu mutasi) |
| Batch | **— tidak ada —** (setiap dokumen punya alur approval sendiri) |

### ② Sync — tidak ada
Tidak ada integrasi ERP/gudang lain (keputusan #2).

### ③ Create / Edit / Upload

**Tombol** `[+ Mutasi Baru]` → pilih tipe terlebih dulu, form menyesuaikan.

| Grup | Field | Aturan |
|---|---|---|
| Header | No. Dokumen (otomatis, read-only) · Tanggal * (default hari ini) · Tipe * | |
| Konteks | Kendaraan (wajib bila Keluar tanpa WO) · No. WO (pilih WO aktif; mengisi kendaraan otomatis) | Keluar: **kendaraan atau WO wajib** |
| Lokasi | Dari lokasi (Keluar/Transfer) · Ke lokasi (Masuk/Retur/Transfer) | Transfer: lokasi asal ≠ tujuan |
| Item | Sparepart * · Qty * · Satuan (read-only) · Stok tersedia (read-only) · Catatan | Qty > 0; Keluar/Transfer: qty ≤ tersedia (tersedia = on hand − reservasi) |
| Lampiran | Foto/dokumen (maks 5, ≤ 5 MB) | |
| Catatan | Teks bebas | |

**Sketsa layar (Mutasi Keluar):**

```
┌ Mutasi Baru — KELUAR ─────────────────────────────────────┐
│ No: (otomatis)   Tanggal: [24/10/2026]   Cabang: Jakarta   │
│ Kendaraan: [B 1234 XY ▾]   No. WO: [WO-JKT-202610-0012 ▾]  │
│ Dari Lokasi: [Gudang Utama ▾]                              │
│ ┌ Item ───────────────────────────────────────────────┐   │
│ │ Sparepart        Tersedia  Qty   Satuan  Catatan  ✕ │   │
│ │ Filter Oli X-12     14     [2]   pcs     [      ]   │   │
│ │ + Tambah Item                                       │   │
│ └─────────────────────────────────────────────────────┘   │
│ Lampiran: [📎 Tambah]                                      │
│           [Simpan Draft]   [Ajukan untuk Approval]         │
└────────────────────────────────────────────────────────────┘
```

| Aksi | Aturan |
|---|---|
| Simpan Draft | Validasi ringan |
| Ajukan | Validasi penuh; status → Diajukan; approval dibuat; dokumen **terkunci** |
| Edit | Hanya saat Draft atau Revisi |
| Upload Excel | **— tidak ada —**. Satu dokumen = satu kejadian fisik; unggah massal menghindari verifikasi. Saldo awal lewat Mutasi Masuk. ⚠️ ASUMSI |

Galat menyebut angka: "Filter Oli X-12: diminta 20, tersedia 14 di Gudang Utama".

### ④ View Detail + Approval

**Isi detail:** header · daftar item · lampiran · **Kartu Stok terkait** (saldo sebelum/sesudah, setelah Posted) · tab **Log Approval**.

**Mekanisme workflow:**

```
 DRAFT ──► DIAJUKAN ──► DISETUJUI ──► DIPOSTING
   ▲           │  │
   └─ REVISI ◄─┘  └──► DITOLAK
 (DRAFT/DIAJUKAN) ──► DIBATALKAN
```

| Aksi | Siapa | Aturan |
|---|---|---|
| ✅ Approve | Approver sesuai level (SPV → DEPT …) | Pengaju ≠ approver (per record) |
| ❌ Reject | Approver | **Alasan wajib** |
| 📝 Revise with notes | Approver | Kembali ke Draft + catatan |
| 🔄 Override | HQ_ADMIN | Catatan wajib, tercatat `OVERRIDE` |

Setelah Approve level terakhir, sistem **otomatis memposting** (transaksi atomik, lihat [TECHNICAL_LOGIC.md](TECHNICAL_LOGIC.md) §4.1). Bila stok tidak cukup saat posting, dokumen kembali ke Diajukan dengan pesan galat, dan pembuat serta approver diberi tahu.

**Log approval** (permanen): status sebelum → sesudah · oleh (nama & role) · waktu · catatan.

**Aksi lain di detail:** `[Cetak Form]` · `[Buat Pembalik]` (hanya untuk Diposting).

Role lain yang tidak berhak melihat tombol keputusan hanya melihat status dan log.

### ⑤ Delete

| Aksi | Tersedia? | Keterangan |
|---|---|---|
| Hapus fisik | ❌ **TIDAK ADA** | Semua jejak harus utuh |
| **Batalkan** | ✅ | Hanya Draft/Diajukan; alasan wajib |
| **Buat Pembalik** | ✅ | Untuk Diposting: membuat dokumen baru berisi baris berlawanan, merujuk dokumen asal, melalui approval yang sama |
| Edit Diposting | ❌ | Immutable |

## 3.2 Saldo Stok

**Rute**: `/inventory/balances` · **Permission**: `stock.read`

### ① List

| Kolom | Catatan |
|---|---|
| Kode · Nama Sparepart · Kategori | |
| Lokasi | Satu baris per sparepart per lokasi |
| On Hand | |
| Reservasi | Dipesan WO terjadwal ⚠️ ASUMSI B-5 |
| Tersedia | On hand − reservasi |
| Stok Min · Status | 🔴 di bawah minimum · 🟢 aman |

Filter: Cabang · Lokasi · Kategori · "Di bawah minimum". Export Excel. Klik baris → Kartu Stok sparepart.

### ② Sync — tidak ada
### ③ Create / Edit — tidak ada
Saldo adalah hasil turunan dari mutasi. Mengedit langsung akan merusak ledger; saldo hanya berubah lewat Posting.
### ④ Detail + Approval — tidak ada
Drilldown ke Kartu Stok. Approval: tidak ada.
### ⑤ Delete — tidak ada

## 3.3 Kartu Stok ✅ TERKONFIRMASI (R1: "card")

**Rute**: `/inventory/stock-cards`, `/inventory/stock-cards/[sparepartId]`

> ⚠️ **Tafsir "card"**: ditafsirkan sebagai tampilan digital kartu stok (B-2). Bila ternyata kartu fisik berbarcode/QR, perlu menu Cetak Label dan pemindaian. 🔒 MENUNGGU konfirmasi.

### ① List
Daftar sparepart (kode, nama, saldo total). Pencarian dan filter kategori. Klik → kartu.

**Kartu per sparepart:**

| Kolom | Catatan |
|---|---|
| Tanggal Posting | |
| No. Dokumen | Tautan ke mutasi |
| Tipe | Masuk / Keluar / Retur / Transfer / Penyesuaian |
| Lokasi | |
| Masuk (+) · Keluar (−) | |
| **Saldo** | `balance_after` dari `stock_movements` |
| Kendaraan / WO | |
| Oleh | |

Filter: lokasi · rentang tanggal · tipe. Export Excel/PDF dalam bentuk kartu stok (cetak). Baris total dihitung dari record, bukan rentang sel.

### ② Sync — tidak ada
### ③ Create / Edit — tidak ada (dibaca dari ledger append-only)
### ④ Detail + Approval — tidak ada
### ⑤ Delete — tidak ada (immutable)

## 3.4 Stock Opname ✅ TERKONFIRMASI (R2)

**Rute**: `/inventory/counts`, `/new`, `/[id]` · **Permission**: `count.create`, `count.enter`

### ① List

| Kolom | Catatan |
|---|---|
| No. Opname | |
| Lokasi | |
| Tipe | Berkala / Ad-hoc |
| Tanggal Buka · Tanggal Selesai | |
| Jumlah Item · Item Selisih | |
| Status | Terbuka · Penghitungan · Review · Disetujui · Disesuaikan · Dibatalkan |

Filter: lokasi · tipe · status · tanggal. Pencarian: no. opname. Export Excel. Batch: **— tidak ada —**.

### ② Sync — tidak ada

### ③ Create / Edit / Upload

| Langkah | Isi |
|---|---|
| 1. Buka sesi | Pilih lokasi * · tipe * · (opsional) kategori tertentu · catatan. Sistem mengambil **snapshot** `system_qty` |
| 2. Hitung | Input `counted_qty` per item. Dukung input dari mobile; simpan per baris (otomatis) |
| 3. Review | Sistem menghitung selisih; item selisih wajib **alasan** (dari Kategori Alasan) + catatan |
| 4. Ajukan | Masuk approval |

**Sketsa layar penghitungan:**

```
┌ Opname OPN-JKT-202610-0003 — Gudang Utama — COUNTING ─────┐
│ 🔍 [cari]   Filter: [Semua ▾]  Progress: 38/120 terhitung  │
│ Sparepart        Sistem   Fisik   Selisih  Alasan          │
│ Filter Oli X-12    14     [14]      0                      │
│ Kampas Rem A       10     [ 8]     −2     [Rusak ▾]        │
│ Aki 12V             6     [  ]      —                      │
│            [Simpan]            [Ajukan Review]             │
└────────────────────────────────────────────────────────────┘
```

| Aturan | Isi |
|---|---|
| Item belum dihitung | Tidak boleh submit; atau tandai "tidak dihitung" dengan alasan ⚠️ ASUMSI |
| Pembekuan | Dua mode: bekukan mutasi di lokasi, atau terima mutasi lalu hitung ulang selisih saat review. Dipilih lewat Parameter Sistem. 🔒 MENUNGGU (C-2) |
| Upload Excel | ✅ Ada: unduh template (kode, nama, sistem) → isi kolom fisik → unggah → pratinjau selisih → konfirmasi. Untuk gudang besar. ⚠️ ASUMSI |

### ④ View Detail + Approval

**Isi detail:** header · tabel item (sistem, fisik, selisih, alasan) · ringkasan (item sesuai / lebih / kurang) · lampiran foto · tab Log Approval.

```
 TERBUKA ─► PENGHITUNGAN ─► REVIEW ─► (approval) ─► DISETUJUI ─► DISESUAIKAN
                  ▲                        │
                  └──────── DITOLAK ◄──────┘
```

| Aksi | Siapa | Aturan |
|---|---|---|
| Approve | SPV/DEPT/HQ sesuai ambang | Ambang berdasarkan total selisih absolut ⚠️ ASUMSI |
| Reject | Approver | Alasan wajib; kembali ke Penghitungan (hitung ulang) |
| Revise with notes | Approver | Kembali ke Penghitungan |

Setelah Disetujui, sistem membuat **Mutasi tipe Penyesuaian** dan memostingnya otomatis; opname → Disesuaikan. Pengaju tidak boleh menyetujui.

### ⑤ Delete

| Aksi | Tersedia? |
|---|---|
| Hapus fisik | ❌ TIDAK ADA |
| **Batalkan sesi** | ✅ Selama belum Disetujui; alasan wajib |
| Koreksi setelah Disesuaikan | Lewat Mutasi Pembalik pada dokumen Penyesuaian |

---

# 4. 🔧 Perawatan & Penjadwalan

## 4.1 Rencana Perawatan ✅ TERKONFIRMASI (R3: schedule perawatan)

**Rute**: `/maintenance/plans` · **Permission**: `plan.write`

### ① List

| Kolom | Catatan |
|---|---|
| Kendaraan | |
| Nama Tugas (mis. Ganti oli) | |
| Interval Hari · Interval KM | Salah satu atau keduanya |
| Terakhir Dilakukan (tanggal/km) | |
| Jatuh Tempo Berikutnya (tanggal/km) | |
| Sisa | "5 hari / 320 km" |
| Status | Aman · Mendekati (≤ lead time) · Jatuh Tempo · Nonaktif |

Filter: cabang · kendaraan · status jatuh tempo · tugas. Sort default: terdekat jatuh tempo. Export Excel.

### ② Sync — tidak ada
Odometer diinput manual (D-2). Tidak ada tarikan GPS.

### ③ Create / Edit / Upload

| Field | Aturan |
|---|---|
| Kendaraan * | Boleh multi-pilih (buat plan sama untuk banyak kendaraan) |
| Nama Tugas * | |
| Interval Hari / Interval KM | **Minimal satu terisi** |
| Terakhir dilakukan (tanggal & km) | Titik awal perhitungan jatuh tempo |
| Bengkel/lokasi default | |
| Daftar sparepart standar | Dipakai membentuk kebutuhan part pada WO |
| Lead time | Default dari Parameter Sistem (7 hari / 500 km) |

Upload Excel: ✅ Ada untuk onboarding armada besar (template: no. polisi, tugas, interval, terakhir). ⚠️ ASUMSI

### ④ View Detail + Approval
Detail: aturan interval · riwayat pelaksanaan (WO terkait) · WO aktif saat ini. **Approval: — tidak ada —** (rencana adalah konfigurasi; perubahan tercatat di Audit Log).

Aturan: satu plan hanya boleh punya **satu WO aktif**. ⚠️ ASUMSI D-7

### ⑤ Delete

| Aksi | Tersedia? |
|---|---|
| Hapus fisik | ❌ TIDAK ADA |
| **Nonaktifkan** | ✅ WO aktif tidak ikut terhapus; harus dibatalkan terpisah |

## 4.2 Work Order ✅ TERKONFIRMASI (R3: perawatan dan perbaikan, termasuk emergensi)

**Rute**: `/maintenance/work-orders`, `/new`, `/[id]`

### ① List

| Kolom | Catatan |
|---|---|
| No. WO | |
| Kendaraan | |
| Jenis | Preventif · Korektif · **Emergensi** (badge merah) |
| Prioritas | |
| Jadwal Mulai–Selesai | |
| Bengkel / Teknisi | |
| Status | Planned · Scheduled · In Progress · Completed · Cancelled |
| ⏰ Overdue | Penanda merah |
| ⚠️ Berubah Jadwal | Penanda bila pernah ada perubahan |

Filter: cabang · kendaraan · jenis · status · rentang tanggal · teknisi · bengkel · overdue. Pencarian: no. WO / no. polisi. Export Excel. Batch: **— tidak ada —**.

### ② Sync — tidak ada
WO preventif dibuat oleh **job internal harian** (bukan sinkronisasi eksternal); tampil dengan label "Dibuat otomatis".

### ③ Create / Edit

**Tombol** `[+ WO Baru]` (SPV/HQ). WO Preventif juga dibuat otomatis dari Rencana Perawatan.

| Grup | Field | Aturan |
|---|---|---|
| Identitas | No. WO (otomatis) · Jenis * · Prioritas * · Kendaraan * | Jenis Emergensi: prioritas otomatis tertinggi, tidak dapat diubah |
| Jadwal | Mulai * · Selesai * · Bengkel/lokasi · Teknisi/bay | Deteksi bentrok kendaraan dan teknisi |
| Sumber | Plan (preventif) · Insiden (emergensi) · Laporan temuan (korektif) | Read-only bila terisi |
| Kebutuhan part | Sparepart * · Qty rencana | Membuat **reservasi** |
| Deskripsi | Keluhan / pekerjaan | |

**Peringatan bentrok:** "Kendaraan B 1234 XY sudah dijadwalkan pada 25/10 08:00–12:00 (WO-JKT-…)".
- Jenis biasa: bentrok **diblokir**.
- Jenis Emergensi: bentrok **diperingatkan, tidak diblokir**; WO yang terdampak ditandai "Perlu dijadwal ulang" dan masuk Perubahan Jadwal. ⚠️ ASUMSI D-5

Edit jadwal pada WO Scheduled **tidak** langsung mengubah; harus lewat **Ajukan Perubahan Jadwal** (§4.4) agar alasan tercatat. Field lain boleh diedit selama belum In Progress.

### ④ View Detail + Approval

Tab: **Ringkasan** · **Sparepart** (rencana vs terpakai, tautan ke Mutasi) · **Jadwal & Anomali** (riwayat perubahan, alasan) · **Insiden** (bila emergensi) · **Log Aktivitas**.

| Aksi | Siapa | Efek |
|---|---|---|
| `[Mulai]` | MECHANIC/SPV | Status In Progress; kendaraan → Dalam Perawatan; mencatat `actual_start` |
| `[Pakai Sparepart]` | MECHANIC | Membuka form Mutasi Keluar terisi dari WO |
| `[Selesai]` | MECHANIC/SPV | Isi odometer akhir · catatan; kendaraan → Aktif; plan diperbarui (`last_done`, `next_due`) |
| `[Ajukan Perubahan Jadwal]` | SPV/HQ | Lihat §4.4 |
| `[Batalkan]` | SPV/HQ | Alasan wajib; reservasi dilepas |

**Approval pada WO:**

| Jenis WO | Approval |
|---|---|
| Preventif / Korektif | **— tidak ada —** pada WO itu sendiri. Kontrol ada pada mutasi part dan perubahan jadwal. |
| **Emergensi** | **Validasi pasca-kejadian** dalam ±24 jam. Dapat dikerjakan lebih dulu. ✅ Approve / ❌ Reject (alasan wajib) / 📝 Revise. Bila terlambat, eskalasi ke HQ dan W9 menyala. ⚠️ ASUMSI D-4 |

Pemakaian part pada WO Emergensi tetap lewat Mutasi; approval dipercepat atau auto-approve + review pasca-kejadian. 🔒 MENUNGGU (D-6)

### ⑤ Delete

| Aksi | Tersedia? |
|---|---|
| Hapus fisik | ❌ TIDAK ADA |
| **Batalkan** | ✅ Selama belum Completed; bila ada part terpakai, harus dikembalikan via Mutasi Retur lebih dulu |
| Completed | Tidak dapat dibatalkan |

## 4.3 Kalender Jadwal ✅ TERKONFIRMASI (R3)

**Rute**: `/maintenance/calendar`

### ① List (tampilan kalender)

| Elemen | Perilaku |
|---|---|
| Tampilan | Bulan · Minggu · Hari · **Agenda** (daftar) |
| Pengelompokan | Per kendaraan atau per bengkel/teknisi (gantt sederhana) |
| Warna | Preventif (biru) · Korektif (kuning) · **Emergensi (merah)** · Overdue (garis merah) |
| Filter | Cabang · kendaraan · bengkel · jenis · status |
| Klik acara | Membuka Detail WO (drawer) |
| Drag & drop | Memindah WO membuka dialog **Ajukan Perubahan Jadwal** (alasan wajib), bukan langsung berpindah ⚠️ ASUMSI |

Export: PDF jadwal mingguan (cetak untuk bengkel).

### ② Sync — tidak ada
### ③ Create / Edit — tidak ada
Layar ini tampilan. Pembuatan lewat Work Order; perubahan lewat Perubahan Jadwal.
### ④ Detail + Approval — tidak ada (mengarah ke Detail WO)
### ⑤ Delete — tidak ada

## 4.4 Perubahan Jadwal (Anomali) ✅ TERKONFIRMASI (R4)

**Rute**: `/maintenance/schedule-changes` · **Permission**: `schedule.request` untuk ajukan, `approval.act` untuk memutuskan

> ⚠️ Aturan inti: setiap percepatan maupun penundaan **wajib** punya kategori alasan. Layar ini adalah daftar sekaligus laporan anomali. Jangan membuat jalan pintas yang mengubah jadwal WO tanpa melewati layar ini.

### ① List

| Kolom | Catatan |
|---|---|
| No. Perubahan | |
| WO · Kendaraan | |
| Tipe | 🔼 Percepatan · 🔽 Penundaan |
| Jadwal Lama → Baru | |
| Selisih | "+3 hari 2 jam" |
| Alasan (kategori) | |
| Keterangan | Dipotong, penuh di detail |
| Diajukan Oleh · Tanggal | |
| Status | Diajukan · Disetujui · Ditolak · Revisi |
| Overdue? | Bila WO sudah melewati jatuh tempo saat diajukan |

Filter: tipe · alasan · status · cabang · kendaraan · rentang tanggal · pengaju. Export Excel. Ringkasan di atas tabel: jumlah percepatan, jumlah penundaan, rata-rata keterlambatan, 3 alasan teratas.

### ② Sync — tidak ada

### ③ Create / Edit

Dibuka dari Detail WO / drag-drop Kalender / tombol `[+ Ajukan Perubahan]`.

| Field | Aturan |
|---|---|
| WO * | Hanya WO Planned/Scheduled |
| Jadwal lama | Read-only |
| Jadwal baru (mulai/selesai) * | Harus berbeda dari lama; bentrok diperiksa |
| Tipe | **Otomatis** dari selisih (maju = Percepatan, mundur = Penundaan) |
| Kategori alasan * | Dari master Kategori Alasan |
| Keterangan | Wajib bila kategori "Lainnya" |
| Lampiran | Opsional |

Galat menyebut angka: "Penundaan 9 hari melebihi 7 hari; akan dieskalasi ke Admin Pusat".

### ④ View Detail + Approval ⭐

Isi: perbandingan jadwal lama/baru · alasan · riwayat perubahan WO sebelumnya · tab Log Approval.

```
 DIAJUKAN ─► DISETUJUI  (jadwal WO berlaku, notifikasi ke teknisi/bengkel/pengemudi)
     │ └───► DITOLAK    (jadwal tetap)
     └─ REVISI ─► DIAJUKAN
```

| Selisih jadwal | Level approval ⚠️ ASUMSI E-2 |
|---|---|
| ≤ 1 hari | SUPERVISOR |
| > 1 hari | + DEPT_HEAD |
| > 7 hari atau WO sudah overdue | + HQ_ADMIN |

Semua perubahan, termasuk percepatan, melewati approval (E-3). Pengaju ≠ approver. Reject wajib alasan.

### ⑤ Delete

| Aksi | Tersedia? |
|---|---|
| Hapus | ❌ TIDAK ADA (jejak anomali tidak boleh hilang) |
| **Tarik kembali** | ✅ Pengaju membatalkan pengajuan selama masih Diajukan |

---

# 5. 🚨 Emergensi

## 5.1 Lapor Darurat (Pengemudi) ✅ TERKONFIRMASI (R6)

**Rute**: `/emergency/report` · **Permission**: `incident.report`

> ⚠️ **Prinsip desain:** harus bisa diselesaikan dalam **≤ 2 langkah**, dengan tombol besar, tanpa field wajib selain kendaraan dan jenis kejadian. Dirancang untuk dipakai satu tangan di tengah masalah.

### ① List
Riwayat laporan milik pengguna (nomor, waktu, jenis, status). Daftar singkat di bawah tombol lapor.

### ② Sync — tidak ada
Lokasi diambil dari perangkat (GPS ponsel) saat izin diberikan. Itu bukan integrasi sistem.

### ③ Create

**Sketsa layar langkah 1:**

```
┌ 🚨 LAPOR DARURAT ──────────────────────────┐
│ Kendaraan: [B 1234 XY ▾]  (default: tugas)  │
│                                            │
│ [🔧 Mogok]      [💥 Kecelakaan]            │
│ [🛞 Ban]        [🔥 Kebakaran]             │
│ [🩺 Medis]      [❓ Lainnya]               │
│                                            │
│ 📍 Lokasi: terdeteksi (-6.20, 106.80)       │
└────────────────────────────────────────────┘
```

Satu ketukan pada jenis kejadian = **laporan terkirim**. Langkah 2 (opsional, setelah terkirim): foto, catatan suara/teks, jumlah korban.

**Layar setelah terkirim (langsung tampil, tanpa menunggu):**

```
┌ Laporan terkirim — INC-JKT-202610-0007 ────┐
│ Pusat sedang diberi tahu.                   │
│ ── LANGKAH CEPAT: Kendaraan Mogok ───────  │
│ 1. Nyalakan lampu hazard                    │
│ 2. Pasang segitiga pengaman                 │
│ 3. Keluar ke area aman                      │
│ 4. Tunggu arahan pusat                      │
│ ── KONTAK ───────────────────────────────  │
│ 📞 Control Tower Pusat      [Telepon]       │
│ 📞 Derek terdekat           [Telepon]       │
│ 📞 Atasan langsung          [Telepon]       │
└────────────────────────────────────────────┘
```

| Aturan | Isi |
|---|---|
| Kunci idempotensi | `Idempotency-Key` dari klien; kirim ulang tidak membuat insiden ganda |
| Offline | Laporan masuk antrean lokal dan dikirim ulang otomatis; layar langkah cepat dan kontak **tetap tampil dari cache**; tersedia tombol Telepon/SMS ke nomor pusat sebagai fallback ⚠️ ASUMSI G-6 |
| Validasi | Hanya kendaraan dan jenis kejadian wajib |

### ④ View Detail + Approval
Status laporan sendiri (Dilaporkan → Dikonfirmasi pusat → Ditangani → Selesai) beserta pesan tindak lanjut dari pusat. **Approval: — tidak ada —** (insiden bukan dokumen persetujuan).

### ⑤ Delete — tidak ada
Laporan tidak dapat dihapus. Salah lapor ditandai "Laporan keliru" oleh pusat, bukan dihapus.

## 5.2 Insiden (Sisi Pusat) ✅ TERKONFIRMASI (R6)

**Rute**: `/emergency/incidents`, `/[id]` · **Permission**: `incident.handle`

### ① List

| Kolom | Catatan |
|---|---|
| No. Insiden | |
| Waktu Lapor · Sejak (durasi) | Merah bila belum ACK > 5 menit |
| Kendaraan · Pengemudi · Cabang | |
| Jenis | |
| Lokasi | Alamat singkat + tautan peta |
| Status | Reported · Acknowledged · In Handling · Resolved · Closed |
| Ditangani Oleh | |

Filter: status (default: aktif) · jenis · cabang · rentang tanggal. Sort default: belum ACK teratas. Penyegaran otomatis 15 detik. Export Excel. Notifikasi suara/banner saat insiden baru masuk. Batch: **— tidak ada —**.

### ② Sync — tidak ada
Notifikasi keluar (push, WhatsApp/SMS) lihat §8.6 · ⚠️ ASUMSI G-7.

### ③ Create / Edit
Insiden dibuat lewat Lapor Darurat; pusat dapat juga `[+ Catat Insiden]` atas laporan telepon dari pengemudi (field sama).

Yang dapat diubah pusat: status · penugasan tindak lanjut · catatan · jenis (koreksi).

### ④ View Detail + Approval

| Bagian | Isi |
|---|---|
| Header | Data kendaraan, pengemudi, kontak pengemudi (tombol Telepon) |
| Peta | Lokasi kejadian |
| Foto & catatan | Dari pengemudi |
| Aksi cepat | `[Acknowledge]` · `[Tugaskan Derek/Teknisi]` · `[Kendaraan Pengganti]` · `[Buat WO Emergensi]` · `[Catatan]` · `[Selesaikan]` |
| Log insiden | Append-only: siapa, kapan, apa |

```
 REPORTED ─► ACKNOWLEDGED ─► IN_HANDLING ─► RESOLVED ─► CLOSED
```

| Aksi | Siapa | Aturan |
|---|---|---|
| Acknowledge | SPV/HQ | Mencatat waktu respon pertama |
| Selesaikan | SPV/HQ | Catatan hasil wajib |
| Tutup (Closed) | HQ_ADMIN | Setelah review |
| Buat WO Emergensi | SPV/HQ | WO terhubung ke insiden, prioritas tertinggi |

**Eskalasi otomatis:** tanpa ACK dalam 5 menit, notifikasi dikirim ke kontak berikutnya ⚠️ ASUMSI G-5. **Approval pada insiden: — tidak ada —** (penanganan tidak boleh menunggu persetujuan); validasi dilakukan pada WO emergensi yang dihasilkan.

### ⑤ Delete — tidak ada
Insiden tidak dapat dihapus. Salah catat → status "Laporan keliru" + alasan.

## 5.3 Kontak Darurat ✅ TERKONFIRMASI (R6: ada kontak dari pusat)

**Rute**: `/emergency/contacts` · **Permission**: `contact.manage` (kelola), semua role (lihat)

### ① List

| Kolom | Catatan |
|---|---|
| Urutan Prioritas | |
| Peran (label) | Control Tower · Derek · Bengkel · Atasan · Asuransi · Ambulans |
| Nama · Telepon | |
| Cakupan | Global · Cabang X · Wilayah Y |
| Status | |

Filter: cakupan · peran · status. Kontak **Global (pusat)** selalu tampil di setiap layar langkah cepat.

### ② Sync — tidak ada
Kontak dari master Vendor dapat dipilih sebagai sumber, namun disalin sebagai nilai (tidak terhubung), agar perubahan vendor tidak mengubah kontak darurat tanpa disadari. ⚠️ ASUMSI

### ③ Create / Edit
Field: Peran/label * · Nama * · Telepon * (validasi format) · Cakupan * (+ cabang/wilayah) · Prioritas * · Catatan · Jam layanan (opsional). Tombol `[Uji Panggilan]` mengirim notifikasi uji ke nomor tersebut. ⚠️ ASUMSI

### ④ Detail + Approval
Detail dalam drawer. **Approval: — tidak ada —** Perubahan kontak darurat tercatat di Audit Log (karena berdampak keselamatan).

### ⑤ Delete
Hapus fisik: ❌ TIDAK ADA. **Nonaktifkan** ✅. Sistem menolak menonaktifkan **kontak Global terakhir**.

## 5.4 Langkah Cepat (Playbook) ✅ TERKONFIRMASI (R6: langkah cepat)

**Rute**: `/emergency/playbooks` · **Permission**: `contact.manage`

### ① List
Kolom: Jenis Kejadian · Judul · Jumlah Langkah · Terakhir Diubah · Status. Satu playbook aktif per jenis kejadian.

### ② Sync — tidak ada

### ③ Create / Edit
Field: Jenis kejadian * · Judul * · Daftar langkah terurut * (tambah/hapus/seret urutan; tiap langkah: teks pendek, ikon opsional). Pratinjau tampilan layar pengemudi. Langkah disusun singkat (kalimat perintah). ⚠️ ASUMSI G-2

### ④ Detail + Approval
Pratinjau layar pengemudi · riwayat versi. **Approval: — tidak ada —**; perubahan tercatat di Audit Log.

### ⑤ Delete
Hapus: ❌ TIDAK ADA. **Nonaktifkan** ✅ hanya bila ada pengganti aktif untuk jenis itu. Setiap jenis kejadian wajib punya playbook aktif; bila tidak ada, sistem memakai playbook "Umum" bawaan.

---

# 6. ✅ Approval ✅ TERKONFIRMASI (R5)

Satu mekanisme untuk semua jenis dokumen (mutasi, opname, perubahan jadwal, WO emergensi). Keputusan dibuat dari Kotak Masuk atau dari halaman detail dokumen, dengan logika yang sama.

## 6.1 Kotak Masuk

**Rute**: `/approvals/inbox` · **Permission**: `approval.act`

### ① List

| Kolom | Catatan |
|---|---|
| Jenis Dokumen | Mutasi · Opname · Perubahan Jadwal · WO Emergensi |
| No. Dokumen | Tautan ke detail |
| Ringkasan | Mis. "3 item, Keluar, B 1234 XY" / "Tunda 3 hari: Part belum ada" |
| Diajukan Oleh · Cabang | |
| Diajukan Pada · Umur | |
| Level | "Level 2 dari 3" |
| SLA | Sisa waktu / terlambat (merah) |

Filter: jenis · cabang · pengaju · terlambat SLA. Sort default: terlambat dulu, lalu terlama. Hanya menampilkan dokumen yang **menunggu role/departemen saya** pada level berjalan.

Batch action: ✅ **Approve massal** untuk dokumen yang dicentang (maksimal 20, hanya jenis tertentu seperti Mutasi Masuk; dokumen berselisih/bernilai besar tidak boleh massal; Reject/Revisi tetap satu per satu). ⚠️ ASUMSI

### ② Sync — tidak ada
### ③ Create / Edit — tidak ada
Approval dibuat otomatis saat dokumen diajukan.

### ④ View Detail + Approval ⭐
Panel detail (drawer) menampilkan **ringkasan dokumen** dan tautan "Buka dokumen penuh", dilengkapi **log approval**.

| Aksi | Aturan |
|---|---|
| ✅ Approve | Catatan opsional |
| ❌ Reject | **Alasan wajib**, dialog tak dapat ditutup tanpa isi |
| 📝 Revise with notes | Catatan wajib; dokumen kembali ke pembuat |

**Pemeriksaan di backend** (bukan hanya UI): role/departemen sesuai level · cabang sesuai · `approved_by ≠ created_by` · request masih PENDING. Dua approver menekan bersamaan → yang kedua mendapat "sudah diputuskan oleh X".

Log: status sebelum → sesudah · oleh · waktu · catatan.

### ⑤ Delete — tidak ada
Keputusan tidak dapat ditarik. Kesalahan keputusan dikoreksi lewat dokumen pembalik / pengajuan ulang.

## 6.2 Semua Antrean (Pusat)

**Rute**: `/approvals/all` · **Permission**: `approval.viewall`

### ① List
Seperti Kotak Masuk, tambah kolom **Menunggu Siapa** (role/orang pada level berjalan) dan **Cabang**; mencakup seluruh cabang. Filter tambahan: level, approver. Ringkasan di atas: jumlah menunggu per jenis, per cabang, yang terlambat SLA.

### ② Sync — tidak ada
### ③ Create / Edit — tidak ada
### ④ View Detail + Approval

| Aksi tambahan | Siapa | Aturan |
|---|---|---|
| 🔄 **Override** | HQ_ADMIN | Loncat level; **catatan wajib**; tercatat `OVERRIDE` di log |
| 🔔 Ingatkan | HQ_ADMIN | Kirim reminder ke approver berjalan |
| ⬆️ Eskalasi manual | HQ_ADMIN | Alihkan ke level berikutnya |

Override tetap tunduk pada aturan segregasi tugas bila HQ_ADMIN adalah pembuat dokumen. ⚠️ ASUMSI F-5

### ⑤ Delete — tidak ada

## 6.3 Riwayat

**Rute**: `/approvals/history`

### ① List
Seluruh keputusan yang pernah dibuat: dokumen · keputusan (Approve/Reject/Revisi/Override/Eskalasi) · oleh · waktu · catatan · lama proses. Filter: jenis · keputusan · approver · rentang tanggal. Role non-pusat hanya melihat keputusan yang menyangkut dokumennya atau yang ia buat. Export Excel.

### ② Sync — tidak ada
### ③ Create / Edit — tidak ada
### ④ Detail — tautan ke dokumen. Approval: tidak ada
### ⑤ Delete — tidak ada (`approval_actions` append-only)

---

# 7. 📑 Laporan

**Rute**: `/reports`, `/reports/[code]` · **Permission**: `report.view` / `report.export`

Laporan bersifat **tetap** (keputusan #6). Tidak ada report builder. Pola penampil sama untuk semua: panel filter di atas, tabel hasil, tombol Export Excel/PDF, parameter tersimpan di URL.

## 7.1 Katalog laporan ⚠️ ASUMSI

| Kode | Laporan | Kolom utama | Filter | Pemakai utama |
|---|---|---|---|---|
| RPT-01 | Mutasi Sparepart | No dokumen, tanggal, tipe, sparepart, qty, kendaraan/WO, lokasi, status | Periode, cabang, tipe, status | Gudang, Pusat |
| RPT-02 | Kartu Stok | Tanggal, dokumen, masuk, keluar, saldo | Sparepart, lokasi, periode | Gudang |
| RPT-03 | Posisi Stok & Stok Minimum | Sparepart, lokasi, on hand, reservasi, tersedia, min | Cabang, kategori, "di bawah min" | Gudang, Pusat |
| RPT-04 | Hasil Stock Opname | Sparepart, sistem, fisik, selisih, alasan, status | Periode, lokasi | Gudang, Pusat, Auditor |
| RPT-05 | Jadwal & Realisasi Perawatan | Kendaraan, tugas, rencana, realisasi, selisih, status | Periode, cabang, jenis | Supervisor, Pusat |
| RPT-06 | Perawatan Overdue | Kendaraan, tugas, jatuh tempo, hari terlambat | Cabang | Supervisor, Pusat |
| RPT-07 | **Anomali Jadwal** | WO, tipe, lama→baru, selisih, alasan, pengaju, keputusan | Periode, cabang, alasan, tipe | Pusat, Dept |
| RPT-08 | **Rekap Alasan Anomali** | Alasan, jumlah, rata-rata selisih, per kendaraan/cabang | Periode, cabang | Pusat |
| RPT-09 | Riwayat Perawatan per Kendaraan | WO, tanggal, pekerjaan, part terpakai | Kendaraan, periode | Supervisor, Mekanik |
| RPT-10 | Pemakaian Sparepart per Kendaraan | Kendaraan, sparepart, qty, tanggal, WO | Kendaraan, periode | Pusat |
| RPT-11 | **Insiden Emergensi** | Insiden, jenis, lokasi, waktu lapor, waktu ACK, waktu selesai, penanganan | Periode, cabang, jenis | Pusat |
| RPT-12 | Waktu Respon Emergensi | Rata-rata/maks waktu ACK dan penyelesaian, per cabang | Periode | Pusat |
| RPT-13 | Kinerja Approval | Jenis, jumlah, rata-rata waktu proses, terlambat SLA, override | Periode, cabang, approver | Pusat |

Baris total dihitung dari record, bukan dari rentang sel. Batas ekspor 50.000 baris; lebih dari itu diproses sebagai tugas latar belakang dan diunduh dari notifikasi. ⚠️ ASUMSI

## 7.2 Laporan × Role

| Laporan | MEK | WH | SPV | DEPT | HQ | SYS |
|---|---|---|---|---|---|---|
| RPT-01…04 | | ✔ | ✔ | ✔ | ✔ | ✔ |
| RPT-05, 06, 09 | ✔ (cabangnya) | | ✔ | ✔ | ✔ | ✔ |
| RPT-07, 08 | | | ✔ | ✔ | ✔ | ✔ |
| RPT-10 | | | ✔ | ✔ | ✔ | ✔ |
| RPT-11, 12 | | | ✔ | ✔ | ✔ | ✔ |
| RPT-13 | | | | ✔ | ✔ | ✔ |

Role non-pusat dibatasi cabangnya.

## 7.3 Lima sudut pandang

| ① List | ② Sync | ③ Create/Edit | ④ Detail + Approval | ⑤ Delete |
|---|---|---|---|---|
| Hub: daftar laporan dikelompokkan (Stok · Perawatan · Anomali · Emergensi · Approval) | — tidak ada — | — tidak ada — (tidak ada report builder) | Penampil laporan; **approval: — tidak ada —** | — tidak ada — |

---

# 8. ⚙️ Administrasi

Hanya **SYS_ADMIN** (kecuali Audit Log yang juga untuk HQ_ADMIN). Menu tidak terlihat oleh role lain.

## 8.1 User

**Rute**: `/admin/users` · **Permission**: `admin.user`

> Aplikasi berdiri sendiri (keputusan #1), jadi pengelolaan user dilakukan **di sini**.

### ① List
Kolom: Nama · Email · Telepon · Cabang · Role · Status (Aktif/Nonaktif/Terkunci) · Login Terakhir. Filter: cabang · role · status. Pencarian: nama/email/telepon. Export Excel.

### ② Sync — tidak ada

### ③ Create / Edit / Upload

| Field | Aturan |
|---|---|
| Nama * · Email * (unik) · Telepon * (dipakai notifikasi) | |
| Cabang * | |
| Role * | Boleh lebih dari satu; peringatan bila kombinasi berisiko (pembuat + approver) |
| Kendaraan ditugaskan | Untuk DRIVER/MECHANIC |
| Password awal | Dibuat sistem; wajib diganti saat login pertama |

Aksi lain: `[Reset Password]` · `[Kunci/Buka Kunci]`. Upload Excel: ✅ untuk onboarding (template: nama, email, telepon, cabang, role) ⚠️ ASUMSI.

### ④ Detail + Approval
Profil · role · riwayat login · aktivitas terakhir. **Approval: — tidak ada —**

### ⑤ Delete
Hapus fisik ❌ TIDAK ADA (jejak transaksi merujuk ke user). **Nonaktifkan** ✅. Sistem menolak menonaktifkan user yang sedang menjadi satu-satunya approver sebuah level aktif.

## 8.2 Role & Permission

**Rute**: `/admin/roles`

### ① List
Kolom: Nama Role · Jumlah User · Jumlah Permission · Bawaan? Role bawaan (7 role) tidak dapat dihapus.

### ② Sync — tidak ada
### ③ Create / Edit
Atur centang permission per role dalam matriks (lihat §0.2). Dapat membuat role baru. Perubahan permission berlaku pada login berikutnya.
### ④ Detail — daftar user pada role. Approval: tidak ada
### ⑤ Delete
Role bawaan ❌ tidak dapat dihapus. Role buatan sendiri: ✅ hanya bila tidak dipakai.

## 8.3 Alur Approval

**Rute**: `/admin/approval-flows` · **Permission**: `admin.flow`

### ① List
Kolom: Jenis Dokumen · Nama Alur · Jumlah Level · Status · Terakhir Diubah.

### ② Sync — tidak ada

### ③ Create / Edit

| Field | Isi |
|---|---|
| Jenis dokumen * | Mutasi · Opname · Perubahan Jadwal · WO Emergensi |
| Level (urut) | Nomor · Role approver * · Departemen · **SLA (jam)** · **Kondisi** (mis. `total selisih > 5`, `selisih jadwal > 1 hari`) |

Level tanpa kondisi selalu berlaku. Bila tidak ada level yang berlaku → dokumen otomatis disetujui. Pratinjau: simulasikan dengan contoh dokumen. Validasi: minimal satu alur aktif per jenis (kecuali sengaja non-approval); tidak boleh dua alur aktif untuk jenis yang sama.

> Perubahan alur hanya berlaku untuk dokumen **baru**; dokumen yang sudah berjalan memakai versi alur saat diajukan.

### ④ Detail + Approval
Riwayat versi alur. **Approval atas perubahan alur: — tidak ada —**; tercatat di Audit Log.

### ⑤ Delete
Hapus ❌ TIDAK ADA. **Nonaktifkan** ✅ hanya bila alur pengganti aktif.

## 8.4 Parameter Sistem

**Rute**: `/admin/parameters`

| Kelompok | Parameter (nilai awal ⚠️ ASUMSI) |
|---|---|
| Perawatan | Lead time hari (7) · lead time km (500) |
| Emergensi | Batas waktu ACK (5 menit) · batas validasi pasca-kejadian (24 jam) |
| Approval | Interval reminder SLA |
| Opname | Mode pembekuan (bekukan / hitung ulang saat review) |
| Stok | Aktifkan reservasi (ya) |
| Notifikasi | Kanal aktif per jenis (push / WhatsApp / SMS) |
| Lampiran | Maks ukuran (5 MB) · maks jumlah (5) · tipe diizinkan |

① List: daftar parameter per kelompok. ② Sync: tidak ada. ③ Edit saja (tanpa Create): nilai divalidasi per tipe. ④ Detail: riwayat perubahan nilai. Approval: tidak ada. ⑤ Delete: tidak ada.

## 8.5 Audit Log

**Rute**: `/admin/audit-logs` · **Permission**: `audit.view`

### ① List
Kolom: Waktu · User · Entitas · ID · Aksi (create/update/nonaktif/login/override) · Ringkasan. Filter: entitas · user · aksi · rentang tanggal. Export Excel.

### ② Sync — tidak ada
### ③ Create / Edit — tidak ada
### ④ Detail
Tampilan **sebelum / sesudah** (diff) per perubahan. Approval: tidak ada.
### ⑤ Delete — tidak ada
Append-only. Tidak ada tombol hapus, edit, maupun purge di UI. Retensi diatur kebijakan. 🔒 MENUNGGU

## 8.6 Log Notifikasi

**Rute**: `/admin/notifications`

### ① List
Kolom: Waktu · Penerima · Kanal (Push/WhatsApp/SMS/Email) · Jenis (Insiden, Approval, SLA, Stok Minimum …) · Status (Antre/Terkirim/Gagal) · Percobaan. Filter: kanal · status · jenis · tanggal.

### ② Sync ⚠️ ASUMSI G-7
**Satu-satunya integrasi keluar.**

| | |
|---|---|
| Arah | Keluar (aplikasi → penyedia notifikasi) |
| Kanal | Push · WhatsApp · SMS (prioritas tinggi untuk emergensi) |
| Percobaan ulang | Antrean dengan retry; gagal permanen masuk dead-letter |
| Gagal | Banner di halaman ini + tombol `[Kirim Ulang]`; **kegagalan notifikasi tidak boleh menggagalkan pembuatan insiden** |

### ③ Create / Edit — tidak ada
Notifikasi dibuat sistem. Template pesan bagian dari konfigurasi kode. 🔒 MENUNGGU bila ingin diedit via UI.
### ④ Detail — isi pesan dan respon penyedia. Approval: tidak ada
### ⑤ Delete — tidak ada

---

# Perilaku Lintas Menu

Dibangun sekali, dipakai semua layar.

## List

- Pencarian debounce 300 ms · filter tersimpan di URL · paging server-side (50/halaman) · sort multi-kolom
- Baris total dihitung dari record, bukan dari rentang sel
- Status memakai badge warna konsisten; status kosong tampil "Tidak ada data" disertai petunjuk tindakan

## Angka & jumlah

- Qty sparepart: `DECIMAL` di basis data, **string** di JSON; format tampilan mengikuti satuan (pcs bulat, liter 2 desimal) ⚠️ ASUMSI
- Pembulatan hanya saat menampilkan
- Satuan berbeda tidak pernah dijumlahkan
- Tanggal dan waktu disimpan UTC, ditampilkan zona waktu cabang (WIB/WITA/WIT)

## Form

- Field terhitung dan identitas read-only (latar abu)
- `If-Match`/rowVersion untuk mencegah timpa-menimpa; benturan menampilkan "Data diubah oleh X, muat ulang?"
- `Idempotency-Key` untuk endpoint yang mengubah stok dan membuat insiden
- Simpan draft otomatis pada form panjang (mutasi, opname)

## Galat

Menyebut angka dan tindakan:
- ✅ "Filter Oli X-12: diminta 20, tersedia 14 di Gudang Utama"
- ❌ "Stok tidak cukup"

## Lampiran

Maks 5 file, ≤ 5 MB, tipe gambar dan PDF; dipindai tipe dan ukuran; thumbnail pratinjau; tidak dapat dihapus setelah dokumen diajukan.

## Approval & Notifikasi

- Dokumen terkunci begitu diajukan
- Notifikasi ke approver saat ada dokumen baru, reminder saat mendekati SLA, eskalasi saat lewat SLA
- Pengaju mendapat notifikasi saat diputuskan

## Mobile

Layar berikut dioptimalkan untuk ponsel (PWA): Lapor Darurat, Langkah Cepat/Kontak, Tugas Saya, Detail WO, Hitung Opname, Approval Inbox. Target sentuh ≥ 44 px. ⚠️ ASUMSI H-3, C-4

## Hak akses

- Dicek di backend setiap request; filter cabang diterapkan di lapisan query
- Tombol tanpa izin disembunyikan (UX), akses langsung ke endpoint ditolak 403

---

# Yang Sengaja TIDAK Dibangun

| Tidak ada | Alasan | Rujukan |
|---|---|---|
| Tombol Sync pada master mana pun | Tidak ada sistem sumber; semua master diinput di sini | [assumption.md](assumption.md) A-4 |
| Login SSO / Auth Redirect / Role Setting ke sistem induk | Aplikasi berdiri sendiri | Keputusan #1 |
| Hapus fisik (master, transaksi, insiden, approval) | Jejak harus utuh; diganti nonaktif/batal/reversal | B-4 |
| Edit dokumen stok yang sudah Posted | Ledger immutable; koreksi lewat pembalik | B-4 |
| Edit langsung Saldo Stok | Saldo hanya hasil Posting | B-3 |
| Harga, nilai, valuasi persediaan | Hanya kuantitas | A-5 |
| Pembelian / PO ke supplier | Di luar lingkup fase ini | A-4 |
| Integrasi GPS/telematika dan ERP | Di luar lingkup | A-4 |
| Report builder | Laporan tetap | Keputusan #6 |
| Upload Excel massal untuk Mutasi | Satu dokumen = satu kejadian fisik yang diverifikasi | Rancangan |
| Approval pada Master Data dan Insiden | Tidak ada kebutuhan; insiden tak boleh menunggu persetujuan | Rancangan |
| Chat/panggilan dalam aplikasi dengan pusat | Hanya tombol telepon dan checklist | G-2 |
| Menu Penalti / Biaya | Tidak ada di requirement | — |
| Aplikasi native iOS/Android | Memakai web responsif/PWA | H-3 |

---

# Rekapitulasi

## Jumlah per modul

| Modul | Sub menu | Halaman | Titik approval |
|---|---|---|---|
| Autentikasi | Login, Lupa Password, Profil | 3 | 0 |
| Dashboard | 1 | 1 | 0 |
| Master Data | 6 | 7 | 0 |
| Inventori Sparepart | 4 | 9 | 2 (Mutasi, Opname) |
| Perawatan & Penjadwalan | 4 | 6 | 2 (Perubahan Jadwal, WO Emergensi) |
| Emergensi | 4 | 5 | 0 |
| Approval | 3 | 3 | (mesin untuk 4 titik di atas) |
| Laporan | 13 laporan | 2 | 0 |
| Administrasi | 6 | 6 | 0 |
| **Total** | **8 menu utama** | **42** | **4** |

## Kelengkapan lima sudut pandang

| Sub menu | ① List | ② Sync | ③ Create/Edit | ④ Detail+Approval | ⑤ Delete |
|---|---|---|---|---|---|
| Master Data (×6) | ✔ | — | ✔ | ✔ / — | Nonaktif |
| Mutasi Sparepart | ✔ | — | ✔ | ✔ / ✔ | Batal / Pembalik |
| Saldo Stok | ✔ | — | — | — / — | — |
| Kartu Stok | ✔ | — | — | — / — | — |
| Stock Opname | ✔ | — | ✔ (+Upload) | ✔ / ✔ | Batal |
| Rencana Perawatan | ✔ | — | ✔ (+Upload) | ✔ / — | Nonaktif |
| Work Order | ✔ | — | ✔ | ✔ / ✔ (Emergensi) | Batal |
| Kalender Jadwal | ✔ | — | — | — / — | — |
| Perubahan Jadwal | ✔ | — | ✔ | ✔ / ✔ | Tarik kembali |
| Lapor Darurat | ✔ | — | ✔ | ✔ / — | — |
| Insiden | ✔ | — | ✔ | ✔ / — | — |
| Kontak & Playbook | ✔ | — | ✔ | ✔ / — | Nonaktif |
| Approval (×3) | ✔ | — | — | ✔ / ✔ | — |
| Laporan | ✔ | — | — | ✔ / — | — |
| Administrasi User/Role/Alur | ✔ | — | ✔ | ✔ / — | Nonaktif |
| Parameter, Audit Log | ✔ | — | Edit saja / — | ✔ / — | — |
| Log Notifikasi | ✔ | **Keluar** | — | ✔ / — | — |

## Urutan bangun yang disarankan

Sejalan dengan rencana rilis di [PRD.md](PRD.md) §9:

| Urutan | Isi | Alasan |
|---|---|---|
| 1 | Autentikasi, Role & User, Parameter, Audit Log | Fondasi akses dan jejak |
| 2 | Master Data | Dependensi semua transaksi |
| 3 | Mesin Approval + Alur Approval + Kotak Masuk | Dipakai Mutasi, Opname, Jadwal |
| 4 | Mutasi Sparepart, Saldo/Kartu Stok, Stock Opname | **Fase 1 (MVP)** |
| 5 | Rencana Perawatan, Work Order, Kalender, Perubahan Jadwal, Dashboard pusat | **Fase 2** |
| 6 | Emergensi (Lapor, Insiden, Kontak, Playbook) + Notifikasi lanjutan | **Fase 3** |
| 7 | Laporan | Bertahap sesuai modul |

> Bila keselamatan menjadi prioritas utama, Emergensi (baris 6) dapat dimajukan setelah Master Data; ia hanya bergantung pada Kendaraan, Kontak, dan Notifikasi.

---

# Yang Perlu Dikonfirmasi

Diurutkan berdasarkan **dampak** pada menu dan effort:

| # | Pertanyaan | Dampak jika berbeda | Asumsi |
|---|---|---|---|
| 1 | Apakah ada **sistem induk (SSO/portal)** untuk login? | Hilang menu User/Role, tambah Auth Redirect dan Role Setting | Berdiri sendiri |
| 2 | **"Card"** = tampilan kartu stok digital atau kartu fisik berbarcode/QR? | Tambah Cetak Label QR, pemindai kamera, mungkin perangkat | B-2 |
| 3 | Apakah **emergensi boleh dikerjakan dulu, di-approve belakangan**? | Bila tidak, WO Emergensi terblokir approval; ubah seluruh alur §4.2 dan §5.2 | D-4 |
| 4 | Interval perawatan: **waktu, km, atau keduanya**? Siapa yang mengisi odometer? | Mengubah model Rencana Perawatan dan perlu menu Input Odometer | D-1, D-2 |
| 5 | **Level, departemen, dan ambang approval** sebenarnya | Tanpa ini Alur Approval tidak dapat diisi dan sistem belum bisa dipakai | F-2 |
| 6 | Bentuk **"langkah cepat dari pusat"**: telepon + checklist saja atau ada chat/panggilan dalam aplikasi? | Tambah modul komunikasi, notifikasi dua arah | G-2 |
| 7 | Karena stok **tanpa harga**, ambang approval berdasarkan apa (qty, jumlah item, jenis part)? Apakah perlu harga? | Bila perlu biaya: tambah kolom harga, costing, laporan biaya per WO | A-5 vs F-1 |
| 8 | Struktur **pusat–cabang**: berapa cabang, apakah pusat melihat semua? | Model cabang dan filter | A-1 |
| 9 | Opname: **bekukan mutasi** selama sesi atau hitung ulang saat review? | Mengubah logika Opname dan Mutasi | C-2 |
| 10 | Perlu **Upload Excel** untuk Kendaraan, Sparepart, Plan, User (onboarding)? | Hemat/tambah effort kecil per master | Rancangan |
| 11 | Kanal notifikasi: WhatsApp/SMS tersedia? Penyedia mana? | Biaya dan setup; fallback hanya push/email | G-7 |
| 12 | Retensi Audit Log dan data insiden | Kebijakan arsip | — |

---

**Ringkasan tahap ②:** 8 menu utama · 42 halaman · 4 titik approval.
