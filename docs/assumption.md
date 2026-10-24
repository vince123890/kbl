# Daftar Asumsi — Sistem Manajemen Perawatan & Sparepart Kendaraan (KBL)

| | |
|---|---|
| Versi | 0.1 (draft) |
| Tanggal | 2026-10-24 |
| Dokumen terkait | [PRD.md](PRD.md), [TECHNICAL_LOGIC.md](TECHNICAL_LOGIC.md), [requirement.docx](requirement.docx) |

## Kenapa ada asumsi

[requirement.docx](requirement.docx) hanya berisi 6 poin singkat. PRD dan Technical Logic butuh detail yang tidak ada di sana (siapa penggunanya, berapa ambang approval, bagaimana aturan jadwal, dan seterusnya). Bagian itu saya isi sendiri dengan nilai yang umum dipakai, dan ditandai **[Asumsi]** di kedua dokumen. Dokumen ini mengumpulkan semuanya: apa asumsinya, kenapa dipilih, apa dampaknya kalau salah, dan siapa yang perlu mengonfirmasi.

**Cara membaca kolom "Risiko jika salah"**: Tinggi = mengubah desain data atau alur inti, Sedang = mengubah aturan atau konfigurasi, Rendah = cukup ubah parameter.

**Status**: semua asumsi di bawah berstatus *Belum dikonfirmasi*. Ubah kolom Status saat sudah dikonfirmasi atau dikoreksi.

---

## A. Bisnis & Organisasi

| ID | Asumsi | Alasan | Risiko jika salah | Konfirmasi dari | Status |
|---|---|---|---|---|---|
| A-1 | Organisasi punya struktur **pusat dan beberapa cabang/gudang**. "Kontrol dari pusat" berarti ada peran pusat yang melihat dan menyetujui lintas cabang. | Requirement menyebut "kontrol dari pusat" dan "langkah cepat dari pusat". | Tinggi. Jika hanya satu lokasi, `branch_id` dan RBAC per cabang tidak perlu. | Manajemen / pemilik proses | Belum |
| A-2 | Peran pengguna: Mekanik, Staf Gudang, Supervisor Workshop, Kepala Departemen, Admin Pusat, Pengemudi, Admin Sistem. | Requirement menyebut "departemen lain/atasan" tanpa nama peran. | Sedang. Mengubah matriks hak akses dan konfigurasi approval. | HR / Operasional | Belum |
| A-3 | Kendaraan dikelola per unit dengan nomor polisi, odometer, dan status (aktif, dalam perawatan, tidak beroperasi). | Perlu identitas kendaraan untuk jadwal dan mutasi. Jenis armada tidak disebut. | Sedang. Jika armada campuran (alat berat, bus, truk), atribut kendaraan dan interval perawatan berbeda. | Operasional | Belum |
| A-4 | Di luar lingkup fase ini: pembelian/PO ke supplier, akuntansi dan valuasi persediaan, GPS real-time, integrasi ERP. | Requirement tidak menyebutnya; menjaga cakupan tetap kecil. | Sedang. Jika dibutuhkan, itu modul tambahan dan memengaruhi estimasi. | Product owner | Belum |
| A-5 | Sparepart dicatat **berdasarkan kuantitas saja** (tanpa harga/nilai). | Requirement hanya bicara keluar-masuk dan opname. | Sedang. Jika butuh biaya per WO atau valuasi stok, perlu kolom harga dan metode costing (FIFO/average). | Finance | Belum |

## B. Mutasi Sparepart (M1)

