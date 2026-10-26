# Panduan Uji Mandiri POC: Aplikasi Perawatan & Sparepart Kendaraan

Panduan untuk **pengguna yang akan mencoba POC sendiri**, tanpa perlu latar belakang teknis. Versi bergambar ada di berkas PDF dengan nama yang sama. Kerjakan skenario berurutan dan centang hasilnya.

- Alamat aplikasi: https://kbl-fawn.vercel.app (masuk di `/login`)
- Password semua akun demo: `Demo12345`
- Estimasi waktu: ±45 menit untuk semuanya, atau ±10 menit per skenario.

---

## 1. Gambaran singkat

```
 Rencana Perawatan ──(jatuh tempo)──► Work Order ──(butuh sparepart)──► Mutasi / Stok
        │                                  │                                  │
        │                                  └─ Perubahan Jadwal                └─ Stock Opname
        └──────────────────── semuanya lewat ► Approval (berjenjang) ◄─────────────┘

 Pengemudi ──► Lapor Darurat ──► Insiden ──► Derek / Teknisi / WO Emergensi
```

Yang akan Anda buktikan: (1) setiap orang hanya melihat dan melakukan yang menjadi tugasnya; (2) stok berubah hanya setelah disetujui dan tercatat di Kartu Stok; (3) yang mengajukan tidak boleh memutuskan dokumennya sendiri; (4) laporan darurat cepat, bahkan tanpa sinyal.

---

## 2. Persiapan

| Kebutuhan | Keterangan |
|---|---|
| Peramban | Chrome atau Edge terbaru (komputer), Chrome (Android), Safari (iPhone) |
| Dua jendela | Satu jendela biasa dan satu incognito/private, agar bisa masuk sebagai dua orang sekaligus |
| Ponsel | Disarankan untuk skenario 6 dan 7 |
| Data demo | Sudah diisi tim teknis. Bila semua daftar kosong setelah masuk, minta tim teknis mengisinya |

### Akun demo

| Email | Peran | Cabang | Dipakai untuk |
|---|---|---|---|
| `sysadmin@example.com` | Admin Sistem | Pusat | Master data, user, role, alur approval, audit |
| `hqadmin@example.com` | Admin Pusat | Pusat | Lintas cabang, mencatat insiden dari telepon, laporan |
| `depthead.jkt@example.com` | Kepala Departemen | Jakarta | Approval level lanjut |
| `supervisor.jkt@example.com` | Supervisor | Jakarta | Approval level 1, rencana, membuat WO. Tidak mengajukan perubahan jadwal |
| `warehouse.jkt@example.com` | Gudang | Jakarta | Mutasi sparepart, stock opname |
| `mechanic.jkt@example.com` | Mekanik | Jakarta | Menjalankan WO, mengajukan perubahan jadwal WO miliknya |
| `driver.jkt@example.com` | Pengemudi | Jakarta | Lapor darurat (kendaraan B 9001 KBL) |
| `supervisor.sby@example.com` | Supervisor | Surabaya | Uji pemisahan antar cabang |
| `mechanic.sby@example.com` | Mekanik | Surabaya | Uji pemisahan antar cabang |
| `gudang.supervisor.jkt@example.com` | Gudang + Supervisor | Jakarta | Uji larangan menyetujui dokumen sendiri |
| `nonaktif.jkt@example.com` | Mekanik (nonaktif) | Jakarta | Uji akun dinonaktifkan: harus ditolak |

### Data contoh

- Kendaraan Jakarta: B 9001 KBL (Hino 500), B 9002 KBL, B 7101 KBL (Bus), B 5201 KBL (Pick-up). Surabaya: L 8001 KBL, L 8002 KBL. Bandung: D 6001 KBL.
- 16 sparepart (oli, filter, kampas rem, aki, ban, lampu). Beberapa sengaja di bawah stok minimum: Filter Udara Hino 500 tinggal 3 (minimum 6), Kampas Rem Depan tinggal 2 (minimum 4), Filter Oli Hino 500 di Workshop Jakarta tinggal 4 (minimum 10).
- 5 rencana perawatan; 2 di antaranya sudah membentuk Work Order preventif otomatis.
- Sudah menunggu keputusan: 1 perubahan jadwal (diajukan Mekanik), 1 stock opname dengan selisih di Gudang Utama Jakarta, 1 insiden belum dikonfirmasi.

