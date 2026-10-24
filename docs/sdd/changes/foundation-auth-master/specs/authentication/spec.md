# Spec delta: authentication

## ADDED Requirements

### Requirement: Login dengan email dan password
Sistem SHALL mengautentikasi pengguna aktif dengan email dan password, dan menerbitkan sesi yang berlaku 8 jam.

#### Scenario: Login berhasil
- **WHEN** pengguna aktif mengirim email dan password yang benar
- **THEN** sistem membuat sesi dan mengarahkan ke Dashboard
- **AND** event `LOGIN_SUCCESS` tercatat di audit log dengan user dan waktu

#### Scenario: Password salah
- **WHEN** pengguna mengirim email terdaftar dengan password salah
- **THEN** sistem menolak dengan pesan umum "Email atau password salah" (tidak menyebut mana yang salah)
- **AND** event `LOGIN_FAILED` tercatat

#### Scenario: Email tidak terdaftar
- **WHEN** pengguna mengirim email yang tidak ada
- **THEN** sistem menolak dengan pesan yang sama persis seperti password salah
- **AND** waktu respon tidak membedakan kedua kasus secara signifikan

#### Scenario: Pengguna nonaktif
- **WHEN** pengguna berstatus Nonaktif mengirim kredensial yang benar
- **THEN** sistem menolak login
- **AND** event `LOGIN_FAILED` tercatat dengan alasan `INACTIVE`

### Requirement: Penguncian akun
Sistem SHALL mengunci akun selama 15 menit setelah 5 kali gagal login berturut-turut.

#### Scenario: Akun terkunci
- **WHEN** pengguna gagal login 5 kali berturut-turut
- **THEN** percobaan ke-6 ditolak dengan pesan "Akun terkunci, coba lagi dalam 15 menit" walaupun password benar
- **AND** status user menjadi Terkunci

#### Scenario: Kunci berakhir
- **WHEN** 15 menit telah lewat sejak penguncian
- **THEN** login dengan kredensial benar berhasil
- **AND** penghitung gagal direset ke 0

#### Scenario: Login berhasil mereset penghitung
- **WHEN** pengguna gagal 3 kali lalu login benar
- **THEN** penghitung gagal direset ke 0

### Requirement: Wajib ganti password awal
Sistem SHALL memaksa pengguna mengganti password pada login pertama setelah akun dibuat atau di-reset admin.

#### Scenario: Login pertama
- **WHEN** pengguna dengan penanda `must_change_password` login berhasil
- **THEN** sistem hanya mengizinkan halaman Ganti Password
- **AND** akses ke halaman lain dijawab 403 sampai password diganti

#### Scenario: Setelah password diganti
- **WHEN** pengguna berhasil mengganti password awal
- **THEN** penanda `must_change_password` menjadi false dan akses normal pulih

### Requirement: Kebijakan password
Sistem SHALL menerima password hanya bila minimal 8 karakter dan mengandung huruf serta angka, dan SHALL menolak password yang sama dengan password saat ini.

#### Scenario: Password valid
- **WHEN** pengguna mengganti ke "Armada2026"
- **THEN** password tersimpan sebagai hash dan semua sesi lain pengguna itu diakhiri

#### Scenario: Password lemah
- **WHEN** pengguna mengganti ke "abc123" (6 karakter)
- **THEN** sistem menolak dengan pesan "Minimal 8 karakter, huruf dan angka"

#### Scenario: Password sama dengan lama
- **WHEN** password baru sama dengan password saat ini
- **THEN** sistem menolak dengan pesan "Password baru harus berbeda"

### Requirement: Lupa dan reset password
Sistem SHALL mengirim link reset sekali pakai berlaku 1 jam ke email terdaftar.

#### Scenario: Permintaan reset
- **WHEN** pengguna meminta reset untuk sebuah email, terdaftar maupun tidak
- **THEN** sistem selalu menjawab "Jika email terdaftar, link reset telah dikirim"
- **AND** hanya email terdaftar yang benar-benar menerima link

#### Scenario: Link dipakai
- **WHEN** pengguna membuka link valid dan memasukkan password baru yang memenuhi kebijakan
- **THEN** password berubah, link tidak bisa dipakai lagi, semua sesi lama pengguna diakhiri

#### Scenario: Link kedaluwarsa atau sudah dipakai
- **WHEN** link dibuka setelah 1 jam atau setelah dipakai
- **THEN** sistem menolak dengan pesan "Link tidak berlaku"

### Requirement: Logout dan kedaluwarsa sesi
Sistem SHALL mengakhiri sesi saat logout atau setelah 8 jam.

#### Scenario: Logout
- **WHEN** pengguna menekan Logout
- **THEN** sesi tidak dapat dipakai lagi dan permintaan berikutnya dijawab 401

#### Scenario: Sesi kedaluwarsa
- **WHEN** pengguna memakai sesi yang berumur lebih dari 8 jam
- **THEN** permintaan dijawab 401 dan pengguna diarahkan ke halaman login

### Requirement: Profil sendiri
Sistem SHALL mengizinkan pengguna melihat profilnya dan mengubah nama dan telepon sendiri, tetapi tidak email, role, atau cabang.

#### Scenario: Ubah telepon
- **WHEN** pengguna mengubah telepon di Profil Saya
- **THEN** perubahan tersimpan dan tercatat di audit log

#### Scenario: Coba ubah role lewat API
- **WHEN** pengguna mengirim field `roles` pada endpoint profil
- **THEN** field itu diabaikan dan role tidak berubah
