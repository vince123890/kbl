# PRD — Sistem Manajemen Perawatan & Sparepart Kendaraan (KBL)

| | |
|---|---|
| Versi | 0.1 (draft) |
| Tanggal | 2026-10-24 |
| Sumber | [requirement.docx](requirement.docx) |
| Dokumen terkait | [TECHNICAL_LOGIC.md](TECHNICAL_LOGIC.md) |

> Requirement sumber hanya berisi 6 poin singkat. Semua yang tidak tertulis di sumber ditandai **[Asumsi]** dan perlu dikonfirmasi sebelum development (lihat bagian 10).

---

## 1. Latar Belakang & Tujuan

Pengelolaan sparepart, perawatan, dan perbaikan kendaraan saat ini perlu didigitalkan dan dikontrol dari pusat. Tujuan sistem:

1. Menggantikan form/kartu kertas untuk mutasi sparepart dan stock opname dengan form/card digital.
2. Menjadwalkan perawatan dan perbaikan, termasuk kondisi emergensi.
3. Mencatat setiap penyimpangan jadwal (percepatan/penundaan) beserta alasannya.
4. Memastikan setiap transaksi penting divalidasi/disetujui oleh atasan atau departemen terkait, sehingga kontrol tetap di pusat.
5. Menyediakan kontak dan langkah cepat dari pusat saat kendaraan mengalami emergensi di jalan.

## 2. Ruang Lingkup

**In scope (dari requirement)**

| # | Requirement asli | Modul |
|---|---|---|
| R1 | Form digital/card keluar-masuk sparepart kendaraan | M1 Mutasi Sparepart |
| R2 | Form digital/card stock opname | M2 Stock Opname |
| R3 | Schedule waktu perawatan dan perbaikan, bahkan saat emergensi | M3 Penjadwalan |
| R4 | Jadwal perawatan & anomali saat percepatan/penundaan kendaraan beserta alasan | M4 Anomali Jadwal |
| R5 | Validasi/approve dari departemen lain/atasan, kontrol dari pusat | M5 Approval |
| R6 | Saat emergensi di jalan, ada kontak & langkah cepat dari pusat | M6 Emergensi Jalan |

**Pendukung (perlu agar modul di atas berjalan) [Asumsi]**: Master data (kendaraan, sparepart, gudang/lokasi, vendor/bengkel, user & role), notifikasi, laporan, audit log.

**Out of scope (fase ini) [Asumsi]**: pembelian/PO ke supplier, akuntansi/penilaian persediaan, GPS/telematika real-time, integrasi ERP.

## 3. Pengguna & Peran [Asumsi]

| Peran | Tanggung jawab utama |
|---|---|
| Mekanik / Teknisi | Mengisi form pemakaian sparepart, mengerjakan WO, melaporkan temuan |
| Staf Gudang | Mencatat barang masuk/keluar, menjalankan stock opname |
| Supervisor Workshop | Menyetujui level 1, menyusun jadwal perawatan |
| Kepala Departemen (Operasional / Gudang / Finance, dll.) | Approval level lanjut sesuai jenis transaksi |
| Admin Pusat / Control Tower | Pengawasan seluruh cabang, approval akhir, penanganan emergensi |
| Pengemudi | Melaporkan emergensi di jalan, melihat kontak & langkah cepat |
| Admin Sistem | Master data, hak akses, konfigurasi aturan approval |

## 4. Kebutuhan Fungsional

### M1 — Mutasi Sparepart (Keluar–Masuk)

- **FR-1.1** Pengguna dapat membuat form mutasi dengan tipe: *Masuk* (penerimaan), *Keluar* (pemakaian untuk kendaraan), dan [Asumsi] *Retur*, *Transfer antar lokasi*.
- **FR-1.2** Form memuat: nomor dokumen otomatis, tanggal, kendaraan (untuk tipe Keluar), referensi Work Order (bila ada), daftar item (sparepart, qty, satuan), lokasi gudang, catatan, lampiran foto.
- **FR-1.3** Setiap sparepart memiliki **kartu stok** digital (stock card) yang menampilkan riwayat mutasi dan saldo berjalan.
- **FR-1.4** Sistem menolak mutasi keluar yang membuat stok negatif.
- **FR-1.5** Mutasi melewati approval (M5) sebelum stok berubah; stok hanya berubah saat status *Approved/Posted*.
- **FR-1.6** Dokumen yang sudah *Posted* tidak dapat diubah; koreksi dilakukan lewat dokumen pembalik.

### M2 — Stock Opname

- **FR-2.1** Gudang membuat sesi opname (per lokasi, periodik atau ad-hoc), sistem membekukan snapshot stok sistem saat sesi dibuka.
- **FR-2.2** Petugas menginput hasil hitung fisik per item pada form/card opname (dapat dari perangkat mobile).
- **FR-2.3** Sistem menghitung selisih (fisik − sistem) dan menandai item yang selisih.
- **FR-2.4** Selisih harus diberi alasan dan disetujui (M5) sebelum penyesuaian stok diposting.
- **FR-2.5** Hasil opname menghasilkan dokumen penyesuaian (adjustment) otomatis setelah approved.