---

## 3. Skenario uji

### Skenario 1: Login, peran, dan batas akses

**Tujuan:** Setiap orang hanya melihat dan melakukan yang menjadi tugasnya.

| No | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 1.1 | `sysadmin@example.com` | Buka /login lalu masuk. | Masuk ke Dashboard. Menu lengkap, termasuk grup Administrasi. | [ ] |
| 1.2 | `driver.jkt@example.com` | Keluar, lalu masuk sebagai pengemudi. | Menu jauh lebih sedikit: Dashboard, Work Order, Kalender Jadwal, Lapor Darurat, Kontak Darurat, Langkah Cepat. Tidak ada Master Data, Administrasi, atau Laporan. | [ ] |
| 1.3 | `driver.jkt@example.com` | Ketik manual alamat /admin/users. | Halaman Akses ditolak, bukan data. | [ ] |
| 1.4 | `nonaktif.jkt@example.com` | Coba masuk (password sama). | Ditolak: Email atau password salah. | [ ] |
| 1.5 | `mechanic.sby@example.com` | Buka Perawatan › Work Order. | 0 WO. WO milik cabang Jakarta tidak terlihat. | [ ] |

### Skenario 2: Mutasi sparepart masuk, dengan approval

**Tujuan:** Stok baru berubah hanya setelah disetujui, dan tercatat di Kartu Stok.

> Contoh memakai Filter Oli Hino 500 di Workshop Jakarta (saldo awal 4). Bila penguji lain sudah mencoba lebih dulu, gunakan selisihnya (+10) sebagai patokan, bukan angka mutlak.

| No | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 2.1 | `warehouse.jkt@example.com` | Inventori Sparepart › Saldo Stok. Catat saldo FLT-OLI-01 Filter Oli Hino 500 di Workshop Jakarta. | On hand 4. | [ ] |
| 2.2 | `warehouse.jkt@example.com` | Mutasi Sparepart › + Mutasi Baru. Tipe Masuk, Ke lokasi Workshop Jakarta. Di kolom Sparepart ketik “filter oli”, pilih Filter Oli Hino 500. Qty 10. Klik Ajukan untuk approval. | Dokumen MSK-… berstatus Diajukan. | [ ] |
| 2.3 | `warehouse.jkt@example.com` | Buka lagi Saldo Stok. | Saldo masih 4. Belum berubah. | [ ] |
| 2.4 | `supervisor.jkt@example.com` | Approval › Kotak Masuk, buka dokumen tadi, klik Setujui, isi catatan (opsional), klik Setujui lagi. | Status Disetujui. Log approval mencatat siapa, kapan, dan catatannya. | [ ] |
| 2.5 | `warehouse.jkt@example.com` | Cek Saldo Stok dan Kartu Stok Filter Oli Hino 500. | Saldo Workshop jadi 14. Kartu Stok memuat baris Masuk +10 dengan nomor dokumen. | [ ] |
| 2.6 | `warehouse.jkt / supervisor.jkt / depthead.jkt` | Ulangi 2.2 dengan Qty 60. Supervisor menyetujui, lalu Kepala Dept. | Setelah Supervisor, status masih Menunggu (“Level 2 dari 2 · menunggu DEPT_HEAD”). Baru Diposting setelah Kepala Dept menyetujui (jumlah di atas 50 butuh dua level). | [ ] |
| 2.7 | `warehouse.jkt / supervisor.jkt` | Buat mutasi kecil. Supervisor memilih Tolak (alasan wajib), lalu pada mutasi lain memilih Minta revisi. | Tolak: status Ditolak. Revisi: dokumen kembali ke Gudang sebagai Draft. Stok tidak berubah pada keduanya. | [ ] |
| 2.8 | `warehouse.jkt@example.com` | Buat mutasi Masuk ke Gudang Utama Jakarta lalu klik Ajukan untuk approval (selama opname Skenario 5 belum disetujui). | Ditahan: “Lokasi Gudang Utama Jakarta sedang diopname (OPN-…); mutasi ditahan sampai opname selesai”. | [ ] |

