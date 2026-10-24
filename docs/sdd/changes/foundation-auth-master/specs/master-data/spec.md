# Spec delta: master-data

Cakupan: Cabang, Kendaraan, Sparepart, Lokasi/Gudang, Vendor/Bengkel, Kategori Alasan, Parameter Sistem.

## ADDED Requirements

### Requirement: Akses master data
Sistem SHALL mengizinkan baca master bagi pemegang `master.read` dan tulis hanya bagi pemegang `master.write` (SYS_ADMIN).

#### Scenario: Baca oleh role operasional
- **WHEN** MECHANIC membuka daftar Kendaraan cabangnya
- **THEN** daftar tampil tanpa tombol tambah/ubah

#### Scenario: Tulis oleh bukan SYS_ADMIN
- **WHEN** WAREHOUSE memanggil `POST /spareparts`
- **THEN** sistem menjawab 403

### Requirement: Kode unik
Sistem SHALL menolak data master dengan kode (atau nomor polisi untuk Kendaraan) yang sudah ada.

#### Scenario: Kode duplikat
- **WHEN** SYS_ADMIN membuat Sparepart dengan kode "OLI-001" yang sudah ada
- **THEN** sistem menolak dengan pesan "Kode sudah dipakai"

#### Scenario: Nomor polisi duplikat
- **WHEN** Kendaraan dibuat dengan nomor polisi yang sama (tanpa membedakan spasi dan huruf besar/kecil)
- **THEN** sistem menolak

### Requirement: Tanpa hapus fisik, nonaktifkan saja
Sistem SHALL tidak menyediakan hapus fisik untuk master data dan SHALL menyediakan nonaktifkan serta aktifkan kembali.

#### Scenario: DELETE
- **WHEN** klien memanggil `DELETE` pada master apa pun
- **THEN** sistem menjawab 404

#### Scenario: Nonaktifkan
- **WHEN** SYS_ADMIN menonaktifkan sebuah master
- **THEN** master tidak muncul pada pilihan form baru
- **AND** tetap tampil pada data historis yang merujuknya

#### Scenario: Masih dipakai transaksi aktif
- **WHEN** SYS_ADMIN menonaktifkan master yang dirujuk dokumen aktif (tersedia mulai slice berikutnya)
- **THEN** sistem menolak dengan pesan menyebut jumlah dokumen aktif
- **AND** pemeriksaan ini dibuat sebagai titik ekstensi sehingga slice lain cukup mendaftarkan aturannya

### Requirement: Cabang
Sistem SHALL mengizinkan tepat satu cabang bertanda Pusat.

#### Scenario: Tandai pusat kedua
- **WHEN** SYS_ADMIN menandai cabang kedua sebagai Pusat sementara sudah ada satu
- **THEN** sistem menolak dengan pesan "Hanya satu cabang pusat"

#### Scenario: Nonaktifkan cabang pusat
- **WHEN** SYS_ADMIN menonaktifkan satu-satunya cabang Pusat
- **THEN** sistem menolak

#### Scenario: Kode cabang tidak berubah
- **WHEN** kode cabang diubah setelah ada data yang merujuknya
- **THEN** sistem menolak (kode dipakai sebagai bagian penomoran dokumen)

### Requirement: Kendaraan dan odometer
Sistem SHALL menyimpan kendaraan dengan cabang, status, dan odometer, serta mencatat riwayat perubahan odometer.

#### Scenario: Odometer naik
- **WHEN** odometer kendaraan dengan nilai 10.000 km diperbarui menjadi 10.250
- **THEN** nilai baru tersimpan dan riwayat mencatat nilai lama, nilai baru, siapa, dan kapan

#### Scenario: Odometer turun
- **WHEN** odometer diperbarui menjadi 9.900
- **THEN** sistem menolak dengan pesan "Odometer tidak boleh lebih kecil dari 10.000"

#### Scenario: Status kendaraan
- **WHEN** SYS_ADMIN mengubah status manual menjadi Tidak Beroperasi
- **THEN** perubahan tersimpan; status "Dalam Perawatan" tidak dapat dipilih manual (diatur otomatis oleh WO pada slice berikutnya)

### Requirement: Sparepart
Sistem SHALL menyimpan sparepart dengan kode, nama, kategori, satuan, dan stok minimum, tanpa saldo awal dan tanpa harga.

