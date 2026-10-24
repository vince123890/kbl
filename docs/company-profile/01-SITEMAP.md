# SITEMAP — Website Company Profile Karunia Beton Lestari

> Peta struktur website. Semua halaman diturunkan dari [00-BRANDSCRIPT.md](00-BRANDSCRIPT.md).
> **Pahlawan = pelanggan. Pemandu = Karunia Beton Lestari. Penjahat = ketidakpastian di hari pengecoran.**

---

## 1. Peta struktur

```
karuniabeton.co.id/
│
├── /  ................................ Beranda
├── /tentang-kami ..................... Tentang Kami (kami mulai dari batu)
├── /produk ........................... Produk (index per tahap)
│   ├── /produk/batu-pecah ............ Batu Pecah dan Agregat
│   ├── /produk/beton-readymix ........ Beton Readymix
│   └── /produk/concrete-pump ......... Concrete Pump dan Layanan Cor
├── /armada ........................... Armada dan Perawatan
├── /hubungi-kami ..................... Konsultasi dan penawaran
│
└── /login ............................ (aplikasi internal; BUKAN bagian profil)
```

Halaman `/proyek` **ditunda** sampai Karunia Beton Lestari memberi referensi proyek yang boleh disebut (lihat daftar data di BrandScript).

---

## 2. Navigasi

### Header (menempel saat scroll)
```
[Karunia Beton Lestari]   Beranda   Tentang   Produk ▾   Armada   Hubungi    [Konsultasi Kebutuhan Beton]   Masuk Aplikasi
                              │
                              ├── Batu Pecah
                              ├── Beton Readymix
                              └── Concrete Pump
```
- Menu 6 item + 1 dropdown. Tombol oranye **Konsultasi Kebutuhan Beton** selalu terlihat.
- **Masuk Aplikasi** berupa tautan teks kecil di bar atas (utility bar), bukan tombol utama. Tujuannya beda: karyawan, bukan calon pelanggan.
- Mobile: hamburger + tombol konsultasi tetap terlihat.

### Utility bar (di atas header)
WhatsApp · Telepon · Lokasi (Sunggal, Deli Serdang) · Masuk Aplikasi.

### Footer (sama di semua halaman)
Kolom: **Karunia Beton Lestari** (tentang, armada) · **Produk** (tiga produk) · **Layanan** (konsultasi) · **Kontak** (alamat, telepon, email, Instagram). Di bawah: kalimat payung + tombol Konsultasi + Chat WhatsApp + kredit foto.

---

## 3. Peran tiap halaman dalam cerita

| URL | Halaman | Peran StoryBrand | Tujuan konversi |
|---|---|---|---|
| `/` | Beranda | Undangan masuk cerita (7 elemen ringkas) | Konsultasi |
| `/tentang-kami` | Tentang | Pemandu: empati + otoritas | Bangun kepercayaan → konsultasi |
| `/produk` | Produk index | Peta solusi per tahap | Arahkan ke produk yang tepat |
| `/produk/batu-pecah` | Batu Pecah | Solusi: bahan baku yang dikenal dari sumbernya | Tanya ketersediaan |
| `/produk/beton-readymix` | Readymix | Solusi: beton sesuai struktur, datang tepat waktu | Minta quotation |
| `/produk/concrete-pump` | Concrete Pump | Solusi: lokasi sulit dijangkau | Minta quotation |
| `/armada` | Armada | Pereda takut "truk tertahan" | Konsultasi |
| `/hubungi-kami` | Hubungi | CTA langsung, hilangkan gesekan | WhatsApp / telepon |

---

## 4. Alur pengguna

- **Jalur A, pengunjung baru:** Beranda → Produk → Hubungi.
- **Jalur B, pembeli serius:** Beranda → Produk spesifik → Minta quotation (WhatsApp berisi teks siap kirim).
- **Jalur C, pengecek kredibilitas:** Tentang → Armada → Hubungi.
- **Jalur D, karyawan:** Utility bar → Masuk Aplikasi → `/login` → `/dashboard`.

Setiap jalur calon pelanggan berujung pada CTA; tidak ada halaman buntu.

---

## 5. Aturan CTA global

| Jenis | Teks | Gaya | Muncul di |
|---|---|---|---|
| **Utama** | Konsultasi Kebutuhan Beton | Oranye solid | Navbar + tiap halaman minimal 2 kali |
| **Produk** | Minta Quotation [Produk] | Oranye solid | Tiap halaman produk |
| **Transisi** | Lihat Produk Kami | Outline | Di sebelah CTA utama pada Beranda |
| **Kontak cepat** | Chat WhatsApp | Hijau (khusus WhatsApp) | Utility bar, footer, Hubungi |

Pesan WhatsApp selalu berisi teks awal siap kirim: *"Halo Karunia Beton Lestari, saya ingin konsultasi kebutuhan beton. Lokasi: … Volume: … Jadwal cor: …"*.

---

## 6. Fase

- **Fase 1 (diimplementasikan lebih dulu):** Beranda (satu halaman berisi ringkasan semua bagian) + Masuk Aplikasi.
- **Fase 2:** Tentang, Produk (+3), Armada, Hubungi sebagai halaman terpisah.
- **Fase 3:** Proyek, FAQ, artikel edukasi (setelah data dari Karunia Beton Lestari tersedia).

---

## Keterangan: Kenapa Sitemap Dibuat Seperti Ini

**Hanya tiga produk, tanpa halaman yang tak bisa diisi.** Survei hanya menemukan batu pecah, readymix, dan layanan pompa/peralatan. Halaman Proyek dan harga ditunda karena datanya belum ada, daripada diisi karangan.

**Aplikasi internal dipisahkan.** Calon pelanggan tidak perlu melihat tombol login; karyawan butuh jalur cepat. Maka login ditaruh di utility bar sebagai tautan kecil.
