# KBL — Perawatan & Sparepart Kendaraan

Aplikasi web + PWA (Next.js 16, Supabase). Dokumen kebutuhan ada di [docs/](docs/); peta pengerjaan di [docs/sdd/ROADMAP-KEKURANGAN.md](docs/sdd/ROADMAP-KEKURANGAN.md).

**Modul yang sudah dibangun** (mengikuti [MENU-SUBMENU-SPESIFIKASI.md](docs/MENU-SUBMENU-SPESIFIKASI.md)):

| Modul | Isi |
|---|---|
| Fondasi | Login, user & role, data master, parameter sistem, audit log |
| Approval | Mesin approval berjenjang (alur dapat diatur), Kotak Masuk, Semua Antrean, Riwayat, override/eskalasi/pengingat, SLA |
| Inventori | Mutasi sparepart (draft → approval → posting), saldo, kartu stok, stock opname (+CSV), pembalik |
| Perawatan | Rencana perawatan, Work Order, reservasi part, kalender (seret untuk ajukan perubahan), perubahan jadwal/anomali, job preventif dan overdue |
| Emergensi | Lapor Darurat (≤ 2 langkah, offline + idempoten), insiden pusat, kontak darurat, langkah cepat |
| Laporan | 13 laporan tetap (RPT-01…13) dengan filter dan ekspor CSV |
| Lainnya | Dashboard W1–W12 per role, notifikasi (dalam aplikasi, push, WhatsApp/SMS lewat webhook), lampiran foto/PDF, impor CSV |

## Menjalankan

