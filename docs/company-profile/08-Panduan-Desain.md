# PANDUAN DESAIN — Website Company Profile Karunia Beton Lestari

> Diadaptasi dari panduan desain acuan `sicoma` (.claude/skills/sicoma-design) dan disesuaikan dengan brand Karunia Beton Lestari. **Warna dan font sengaja berbeda** dari Sicoma dan dari Karunia Beton Jember agar identitas Karunia Beton Lestari berdiri sendiri.

---

## 1. Penalaran desain
- **Industri:** material konstruksi B2B (batu dan beton). **Audiens:** kontraktor, pengembang, pembeli proyek yang membandingkan cepat, sering lewat ponsel di lapangan.
- **Tugas emosional:** mengurangi rasa takut akan **ketidakpastian** di hari pengecoran.
- **Prioritas:** keterbacaan dan aksesibilitas → sinyal kepercayaan (proses nyata) → CTA jelas → kecepatan → hiasan.
- **Gaya:** Swiss-modern, berat di tipografi dan foto. **Tanpa ikon dekoratif, tanpa emoji, tanpa glassmorphism.**

## 2. Token (sumber kebenaran: `src/app/(site)/landing.css`)
```
--navy   #12263a   teks gelap, header, footer, panel gelap
--aksen  #f26a21   oranye: tombol utama dan satu kata kunci per layar
--abu    #e3e1dc   latar kartu
--krem   #f3f1ec   latar section selang-seling
--tinta  #1b1b1b   teks
--lembut #5b5b57   teks sekunder
--sans   Archivo 400–800 (judul, UI)
--serif  Source Serif 4 (paragraf cerita)
```
Aturan: teks di atas oranye memakai navy atau putih dengan kontras ≥ 4,5:1 (periksa); oranye kecil di latar terang memakai varian lebih gelap. `wa` hijau hanya untuk tombol WhatsApp.

## 3. Pola tata letak
- Kartu **seragam tinggi** (grid `items-stretch`, kartu `h-full`). Tepi bawah bergerigi dilarang.
- Foto berbingkai oranye offset dengan **tab keterangan** navy di kiri bawah (ciri visual Karunia Beton Lestari).
- Penomoran **hanya** untuk urutan nyata (rencana 3 langkah, jam pada garis waktu), tidak untuk dekorasi.

## 4. Gerak
Prinsip sicoma dipertahankan: gerak **tegas dan presisi**, sekali saja, tidak mengulang.
- **Reveal saat scroll** (opacity + translateY 28–36px, easing `cubic-bezier(0.16,1,0.3,1)`), hanya di bawah lipatan pertama, sekali jalan, stagger 100 ms maksimum 4–5 item.
- **Hover kartu:** naik 6px + bayangan; tetap dapat dijangkau keyboard dan sentuh.
- Jangan menganimasikan hero atau navbar. Hormati `prefers-reduced-motion`; konten sudah ada di DOM tanpa JS.
- Dilarang: pantulan/spring, parallax penuh, scroll-jacking, video latar berat (audiens sering di jaringan lemah).

## 5. Aksesibilitas dan interaksi
Kontras teks ≥ 4,5:1; target sentuh ≥ 44 px; fokus terlihat (`outline` 3 px) di semua elemen interaktif; semua gambar ber-`alt`; `sizes` pada `next/image`; hero memakai `priority`, sisanya lazy.

## 6. Foto
Sementara: ilustrasi berlisensi bebas (Wikimedia Commons) dengan **kredit di halaman** dan keterangan "bukan dokumentasi Karunia Beton Lestari". Ganti dengan foto asli Karunia Beton Lestari (plant, batching, armada, lokasi cor) begitu tersedia. Dilarang mengambil foto dari akun media sosial atau situs perusahaan lain.

## 7. Daftar periksa sebelum merilis bagian baru
1. Teksnya sama dengan dokumen halaman terkait di folder ini?
2. Adakah klaim angka, nama, atau foto yang tidak ada di sumber? Hapus.
3. Tombol utama masih oranye dan menjadi elemen paling menonjol di bagiannya?
4. Reveal hanya di bawah lipatan pertama dan hormati reduced-motion?
5. Grid kartu seragam tinggi?
6. Kontras dan target sentuh diperiksa?
