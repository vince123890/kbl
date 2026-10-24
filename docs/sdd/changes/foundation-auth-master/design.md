# Design: foundation-auth-master

## Context
Proyek baru, belum ada kode. Stack belum diputuskan (lihat Open Questions); keputusan di bawah ditulis netral di mana mungkin dan menyebut usulan stack bila perlu. Konteks bisnis: [config.md](../../config.md), model data awal di [../../../TECHNICAL_LOGIC.md](../../../TECHNICAL_LOGIC.md) §2.

## Goals / Non-Goals
**Goals:**
- Fondasi autentikasi, RBAC per permission dan per cabang yang dipakai semua slice.
- Master data lengkap dengan pola seragam (kode unik, nonaktif, rowVersion).
- Audit log append-only yang atomik dengan perubahan data.

**Non-Goals:**
- Approval engine, stok, perawatan, emergensi (slice berikutnya).
- SSO, MFA, notifikasi WhatsApp/SMS.

## Decisions

### D1. Sesi: token akses berumur pendek + refresh, disimpan di cookie HttpOnly
- **Rationale**: Sesi harus dapat diakhiri server-side (logout, nonaktifkan user, ganti password) dan tidak terbaca skrip. Tabel `sessions` menyimpan ID sesi; token merujuk ke sana sehingga bisa dicabut.
- **Alternatives considered**: JWT murni tanpa penyimpanan (tidak bisa dicabut sebelum kedaluwarsa, ditolak); token di localStorage (rentan XSS, ditolak).

### D2. Hash password dengan argon2id
- **Rationale**: Standar saat ini, tahan serangan GPU. Cadangan bcrypt bila argon2 tidak tersedia di lingkungan.
- **Alternatives considered**: bcrypt (lebih tua, masih diterima), SHA/MD5 (ditolak).

### D3. RBAC berbasis permission; role hanya pengelompokan
- **Rationale**: Backend memeriksa permission (`stock.create`, dst.), sehingga role kustom dan perubahan matriks tidak mengubah kode. Permission dimuat saat login dan disimpan di sesi; berlaku login berikutnya (sesuai spec).
- **Alternatives considered**: cek nama role di kode (kaku, ditolak).

### D4. Filter cabang diterapkan di lapisan repository, bukan di controller
- **Rationale**: Mencegah lupa memfilter di endpoint baru. Repository dasar menerima konteks pengguna dan menambahkan `branch_id` otomatis kecuali permission lintas cabang. Akses ke data cabang lain mengembalikan 404 (bukan 403) agar keberadaannya tidak bocor.
- **Alternatives considered**: filter manual per endpoint (mudah terlewat); row-level security di DB (kuat, tetapi kompleks untuk tim kecil, dipertimbangkan nanti).

### D5. Audit log ditulis dalam transaksi yang sama dengan perubahan data
- **Rationale**: Menjamin tidak ada perubahan tanpa jejak. Tabel `audit_logs` hanya menerima INSERT; akun DB aplikasi tidak diberi hak UPDATE/DELETE pada tabel ini.
- **Alternatives considered**: pencatatan asinkron lewat antrean (bisa hilang saat gagal, ditolak untuk data sensitif).

### D6. Nonaktifkan lewat "pemeriksa ketergantungan" yang dapat didaftar
- **Rationale**: Slice sekarang belum punya transaksi, tetapi aturan "tidak boleh dinonaktifkan bila dipakai dokumen aktif" harus bisa ditambah slice lain tanpa mengubah modul master. Antarmuka: `DeactivationGuard.check(entity, id) → {blocked, reason, count}`; modul lain mendaftarkan guard-nya.
- **Alternatives considered**: query langsung ke tabel transaksi dari modul master (membuat dependensi terbalik, ditolak).

### D7. Optimistic locking dengan `row_version`
- **Rationale**: Mencegah timpa-menimpa (spec: Konkurensi pengeditan). Klien mengirim versi (`If-Match`); versi lama ditolak 409.
- **Alternatives considered**: last-write-wins (menimpa diam-diam, ditolak).

### D8. Login tidak membocorkan keberadaan akun
- **Rationale**: Pesan sama untuk email salah dan password salah; reset password selalu menjawab sama. Untuk email tak terdaftar tetap jalankan verifikasi hash dummy agar waktu respon seragam.

## Interface / Data / Arsitektur

**Tabel baru** (kolom inti; `created_at/by`, `updated_at/by`, `row_version` pada semuanya, tidak diulang):