| ID | Asumsi | Alasan | Risiko jika salah | Konfirmasi dari | Status |
|---|---|---|---|---|---|
| B-1 | Tipe mutasi: Masuk, Keluar, **Retur, dan Transfer antar lokasi** selain dua tipe yang disebut requirement. | Praktik gudang umumnya membutuhkan retur dan transfer. | Rendah. Tipe bisa ditambah atau dikurangi. | Gudang | Belum |
| B-2 | **"Card"** = tampilan digital kartu stok (riwayat mutasi dan saldo berjalan per sparepart), bukan kartu fisik berbarcode/QR/RFID. | Kata "form digital/card" ambigu. | Tinggi bila kartu fisik dimaksudkan: perlu pemindaian QR/barcode, cetak label, dan perangkat. | Gudang / pemilik proses | Belum |
| B-3 | Stok **hanya berubah setelah dokumen disetujui dan diposting**, bukan saat form diisi. | Requirement meminta kontrol dari pusat; stok tidak boleh berubah tanpa validasi. | Sedang. Jika pemakaian harus langsung memotong stok, alur approval harus pasca-kejadian. | Gudang / Finance | Belum |
| B-4 | Dokumen yang sudah diposting **tidak bisa diubah**; koreksi memakai dokumen pembalik. | Prinsip ledger agar jejak audit utuh. | Rendah. Mengubah aturan edit saja. | Auditor / Finance | Belum |
| B-5 | Sistem melakukan **reservasi stok** untuk sparepart yang dibutuhkan WO terjadwal. | Mencegah dua WO memakai part yang sama. | Rendah. Fitur bisa dimatikan. | Gudang | Belum |
| B-6 | Stok minimum per sparepart ada dan memicu peringatan. | Praktik umum; tidak ada di requirement. | Rendah. | Gudang | Belum |

## C. Stock Opname (M2)

| ID | Asumsi | Alasan | Risiko jika salah | Konfirmasi dari | Status |
|---|---|---|---|---|---|
| C-1 | Opname dilakukan **per lokasi/gudang**, berkala maupun ad-hoc, dengan snapshot stok sistem saat sesi dibuka. | Dasar menghitung selisih. | Sedang. | Gudang | Belum |
| C-2 | Selama opname, transaksi pada lokasi tersebut bisa dibekukan, atau diterima lalu selisih dihitung ulang saat review. Belum diputuskan mana yang dipakai. | Dua praktik umum dengan konsekuensi operasional berbeda. | Sedang. Mengubah logika perhitungan selisih. | Gudang / Operasional | Belum |
| C-3 | Setiap selisih wajib punya alasan dan persetujuan sebelum penyesuaian stok diposting. | Sejalan dengan kontrol dari pusat. | Rendah. | Gudang / Finance | Belum |
| C-4 | Input hitung fisik dilakukan lewat perangkat mobile. | Petugas bekerja di rak, bukan di meja. | Sedang. Menentukan kebutuhan antarmuka mobile. | Gudang | Belum |

## D. Penjadwalan Perawatan & Perbaikan (M3)

| ID | Asumsi | Alasan | Risiko jika salah | Konfirmasi dari | Status |
|---|---|---|---|---|---|
| D-1 | Perawatan preventif dipicu oleh **interval waktu dan/atau interval pemakaian (km/jam)**, mana yang lebih dulu tercapai. | Standar perawatan kendaraan. Requirement hanya menyebut "schedule". | Tinggi bila hanya berbasis kalender: model plan lebih sederhana. Bila berbasis km, odometer harus tersedia. | Operasional / Workshop | Belum |
| D-2 | Odometer kendaraan **diinput manual** (oleh pengemudi/mekanik) dan tidak diambil otomatis dari GPS. | GPS di luar lingkup. | Sedang. Akurasi jatuh tempo bergantung disiplin input. | Operasional | Belum |
| D-3 | WO preventif dibuat otomatis **7 hari atau 500 km sebelum jatuh tempo** (lead time). | Angka umum untuk memberi waktu menyiapkan part dan slot bengkel. | Rendah. Parameter konfigurasi. | Workshop | Belum |
| D-4 | WO emergensi **boleh dieksekusi lebih dulu dan di-approve pasca-kejadian**, dengan batas sekitar 24 jam. | Emergensi tidak bisa menunggu approval. Requirement menyebut jadwal "bahkan saat emergensi". | Tinggi. Jika semua emergensi tetap harus diapprove sebelum dikerjakan, alur emergensi berubah total. | Manajemen / Operasional | Belum |
| D-5 | WO emergensi **boleh menyela** antrean dan melanggar bentrok jadwal; WO yang terdampak ditandai untuk dijadwal ulang (menjadi anomali). | Prioritas tertinggi. | Sedang. | Workshop | Belum |
| D-6 | Part untuk WO emergensi diproses dengan approval dipercepat atau auto-approve lalu direview pasca-kejadian. | Agar perbaikan tidak tertahan. | Sedang. Perlu persetujuan Finance/Gudang. | Gudang / Finance | Belum |
| D-7 | Satu rencana perawatan hanya boleh punya satu WO aktif pada satu waktu. | Mencegah WO ganda. | Rendah. | Workshop | Belum |