### M3 — Penjadwalan Perawatan & Perbaikan

- **FR-3.1** Jadwal perawatan preventif per kendaraan berdasarkan aturan: interval waktu (hari/bulan) dan/atau interval pemakaian (km/jam) **[Asumsi]**.
- **FR-3.2** Sistem membuat Work Order (WO) terjadwal otomatis ketika jatuh tempo, dan menampilkan kalender/jadwal per kendaraan, per bengkel, per periode.
- **FR-3.3** Perbaikan korektif dapat dibuat kapan saja dari laporan kerusakan/temuan.
- **FR-3.4** **Jadwal emergensi**: WO dengan prioritas *Emergency* dapat dibuat di luar jadwal normal, menyela antrean (prioritas tertinggi), dan memicu notifikasi ke pusat.
- **FR-3.5** WO memuat: kendaraan, jenis (preventif/korektif/emergensi), tanggal-jam rencana, bengkel/lokasi, teknisi, estimasi durasi, daftar sparepart yang dibutuhkan, status.
- **FR-3.6** Pemakaian sparepart pada WO otomatis membuat mutasi keluar (M1).
- **FR-3.7** Sistem mendeteksi bentrok jadwal (kendaraan yang sama, teknisi/bay yang sama) dan memberi peringatan.

### M4 — Anomali Jadwal (Percepatan / Penundaan) + Alasan