### Skenario 3: Larangan menyetujui dokumen sendiri

**Tujuan:** Orang yang mengajukan tidak boleh memutuskan dokumennya, walau perannya mengizinkan.

| No | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 3.1 | `gudang.supervisor.jkt@example.com` | Buat mutasi Masuk kecil ke Workshop Jakarta, lalu Ajukan untuk approval. | Status Diajukan. | [ ] |
| 3.2 | `gudang.supervisor.jkt@example.com` | Dokumen itu tidak muncul di Kotak Masuk Anda. Buka detail dokumen, klik Lihat approval. | Muncul pesan “Anda yang mengajukan dokumen ini, sehingga tidak dapat memutuskannya sendiri”. Tidak ada tombol Setujui. | [ ] |
| 3.3 | `supervisor.jkt@example.com` | Buka Kotak Masuk, setujui dokumen yang sama. | Berhasil. Status Disetujui. | [ ] |

### Skenario 4: Perawatan: dari rencana sampai Work Order selesai

**Tujuan:** Satu siklus penuh, termasuk pemakaian sparepart dan odometer.

| No | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 4.1 | `supervisor.jkt@example.com` | Perawatan › Rencana Perawatan. | Ada 5 rencana (oli, servis rem, servis berkala, dll.). | [ ] |
| 4.2 | `supervisor.jkt@example.com` | Perawatan › Work Order. | WO Preventif bertanda “Dibuat otomatis” sudah ada, di samping 2 WO Korektif dari data demo. | [ ] |
| 4.3 | `supervisor.jkt@example.com` | Perawatan › Kalender Jadwal. | WO tampil pada tanggal jadwalnya. | [ ] |
| 4.4 | `supervisor.jkt@example.com` | Work Order › + WO Baru: Korektif, kendaraan B 5201 KBL, mulai dan selesai besok lusa, teknisi Maman Mekanik, deskripsi “Lampu depan mati”. Klik + Tambah part, cari “lampu”, pilih Lampu Depan H4 24V, Qty 2, Ambil dari Workshop Jakarta. Buat Work Order. | WO tersimpan berstatus Scheduled; part 2 tercatat sebagai reservasi dari Workshop Jakarta. | [ ] |
| 4.5 | `mechanic.jkt@example.com` | Buka WO tadi, klik Mulai. | Status In Progress. | [ ] |
| 4.6 | `mechanic.jkt@example.com` | Klik Pakai sparepart (form Keluar terisi otomatis). Pilih Dari lokasi Workshop Jakarta, cari Lampu Depan H4 24V, Qty 2, Ajukan untuk approval. Lalu supervisor.jkt menyetujuinya. | Mutasi Keluar Diposting. Di WO, kolom Terpakai menjadi 2. Saldo lampu di Workshop berkurang 2. | [ ] |
| 4.7 | `mechanic.jkt@example.com` | Di WO klik Selesai, isi Odometer akhir (mis. 38150) dan catatan, klik Selesaikan WO. | Status Completed; odometer akhir tersimpan. | [ ] |
| 4.8 | `supervisor.jkt@example.com` | Master Data › Kendaraan › Detail B 5201 KBL. | Odometer baru, riwayat perubahan odometer, dan WO terbaru terlihat. | [ ] |

### Skenario 5: Perubahan jadwal dan stock opname

**Tujuan:** Yang mengajukan perubahan jadwal adalah teknisi pemilik WO; Supervisor hanya memutuskan.

