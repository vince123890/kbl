# Spec delta: audit-log

## ADDED Requirements

### Requirement: Pencatatan perubahan
Sistem SHALL mencatat setiap pembuatan, perubahan, nonaktifkan, dan perubahan permission atas user, role, dan master data, beserta nilai sebelum dan sesudah.

#### Scenario: Ubah master
- **WHEN** SYS_ADMIN mengubah stok minimum sparepart dari 5 menjadi 8
- **THEN** satu entri audit tercatat berisi entitas, id, aksi `UPDATE`, user, waktu, nilai sebelum `5` dan sesudah `8`

#### Scenario: Perubahan gagal
- **WHEN** simpanan ditolak karena validasi
- **THEN** tidak ada entri audit untuk perubahan data (hanya entri keamanan bila relevan)

#### Scenario: Data sensitif
- **WHEN** password diganti atau di-reset
- **THEN** entri audit mencatat kejadian tanpa menyimpan password atau hash-nya

### Requirement: Pencatatan keamanan
Sistem SHALL mencatat event login berhasil, login gagal, penguncian akun, logout, penolakan akses (403), dan reset password.

#### Scenario: Penguncian
- **WHEN** akun terkunci karena 5 kali gagal
- **THEN** entri `ACCOUNT_LOCKED` tercatat dengan user dan alamat IP

#### Scenario: Akses ditolak
- **WHEN** permintaan dijawab 403
- **THEN** entri `ACCESS_DENIED` tercatat dengan user, endpoint, dan permission yang dibutuhkan

### Requirement: Tidak dapat diubah
Sistem SHALL menyimpan audit log secara append-only: tidak ada endpoint atau tombol untuk mengubah atau menghapus entri.

#### Scenario: Ubah atau hapus entri
- **WHEN** klien memanggil `PUT`/`PATCH`/`DELETE` pada entri audit
- **THEN** sistem menjawab 404 (atau 405) dan entri tidak berubah

#### Scenario: Kegagalan pencatatan
- **WHEN** penulisan audit gagal saat perubahan data
- **THEN** perubahan data ikut dibatalkan (dalam transaksi yang sama) agar tidak ada perubahan tanpa jejak

### Requirement: Penelusuran audit
Sistem SHALL mengizinkan hanya pemegang `audit.view` (HQ_ADMIN, SYS_ADMIN) melihat audit log dengan filter entitas, user, aksi, dan rentang tanggal, serta tampilan sebelum/sesudah.

#### Scenario: Filter
- **WHEN** HQ_ADMIN memfilter entitas `Sparepart` dan rentang 1–7 Oktober 2026
- **THEN** hanya entri yang cocok tampil, terbaru dulu, paging 50 per halaman

#### Scenario: Akses ditolak
- **WHEN** SUPERVISOR membuka Audit Log
- **THEN** sistem menjawab 403

#### Scenario: Lihat diff
- **WHEN** pengguna membuka satu entri UPDATE
- **THEN** sistem menampilkan field yang berubah dengan nilai sebelum dan sesudah

### Requirement: Ekspor
Sistem SHALL mengizinkan ekspor hasil filter audit ke Excel bagi pemegang `report.export`.

#### Scenario: Ekspor terfilter
- **WHEN** pengguna mengekspor setelah menerapkan filter
- **THEN** berkas hanya memuat entri yang cocok dengan filter itu

#### Scenario: Tanpa izin ekspor
- **WHEN** pengguna tanpa `report.export` memanggil endpoint ekspor
- **THEN** sistem menjawab 403
