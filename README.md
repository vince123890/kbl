# KBL — Perawatan & Sparepart Kendaraan

Aplikasi web + PWA (Next.js 16, Supabase). Dokumen kebutuhan ada di [docs/](docs/). Slice yang sudah dibangun: **`foundation-auth-master`** (login, user & role, data master, parameter, audit log). Spesifikasinya di [docs/sdd/changes/foundation-auth-master/](docs/sdd/changes/foundation-auth-master/).

## Menjalankan

1. Buat project di [Supabase](https://supabase.com) (atau pakai instance yang sudah ada).
2. Jalankan migrasi di `supabase/migrations/` berurutan (SQL Editor, atau `npx supabase link` lalu `npx supabase db push`).
3. Di Supabase Dashboard › **Authentication**:
   - Providers › Email: **matikan "Allow new users to sign up"** (user hanya dibuat admin).
   - URL Configuration › Site URL = URL aplikasi; tambahkan `<URL>/auth/callback` ke Redirect URLs.
   - Password policy: minimal 8 karakter, huruf dan angka. Masa berlaku link email (OTP expiry) 3600 detik.
   - Email: atur SMTP sendiri untuk produksi (SMTP bawaan Supabase sangat dibatasi).
   - Nilai-nilai ini juga ada di `supabase/config.toml`.
4. Salin `.env.example` → `.env.local` dan isi. **`SUPABASE_SERVICE_ROLE_KEY` hanya untuk server.**
5. Instal dan buat admin pertama:
   ```bash
   npm install
   npm run seed:admin      # membuat SYS_ADMIN dari SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
   npm run dev             # http://localhost:3000
   ```
6. Login dengan akun admin tersebut; sistem meminta ganti password pada login pertama.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | Tipe TypeScript |
| `npm test` | Seluruh tes (unit + database) |
| `npm run test:db` | Tes skema SQL, RLS, trigger, audit (PGlite, tanpa Docker) |

## PWA

- Manifest di `src/app/manifest.ts`, ikon dibuat dinamis di `/icons/*`, service worker di `public/sw.js`.
- Service worker hanya aktif pada build produksi (`npm run build && npm run start`) dan harus lewat **HTTPS** (localhost dikecualikan).
- Pasang: Chrome/Edge Android & desktop → tombol **Pasang Aplikasi** (atau menu browser › Install). iPhone/iPad → Safari › Bagikan › **Tambah ke Layar Utama**.
- Hanya aset statis dan halaman `/offline` yang disimpan; halaman dan data pengguna tidak pernah di-cache.

## Keamanan singkat

- Otorisasi diperiksa di database (RLS + permission) dan di server action; menyembunyikan tombol hanya UX.
- Data dibatasi per cabang (`branch.all` untuk HQ_ADMIN dan SYS_ADMIN).
- Audit log append-only (trigger + hak akses); tidak ada hapus fisik pada master.
- Sesi maksimal 8 jam (ditegakkan di `src/proxy.ts`); akun terkunci 15 menit setelah 5 kali gagal login.