| No | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 5.1 | `supervisor.jkt@example.com` | Buat WO Korektif untuk B 5201 KBL, jadwal 29 Okt, teknisi Maman Mekanik. Buka detailnya. | Tombol yang ada hanya Cetak, Ubah, Mulai, Batalkan. Tidak ada Ajukan perubahan jadwal. | [ ] |
| 5.2 | `mechanic.jkt@example.com` | Buka WO yang sama, klik Ajukan perubahan jadwal. Jadwal baru +2 hari, alasan “Sparepart belum tersedia”, keterangan, Ajukan untuk approval. | Pengajuan PJ-… berstatus Diajukan, tampil di bagian Jadwal & anomali WO. | [ ] |
| 5.3 | `supervisor.jkt@example.com` | Approval › Kotak Masuk, buka PJ-… tadi, Setujui. | Belum selesai: “Level 2 dari 2 · menunggu DEPT_HEAD” (penundaan lebih dari 1 hari). | [ ] |
| 5.4 | `depthead.jkt@example.com` | Kotak Masuk, setujui PJ-… yang sama. | Disetujui. Jadwal WO berpindah, Jadwal awal tetap tersimpan, dan pengajuan tercatat di laporan anomali. | [ ] |
| 5.5 | `mechanic.sby@example.com` | Coba cari WO Jakarta tadi. | Tidak terlihat; teknisi hanya dapat mengajukan untuk WO yang ditugaskan kepadanya. | [ ] |
| 5.6 | `supervisor.jkt@example.com` | Inventori › Stock Opname, buka OPN-… (Gudang Utama Jakarta, kategori Filter), lalu setujui lewat Kotak Masuk. | Terlihat 1 item selisih −1 (Filter Oli Hino 500) dengan alasan. Setelah disetujui, status opname selesai dan penahanan mutasi di Gudang Utama Jakarta dicabut. | [ ] |
| 5.7 | `warehouse.jkt@example.com` | Kartu Stok Filter Oli Hino 500. | Ada baris Penyesuaian −1 (ADJ-…). | [ ] |
| 5.8 | `warehouse.jkt@example.com` | Stock Opname › + Buka Sesi Opname (Workshop Jakarta, kategori Filter). Isi Qty fisik berbeda dari sistem. | Selisih terhitung otomatis; alasan wajib dipilih, dan alasan “Lainnya” wajib diberi keterangan. | [ ] |

### Skenario 6: Darurat di lapangan

**Tujuan:** Pengemudi cukup mengetuk jenis kejadian, dan pusat bisa menanganinya sampai tuntas.

> Langkah 6.1–6.2 dicoba di ponsel (atau jendela browser yang dipersempit). Izinkan akses lokasi saat diminta.

| No | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 6.1 | `driver.jkt@example.com (ponsel)` | Ketuk tombol merah Darurat. Kendaraan B 9001 KBL sudah terpilih; lokasi terdeteksi otomatis. | Layar berisi 6 jenis kejadian besar dan kontak darurat. | [ ] |
| 6.2 | `driver.jkt@example.com (ponsel)` | Ketuk Mogok. | “Laporan terkirim INC-…”, lengkap dengan Langkah cepat (nyalakan hazard, pasang segitiga, tunggu arahan) dan tombol telepon pusat, derek, atasan. | [ ] |
| 6.3 | `hqadmin@example.com` | Emergensi › Insiden. | Insiden baru ada di atas dengan status Dilaporkan; lencana merah pada menu dan banner merah menunjukkan insiden belum dikonfirmasi. | [ ] |
| 6.4 | `hqadmin@example.com` | Buka insiden, klik Acknowledge. | Status Dikonfirmasi pusat, dengan nama dan waktu. | [ ] |
| 6.5 | `hqadmin@example.com` | Klik Tugaskan derek (isi catatan), lalu Selesaikan (catatan hasil), lalu Tutup insiden. | Status berturut-turut: Ditangani, Selesai, Ditutup. Log insiden mencatat tiap langkah dengan waktu dan nama. | [ ] |
| 6.6 | `hqadmin@example.com` | Klik + Catat Insiden. Pilih kendaraan B 9001 KBL, pilih pengemudi Dedi Driver, jenis, alamat, keterangan. | Insiden tercatat atas nama pengemudi dan bertanda “(dicatat pusat)”. *(perlu pembaruan terbaru)* | [ ] |
| 6.7 | `driver.jkt@example.com (ponsel)` | Ketuk jenis kejadian dua kali dengan sangat cepat. | Hanya satu insiden terbentuk. *(perlu pembaruan terbaru)* | [ ] |

