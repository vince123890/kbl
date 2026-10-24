import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { company, mapsUrl, waLink } from "@/lib/site-config";
import { SiteHeader } from "./site-header";

export const metadata: Metadata = {
  title: { absolute: "PT Karunia Beton Lestari (KBL) — Batu Pecah & Readymix, Deli Serdang" },
  description:
    "PT Karunia Beton Lestari (KBL), Sunggal, Deli Serdang, Sumatera Utara: pemasok batu pecah dan beton readymix. Dari batu, batching plant, transit mixer, sampai concrete pump di lokasi cor.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "PT Karunia Beton Lestari (KBL) — Quality Stone and Readymix Concrete",
    description: "Dari batu sampai beton siap cor. Profil, layanan, dan kontak KBL, Sunggal, Deli Serdang.",
    locale: "id_ID",
    type: "website",
  },
};

type Photo = { src: string; w: number; h: number; alt: string };

/** Foto bebas lisensi (ilustrasi), BUKAN dokumentasi KBL. Kredit lengkap ditampilkan di bagian bawah halaman. */
const PHOTOS: Record<"mixer" | "quarry" | "batching" | "pump", Photo> = {
  mixer: { src: "/foto/mixer.jpg", w: 1920, h: 1440, alt: "Truk transit mixer biru sedang berada di lokasi pengecoran jalan" },
  quarry: { src: "/foto/quarry.jpg", w: 1600, h: 1200, alt: "Gunungan batu pecah di lokasi quarry dengan excavator merah di puncaknya" },
  batching: { src: "/foto/batching.jpg", w: 1920, h: 1082, alt: "Instalasi batching plant dengan silo semen dan konveyor agregat" },
  pump: { src: "/foto/pump.jpg", w: 1800, h: 1219, alt: "Concrete pump dengan boom panjang mengecor struktur bertulang di lokasi proyek" },
};

const CREDITS: { photo: string; author: string; license: string; licenseUrl?: string; source: string }[] = [
  {
    photo: "Truk transit mixer (hero)",
    author: "Captainmorlypogi1959",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: "https://commons.wikimedia.org/wiki/File:Mitsubishi_Fuso_Super_Great_Transit_Mixer_Truck_2021.jpg",
  },
  {
    photo: "Tumpukan batu pecah",
    author: "John Haynes",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    source: "https://commons.wikimedia.org/wiki/File:Crushed_stone_at_Tonfanau_Quarry_-_geograph.org.uk_-_2978560.jpg",
  },
  {
    photo: "Batching plant",
    author: "Fsmazlum",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: "https://commons.wikimedia.org/wiki/File:MOBILE_CONCRETE_BATCHING_PLANT_mekaglobal.jpg",
  },
  {
    photo: "Concrete pump",
    author: "Steve Pivnick, U.S. Air Force",
    license: "Domain publik",
    source: "https://commons.wikimedia.org/wiki/File:Construction_site_with_concrete_pump_truck.JPG",
  },
];