- **FR-4.1** Setiap perubahan jadwal WO (maju/mundur) **wajib** mengisi kategori alasan dan keterangan.
- **FR-4.2** Sistem mencatat anomali otomatis: tipe (*Percepatan*/*Penundaan*), selisih waktu, jadwal lama & baru, pengaju, waktu pengajuan.
- **FR-4.3** Daftar kategori alasan [Asumsi]: kendaraan masih beroperasi, sparepart belum tersedia, kerusakan mendadak, permintaan operasional, cuaca/kondisi jalan, bengkel penuh, lainnya (teks bebas wajib).
- **FR-4.4** Perubahan jadwal melewati approval (M5); ambang tertentu (mis. tunda > N hari) naik ke level lebih tinggi **[Asumsi]**.
- **FR-4.5** Kendaraan yang melewati batas jatuh tempo tanpa pelaksanaan ditandai *Overdue* dan muncul di dashboard pusat.
- **FR-4.6** Laporan anomali: frekuensi per kendaraan, per alasan, per cabang, rata-rata keterlambatan.

### M5 — Validasi & Approval Berjenjang

- **FR-5.1** Dokumen yang butuh approval: mutasi sparepart, penyesuaian stock opname, perubahan jadwal (anomali), WO emergensi (approval pasca-kejadian), [Asumsi] WO dengan biaya di atas ambang.
- **FR-5.2** Alur approval dikonfigurasi per jenis dokumen: urutan level, peran/departemen approver, syarat ambang (nilai, selisih, durasi).
- **FR-5.3** Approver dapat: *Approve*, *Reject* (wajib alasan), *Minta Revisi*.
- **FR-5.4** Notifikasi ke approver saat ada dokumen menunggu; reminder dan eskalasi bila melewati SLA **[Asumsi]**.
- **FR-5.5** Admin Pusat dapat melihat seluruh antrean approval lintas cabang dan melakukan approval/override dengan jejak audit.
- **FR-5.6** Seluruh keputusan dicatat (siapa, kapan, keputusan, catatan) dan tidak dapat dihapus.
- **FR-5.7** Pembuat dokumen tidak boleh menyetujui dokumennya sendiri.

### M6 — Emergensi di Jalan

- **FR-6.1** Pengemudi dapat membuat laporan emergensi dari ponsel: kendaraan, jenis kejadian (mogok, kecelakaan, ban, kebakaran, medis, lainnya), lokasi (koordinat/alamat), foto, catatan. Tombol harus dapat dijangkau dalam ≤ 2 langkah.
- **FR-6.2** Setelah laporan dikirim, pengemudi langsung melihat **kartu "Langkah Cepat"** sesuai jenis kejadian (checklist keselamatan) dan **kontak darurat** (pusat/control tower, bengkel/derek terdekat, atasan, asuransi) dengan tombol *call* sekali ketuk.
- **FR-6.3** Sistem otomatis memberi notifikasi ke pusat dan atasan, serta membuat insiden dengan status yang dapat dilacak (Dilaporkan → Ditangani → Selesai).
- **FR-6.4** Pusat dapat menugaskan tindak lanjut (kirim derek/teknisi, alihkan kendaraan pengganti), dan mencatat setiap langkah.
- **FR-6.5** Bila perlu perbaikan, sistem membuat WO emergensi (M3) terhubung ke insiden.
- **FR-6.6** Konten kontak dan langkah cepat dikelola pusat (CRUD) per jenis kejadian dan per wilayah **[Asumsi]**.
- **FR-6.7** Laporan emergensi dapat dikirim saat sinyal lemah (antrean offline lalu kirim ulang; fallback SMS/telepon ke nomor pusat) **[Asumsi]**.

### Pendukung

- **FR-S.1** Master data: kendaraan, sparepart (kode, nama, satuan, kategori, min stok), lokasi/gudang, vendor/bengkel, user-role.
- **FR-S.2** Audit log untuk semua perubahan data penting.
- **FR-S.3** Dashboard pusat: stok kritis, WO terjadwal/overdue, anomali, antrean approval, insiden emergensi aktif.
- **FR-S.4** Export laporan (Excel/PDF) dan cetak form/card.

## 5. Alur Pengguna Utama

1. **Pemakaian sparepart**: Mekanik buka WO → pilih sparepart → submit mutasi keluar → approval → stok terpotong → kartu stok terbarui.
2. **Perubahan jadwal**: Supervisor ubah jadwal → wajib isi alasan → anomali tercatat → approval → jadwal baru berlaku, notifikasi ke pihak terkait.
3. **Stock opname**: Gudang buka sesi → hitung fisik → sistem tampilkan selisih → isi alasan → approval → penyesuaian stok.
4. **Emergensi**: Pengemudi tekan tombol darurat → isi singkat → lihat langkah cepat + kontak → pusat menerima alert dan menangani → WO emergensi → selesai.

## 6. Kebutuhan Non-Fungsional

| Aspek | Target [Asumsi] |
|---|---|
| Ketersediaan | ≥ 99,5% jam kerja; modul emergensi prioritas tertinggi |
| Kinerja | Halaman utama < 3 dtk; notifikasi emergensi ke pusat < 10 dtk |
| Keamanan | Autentikasi, RBAC per peran & per cabang, audit log immutable, enkripsi in-transit |
| Mobile | Antarmuka responsif/PWA untuk pengemudi, mekanik, dan petugas opname |
| Offline | Laporan emergensi dan input opname dapat diantre saat offline |
| Integritas data | Stok tidak boleh negatif; dokumen posted tidak dapat diubah |
| Skalabilitas | Multi-cabang/multi-lokasi dengan kontrol terpusat |

## 7. Metrik Keberhasilan [Asumsi]

- 100% mutasi sparepart tercatat digital dan ter-approve sebelum stok berubah.
- Selisih stock opname turun dibanding baseline kertas.
- ≥ 95% perubahan jadwal memiliki alasan tercatat.
- Waktu dari laporan emergensi hingga respon pusat pertama < 5 menit.
- Persentase perawatan preventif tepat waktu meningkat.

## 8. Status Dokumen & Siklus Hidup (ringkas)

| Dokumen | Status |
|---|---|
| Mutasi sparepart | Draft → Submitted → Approved/Rejected → Posted (atau Cancelled) |
| Stock opname | Open → Counting → Review → Approved → Adjusted (atau Cancelled) |
| Work Order | Planned → Scheduled → In Progress → Completed (atau Cancelled), + flag Overdue |
| Perubahan jadwal | Requested → Approved/Rejected |
| Insiden emergensi | Reported → Acknowledged → In Handling → Resolved → Closed |

Detail transisi ada di [TECHNICAL_LOGIC.md](TECHNICAL_LOGIC.md).

## 9. Rencana Rilis [Asumsi]

| Fase | Isi |
|---|---|
| 1 (MVP) | Master data, M1 Mutasi, M2 Opname, M5 Approval dasar |
| 2 | M3 Penjadwalan, M4 Anomali, dashboard pusat |
| 3 | M6 Emergensi (termasuk mobile/offline), notifikasi lanjutan, laporan |

> Alternatif: M6 dimajukan ke Fase 1 bila risiko keselamatan menjadi prioritas.

## 10. Pertanyaan Terbuka (perlu konfirmasi)

1. Jenis kendaraan dan jumlah armada/cabang/gudang? Apakah multi-cabang dengan "pusat" sebagai kontrol?
2. Apakah "card" berarti kartu fisik (barcode/QR/RFID) atau hanya tampilan digital kartu stok?
3. Aturan approval: siapa saja level dan departemennya, dan ambang nilainya?
4. Interval perawatan berbasis waktu, odometer/jam kerja, atau keduanya? Apakah odometer diinput manual?
5. Definisi "emergensi" pada penjadwalan: apakah boleh langsung dieksekusi lalu di-approve belakangan?
6. Sumber kontak darurat & langkah cepat: siapa yang menyusun dan memelihara isinya?
7. Perlu integrasi dengan sistem lain (ERP/akuntansi, GPS, WhatsApp)? Kanal notifikasi yang dipakai?
8. Apakah ada kebutuhan nilai/biaya sparepart (harga, valuasi)?
9. Platform target: web saja atau juga aplikasi mobile?
10. Kebijakan retensi data dan kebutuhan kepatuhan/audit.
