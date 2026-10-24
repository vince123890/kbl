# Peta Kekurangan dan Rencana Pengerjaan

Dasar: [MENU-SUBMENU-SPESIFIKASI.md](../MENU-SUBMENU-SPESIFIKASI.md) (42 halaman, 4 titik approval) dan [TECHNICAL_LOGIC.md](../TECHNICAL_LOGIC.md).
Kondisi awal: slice 1 `foundation-auth-master` (login, user, role, master data, parameter, audit log). Selebihnya belum ada.

## Aturan rancangan yang dipakai di semua slice

- Aturan bisnis ditulis sebagai fungsi Postgres (`security definer`) agar atomik dan bisa diuji lewat PGlite tanpa Docker. Server action hanya memanggil `rpc`.
- Tabel transaksi tidak punya hak tulis langsung untuk pengguna; semua perubahan lewat fungsi. Hak baca dibatasi RLS per cabang.
- Ledger, log approval, log insiden, dan audit append-only (trigger menolak update/delete).
- Pengaju tidak boleh menyetujui dokumennya sendiri, diperiksa per record di dalam fungsi `approval_act`.
- Tidak ada hapus fisik: batal, nonaktif, atau dokumen pembalik.

## Yang kurang dan urutan pengerjaan

| Slice | Isi | Halaman | Status |
|---|---|---|---|
| S2 | Mesin approval, Alur Approval, Kotak Masuk, Semua Antrean, Riwayat, notifikasi dalam aplikasi | `/approvals/*`, `/admin/approval-flows`, `/admin/notifications`, `/notifications` | Dikerjakan |
| S3 | Mutasi Sparepart (draft, ajukan, posting, batal, pembalik), Saldo Stok, Kartu Stok, Stock Opname (+ unggah CSV) | `/inventory/*` | Dikerjakan |
| S4 | Rencana Perawatan, Work Order, Kalender Jadwal, Perubahan Jadwal, job preventif dan overdue | `/maintenance/*` | Dikerjakan |
| S5 | Lapor Darurat (offline, idempoten), Insiden, Kontak Darurat, Langkah Cepat | `/emergency/*` | Dikerjakan |
| S6 | Dashboard W1–W12, 13 laporan + ekspor CSV, lampiran, job terjadwal, impor CSV master, data demo transaksi | `/dashboard`, `/reports/*` | Dikerjakan |

## Keputusan yang diambil sendiri (asumsi, bisa diubah)

1. Level dan ambang approval awal (dapat diubah di Alur Approval):
   - Mutasi: Supervisor; + Kepala Dept bila total qty > 50.
   - Opname: Supervisor; + Kepala Dept bila total selisih absolut > 5; + Admin Pusat bila > 50.
   - Perubahan jadwal: Supervisor; + Kepala Dept bila selisih > 1 hari; + Admin Pusat bila > 7 hari atau WO overdue.
   - WO emergensi (validasi pasca-kejadian): Kepala Dept.
2. Ekspor memakai CSV (dibuka di Excel), bukan .xlsx, agar tidak menambah dependensi.
3. Notifikasi dalam aplikasi selalu aktif. Push/WhatsApp/SMS diantre dan dikirim oleh pengirim bila kunci penyedia diisi; bila tidak, ditandai Gagal dan bisa dikirim ulang. Penyedia WhatsApp/SMS belum ditentukan (pertanyaan #11).
4. Job terjadwal dipicu `vercel.json` (harian) dan bisa dipicu ulang lewat `pg_cron` bila tersedia.
5. Departemen pada langkah approval tidak dipakai (tidak ada atribut departemen pada user); langkah memakai role.
6. Opname memakai mode pembekuan dari parameter `count.freeze_mode` (`freeze` atau `recount`).
7. Pertanyaan terbuka #2 (kartu fisik/QR) tidak dikerjakan: Kartu Stok berupa tampilan digital.