### Skenario 7: Bekerja tanpa sinyal, lalu sinkron

**Tujuan:** Lapangan tetap bisa bekerja saat sinyal hilang; hasilnya terkirim sendiri saat sinyal kembali.

> Buka aplikasi dengan sinyal lebih dulu agar data tersimpan di perangkat. Untuk pengemudi, buka halaman Lapor Darurat satu kali saat online supaya panduan dan kontak tersimpan. Di panduan ini jaringan dimatikan dengan mode pesawat (atau tab Network › Offline di browser).

| No | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 7.1 | `mechanic.jkt@example.com (ponsel)` | Masuk dan buka Work Order sekali dengan sinyal. | Daftar tampil; data tugas tersimpan di perangkat. | [ ] |
| 7.2 | `mechanic.jkt@example.com (ponsel)` | Aktifkan mode pesawat, lalu buka aplikasi (atau alamat /offline). | Halaman Mode offline muncul: “Tidak ada sinyal. Anda tetap dapat bekerja”, berisi Tugas Saya dan tombol darurat. | [ ] |
| 7.3 | `mechanic.jkt@example.com (ponsel)` | Ketuk salah satu WO Scheduled, lalu Mulai. | Status “In Progress · menunggu sinkron”. Muncul di daftar Menunggu sinkron. | [ ] |
| 7.4 | `mechanic.jkt@example.com (ponsel)` | Isi Odometer akhir dan catatan, ketuk Selesaikan WO. | Status “Completed · menunggu sinkron”. Antrean berisi 2 pekerjaan. | [ ] |
| 7.5 | `mechanic.jkt@example.com (ponsel)` | Matikan mode pesawat; ketuk Kirim sekarang bila perlu. | Antrean terkirim otomatis: “Tidak ada pekerjaan yang menunggu”. | [ ] |
| 7.6 | `supervisor.jkt@example.com` | Perawatan › Work Order. | WO tadi berstatus Completed di server, sama seperti yang dikerjakan offline. | [ ] |
| 7.7 | `driver.jkt@example.com (ponsel)` | Saat offline, buka /offline lalu ketuk jenis kejadian (mis. Ban). | Tampil “Laporan disimpan di perangkat ini” beserta langkah cepat dan kontak. Saat sinyal kembali terkirim otomatis dan hanya membentuk satu insiden. | [ ] |

### Skenario 8: Dashboard dan laporan

**Tujuan:** Angka di dashboard dan laporan sesuai data, dan terbatas pada cabang pemakainya.

| No | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 8.1 | `hqadmin@example.com` | Buka Dashboard. | Widget terisi: insiden aktif, antrean approval, WO hari ini, perawatan jatuh tempo, stok kritis, anomali jadwal. Angka sesuai data. | [ ] |
| 8.2 | `hqadmin@example.com` | Laporan › RPT-03 Posisi Stok & Stok Minimum. Atur filter, klik Tampilkan. | Tabel terisi sesuai filter; ada pilihan cabang. | [ ] |
| 8.3 | `hqadmin@example.com` | Klik Ekspor CSV dan Cetak / PDF. | File CSV terunduh; tampilan cetak rapi. | [ ] |
| 8.4 | `supervisor.jkt@example.com` | Buka laporan yang sama. | Hanya lokasi cabang Jakarta; filter cabang tidak ada. | [ ] |

### Skenario 9: Administrasi dan jejak audit

