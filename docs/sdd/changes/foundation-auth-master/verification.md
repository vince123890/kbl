# Verification: foundation-auth-master

Tanggal: 2026-10-24 · Kekritisan: **tinggi** · Status: **implementasi selesai, verifikasi belum lengkap**

## Gerbang otomatis (dijalankan)

| Gerbang | Hasil |
|---|---|
| `npm run lint` | bersih |
| `npm run typecheck` | bersih |
| `npm test` | 57 lulus (36 tes database di PGlite + 21 tes unit termasuk property-based) |
| `npm run build` (Next.js 16, Turbopack) | berhasil; 20 rute |
| `npm audit --omit=dev` | 0 kerentanan |
| Smoke test `next start` | `/login`, `/forgot-password`, `/offline`, `/manifest.webmanifest`, `/icons/*`, `/sw.js` → 200; `/master/*` dan `/admin/*` tanpa sesi → 307 ke `/login` |

## Pemetaan scenario → bukti

Legenda: ✅ tes otomatis · 🟡 diimplementasikan, **tidak** diuji otomatis · ❌ belum ada

### authentication
| Scenario | Bukti |
|---|---|
| Login berhasil / password salah / email tak terdaftar / nonaktif | 🟡 `loginAction` ([actions.ts](../../../../src/lib/auth/actions.ts)); butuh Supabase sungguhan |
| Pesan seragam, waktu respon seragam | 🟡 pesan seragam; waktu tidak diukur |
| Penguncian 5× / 15 menit / reset penghitung / kunci berakhir | ✅ logika murni (`unit.test.ts`: afterFailure, isLocked, minutesLeft); 🟡 integrasi ke login |
| Wajib ganti password awal (403 selain halaman ganti password) | 🟡 `requireUser` mengarahkan ke `/change-password`; `authorize()` menolak aksi |
| Kebijakan password (7/8 karakter, huruf+angka, sama dengan lama) | ✅ unit + property-based |
| Lupa/reset password (respon seragam, 1 jam, sekali pakai) | 🟡 respon seragam di aksi; masa berlaku dan sekali-pakai oleh Supabase (dikonfigurasi di `config.toml`/dashboard) |
| Logout; sesi 8 jam | ✅ aturan 8 jam (`sessionExpired`); 🟡 penegakan di `src/proxy.ts` |
| Profil: hanya nama dan telepon | ✅ trigger `profiles_guard` (tes DB) |

### user-role-management
| Scenario | Bukti |
|---|---|
| Buat user, email duplikat | ✅ indeks unik case-insensitive (tes DB); 🟡 alur `createUserAction` + kompensasi |
| Tanpa role/cabang | 🟡 validasi di `parseUserForm` |
| 403 tanpa permission | ✅ RLS menolak insert/update oleh role tanpa izin (tes DB); 🟡 `authorize()` |
| Nonaktifkan user, SYS_ADMIN terakhir | ✅ tes DB (trigger `keep_one_sysadmin`) |
| DELETE user → 404 | ✅ tidak ada hak DELETE pada `profiles` untuk `authenticated`; 🟡 tidak ada endpoint |
| 7 role bawaan, role bawaan tak bisa dihapus, role kustom terpakai | ✅ tes DB |
| Perubahan permission + audit | ✅ tes DB (trigger audit `role_permissions`); SYS_ADMIN tak bisa kehilangan permission admin ✅ |
| Isolasi cabang (daftar, detail 404, tulis lintas cabang) | ✅ daftar dan detail (tes DB, 3 pengguna); 🟡 tulis lintas cabang oleh non-admin tidak punya jalur (hanya SYS_ADMIN yang menulis dan memiliki `branch.all`) |
| 401 tanpa sesi | ✅ smoke test proxy (307 ke login); API route audit export 401 🟡 |