| Tabel | Kolom |
|---|---|
| `branches` | id, code (unik), name, address, phone, is_hq, is_active |
| `users` | id, name, email (unik, case-insensitive), phone, password_hash, branch_id, status (ACTIVE/INACTIVE/LOCKED), failed_attempts, locked_until, must_change_password, last_login_at |
| `roles` | id, name (unik), is_builtin |
| `permissions` | id, code (unik) |
| `role_permissions` | role_id, permission_id |
| `user_roles` | user_id, role_id |
| `sessions` | id, user_id, issued_at, expires_at, revoked_at, ip |
| `password_resets` | id, user_id, token_hash, expires_at, used_at |
| `vehicles` | id, plate_no (unik, dinormalisasi), type, model, year, branch_id, odometer, status, main_driver_id?, notes, is_active |
| `vehicle_odometer_logs` | id, vehicle_id, old_value, new_value, by, at |
| `spareparts` | id, code (unik), name, category, uom, min_stock, description, photo_url?, is_active |
| `locations` | id, branch_id, code (unik per cabang), name, notes, is_active |
| `vendors` | id, name, type (BENGKEL/DEREK/ASURANSI/SUPPLIER), phone, address, region, pic, is_active |
| `reason_codes` | id, code (unik), name, used_for, require_note, is_active |
| `system_parameters` | key (PK), value, type, group, min?, max? |
| `system_parameter_logs` | id, key, old_value, new_value, by, at |
| `audit_logs` | id, at, user_id?, entity, entity_id, action, before (JSON), after (JSON), ip, meta (JSON) |

**Endpoint (REST, JSON, Bearer/cookie sesi)**:

| Kelompok | Endpoint |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/logout` · `POST /auth/change-password` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET/PATCH /me` |
| User | `GET/POST /users` · `GET/PATCH /users/{id}` · `POST /users/{id}/deactivate` · `/activate` · `/reset-password` · `/unlock` |
| Role | `GET/POST /roles` · `GET/PATCH/DELETE /roles/{id}` (DELETE hanya role kustom) · `GET /permissions` |
| Master | `GET/POST /{branches,vehicles,spareparts,locations,vendors,reason-codes}` · `GET/PATCH /…/{id}` · `POST /…/{id}/deactivate` · `/activate` · `POST /vehicles/{id}/odometer` |
| Parameter | `GET /parameters` · `PATCH /parameters/{key}` |
| Audit | `GET /audit-logs` · `GET /audit-logs/{id}` · `GET /audit-logs/export` |

Konvensi: paginasi `?page&limit`, galat `{code, message, details}`, header `If-Match` untuk PATCH, `DELETE` pada master/user/audit mengembalikan 404.

**Seed**: 7 role + permission default, kategori alasan, parameter, satu cabang Pusat, satu SYS_ADMIN awal (kredensial dari variabel lingkungan, wajib ganti saat login pertama).

**Antarmuka**: Login, Lupa/Reset Password, Ganti Password, Profil, Dashboard (placeholder), 7 halaman Master, User, Role & Permission, Parameter, Audit Log (lihat [../../../MENU-SUBMENU-SPESIFIKASI.md](../../../MENU-SUBMENU-SPESIFIKASI.md) §2 dan §8).

## Keamanan, Kinerja, Kepatuhan
- Cookie sesi `HttpOnly; Secure; SameSite=Lax`; perlindungan CSRF untuk metode yang mengubah data.
- Rate limit pada `/auth/*` (selain penguncian akun) per IP.
- Token reset disimpan sebagai hash, sekali pakai.
- Validasi input di backend untuk semua field; lampiran (foto sparepart) dibatasi tipe dan ukuran.
- Daftar master < 3 dtk pada 50 baris; indeks pada kode, nama, `branch_id`, `is_active`.
- Kebijakan retensi audit: belum ditentukan.

## Risks / Trade-offs
- Salah rancang `branch_id`/RBAC mahal diubah nanti → mitigasi: D4 (satu tempat), tes integrasi lintas cabang sejak awal.
- Stack belum diputuskan → mitigasi: keputusan ditulis netral; setelah stack ditetapkan, perbarui [config.md](../../config.md) dan tasks setup.
- Email reset belum tersedia → mitigasi: admin dapat reset manual (`/users/{id}/reset-password`).
- Asumsi kebijakan password dan penguncian bukan dari bisnis → mitigasi: dijadikan parameter bila diminta berubah.

## Migration / Rollout / Rollback
N/A (proyek baru). Migrasi skema berversi; rollback dengan skrip turun per migrasi.

## Verification Plan