#### Scenario: Buat sparepart
- **WHEN** SYS_ADMIN membuat sparepart dengan satuan "pcs" dan stok minimum 5
- **THEN** sparepart tersimpan Aktif

#### Scenario: Stok minimum tidak valid
- **WHEN** stok minimum diisi -1 atau bukan angka
- **THEN** sistem menolak

#### Scenario: Ubah satuan setelah ada mutasi
- **WHEN** satuan diubah pada sparepart yang sudah punya mutasi (berlaku mulai slice stok)
- **THEN** sistem menolak

### Requirement: Lokasi/Gudang
Sistem SHALL menyimpan lokasi yang selalu milik satu cabang.

#### Scenario: Buat lokasi
- **WHEN** SYS_ADMIN membuat lokasi "Gudang Utama" untuk cabang Jakarta
- **THEN** lokasi tersimpan dan hanya terlihat oleh pengguna cabang Jakarta dan HQ_ADMIN

#### Scenario: Nonaktifkan lokasi bersaldo
- **WHEN** SYS_ADMIN menonaktifkan lokasi yang masih memiliki saldo stok > 0 (berlaku mulai slice stok)
- **THEN** sistem menolak

### Requirement: Vendor/Bengkel
Sistem SHALL menyimpan vendor dengan tipe Bengkel, Derek, Asuransi, atau Supplier.

#### Scenario: Tipe tidak dikenal
- **WHEN** vendor dibuat dengan tipe "Lainnya"
- **THEN** sistem menolak; hanya empat tipe di atas yang diterima

#### Scenario: Telepon wajib
- **WHEN** vendor dibuat tanpa telepon
- **THEN** sistem menolak (kontak diperlukan untuk slice emergensi)

### Requirement: Kategori Alasan
Sistem SHALL menyediakan kategori alasan awal dan mengizinkan SYS_ADMIN mengelolanya.

#### Scenario: Data awal
- **WHEN** sistem pertama dijalankan
- **THEN** tersedia kategori: Kendaraan masih beroperasi, Sparepart belum tersedia, Kerusakan mendadak, Permintaan operasional, Cuaca/kondisi jalan, Bengkel penuh, Lainnya
- **AND** hanya "Lainnya" bertanda wajib keterangan

#### Scenario: Nonaktifkan kategori
- **WHEN** sebuah kategori dinonaktifkan
- **THEN** tidak muncul pada form baru, tetapi tetap tampil pada riwayat yang memakainya

### Requirement: Parameter Sistem
Sistem SHALL menyediakan parameter yang dapat diedit tetapi tidak dapat dibuat atau dihapus, dengan validasi tipe.

#### Scenario: Nilai awal
- **WHEN** sistem pertama dijalankan
- **THEN** parameter bernilai: lead time hari 7, lead time km 500, batas ACK insiden 5 menit, batas validasi pasca-kejadian 24 jam, reservasi stok aktif, maks lampiran 5 file dan 5 MB

#### Scenario: Nilai tidak valid
- **WHEN** lead time diisi -3 atau "abc"
- **THEN** sistem menolak dengan pesan menyebut tipe dan rentang yang benar

#### Scenario: Riwayat perubahan
- **WHEN** parameter diubah
- **THEN** nilai lama, nilai baru, user, dan waktu tercatat

### Requirement: Konkurensi pengeditan
Sistem SHALL menolak penyimpanan yang berdasar versi data yang sudah usang.

#### Scenario: Dua admin mengedit bersamaan
- **WHEN** admin A dan B membuka master yang sama, A menyimpan, lalu B menyimpan versi lamanya
- **THEN** simpanan B ditolak dengan pesan "Data diubah oleh A, muat ulang?"

#### Scenario: Versi terbaru
- **WHEN** B memuat ulang lalu menyimpan dengan versi terbaru
- **THEN** simpanan diterima dan versi bertambah satu

### Requirement: Daftar master
Sistem SHALL menampilkan daftar dengan pencarian, filter status (default Aktif), sort, dan paging 50 per halaman di sisi server.

#### Scenario: Pencarian
- **WHEN** pengguna mengetik "oli" pada pencarian Sparepart
- **THEN** daftar hanya memuat sparepart yang kode atau namanya mengandung "oli" tanpa membedakan huruf besar/kecil

#### Scenario: Filter di URL
- **WHEN** pengguna menerapkan filter lalu memuat ulang halaman
- **THEN** filter yang sama masih berlaku
