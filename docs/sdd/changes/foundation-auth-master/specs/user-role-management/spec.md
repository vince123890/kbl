# Spec delta: user-role-management

## ADDED Requirements

### Requirement: Kelola user
Sistem SHALL mengizinkan hanya pemegang permission `admin.user` (SYS_ADMIN) membuat, mengubah, menonaktifkan, dan mereset password user.

#### Scenario: Buat user
- **WHEN** SYS_ADMIN membuat user dengan nama, email unik, telepon, cabang, dan minimal satu role
- **THEN** user tersimpan Aktif dengan password awal acak dan `must_change_password = true`
- **AND** perubahan tercatat di audit log

#### Scenario: Email duplikat
- **WHEN** SYS_ADMIN membuat user dengan email yang sudah dipakai (tanpa membedakan huruf besar/kecil)
- **THEN** sistem menolak dengan pesan "Email sudah terdaftar"

#### Scenario: Tanpa role atau tanpa cabang
- **WHEN** user dibuat tanpa role atau tanpa cabang
- **THEN** sistem menolak dengan pesan field wajib

#### Scenario: Akses ditolak
- **WHEN** pengguna tanpa `admin.user` memanggil endpoint kelola user
- **THEN** sistem menjawab 403

### Requirement: Nonaktifkan user
Sistem SHALL menonaktifkan user tanpa menghapusnya, dan SHALL menolak menonaktifkan SYS_ADMIN aktif terakhir.

#### Scenario: Nonaktifkan user biasa
- **WHEN** SYS_ADMIN menonaktifkan user
- **THEN** `is_active = false`, semua sesi user diakhiri, dan data riwayat yang merujuk user tetap utuh

#### Scenario: SYS_ADMIN terakhir
- **WHEN** SYS_ADMIN mencoba menonaktifkan satu-satunya SYS_ADMIN aktif
- **THEN** sistem menolak dengan pesan "Minimal satu SYS_ADMIN aktif harus ada"

#### Scenario: Hapus fisik
- **WHEN** klien memanggil `DELETE /users/{id}`
- **THEN** sistem menjawab 404

### Requirement: Role bawaan dan kustom
Sistem SHALL menyediakan 7 role bawaan yang tidak dapat dihapus, dan mengizinkan SYS_ADMIN membuat role kustom serta mengatur permission tiap role.

#### Scenario: Role bawaan tersedia
- **WHEN** sistem pertama kali dijalankan
- **THEN** role DRIVER, MECHANIC, WAREHOUSE, SUPERVISOR, DEPT_HEAD, HQ_ADMIN, SYS_ADMIN ada dengan permission default sesuai [matriks permission](../../../../MENU-SUBMENU-SPESIFIKASI.md)

#### Scenario: Hapus role bawaan
- **WHEN** SYS_ADMIN mencoba menghapus role bawaan
- **THEN** sistem menolak

#### Scenario: Hapus role kustom yang dipakai
- **WHEN** SYS_ADMIN menghapus role kustom yang masih dimiliki user
- **THEN** sistem menolak dengan pesan menyebut jumlah user yang memakai

#### Scenario: Perubahan permission
- **WHEN** SYS_ADMIN mengubah permission sebuah role
- **THEN** perubahan berlaku bagi user role itu pada login berikutnya
- **AND** tercatat di audit log dengan sebelum/sesudah

### Requirement: Otorisasi di backend
Sistem SHALL memeriksa permission pada setiap permintaan di sisi backend, bukan hanya menyembunyikan tombol di antarmuka.

#### Scenario: Endpoint dipanggil langsung
- **WHEN** pengguna tanpa permission memanggil endpoint yang dilindungi langsung (tanpa lewat UI)
- **THEN** sistem menjawab 403 dan event ditolak tercatat

#### Scenario: Tanpa sesi
- **WHEN** permintaan tanpa sesi valid mengakses endpoint yang dilindungi
- **THEN** sistem menjawab 401

### Requirement: Pembatasan data per cabang
Sistem SHALL membatasi data yang dibaca dan ditulis ke `branch_id` milik pengguna, kecuali pengguna ber-role HQ_ADMIN.

#### Scenario: Pengguna cabang A melihat data cabang B
- **WHEN** pengguna cabang A meminta daftar atau detail data milik cabang B
- **THEN** daftar tidak memuatnya dan detail dijawab 404

#### Scenario: HQ_ADMIN
- **WHEN** HQ_ADMIN meminta daftar tanpa filter cabang
- **THEN** sistem memuat data semua cabang, dan dapat difilter per cabang

#### Scenario: Menulis ke cabang lain
- **WHEN** pengguna cabang A mengirim `branch_id` cabang B saat membuat data
- **THEN** sistem menolak dengan 403