**Tujuan:** Semua tindakan dapat ditelusuri, dan aturan approval dapat dilihat serta diatur.

| No | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 9.1 | `sysadmin@example.com` | Administrasi › Alur Approval. | Terlihat tahap tiap jenis dokumen. Mutasi: Supervisor, lalu Kepala Dept bila jumlah > 50. Perubahan jadwal: Supervisor, Kepala Dept bila lebih dari 1 hari, Admin Pusat bila lebih dari 7 hari. | [ ] |
| 9.2 | `sysadmin@example.com` | Administrasi › Role & Permission. | Daftar role dan jumlah izin masing-masing. | [ ] |
| 9.3 | `sysadmin@example.com` | Administrasi › Audit Log. | Tindakan keamanan dan perubahan data tercatat: siapa, kapan, apa. Tidak dapat diubah atau dihapus. | [ ] |
| 9.4 | `sysadmin@example.com` | Administrasi › Log Notifikasi. | Notifikasi dalam aplikasi berstatus Terkirim. Kanal WhatsApp/SMS/Email berstatus Gagal selama penyedia pengirim belum dihubungkan (wajar pada POC). | [ ] |
| 9.5 | `hqadmin@example.com` | Klik ikon lonceng. | Notifikasi dalam aplikasi muncul, mis. insiden yang belum direspons atau permintaan approval. | [ ] |

---

## 4. Yang wajar belum ada di POC

- Pengiriman WhatsApp/SMS/Email belum terhubung ke penyedia; yang aktif adalah notifikasi dalam aplikasi (lonceng) dan push bila diaktifkan.
- Data dan akun adalah data contoh, bukan data perusahaan. Jangan memasukkan data rahasia.
- Kecepatan di POC dipengaruhi lokasi server dan database; di produksi wilayah keduanya akan disamakan.

## 5. Lembar temuan

| No | Langkah | Login | Yang terjadi | Seharusnya | Tingkat (Kritis / Penting / Saran) |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

## 6. Penilaian akhir

| Pertanyaan | Jawaban |
|---|---|
| Apakah alur approval sesuai cara kerja yang diinginkan? | |
| Apakah pengemudi bisa melapor darurat dengan mudah di ponsel? | |
| Apakah mekanik bisa bekerja tanpa sinyal? | |
| Apakah stok dan Kartu Stok bisa dipercaya? | |
| Fitur apa yang paling dibutuhkan namun belum ada? | |
| Layak dilanjutkan ke tahap berikutnya? | |

---

## Lampiran: untuk tim teknis

1. Jalankan 9 migrasi di supabase/migrations/ berurutan (SQL Editor, satu berkas per eksekusi, jangan diulang): 20261024000001 foundation, 20261024000002 seed_reference, 20261025000001 approval_core, …000002 inventory, …000003 maintenance, …000004 emergency, …000005 jobs_reports_attachments, 20261026000001 schedule_request_by_technician, 20261026000002 incident_drivers.
2. Untuk mengulang dari nol: jalankan skrip reset (drop schema public lalu buat ulang dan grant), lalu migrasi di atas, lalu npm run seed:admin dan npm run seed:demo -- --yes. Aman diulang hanya setelah reset; seed:demo tidak menghapus data lama.
3. Isi .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). Jangan jalankan seeder di database produksi.
4. Setiap penguji sebaiknya mulai dari data demo yang bersih agar angka awal (mis. saldo 4) sama dengan panduan. Bila beberapa penguji bergantian, pakai selisih sebagai patokan.
5. Langkah 6.6 dan 6.7 memerlukan commit terbaru dan migrasi …000002 (daftar pengemudi untuk Catat Insiden, penjaga ketuk ganda).
6. Uji skenario 6 dan 7 di ponsel sungguhan sebelum diserahkan; gambar di panduan ini memakai tampilan ponsel yang ditiru di browser.
7. Jika halaman terasa lambat, samakan region fungsi Vercel dengan region Supabase.
