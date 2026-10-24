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

## Data demo (hanya development/staging)

```bash
npm run seed:demo -- --yes
```

Membuat 12 user (semua role) dan data master contoh sekali jalan: 3 cabang tambahan, 5 lokasi, 8 kendaraan, 16 sparepart, 7 vendor. Aman diulang (baris yang sudah ada dilewati). **Jangan dijalankan di produksi.** Password semua user demo: `Demo12345` (tidak diminta ganti saat login).

| Email | Role | Cabang |
|---|---|---|
| sysadmin@example.com | SYS_ADMIN | Pusat |
| hqadmin@example.com | HQ_ADMIN | Pusat |
| depthead.jkt@example.com | DEPT_HEAD | Jakarta |
| supervisor.jkt@example.com | SUPERVISOR | Jakarta |
| warehouse.jkt@example.com | WAREHOUSE | Jakarta |
| mechanic.jkt@example.com | MECHANIC | Jakarta |
| driver.jkt@example.com | DRIVER | Jakarta |
| gudang.supervisor.jkt@example.com | WAREHOUSE + SUPERVISOR | Jakarta |
| supervisor.sby@example.com | SUPERVISOR | Surabaya |
| mechanic.sby@example.com | MECHANIC | Surabaya |
| driver.sby@example.com | DRIVER | Surabaya |
| nonaktif.jkt@example.com | MECHANIC (nonaktif) | Jakarta |

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | Tipe TypeScript |
| `npm test` | Seluruh tes (unit + database) |
| `npm run test:db` | Tes skema SQL, RLS, trigger, audit (PGlite, tanpa Docker) |

## Halaman publik dan rute

- `/` adalah **company profile PT Karunia Beton Lestari (KBL)** (batu pecah dan beton readymix), disusun dengan kerangka StoryBrand (masalah, solusi, rencana, produk, bukti, ajakan). Kode di `src/app/(site)/`; data usaha di `src/lib/site-config.ts` (**verifikasi sebelum rilis**).
- **Kebutuhan dan copy website** ada di `docs/company-profile/` (BrandScript StoryBrand, sitemap, tiap halaman, panduan desain), mengikuti pola repo acuan `sicoma`. Ubah dokumennya dulu, lalu sinkronkan `page.tsx`.
- Tombol **Masuk Aplikasi** membawa karyawan ke `/login`, lalu ke `/dashboard`. Situs profil dan aplikasi internal punya tujuan berbeda.
- Foto di `public/foto/` adalah ilustrasi berlisensi bebas (Wikimedia Commons) dengan kredit di halaman. Ganti dengan foto asli KBL bila tersedia.
- Katalog "Karunia Beton" Jember (CV. Karunia Abadi) di `docs/` adalah **perusahaan lain** dan tidak dipakai di situs ini.
- Kontak bisa ditimpa lewat `NEXT_PUBLIC_CONTACT_*` (lihat `.env.example`).
- Halaman lain (`/master/*`, `/admin/*`, `/profile`) memerlukan login.

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
