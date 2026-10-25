# Panduan Uji Mandiri POC — Aplikasi Perawatan & Sparepart Kendaraan

Dokumen ini untuk **pengguna yang akan mencoba POC sendiri**. Tidak perlu latar belakang teknis. Ikuti skenario berurutan, centang hasilnya, dan catat temuan di bagian akhir.

- Alamat aplikasi: https://kbl-fawn.vercel.app (halaman aplikasi ada di `/login`)
- Password semua akun demo: `Demo12345`
- Estimasi waktu: ±45 menit untuk semua skenario, atau ±10 menit per skenario.

---

## 1. Gambaran singkat

Aplikasi ini mencatat empat hal yang saling berkaitan:

```
 Rencana Perawatan ──(jatuh tempo)──► Work Order ──(butuh sparepart)──► Mutasi / Stok
        │                                  │                                  │
        │                                  └─ Perubahan Jadwal                └─ Stock Opname
        │                                       │                                  │
        └──────────────────── semuanya lewat ► Approval (berjenjang) ◄─────────────┘

 Pengemudi di lapangan ──► Lapor Darurat ──► Insiden ──► Derek / Teknisi / WO Emergensi
```

Prinsip yang bisa Anda buktikan saat mencoba:

1. **Setiap orang hanya melihat dan melakukan yang menjadi tugasnya** (peran/role).
2. **Perubahan stok tidak langsung terjadi**; harus disetujui atasan, dan tercatat di Kartu Stok.
3. **Orang yang mengajukan tidak boleh menyetujui dokumennya sendiri.**
4. **Laporan darurat harus cepat**, bahkan di ponsel dengan sinyal buruk atau tanpa sinyal.

---

## 2. Persiapan

| Kebutuhan | Keterangan |
|---|---|
| Peramban | Chrome atau Edge terbaru (komputer), Chrome (Android), Safari (iPhone) |
| Dua jendela | Pakai **jendela biasa + jendela incognito/private**, atau dua peramban, agar bisa login sebagai dua orang sekaligus |
| Ponsel (opsional) | Dibutuhkan untuk skenario 6 (instal PWA) dan 7 (offline) |
| Data demo | Harus sudah diisi oleh tim teknis dengan `npm run seed:demo -- --yes`. Jika setelah login semua daftar kosong, minta tim teknis menjalankannya |

> **Catatan kecepatan:** membuka halaman pertama setelah lama tidak dipakai bisa lebih lambat (server "bangun" dulu). Buka ulang halaman yang sama untuk melihat kecepatan normal.

### Daftar akun demo

| Email | Peran | Cabang | Dipakai untuk |
|---|---|---|---|
| `sysadmin@example.com` | Admin Sistem | Pusat | Master data, user, role, alur approval, audit |
| `hqadmin@example.com` | Admin Pusat | Pusat | Melihat lintas cabang, mencatat insiden dari telepon, laporan |
| `depthead.jkt@example.com` | Kepala Departemen | Jakarta | Approval level lanjut |
| `supervisor.jkt@example.com` | Supervisor | Jakarta | Approval level 1, rencana, WO (tidak mengajukan perubahan jadwal) |
| `warehouse.jkt@example.com` | Gudang | Jakarta | Mutasi sparepart, stock opname |
| `mechanic.jkt@example.com` | Mekanik | Jakarta | Menjalankan Work Order, mengajukan perubahan jadwal |
| `driver.jkt@example.com` | Pengemudi | Jakarta | Lapor darurat (kendaraan **B 9001 KBL**) |
| `supervisor.sby@example.com` | Supervisor | Surabaya | Uji pemisahan antar cabang |
| `gudang.supervisor.jkt@example.com` | Gudang + Supervisor | Jakarta | Uji larangan menyetujui dokumen sendiri |
| `nonaktif.jkt@example.com` | Mekanik (nonaktif) | Jakarta | Uji akun dinonaktifkan: **harus ditolak** |