1. Buat project di [Supabase](https://supabase.com) (atau pakai instance yang sudah ada).
2. Jalankan migrasi di `supabase/migrations/` berurutan (SQL Editor, atau `npx supabase link` lalu `npx supabase db push`). Ada 7 berkas; yang `20261025…` adalah modul transaksi dan **wajib setelah** dua berkas awal. Migrasi membuat bucket Storage privat `attachments` untuk lampiran dan, bila ekstensi `pg_cron` tersedia, menjadwalkan job tiap menit.
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

## Job terjadwal dan notifikasi

- **Job** (WO preventif otomatis, penanda overdue, eskalasi insiden tanpa ACK, SLA approval, pengingat validasi, ringkasan stok minimum) ada di fungsi `_run_jobs()`. Dua pemicunya:
  1. `pg_cron` di Supabase (tiap menit; aktif otomatis bila ekstensinya tersedia), dan/atau
  2. `GET /api/jobs/run` dengan header `Authorization: Bearer $CRON_SECRET`. `vercel.json` memanggilnya **harian** (batas paket Hobby Vercel). Untuk interval pendek, pakai `pg_cron` atau penjadwal lain yang memanggil URL itu.
- **Notifikasi**: dalam aplikasi (lonceng) selalu aktif. **Push** perlu kunci VAPID (`npx web-push generate-vapid-keys`). **WhatsApp/SMS/Email** dikirim lewat webhook `NOTIFY_WEBHOOK_URL` (JSON `{channel,to,title,body,link,id}`); penyedia belum ditentukan, jadi sampai diisi kanal itu ditandai **Gagal** di Admin › Log Notifikasi (tidak mengganggu pencatatan insiden). Kanal per jenis notifikasi diatur di Parameter Sistem.

## Data demo (hanya development/staging)

```bash
npm run seed:demo -- --yes
```

Membuat 13 user (semua role) dan data master contoh: 3 cabang tambahan, 5 lokasi, 8 kendaraan, 16 sparepart, 7 vendor. Bila `NEXT_PUBLIC_SUPABASE_ANON_KEY` terisi, ikut dibuat **transaksi** lewat jalur resmi (login sebagai user demo): stok awal (sebagian di bawah minimum), 5 rencana perawatan + WO preventif, WO terjadwal dan berjalan, satu perubahan jadwal dan satu opname yang menunggu approval, serta dua insiden (satu belum dikonfirmasi). Aman diulang (bagian yang sudah ada dilewati). **Jangan dijalankan di produksi.** Password semua user demo: `Demo12345` (tidak diminta ganti saat login).

| Email | Role | Cabang |
|---|---|---|
| sysadmin@example.com | SYS_ADMIN | Pusat |
| hqadmin@example.com | HQ_ADMIN | Pusat |
| depthead.jkt@example.com | DEPT_HEAD | Jakarta |
| supervisor.jkt@example.com | SUPERVISOR | Jakarta |
| warehouse.jkt@example.com | WAREHOUSE | Jakarta |
| warehouse.sby@example.com | WAREHOUSE | Surabaya |
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
| `npm run test:db` | Tes skema SQL, RLS, trigger, audit, approval, stok, WO, insiden, laporan (PGlite, tanpa Docker) |

## Halaman publik dan rute

- `/` adalah **company profile PT Karunia Beton Lestari (KBL)** (batu pecah dan beton readymix), disusun dengan kerangka StoryBrand (masalah, solusi, rencana, produk, bukti, ajakan). Kode di `src/app/(site)/`; data usaha di `src/lib/site-config.ts` (**verifikasi sebelum rilis**).
- **Kebutuhan dan copy website** ada di `docs/company-profile/` (BrandScript StoryBrand, sitemap, tiap halaman, panduan desain), mengikuti pola repo acuan `sicoma`. Ubah dokumennya dulu, lalu sinkronkan `page.tsx`.
- Tombol **Masuk Aplikasi** membawa karyawan ke `/login`, lalu ke `/dashboard`. Situs profil dan aplikasi internal punya tujuan berbeda.
- Foto di `public/foto/` adalah ilustrasi berlisensi **CC0 / domain publik** (tidak wajib kredit; sumber dicatat di `docs/company-profile/09-Sumber-Foto.md`). Jangan menambah foto CC BY / CC BY-SA tanpa menampilkan kredit. Ganti dengan foto asli bila tersedia.
- Katalog "Karunia Beton" Jember (CV. Karunia Abadi) di `docs/` adalah **perusahaan lain** dan tidak dipakai di situs ini.
- Kontak bisa ditimpa lewat `NEXT_PUBLIC_CONTACT_*` (lihat `.env.example`).
- Halaman lain (`/master/*`, `/admin/*`, `/profile`) memerlukan login.

## PWA

- Manifest di `src/app/manifest.ts`, ikon dibuat dinamis di `/icons/*`, service worker di `public/sw.js`.
- Service worker hanya aktif pada build produksi (`npm run build && npm run start`) dan harus lewat **HTTPS** (localhost dikecualikan).
- Pasang: Chrome/Edge Android & desktop → tombol **Pasang Aplikasi** (atau menu browser › Install). iPhone/iPad → Safari › Bagikan › **Tambah ke Layar Utama**.
- Hanya aset statis dan halaman `/offline` yang disimpan; halaman dan data pengguna tidak pernah di-cache.
- **Mode offline (hub `/offline`)**: saat aplikasi dibuka tanpa sinyal, hub menampilkan salinan data kerja di perangkat. Salinan diperbarui otomatis tiap Dashboard dibuka online dan **dihapus saat Keluar**.
  - **Tugas Saya (mekanik):** WO yang ditugaskan, tombol Mulai, Selesaikan (odometer + catatan), dan foto (dikecilkan ke ≤ 1600 px).
  - **Stock Opname (gudang):** lembar hitung per baris, termasuk alasan selisih. Pengajuan review tetap dari halaman opname saat online.
  - **Antrean sinkron:** semua aksi di atas masuk antrean lokal, ditandai "menunggu sinkron" (juga di header aplikasi), dan dikirim otomatis saat sinyal kembali. Aturan: aksi hanya dikirim oleh akun yang membuatnya; hitung ulang baris yang sama menimpa; aksi yang ditolak aturan bisnis (mis. WO sudah dibatalkan) ditandai **perlu dicek**, tidak diulang otomatis.
  - **Tetap butuh online:** keputusan approval dan posting stok (perlu status terbaru dan aturan pengaju tidak boleh menyetujui sendiri).
- **Lapor Darurat offline**: setiap kali halaman `/emergency/report` dibuka online, langkah cepat dan kontak disimpan di perangkat. Tanpa sinyal, halaman `/offline` menampilkannya, menerima laporan ke antrean lokal (IndexedDB), dan mengirim ulang otomatis dengan kunci idempoten yang sama (tidak ada insiden ganda). Antrean hanya dikirim oleh user pemiliknya.

## Keamanan singkat

- Otorisasi diperiksa di database (RLS + permission) dan di server action; menyembunyikan tombol hanya UX.
- Data dibatasi per cabang (`branch.all` untuk HQ_ADMIN dan SYS_ADMIN).
- Audit log append-only (trigger + hak akses); tidak ada hapus fisik pada master.
- Sesi maksimal 8 jam (ditegakkan di `src/proxy.ts`); akun terkunci 15 menit setelah 5 kali gagal login.