| Requirement / Scenario | Lapisan tes | Alat / Teknik | Catatan risiko |
|---|---|---|---|
| Login, penguncian, kedaluwarsa sesi, reset password | unit (aturan) + integrasi (API) | Waktu dapat disuntik (fake clock) untuk 15 menit/1 jam/8 jam | **Kritis**: tidak boleh membocorkan keberadaan akun |
| Pesan seragam & waktu respon | integrasi | Ukur selisih waktu email ada vs tidak | Tes sensitif; toleransi longgar |
| Kebijakan password | unit + property-based | Generator string; batas 7/8 karakter | |
| RBAC 401/403 per endpoint | integrasi | Tes tabel: setiap endpoint × role | **Kritis**; dibuat otomatis dari daftar rute |
| Filter cabang | integrasi | Dua cabang, tiga pengguna (A, B, HQ) | **Kritis**: 404 bukan 403 |
| SYS_ADMIN terakhir, role bawaan | unit + integrasi | | |
| Kode unik, nonaktif, DELETE 404 | integrasi | Per master | Pola sama, gunakan tes parametrik |
| Odometer tidak turun | unit | Batas: sama, kurang 1, lebih 1 | |
| Cabang pusat tunggal | integrasi | | |
| rowVersion | integrasi | Dua permintaan berurutan dengan versi lama | |
| Audit atomik & append-only | integrasi | Paksa gagal pada penulisan audit; cek rollback; cek hak DB | **Kritis** |
| Audit tidak menyimpan password | integrasi | Cari pola password/hash di keluaran | |
| Alur login → ganti password → profil | E2E | Satu jalur kritis | |

Kekritisan change ini: **tinggi** — alasan: autentikasi, otorisasi, dan isolasi data cabang menjadi dasar keamanan seluruh sistem. Teknik tambahan: mutation test pada modul aturan password/penguncian; tinjauan keamanan (SAST + dependency scan) sebelum archive.

## Open Questions
- [x] Tech stack final: Next.js 16 + Supabase (lihat "Revisi untuk Supabase").
- [ ] Penyimpanan foto sparepart: disk lokal atau object storage? (usulan: disk lokal dulu, antarmuka dibuat dapat diganti)
- [ ] Strategi deploy dan lingkungan (dev/staging/prod) belum dibahas.


## Revisi untuk Supabase (Next.js 16 + Supabase, 2026-10-24)

Stack diputuskan; keputusan di atas disesuaikan seperlunya. Yang berubah:

| Semula | Sekarang | Alasan |
|---|---|---|
| D1 sesi server-side + tabel `sessions` | Supabase Auth: cookie sesi `@supabase/ssr`, refresh di `src/proxy.ts`. Batas 8 jam ditegakkan dengan cookie `kbl_login_at` di proxy. | Sesi dikelola Supabase; fitur time-box bawaan hanya di paket berbayar. |
| D2 argon2id | Hash password oleh Supabase Auth (bcrypt) | Tidak menyimpan password sendiri. |
| D3/D4 guard permission & filter cabang di repository | **RLS Postgres** (`has_permission`, `can_see_branch`) + pemeriksaan `authorize()` di server action | Penegakan di database tidak bisa terlewat oleh endpoint baru. Akses data cabang lain mengembalikan 0 baris / 404. |
| D5 audit dalam transaksi | Trigger `audit_row` (security definer) pada tiap tabel; `audit_logs` tanpa hak UPDATE/DELETE + trigger penolak | Atomik dengan perubahan; aktor dari `auth.uid()`. Event keamanan lewat fungsi `log_security_event` (hanya service_role). |
| D6 DeactivationGuard (kode) | Fungsi SQL `deactivation_block_reason()` dan `uom_locked()` yang diganti slice berikutnya dengan `create or replace` | Titik ekstensi di sisi database. |
| D7 `If-Match` | Kolom `row_version` + `update … where row_version = $n` | Setara, sederhana lewat PostgREST. |
| Tabel `sessions`, `password_resets`, `system_parameter_logs`, `vehicle_odometer_logs` terpisah | `sessions`/`password_resets` dihapus (ditangani Supabase). Riwayat parameter lewat `audit_logs`. `vehicle_odometer_logs` tetap. | Menghindari duplikasi. |
| SYS_ADMIN hanya master | SYS_ADMIN **juga** memiliki `branch.all` | SYS_ADMIN perlu membuat master dan user untuk semua cabang. |
| Lockout di backend | Server action `loginAction` + kolom `failed_attempts/locked_until` di `profiles` (diubah via service_role) | Supabase tidak menyediakan penguncian per akun 5×/15 menit. |
| Ekspor Excel audit | Ekspor **CSV** (UTF-8 BOM, dapat dibuka Excel) | Tanpa dependensi tambahan; sesuaikan bila perlu .xlsx. |

Batasan yang diketahui:
- Reset password oleh admin menetapkan password sementara dan mewajibkan penggantian, tetapi **tidak mencabut sesi yang sedang aktif** (Admin API butuh JWT pengguna). Menonaktifkan user memakai `ban_duration`, sehingga refresh token ditolak.
- Pesan "password sama dengan lama" saat reset lewat email bergantung pada galat Supabase; saat ganti password biasa diperiksa lebih dulu di aplikasi.
- Waktu respons login untuk email tak terdaftar vs password salah tidak diukur; keduanya memanggil `signInWithPassword`.