## E. Anomali Jadwal (M4)

| ID | Asumsi | Alasan | Risiko jika salah | Konfirmasi dari | Status |
|---|---|---|---|---|---|
| E-1 | Alasan perubahan jadwal dipilih dari **daftar kategori** (kendaraan masih beroperasi, part belum tersedia, kerusakan mendadak, permintaan operasional, cuaca/jalan, bengkel penuh, lainnya) ditambah keterangan teks. | Alasan terstruktur memudahkan laporan. Requirement hanya menyebut "beserta alasan". | Rendah. Daftar dikelola sebagai master. | Operasional | Belum |
| E-2 | Eskalasi approval perubahan jadwal berdasarkan selisih: ≤ 1 hari = Supervisor; > 1 hari = ditambah Kepala Departemen; > 7 hari atau WO sudah overdue = ditambah Admin Pusat. | Angka contoh untuk menunjukkan mekanisme ambang. | Rendah. Konfigurasi. | Manajemen | Belum |
| E-3 | Semua perubahan jadwal, termasuk percepatan, **wajib** diapprove. | Percepatan juga menyimpang dari rencana. | Sedang. Jika percepatan kecil boleh tanpa approval, perlu aturan pengecualian. | Operasional | Belum |

## F. Approval (M5)

| ID | Asumsi | Alasan | Risiko jika salah | Konfirmasi dari | Status |
|---|---|---|---|---|---|
| F-1 | Dokumen yang butuh approval: mutasi sparepart, penyesuaian opname, perubahan jadwal, WO emergensi (pasca-kejadian), dan WO dengan biaya di atas ambang. | Mewakili semua titik kontrol dari requirement. | Sedang. | Manajemen | Belum |
| F-2 | Jalur approval **dikonfigurasi per jenis dokumen** dan dapat bersyarat (nilai, selisih, durasi). Level, departemen, dan ambang konkret belum diketahui. | Organisasi berbeda punya jenjang berbeda. | Rendah di desain (konfigurable), tinggi di operasional: tanpa data ini sistem belum bisa dipakai. | Manajemen / Departemen terkait | Belum |
| F-3 | **Pengaju tidak boleh menyetujui dokumennya sendiri** (segregation of duties). | Praktik kontrol standar. | Rendah. | Auditor | Belum |
| F-4 | Ada SLA approval dengan reminder dan eskalasi otomatis bila terlambat. | Mencegah dokumen macet. | Rendah. | Manajemen | Belum |
| F-5 | Admin Pusat boleh melakukan **override** dengan catatan wajib dan tercatat di audit. | Kontrol pusat harus bisa memotong antrean yang macet. | Sedang. Perlu persetujuan kebijakan. | Manajemen | Belum |

## G. Emergensi di Jalan (M6)

| ID | Asumsi | Alasan | Risiko jika salah | Konfirmasi dari | Status |
|---|---|---|---|---|---|
| G-1 | Pengemudi melapor lewat **ponsel** (web/PWA) dengan form minimal: kendaraan dan jenis kejadian wajib, lokasi diambil otomatis. | Dalam keadaan darurat, input harus sesedikit mungkin. | Sedang. Jika pengemudi tidak punya ponsel/data, kanal lain (telepon ke call center) jadi utama. | Operasional | Belum |
| G-2 | "Kontak dan langkah cepat dari pusat" diwujudkan sebagai **kontak darurat (tombol telepon)** dan **playbook langkah keselamatan** per jenis kejadian, dikelola oleh pusat. | Requirement tidak merinci bentuknya. | Sedang. Jika pusat ingin chat langsung atau panggilan dari dalam aplikasi, ada fitur tambahan. | Pusat / Operasional | Belum |
| G-3 | Jenis kejadian: mogok, kecelakaan, ban, kebakaran, medis, lainnya. | Kategori umum. | Rendah. | Operasional / HSE | Belum |
| G-4 | Kontak darurat bisa berbeda per cabang/wilayah, dengan kontak pusat selalu tersedia. | Derek dan bengkel bersifat lokal. | Sedang. | Pusat | Belum |
| G-5 | Insiden tanpa konfirmasi (ACK) pusat dalam **5 menit** dieskalasi ke kontak berikutnya. | Angka contoh agar tidak ada laporan terbengkalai. | Rendah. Parameter. | Pusat | Belum |
| G-6 | Laporan dapat **diantre saat offline** dan dikirim ulang tanpa duplikat; layar langkah cepat dan kontak di-cache; ada fallback panggil/SMS ke pusat. | Jalan sering tanpa sinyal stabil. | Sedang. Menambah kompleksitas klien (PWA/penyimpanan lokal). | Tim teknis | Belum |
| G-7 | Notifikasi emergensi lewat push dan **WhatsApp/SMS** (kanal prioritas tinggi). | Notifikasi harus menjangkau orang pusat di mana pun. | Sedang. WhatsApp/SMS butuh penyedia berbayar dan setup. | Pusat / IT | Belum |