Akun lain (Gudang, Mekanik, Pengemudi Surabaya) tersedia untuk uji pemisahan cabang.

### Data contoh yang sudah ada

- Kendaraan Jakarta: B 9001 KBL (Hino 500), B 9002 KBL, B 7101 KBL (Bus), B 5201 KBL (Pick-up). Surabaya: L 8001 KBL, L 8002 KBL. Bandung: D 6001 KBL.
- 16 sparepart (oli, filter, kampas rem, aki, ban, dll.). Beberapa **sengaja di bawah stok minimum** (contoh: Filter Udara Hino 500 tinggal 3, minimum 6; Kampas Rem Depan tinggal 2, minimum 4).
- 5 rencana perawatan, beberapa **sudah dekat jatuh tempo**, sehingga Work Order preventif terbentuk otomatis.
- Menunggu keputusan: 1 perubahan jadwal, 1 stock opname dengan selisih, 1 insiden belum dikonfirmasi.

---

## 3. Skenario uji

Tiap skenario: **Tujuan → Login sebagai → Langkah → Hasil yang diharapkan**. Centang `[ ]` bila hasilnya sesuai.

### Skenario 1 — Login, peran, dan batas akses

**Tujuan:** setiap orang hanya melihat menu sesuai perannya.

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 1.1 | Buka `/login`, masuk sebagai `sysadmin@example.com` | Masuk ke Dashboard. Menu lengkap termasuk **Administrasi** | [ ] |
| 1.2 | Keluar, masuk sebagai `driver.jkt@example.com` | Menu jauh lebih sedikit; tidak ada Master Data, Administrasi, atau Laporan | [ ] |
| 1.3 | Sebagai pengemudi, ketik manual alamat `/admin/users` | Muncul halaman "tidak berhak", bukan data | [ ] |
| 1.4 | Coba masuk sebagai `nonaktif.jkt@example.com` | **Ditolak** | [ ] |
| 1.5 | Masuk sebagai `mechanic.sby@example.com`, buka Work Order | Hanya WO cabang Surabaya; WO Jakarta tidak tampil | [ ] |

### Skenario 2 — Mutasi sparepart masuk ke stok (dengan approval)

**Tujuan:** membuktikan stok baru berubah **hanya setelah disetujui**.

| # | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 2.1 | `warehouse.jkt@example.com` | Inventori Sparepart › **Saldo Stok**. Catat saldo "Filter Udara Hino 500" di Gudang Utama Jakarta (**3**) | Saldo terlihat | [ ] |
| 2.2 | sama | **Mutasi Sparepart** › buat baru, jenis **Masuk**, tujuan Gudang Utama Jakarta, tambah Filter Udara Hino 500 × **10**, simpan lalu **ajukan** | Status **Diajukan** | [ ] |
| 2.3 | sama | Buka lagi **Saldo Stok** | Saldo **masih 3** (belum berubah) | [ ] |
| 2.4 | `supervisor.jkt@example.com` | Approval › **Kotak Masuk**, buka permintaan tadi, klik **Setujui** | Status menjadi **Diposting** | [ ] |
| 2.5 | `warehouse.jkt@example.com` | **Saldo Stok** dan **Kartu Stok** untuk Filter Udara | Saldo jadi **13**; Kartu Stok mencatat baris masuk +10 | [ ] |
| 2.6 | sama | Ulangi 2.2 dengan jumlah **60** lalu minta Supervisor menyetujui | Setelah Supervisor, permintaan **masih menunggu Kepala Dept** (jumlah di atas 50 butuh dua level). Setujui dengan `depthead.jkt@example.com` baru diposting | [ ] |

**Uji tambahan — tolak & revisi:** buat mutasi baru, lalu Supervisor memilih **Tolak** (wajib isi alasan) atau **Minta revisi**. Dokumen kembali ke Gudang dan stok tidak berubah.

### Skenario 3 — Larangan menyetujui dokumen sendiri

**Tujuan:** membuktikan pemisahan tugas.

| # | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 3.1 | `gudang.supervisor.jkt@example.com` | Buat mutasi Masuk kecil lalu ajukan | Status Diajukan | [ ] |
| 3.2 | sama | Buka **Kotak Masuk** / halaman permintaan itu | Tidak bisa menyetujui permintaan miliknya sendiri | [ ] |
| 3.3 | `supervisor.jkt@example.com` | Setujui | Berhasil | [ ] |

### Skenario 4 — Perawatan: dari rencana ke Work Order selesai

**Tujuan:** melihat siklus perawatan penuh, termasuk pemakaian sparepart.

| # | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 4.1 | `supervisor.jkt@example.com` | Perawatan › **Rencana Perawatan** | Ada 5 rencana; sebagian berstatus mendekati/lewat jatuh tempo (mis. "Ganti oli mesin dan filter oli" B 9001 KBL) | [ ] |
| 4.2 | sama | Perawatan › **Work Order** | WO preventif sudah terbentuk otomatis untuk rencana yang jatuh tempo | [ ] |
| 4.3 | sama | **Kalender Jadwal** | WO tampil pada tanggal jadwalnya | [ ] |
| 4.4 | sama | Buat WO **Korektif** baru: kendaraan B 5201 KBL, keluhan "Lampu depan mati", sparepart Lampu Depan H4 × 2 dari Workshop Jakarta, tugaskan ke Maman Mekanik | WO tersimpan berstatus **Scheduled** | [ ] |
| 4.5 | `mechanic.jkt@example.com` | Buka WO tadi, klik **Mulai** | Status **In Progress** | [ ] |
| 4.6 | sama | Selesaikan WO (isi catatan, jumlah sparepart yang terpakai, lampirkan foto bila ada) | Status **Completed**; stok Lampu Depan di Workshop **berkurang 2**; terlihat di **Kartu Stok** | [ ] |
| 4.7 | `supervisor.jkt@example.com` | Buka kendaraan di Master Data | Riwayat perawatan kendaraan bertambah | [ ] |

### Skenario 5 — Perubahan jadwal & Stock Opname

**Tujuan:** menguji approval untuk dua jenis dokumen lain.

| # | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 5.1 | `supervisor.jkt@example.com` | Buka WO B 5201 KBL dari skenario 4.4 | **Tidak ada tombol "Ajukan perubahan jadwal"** (Supervisor hanya memutuskan, tidak mengajukan) | [ ] |
| 5.2 | `mechanic.jkt@example.com` | Buka WO yang sama (ditugaskan kepadanya), klik **Ajukan perubahan jadwal**, pilih alasan, geser 2 hari, kirim | Pengajuan terbentuk, menunggu Supervisor | [ ] |
| 5.3 | `supervisor.jkt@example.com` | Approval › **Kotak Masuk**, buka pengajuan tadi atau pengajuan demo (WO B 9002 KBL, "Kampas rem belakang menunggu pengiriman"), **Setujui** | Naik ke level berikutnya (Kepala Dept) karena penundaan lebih dari 1 hari | [ ] |
| 5.4 | `depthead.jkt@example.com` | Setujui pengajuan yang sama | Jadwal WO berpindah | [ ] |
| 5.5 | `mechanic.sby@example.com` | Buka WO Jakarta yang sama (atau WO milik mekanik lain) | WO tidak terlihat / tidak bisa diajukan: hanya teknisi yang ditugaskan pada WO itu | [ ] |
| 5.6 | `supervisor.jkt@example.com` | Inventori › **Stock Opname** | Ada 1 sesi opname kategori Filter dengan selisih. Buka dan setujui | [ ] |
| 5.7 | `warehouse.jkt@example.com` | **Kartu Stok** item yang selisih | Muncul baris **Penyesuaian** hasil opname | [ ] |
| 5.8 | sama | Buka sesi opname baru, isi hitungan fisik berbeda dari sistem | Selisih dihitung otomatis dan wajib diberi alasan | [ ] |