const LAYANAN: { nama: string; isi: string }[] = [
  { nama: "Batu pecah dan agregat", isi: "Material batu untuk beton, jalan, dan pekerjaan sipil. Ukuran dan ketersediaan kami sesuaikan dengan kebutuhan proyek Anda." },
  { nama: "Beton readymix", isi: "Beton siap pakai yang diproduksi di batching plant dan dikirim langsung ke lokasi cor. Mutu mengikuti kebutuhan struktur Anda." },
  { nama: "Transit mixer", isi: "Truk pengaduk yang menjaga beton tetap bergerak selama perjalanan dari plant ke proyek." },
  { nama: "Concrete pump", isi: "Pompa beton untuk menjangkau area yang sulit: lantai atas, bentang panjang, atau lokasi sempit." },
  { nama: "Stone crusher dan loader", isi: "Mesin pemecah batu serta wheel loader (front end loader) untuk mengolah dan memuat material." },
  { nama: "Jembatan timbang", isi: "Penimbangan muatan kendaraan, supaya jumlah material yang keluar dari plant tercatat." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: company.legal,
  alternateName: company.short,
  url: company.siteUrl,
  email: company.email,
  telephone: [company.phone.tel, company.mobile.tel],
  slogan: company.tagline,
  address: {
    "@type": "PostalAddress",
    streetAddress: `${company.address.street}, ${company.address.area}`,
    addressLocality: "Deli Serdang",
    addressRegion: "Sumatera Utara",
    postalCode: "20351",
    addressCountry: "ID",
  },
  sameAs: [company.instagram.url],
};

function Fig({ p, tab, sizes, priority }: { p: Photo; tab?: string; sizes: string; priority?: boolean }) {
  return (
    <figure className="kb-fig">
      <Image src={p.src} width={p.w} height={p.h} alt={p.alt} sizes={sizes} priority={priority} />
      {tab && <figcaption className="kb-tab">{tab}</figcaption>}
    </figure>
  );
}

export default function CompanyProfilePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a className="kb-skip" href="#cerita">
        Lompat ke konten
      </a>
      <SiteHeader />

      {/* ------------------------------------------------------------ hero */}
      <section className="kb-hero" aria-labelledby="h-hero">
        <Image
          src={PHOTOS.mixer.src}
          width={PHOTOS.mixer.w}
          height={PHOTOS.mixer.h}
          alt={PHOTOS.mixer.alt}
          sizes="100vw"
          priority
          className="kb-hero-img"
        />
        <div className="kb-hero-shade" />
        <div className="kb-wrap kb-hero-copy">
          <p className="kb-eyebrow">{company.tagline}</p>
          <h1 id="h-hero">
            Dari batu sampai beton <em>siap cor.</em>
          </h1>
          <p className="kb-hero-lede">
            {company.legal} memasok batu pecah dan beton readymix dari Sunggal, Deli Serdang, Sumatera Utara. Kami mulai dari batu, dan kami tahu betul apa yang membuat beton kuat.
          </p>
          <div className="kb-actions">
            <a className="kb-btn kb-btn-aksen" href="#cerita">
              Baca ceritanya
            </a>
            <a className="kb-btn kb-btn-garis" href={waLink(company.mobile.wa)} target="_blank" rel="noopener noreferrer">
              Hubungi kami
            </a>
          </div>
        </div>
        <p className="kb-hero-tab">{company.legal}</p>
      </section>

      <main>
        {/* ------------------------------------------------------------ bab I */}
        <section className="kb-bab" id="cerita" aria-labelledby="h-bab1">
          <div className="kb-wrap kb-split">
            <div className="kb-text">
              <p className="kb-bab-label">Bab satu</p>
              <h2 id="h-bab1">Kami mulai dari batu</h2>
              <p>
                KBL tidak lahir sebagai pabrik beton. Kami mulai sebagai pemasok berbagai jenis material batu, lalu mengembangkan usaha ke produksi beton siap pakai.
              </p>
              <p>
                Urutan itu penting. Sekitar dua pertiga isi beton adalah agregat, jadi siapa yang paham batu, paham separuh rahasia beton. Dari pengalaman itulah kami memandang
                setiap kubik yang keluar dari plant: bukan sekadar campuran, melainkan bahan yang akan menahan bangunan bertahun-tahun.
              </p>
            </div>
            <Fig p={PHOTOS.quarry} tab="Batu pecah: bahan pertama dan utama" sizes="(min-width: 900px) 520px, 100vw" />
          </div>
        </section>

        {/* ------------------------------------------------------------ bab II */}
        <section className="kb-bab is-krem" aria-labelledby="h-bab2">
          <div className="kb-wrap kb-split is-balik">
            <div className="kb-text">
              <p className="kb-bab-label">Bab dua</p>
              <h2 id="h-bab2">Meracik di batching plant</h2>
              <p>
                Di batching plant, batu, pasir, semen, dan air bertemu. Komposisinya mengikuti rancangan campuran yang dibutuhkan proyek, karena beton untuk pondasi, lantai kerja,
                dan struktur bertingkat tidak boleh diperlakukan sama.
              </p>
              <p>Ceritakan kebutuhan struktur Anda. Dari situ kami bantu menentukan mutu dan jumlah yang tepat.</p>
            </div>
            <Fig p={PHOTOS.batching} tab="Batching plant dengan silo dan konveyor agregat" sizes="(min-width: 900px) 560px, 100vw" />
          </div>
        </section>

        {/* ------------------------------------------------------------ bab III: pita */}
        <section className="kb-band" aria-labelledby="h-bab3">
          <div className="kb-wrap">
            <p className="kb-bab-label" style={{ color: "var(--aksen)" }}>
              Bab tiga
            </p>
            <blockquote id="h-bab3">
              Beton mulai mengeras sejak diaduk. <em>Setiap menit di jalan dihitung.</em>
            </blockquote>
            <p>
              Karena itu readymix bergerak di dalam transit mixer: drum berputar menjaga campuran tetap homogen selama perjalanan menuju proyek. Waktu tempuh, kondisi kendaraan, dan
              kesiapan lokasi cor sama pentingnya dengan resep campurannya.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------ bab IV */}
        <section className="kb-bab" aria-labelledby="h-bab4">
          <div className="kb-wrap kb-split">
            <div className="kb-text">
              <p className="kb-bab-label">Bab empat</p>
              <h2 id="h-bab4">Sampai di lokasi cor</h2>
              <p>
                Perjalanan satu kubik beton berakhir di cetakan: di lantai, kolom, atau jalan. Untuk lokasi yang sulit dijangkau, concrete pump membawa beton sampai ke titik
                tuang yang tepat, tanpa harus dipikul atau diangkut dua kali.
              </p>
              <p>Di situlah pekerjaan kami selesai, dan pekerjaan bangunan Anda baru dimulai.</p>
            </div>
            <Fig p={PHOTOS.pump} tab="Concrete pump di lokasi pengecoran" sizes="(min-width: 900px) 540px, 100vw" />
          </div>
        </section>

        {/* ------------------------------------------------------------ layanan */}
        <section className="kb-bab is-krem" id="layanan" aria-labelledby="h-layanan">
          <div className="kb-wrap">
            <div className="kb-bab-head">
              <p className="kb-bab-label">Layanan dan peralatan</p>
              <h2 id="h-layanan">Yang kami kerjakan, dan dengan apa</h2>
              <p className="kb-serif">
                Dari material batu sampai beton yang sudah dituang. Daftar mutu, ukuran agregat, dan harga kami susun per proyek, jadi hubungi tim kami untuk penawaran.
              </p>
            </div>
            <ul className="kb-layanan">
              {LAYANAN.map((l) => (
                <li key={l.nama}>
                  <h3>{l.nama}</h3>
                  <p>{l.isi}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ kontak */}
        <section className="kb-kontak" id="kontak" aria-labelledby="h-kontak">
          <div className="kb-wrap kb-kontak-grid">
            <div>
              <p className="kb-bab-label is-gelap">Bab terakhir</p>
              <h2 id="h-kontak">Ada proyek yang butuh batu atau beton?</h2>
              <p className="kb-serif">
                Sampaikan lokasi, volume, dan mutu yang Anda butuhkan. Tim kami akan menghubungi Anda untuk penawaran dan jadwal pengiriman.
              </p>
              <div className="kb-actions">
                <a className="kb-btn kb-btn-navy" href={waLink(company.mobile.wa)} target="_blank" rel="noopener noreferrer">
                  WhatsApp {company.mobile.label}
                </a>
                <a className="kb-btn kb-btn-garis" href={`tel:${company.phone.tel}`}>
                  Telepon {company.phone.label}
                </a>
              </div>
            </div>
            <dl className="kb-card">
              <div>
                <dt>Alamat</dt>
                <dd>
                  {company.address.street}
                  <br />
                  {company.address.area}
                  <br />
                  {company.address.city}
                  <br />
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    Buka di Google Maps
                  </a>
                </dd>
              </div>
              <div>
                <dt>Telepon</dt>
                <dd>
                  <a href={`tel:${company.phone.tel}`}>{company.phone.label}</a>
                  <br />
                  <a href={`tel:${company.mobile.tel}`}>{company.mobile.label}</a>
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${company.email}`}>{company.email}</a>
                </dd>
              </div>
              <div>
                <dt>Instagram</dt>
                <dd>
                  <a href={company.instagram.url} target="_blank" rel="noopener noreferrer">
                    {company.instagram.handle}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ------------------------------------------------------------ kredit foto */}
        <section className="kb-kredit" aria-labelledby="h-kredit">
          <div className="kb-wrap">
            <h2 id="h-kredit">Kredit foto</h2>
            <p>
              Foto di halaman ini adalah ilustrasi berlisensi bebas dari Wikimedia Commons, bukan dokumentasi operasional KBL. Foto telah diubah ukurannya. Akan diganti dengan foto
              fasilitas dan armada KBL.
            </p>
            <ul>
              {CREDITS.map((c) => (
                <li key={c.photo}>
                  {c.photo}: {c.author},{" "}
                  {c.licenseUrl ? (
                    <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer license">
                      {c.license}
                    </a>
                  ) : (
                    c.license
                  )}
                  ,{" "}
                  <a href={c.source} target="_blank" rel="noopener noreferrer">
                    sumber
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="kb-footer">
        <div className="kb-wrap kb-footer-row">
          <div>
            <Link href="/" className="kb-logo" aria-label="PT Karunia Beton Lestari, beranda">
              <span className="kb-mark" aria-hidden="true">
                KBL
              </span>
              <span className="kb-logo-name">
                Karunia Beton Lestari
                <small>Stone &amp; Readymix</small>
              </span>
            </Link>
            <p>
              {company.legal}
              <br />
              {company.address.street}, {company.address.area}, {company.address.city}
            </p>
          </div>
          <nav aria-label="Tautan footer">
            <a href="#cerita">Cerita</a>
            <a href="#layanan">Layanan</a>
            <a href="#kontak">Kontak</a>
          </nav>
        </div>
        <div className="kb-wrap kb-footer-bottom">
          <span>© 2026 {company.legal}</span>
          <Link href="/login">Masuk Aplikasi (karyawan)</Link>
        </div>
      </footer>
    </>
  );
}