### master-data
| Scenario | Bukti |
|---|---|
| Akses baca vs tulis | ✅ tes DB |
| Kode unik, nomor polisi ternormalisasi | ✅ tes DB |
| Tanpa hapus fisik | ✅ `permission denied` pada DELETE (tes DB) |
| Nonaktifkan; masih dipakai dokumen aktif | ✅ audit DEACTIVATE; titik ekstensi `deactivation_block_reason` ada tetapi belum punya aturan (belum ada transaksi) |
| Cabang: satu pusat, pusat tak bisa nonaktif, kode terkunci | ✅ tes DB |
| Odometer naik/turun + riwayat; status manual terbatas | ✅ tes DB |
| Sparepart: stok min valid; satuan terkunci | ✅ stok min (DB + unit); satuan terkunci = titik ekstensi saja |
| Lokasi: nonaktif bersaldo | ❌ menunggu slice stok |
| Vendor: tipe, telepon wajib | ✅ DB + unit |
| Kategori Alasan: data awal | ✅ tes DB |
| Parameter: nilai awal, validasi, riwayat | ✅ tes DB |
| Konkurensi (`row_version`) | ✅ versi bertambah (tes DB); 🟡 penolakan versi usang di server action |
| Daftar: pencarian, filter di URL, paging 50 | 🟡 diimplementasikan; tidak diuji |

### audit-log
| Scenario | Bukti |
|---|---|
| Ubah master mencatat sebelum/sesudah | ✅ tes DB |
| Password tak disimpan | ✅ secara struktur: tabel `profiles` tidak memuat password; 🟡 event reset hanya mencatat kejadian |
| Event keamanan (login, lock, 403) | ✅ `log_security_event` hanya service_role (tes DB); 🟡 pemanggilan dari login/otorisasi |
| Append-only, termasuk service_role dan pemilik tabel | ✅ tes DB |
| Kegagalan audit membatalkan perubahan | ✅ tes DB (trigger dipaksa gagal) |
| Hanya `audit.view`; filter; diff; ekspor | ✅ pembacaan dibatasi RLS (tes DB); 🟡 filter, diff, ekspor CSV |

## Celah yang diterima atau belum ditutup

1. **Tidak ada tes terhadap Supabase sungguhan.** Docker tidak dipakai, sehingga alur yang melibatkan Supabase Auth (login, lockout terintegrasi, reset email, ban saat nonaktif, `signOut` sesi lain) hanya terverifikasi lewat tinjauan kode dan build. Harus diuji manual sebelum dipakai (lihat daftar di bawah).
2. **Tidak ada E2E browser** dan belum diuji di perangkat nyata: instalasi PWA, service worker, tampilan ponsel.
3. **SAST, mutation test, dan tinjauan keamanan terpisah belum dijalankan** (task 7.5).
4. **Skema SQL diuji di PGlite dengan stub `auth`**, bukan Postgres Supabase. Perbedaan mungkin ada pada hak akses default Supabase dan versi Postgres.
5. Reset password oleh admin tidak mencabut sesi yang sedang aktif; user nonaktif dicegah lewat ban.
6. Ekspor audit berupa CSV, bukan .xlsx.
7. Zona waktu filter audit dipatok WIB; belum per cabang.
8. Tidak ada rate limit di `/auth/*` selain batas bawaan Supabase dan penguncian akun.

## Uji manual yang wajib sebelum go-live

- [ ] Jalankan migrasi di project Supabase, jalankan `npm run seed:admin`, login sebagai admin (diminta ganti password).
- [ ] Salah password 5× → terkunci 15 menit; password benar saat terkunci tetap ditolak; admin dapat membuka kunci.
- [ ] Buat user per role; login dan pastikan menu hanya sesuai permission; buka URL admin langsung dengan user biasa → `/forbidden` dan muncul `ACCESS_DENIED` di Audit Log.
- [ ] Dua cabang: user cabang A tidak melihat kendaraan/lokasi cabang B.
- [ ] Lupa password → email diterima → link bekerja sekali → sesi lama berakhir.
- [ ] Nonaktifkan user yang sedang login → sesinya tidak bisa menyegarkan token.
- [ ] Dua tab mengedit data yang sama → tab kedua mendapat pesan konflik.
- [ ] Build produksi di HTTPS: banner/tombol Pasang Aplikasi muncul, ikon benar, mode offline menampilkan `/offline`, halaman terautentikasi tidak tersimpan di cache.
- [ ] Ekspor CSV audit terbuka benar di Excel.