### Skenario 6 — Darurat di lapangan (pengemudi, ponsel)

**Tujuan:** membuktikan laporan darurat cepat dan ditangani pusat.

| # | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 6.1 | `driver.jkt@example.com` (ponsel) | Ketuk tombol merah **Darurat** (bar bawah) | Halaman lapor darurat, hanya sedikit isian | [ ] |
| 6.2 | sama | Pilih jenis (mis. Mogok / Ban), izinkan lokasi, kirim | Muncul nomor insiden dan **kontak darurat** serta **langkah cepat** yang bisa langsung diikuti | [ ] |
| 6.3 | `hqadmin@example.com` | Emergensi › **Insiden** | Insiden baru tampil di atas; lencana merah pada menu menunjukkan insiden **belum dikonfirmasi** | [ ] |
| 6.4 | sama | Buka insiden, klik **Acknowledge** | Status berubah; pengemudi bisa melihatnya | [ ] |
| 6.5 | sama | **Tugaskan derek** (isi catatan), lalu **Selesaikan**, lalu **Tutup insiden** | Setiap langkah tercatat di **Log insiden** lengkap dengan waktu dan nama | [ ] |
| 6.6 | `hqadmin@example.com` | **Catat insiden** dari telepon untuk pengemudi tertentu | Insiden tercatat bertanda "dicatat pusat" | [ ] |
| 6.7 | pengemudi | Kirim laporan yang sama dua kali (ketuk dua kali / kirim ulang) | Tidak terbentuk dua insiden | [ ] |

### Skenario 7 — Bekerja tanpa sinyal (offline) dan sinkron

**Tujuan:** membuktikan lapangan tetap bisa bekerja saat sinyal hilang.

> Lakukan di ponsel/komputer. Buka aplikasi **dengan sinyal** dulu agar data tersimpan.

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 7.1 | Login sebagai `mechanic.jkt@example.com`, buka halaman **Work Order** sekali (data tersimpan di perangkat) | Daftar tampil | [ ] |
| 7.2 | Aktifkan **mode pesawat** (atau matikan Wi-Fi), lalu buka ulang aplikasi | Halaman **Offline** muncul berisi **Tugas Saya** dan lencana "Offline" | [ ] |
| 7.3 | Saat offline, lakukan satu aksi (mis. mulai/selesaikan WO atau tambah foto) | Aksi diterima dan masuk **antrean sinkron** (ada penghitung antrean) | [ ] |
| 7.4 | Matikan mode pesawat | Antrean terkirim otomatis; penghitung kembali 0 | [ ] |
| 7.5 | Login ulang sebagai supervisor, cek WO tadi | Perubahan sudah tercatat di server | [ ] |
| 7.6 | Sebagai `driver.jkt@example.com` saat offline, buka **Darurat** | Kontak darurat dan langkah cepat **tetap tampil**; laporan tersimpan dan terkirim saat sinyal kembali | [ ] |

**Instal sebagai aplikasi (PWA):** di Chrome Android pilih menu ⋮ › *Instal aplikasi*; di iPhone Safari pilih Bagikan › *Tambah ke Layar Utama*. Ikon aplikasi akan muncul di layar utama.

### Skenario 8 — Dashboard, laporan, dan pencarian

| # | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 8.1 | `hqadmin@example.com` | Buka **Dashboard** | Widget: stok kritis, WO overdue/hari ini, approval menunggu, insiden aktif; angkanya sesuai data | [ ] |
| 8.2 | sama | Buka **Laporan**, pilih satu laporan, atur filter | Tabel terisi sesuai filter | [ ] |
| 8.3 | sama | Unduh hasil laporan (CSV) / **Cetak** | File terunduh / tampilan cetak rapi | [ ] |
| 8.4 | `supervisor.jkt@example.com` | Buka **Laporan** | Hanya data cabang Jakarta | [ ] |

### Skenario 9 — Administrasi & jejak audit