## H. Non-Fungsional & Teknis

| ID | Asumsi | Alasan | Risiko jika salah | Konfirmasi dari | Status |
|---|---|---|---|---|---|
| H-1 | Target ketersediaan ≥ 99,5% pada jam kerja; modul emergensi prioritas tertinggi. | Angka umum untuk sistem operasional internal. | Rendah. | Manajemen / IT | Belum |
| H-2 | Waktu muat halaman utama < 3 detik; notifikasi emergensi ke pusat < 10 detik; respon API emergensi < 2 detik. | Target awal wajar. | Rendah. | Tim teknis | Belum |
| H-3 | Platform berupa **web responsif/PWA**, tanpa aplikasi native. | Satu basis kode, mudah didistribusikan. | Sedang. Jika butuh aplikasi native (notifikasi latar belakang, akses perangkat lebih dalam), biaya naik. | Product owner | Belum |
| H-4 | Database relasional dengan transaksi ACID; stok memakai ledger append-only dan row lock saat posting. | Integritas stok adalah kebutuhan inti. | Rendah. | Tim teknis | Belum |
| H-5 | Penomoran dokumen berformat `{PREFIX}-{CABANG}-{YYYYMM}-{urut}`. | Mudah dilacak per cabang dan bulan. | Rendah. | Gudang / Finance | Belum |
| H-6 | Stack teknologi belum ditentukan; dokumen teknis sengaja netral. | Belum ada kode atau keputusan di proyek. | Rendah. | Tim teknis | Belum |
| H-7 | Metrik keberhasilan (mis. waktu respon emergensi < 5 menit, ≥ 95% perubahan jadwal beralasan) adalah target usulan, bukan angka dari bisnis. | Perlu ukuran agar sukses bisa dinilai. | Rendah. | Manajemen | Belum |
| H-8 | Rencana rilis: Fase 1 (master, mutasi, opname, approval dasar), Fase 2 (jadwal, anomali, dashboard), Fase 3 (emergensi, notifikasi lanjutan, laporan). | Urutan berdasarkan ketergantungan antar modul. | Sedang. Jika keselamatan prioritas utama, M6 dimajukan. | Product owner | Belum |

---

## Asumsi yang paling perlu dikonfirmasi lebih dulu

Urutan berdasarkan dampak terhadap desain:

1. **A-1** Struktur pusat-cabang (mengubah model data dan hak akses).
2. **B-2** Arti "card": kartu digital atau kartu fisik berbarcode.
3. **D-4** Apakah emergensi boleh dikerjakan dulu, di-approve belakangan.
4. **D-1** Dasar interval perawatan: waktu, km, atau keduanya.
5. **F-2** Level, departemen, dan ambang approval yang sebenarnya.
6. **G-2** Bentuk "langkah cepat dari pusat": telepon dan checklist saja, atau ada komunikasi langsung di aplikasi.

## Cara memperbarui dokumen ini

- Setelah sebuah asumsi dikonfirmasi: ubah Status menjadi *Dikonfirmasi* dan hapus tanda **[Asumsi]** di [PRD.md](PRD.md) / [TECHNICAL_LOGIC.md](TECHNICAL_LOGIC.md).
- Jika dikoreksi: ubah Status menjadi *Dikoreksi*, tulis nilai yang benar di kolom Asumsi, lalu sesuaikan PRD dan Technical Logic.