| # | Login sebagai | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 9.1 | `sysadmin@example.com` | Administrasi › **Alur Approval** | Terlihat urutan approver per jenis dokumen (mis. Mutasi: Supervisor, lalu Kepala Dept bila jumlah > 50) | [ ] |
| 9.2 | sama | Administrasi › **Role & Permission** | Daftar hak akses per peran | [ ] |
| 9.3 | sama | Administrasi › **Audit Log** | Semua tindakan di skenario sebelumnya tercatat: siapa, kapan, apa | [ ] |
| 9.4 | sama | Administrasi › **Log Notifikasi** | Notifikasi yang terkirim/tertunda terlihat. Pesan lewat WhatsApp/SMS/Email tampil **Gagal** selama penyedia kirimnya belum dihubungkan (**wajar pada POC**) | [ ] |
| 9.5 | `hqadmin@example.com` | Klik ikon **lonceng** | Notifikasi dalam aplikasi muncul (mis. permintaan approval baru) | [ ] |

---

## 4. Yang wajar belum ada di POC

Agar tidak dianggap kekurangan saat uji:

- Pengiriman **WhatsApp/SMS/Email** belum terhubung ke penyedia; yang aktif adalah notifikasi dalam aplikasi (lonceng) dan push (jika diaktifkan).
- Data dan akun di atas adalah **data contoh**, bukan data perusahaan. Jangan memasukkan data rahasia.
- Kecepatan di POC dipengaruhi lokasi server dan database; di produksi akan disamakan wilayahnya.

---

## 5. Lembar temuan

Catat setiap hal yang tidak sesuai. Satu baris per temuan.

| No | Skenario / langkah | Login sebagai | Yang dilakukan | Yang terjadi | Seharusnya | Tingkat (Kritis / Penting / Saran) |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

**Tips melaporkan:** sertakan tangkapan layar, jam kejadian, dan jenis perangkat (mis. "Android Chrome"). Semakin jelas langkahnya, semakin cepat diperbaiki.

---

## 6. Penilaian akhir

| Pertanyaan | Jawaban |
|---|---|
| Apakah alur approval sesuai cara kerja yang diinginkan? | Ya / Sebagian / Tidak |
| Apakah pengemudi bisa melapor darurat dengan mudah di ponsel? | Ya / Sebagian / Tidak |
| Apakah mekanik bisa bekerja tanpa sinyal? | Ya / Sebagian / Tidak |
| Apakah stok dan Kartu Stok bisa dipercaya? | Ya / Sebagian / Tidak |
| Fitur apa yang paling dibutuhkan namun belum ada? | |
| Layak dilanjutkan ke tahap berikutnya? | Ya / Ya dengan catatan / Tidak |

---

## Lampiran — Untuk tim teknis (penyiapan sebelum uji)

1. Pastikan seluruh migrasi `supabase/migrations/` sudah dijalankan berurutan, **termasuk `20261026000001_schedule_request_by_technician.sql`** (mengalihkan hak mengajukan perubahan jadwal dari Supervisor ke Mekanik).
   - **Jika data demo sudah terisi sebelum migrasi itu:** pengajuan demo lama (PJ-JKT-…-0001) diajukan oleh Supervisor dan macet. Masuk sebagai `supervisor.jkt@example.com`, buka pengajuan itu di **Perubahan Jadwal**, klik **Tarik kembali**. Lalu masuk sebagai `mechanic.jkt@example.com` dan ajukan ulang untuk WO B 9002 KBL (seeder tidak membuat ulang karena sudah ada data).
2. Isi `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), lalu jalankan `npm run seed:demo -- --yes`. Aman diulang. **Jangan di database produksi.**
3. Setelah deploy, uji skenario 6 dan 7 di ponsel sungguhan, karena perilaku PWA dan offline paling mudah berbeda antar perangkat.
4. Jika semua halaman terasa lambat, samakan region fungsi Vercel dengan region Supabase.
