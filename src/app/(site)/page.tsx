import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { company, mapsUrl, waLink } from "@/lib/site-config";
import { Reveal } from "./reveal";
import { SiteHeader } from "./site-header";

// Konten mengikuti docs/company-profile/02-Beranda.md (kerangka StoryBrand). Ubah dokumen itu dulu, lalu sinkronkan di sini.

export const metadata: Metadata = {
  title: { absolute: "PT Karunia Beton Lestari (KBL) — Batu Pecah & Beton Readymix, Deli Serdang" },
  description:
    "KBL memasok batu pecah dan beton readymix dari Sunggal, Deli Serdang. Pesanan tercatat dari penawaran sampai foto bukti terkirim, armada dirawat terjadwal.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "PT Karunia Beton Lestari (KBL) — Pengecoran Anda Tidak Boleh Menunggu",
    description: "Batu pecah dan beton readymix dengan pesanan yang tercatat dan armada yang dirawat. Sunggal, Deli Serdang.",
    locale: "id_ID",
    type: "website",
  },
};

type Photo = { src: string; w: number; h: number; alt: string };

/** Foto bebas lisensi (ilustrasi), BUKAN dokumentasi KBL. Kredit lengkap ada di bagian bawah halaman. */
const PHOTOS = {
  mixer: { src: "/foto/mixer.jpg", w: 1920, h: 1440, alt: "Truk transit mixer biru sedang berada di lokasi pengecoran jalan" },
  quarry: { src: "/foto/quarry.jpg", w: 1600, h: 1200, alt: "Gunungan batu pecah di lokasi quarry dengan excavator merah di puncaknya" },
  kontrak: { src: "/foto/kontrak.jpg", w: 1800, h: 1350, alt: "Lembar penawaran dan kontrak dengan pulpen di atasnya" },
  bengkel: { src: "/foto/bengkel.jpg", w: 1800, h: 1200, alt: "Truk diesel merah di dalam bengkel perawatan" },
  batching: { src: "/foto/batching.jpg", w: 1920, h: 1082, alt: "Instalasi batching plant dengan silo semen dan konveyor agregat" },
  lokasi: { src: "/foto/lokasi.jpg", w: 1800, h: 1201, alt: "Transit mixer dan concrete pump di lokasi proyek yang sedang dicor" },
  pump: { src: "/foto/pump.jpg", w: 1800, h: 1219, alt: "Concrete pump dengan boom panjang mengecor struktur bertulang" },
} satisfies Record<string, Photo>;

const CREDITS: { photo: string; author: string; license: string; licenseUrl?: string; source: string }[] = [
  { photo: "Transit mixer (hero)", author: "Captainmorlypogi1959", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:Mitsubishi_Fuso_Super_Great_Transit_Mixer_Truck_2021.jpg" },
  { photo: "Tumpukan batu pecah", author: "John Haynes", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://commons.wikimedia.org/wiki/File:Crushed_stone_at_Tonfanau_Quarry_-_geograph.org.uk_-_2978560.jpg" },
  { photo: "Penawaran dan kontrak", author: "Blogtrepreneur", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://commons.wikimedia.org/wiki/File:Legal_Contract_%26_Signature_-_Warm_Tones.jpg" },
  { photo: "Bengkel truk", author: "BEAR RV", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/", source: "https://commons.wikimedia.org/wiki/File:Truck_Repair_-_panoramio.jpg" },
  { photo: "Batching plant", author: "Fsmazlum", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:MOBILE_CONCRETE_BATCHING_PLANT_mekaglobal.jpg" },
  { photo: "Transit mixer di lokasi cor", author: "U.S. Air Force, Airman Sydney Franklin", license: "Domain publik", source: "https://commons.wikimedia.org/wiki/File:Concrete_pouring_for_the_new_Spangdahlem_Elementary_School_(8062804).jpg" },
  { photo: "Concrete pump", author: "Steve Pivnick, U.S. Air Force", license: "Domain publik", source: "https://commons.wikimedia.org/wiki/File:Construction_site_with_concrete_pump_truck.JPG" },
];

const WA_TEXT = "Halo KBL, saya ingin konsultasi kebutuhan beton. Lokasi: … Volume: … Jadwal cor: …";
const waUtama = waLink(company.mobile.wa, WA_TEXT);

const MASALAH = [
  { judul: "Truk datang terlambat", isi: "Tukang sudah menunggu, jadwal cor sudah dipesan. Beton yang telat harus berpacu dengan waktu pengerasan." },
  { judul: "Tidak ada kabar", isi: "Pesanan sudah dibuat, tetapi tak ada yang tahu sedang diproduksi, di jalan, atau sudah tiba." },
  { judul: "Catatan tercecer", isi: "Harga di telepon, volume di chat, persetujuan di kertas. Saat ada selisih, tak ada satu sumber yang bisa dipegang." },
];

const RANTAI = [
  { kata: "Batu", isi: "Kami mulai sebagai pemasok material batu, jadi kualitas agregat kami kenal dari sumbernya." },
  { kata: "Racik", isi: "Batching plant mencampur batu, pasir, semen, dan air sesuai kebutuhan struktur Anda." },
  { kata: "Antar", isi: "Transit mixer menjaga beton tetap bergerak, concrete pump menjangkau titik tuang." },
  { kata: "Rawat", isi: "Armada kami dirawat terjadwal supaya tidak ada truk yang tertahan di hari pengecoran." },
];

const PERALATAN = ["Batching plant", "Transit mixer", "Concrete pump", "Stone crusher", "Wheel loader", "Jembatan timbang"];

const RENCANA = [
  { judul: "Ceritakan kebutuhan", isi: "Lokasi, volume, mutu, dan jadwal cor. Gratis, tanpa kewajiban." },
  { judul: "Terima quotation tertulis", isi: "Tim sales membuat penawaran; Anda boleh meminta revisi sampai cocok. Manajer menyetujui sebelum menjadi order." },
  { judul: "Pantau sampai terkirim", isi: "Status produksi dan pengiriman diperbarui. Begitu tiba, ada foto bukti pengiriman." },
];

const PRODUK = [
  { nama: "Batu pecah dan agregat", isi: "Material batu untuk beton, jalan, dan pekerjaan sipil.", cta: "Tanya ketersediaan", foto: PHOTOS.quarry, pesan: "Halo KBL, saya ingin menanyakan ketersediaan batu pecah. Lokasi: … Volume: …" },
  { nama: "Beton readymix", isi: "Beton siap pakai sesuai kebutuhan struktur, dikirim ke lokasi cor.", cta: "Minta quotation", foto: PHOTOS.batching, pesan: "Halo KBL, saya ingin meminta quotation beton readymix. Lokasi: … Volume: … Jadwal cor: …" },
  { nama: "Concrete pump", isi: "Menjangkau lantai atas, bentang panjang, dan lokasi sempit.", cta: "Minta quotation", foto: PHOTOS.pump, pesan: "Halo KBL, saya ingin meminta quotation concrete pump. Lokasi: … Jadwal cor: …" },
];

const BUKTI = [
  { judul: "Penawaran tertulis", isi: "Setiap harga dan volume ada di quotation yang disetujui manajer." },
  { judul: "Status yang diperbarui", isi: "Produksi dan pengiriman memiliki status; Anda tidak perlu menelepon untuk bertanya." },
  { judul: "Foto bukti pengiriman", isi: "Setiap pengiriman ditutup dengan foto dan penanda Terkirim." },
];

const SUKSES = [
  ["Harga di telepon, mudah berubah", "Quotation tertulis, disetujui manajer"],
  ["Menelepon untuk tahu pesanan sampai mana", "Status produksi dan pengiriman diperbarui"],
  ["“Katanya sudah sampai”", "Foto bukti pengiriman"],
  ["Truk tertahan di hari pengecoran", "Armada dirawat terjadwal, suku cadang dicatat"],
];

type Chapter = {
  id: string;
  aside?: boolean;
  day: string;
  time: string;
  place: string;
  title: string;
  body: string[];
  log: string[];
  photo?: { p: Photo; tab: string };
};

/** Cerita fiktif satu pesanan, sumber alur: dokumen requirement KBL (Agustus 2024). Isi lengkap: docs/company-profile/04-Alur-Pesanan.md */
const CHAPTERS: Chapter[] = [
  {
    id: "bab-1", day: "Senin", time: "09:15", place: "Tim sales", title: "Penawaran yang bisa dipegang",
    body: [
      "Seorang kontraktor menelepon. Ia butuh readymix untuk mengecor pondasi, dan ia ingin tahu harganya hari ini.",
      "Tim sales membuat quotation, lalu mengirimkannya lewat email atau mencetaknya. Kalau harga atau volumenya belum cocok, quotation diperbarui dan dikirim lagi, sampai kedua pihak sepakat.",
    ],
    log: ["Sales membuat quotation", "Dikirim ke pelanggan, lewat email atau cetak", "Belum cocok? Quotation diperbarui, dikirim ulang"],
    photo: { p: PHOTOS.kontrak, tab: "Penawaran yang disepakati tertulis" },
  },
  {
    id: "bab-2", day: "Senin", time: "14:00", place: "Manajer", title: "Satu persetujuan mengubah penawaran menjadi order",
    body: [
      "Pelanggan setuju. Sales menandai quotation sebagai Disetujui, dan manajer memberi persetujuannya.",
      "Mulai saat itu angkanya bukan lagi tawaran. Ia menjadi order yang muncul di daftar admin produksi, lengkap dengan siapa yang menyetujui dan kapan.",
    ],
    log: ["Pelanggan menyetujui", "Manajer menyetujui quotation", "Status Disetujui, order masuk daftar produksi"],
  },
  {
    id: "bab-3", aside: true, day: "Rabu", time: "16:30", place: "Bengkel dan gudang", title: "Truk yang tidak boleh tertahan",
    body: [
      "Sementara order menunggu hari pengecoran, di bengkel ada pekerjaan yang tak pernah masuk faktur: memastikan armada siap.",
      "Servis oli, pergantian suku cadang, bahkan perpanjangan STNK mengingatkan diri sendiri sebelum jatuh tempo. Teknisi yang butuh suku cadang mengajukannya ke gudang. Kalau stok tidak cukup, gudang membuat permintaan pembelian, pengadaan memprosesnya, dan manajer menyetujui.",
      "Kadang jawabannya ada di garasi sendiri. Ban kendaraan nomor 30 masih layak untuk nomor 40, dan perpindahan itu dicatat, supaya tak ada ban yang hilang tanpa jejak dan tak ada gudang yang tiba-tiba kosong.",
    ],
    log: ["Pengingat servis, suku cadang, dan STNK", "Teknisi mengajukan suku cadang ke gudang", "Stok kurang: permintaan pembelian, persetujuan manajer", "Perpindahan komponen antar kendaraan dicatat"],
    photo: { p: PHOTOS.bengkel, tab: "Armada dirawat sebelum dibutuhkan" },
  },
  {
    id: "bab-4", day: "Kamis", time: "04:30", place: "Admin produksi", title: "Batching plant menyala",
    body: [
      "Pagi-pagi sekali, admin produksi membuka daftar order yang sudah disetujui dan memulai produksi. Batu, pasir, semen, dan air bertemu sesuai rancangan campuran untuk pondasi tadi.",
      "Selama produksi berjalan, statusnya diperbarui berkala, sehingga siapa pun yang bertanya “sudah sampai mana?” mendapat jawaban tanpa menelepon ke plant. Begitu selesai, order ditandai Siap Kirim.",
    ],
    log: ["Admin produksi memulai order yang disetujui", "Status produksi diperbarui berkala", "Selesai: ditandai Siap Kirim"],
  },
  {
    id: "bab-5", day: "Kamis", time: "05:40", place: "Admin pengiriman", title: "Berangkat tanpa menunggu",
    body: [
      "Beton mulai mengeras sejak diaduk, jadi di sinilah waktu paling mahal. Admin pengiriman melihat daftar order Siap Kirim, menjadwalkan pengiriman, dan memperbarui status saat transit mixer berangkat dan selama di jalan.",
      "Armada yang dirawat hari Rabu kini berguna: tidak ada truk yang mogok di pintu keluar plant.",
    ],
    log: ["Admin pengiriman melihat daftar Siap Kirim", "Pengiriman dijadwalkan", "Status diperbarui selama perjalanan"],
  },
  {
    id: "bab-6", day: "Kamis", time: "07:10", place: "Lokasi pelanggan", title: "Bukti yang bisa dilihat",
    body: [
      "Truk tiba. Concrete pump menjangkau titik tuang, dan beton mengalir ke dalam bekisting pondasi.",
      "Begitu tiba di lokasi, admin pengiriman mengunggah foto bukti pengiriman, lalu menandai order Terkirim. Tidak ada lagi “katanya sudah sampai”: ada foto, ada jam.",
    ],
    log: ["Truk tiba di lokasi pelanggan", "Foto bukti pengiriman diunggah", "Order ditandai Terkirim"],
  },
  {
    id: "bab-7", day: "Kamis", time: "15:00", place: "Manajer", title: "Selesai, dan ceritanya tersimpan",
    body: [
      "Sore harinya status order berubah sendiri menjadi Selesai dan pindah ke histori penjualan.",
      "Manajer membuka laporan: penjualan, quotation, order terkirim dan yang masih pending, serta kinerja sales, produksi, dan pengiriman. Keputusan berikutnya diambil dari catatan, bukan dari ingatan.",
    ],
    log: ["Status otomatis menjadi Selesai", "Masuk histori penjualan", "Laporan penjualan, order terkirim, order pending, dan kinerja"],
  },
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

function Fig({ p, tab, sizes }: { p: Photo; tab?: string; sizes: string }) {
  return (
    <figure className="kb-fig">
      <Image src={p.src} width={p.w} height={p.h} alt={p.alt} sizes={sizes} />
      {tab && <figcaption className="kb-tab">{tab}</figcaption>}
    </figure>
  );
}

function Head({ label, title, lead, id }: { label: string; title: string; lead?: string; id: string }) {
  return (
    <Reveal className="kb-bab-head">
      <p className="kb-bab-label">{label}</p>
      <h2 id={id}>{title}</h2>
      {lead && <p className="kb-serif">{lead}</p>}
    </Reveal>
  );
}

export default function CompanyProfilePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a className="kb-skip" href="#masalah">
        Lompat ke konten
      </a>
      <SiteHeader
        contact={{ waHref: waUtama, mobileLabel: company.mobile.label, phoneLabel: company.phone.label, phoneTel: company.phone.tel }}
      />

      {/* ------------------------------------------------------------ hero */}
      <section className="kb-hero" id="beranda" aria-labelledby="h-hero">
        <Image src={PHOTOS.mixer.src} width={PHOTOS.mixer.w} height={PHOTOS.mixer.h} alt={PHOTOS.mixer.alt} sizes="100vw" priority className="kb-hero-img" />
        <div className="kb-hero-shade" />
        <div className="kb-wrap kb-hero-copy">
          <p className="kb-eyebrow">Batu pecah · Beton readymix · Sunggal, Deli Serdang</p>
          <h1 id="h-hero">
            Pengecoran Anda tidak boleh <em>menunggu.</em>
          </h1>
          <p className="kb-hero-lede">
            Batu pecah dan beton readymix dari KBL datang dengan pesanan yang tercatat: dari quotation tertulis sampai foto bukti terkirim, dengan armada yang dirawat
            sebelum hari pengecoran.
          </p>
          <div className="kb-actions">
            <a className="kb-btn kb-btn-aksen" href={waUtama} target="_blank" rel="noopener noreferrer">
              Konsultasi Kebutuhan Beton
            </a>
            <a className="kb-btn kb-btn-garis" href="#alur">
              Lihat Satu Pesanan dari Dekat
            </a>
          </div>
        </div>
        <p className="kb-hero-tab">{company.legal}</p>
      </section>

      <main>
        {/* ------------------------------------------------------------ masalah */}
        <section className="kb-bab is-krem" id="masalah" aria-labelledby="h-masalah">
          <div className="kb-wrap">
            <Head label="Masalahnya bukan betonnya" title="Yang membuat hari pengecoran menegangkan" id="h-masalah" />
            <div className="kb-grid3">
              {MASALAH.map((m, i) => (
                <Reveal key={m.judul} delay={i * 100} className="kb-cell">
                  <article className="kb-pain">
                    <h3>{m.judul}</h3>
                    <p>{m.isi}</p>
                  </article>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <p className="kb-pull">
                Masalahnya bukan betonnya, melainkan <strong>ketidakpastian</strong>. Dan ketidakpastian bisa dicegah: dengan proses yang tercatat dan armada yang siap.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------------ satu rantai */}
        <section className="kb-bab" id="armada" aria-labelledby="h-rantai">
          <div className="kb-wrap">
            <Head label="Satu rantai" title="Dari batu sampai lokasi cor, dalam satu tangan" id="h-rantai" />
            <div className="kb-grid4">
              {RANTAI.map((r, i) => (
                <Reveal key={r.kata} delay={i * 100} className="kb-cell">
                  <article className="kb-pillar">
                    <h3>{r.kata}</h3>
                    <p>{r.isi}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ pemandu */}
        <section className="kb-bab is-navy" id="tentang" aria-labelledby="h-pemandu">
          <div className="kb-wrap kb-split">
            <Reveal className="kb-text">
              <p className="kb-bab-label">Kami mulai dari batu</p>
              <h2 id="h-pemandu">Anda tidak menunggu sendirian</h2>
              <p>
                Kami tahu rasanya hari pengecoran: alarm jam empat pagi, tukang dan alat sudah dipesan, dan tidak ada yang bisa diulang. Yang Anda butuhkan saat itu bukan
                brosur, melainkan kepastian. Karena itu setiap pesanan di KBL punya catatan: siapa yang membuat penawaran, siapa yang menyetujui, kapan produksi dimulai, kapan
                truk berangkat.
              </p>
              <ul className="kb-peralatan" aria-label="Peralatan KBL">
                {PERALATAN.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal>
              <Fig p={PHOTOS.lokasi} tab="Transit mixer dan concrete pump di lokasi cor" sizes="(min-width: 900px) 540px, 100vw" />
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------------ rencana */}
        <section className="kb-bab" id="rencana" aria-labelledby="h-rencana">
          <div className="kb-wrap">
            <Head label="Rencana" title="Tiga langkah sampai beton tiba" id="h-rencana" />
            <ol className="kb-steps3">
              {RENCANA.map((r, i) => (
                <Reveal as="li" key={r.judul} delay={i * 100} className="kb-cell">
                  <div className="kb-step">
                    <span className="kb-step-n" aria-hidden="true">
                      {i + 1}
                    </span>
                    <h3>{r.judul}</h3>
                    <p>{r.isi}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
            <Reveal>
              <div className="kb-actions">
                <a className="kb-btn kb-btn-aksen" href={waUtama} target="_blank" rel="noopener noreferrer">
                  Mulai dari Langkah 1: Konsultasi
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------------ produk */}
        <section className="kb-bab is-krem" id="produk" aria-labelledby="h-produk">
          <div className="kb-wrap">
            <Head label="Produk" title="Untuk setiap tahap pekerjaan Anda" lead="Daftar mutu dan harga kami sampaikan lewat quotation, sesuai kebutuhan proyek." id="h-produk" />
            <div className="kb-grid3">
              {PRODUK.map((p, i) => (
                <Reveal key={p.nama} delay={i * 100} className="kb-cell">
                  <article className="kb-prod">
                    <div className="kb-prod-img">
                      <Image src={p.foto.src} width={p.foto.w} height={p.foto.h} alt={p.foto.alt} sizes="(min-width: 900px) 380px, 100vw" />
                    </div>
                    <div className="kb-prod-body">
                      <h3>{p.nama}</h3>
                      <p>{p.isi}</p>
                      <a href={waLink(company.mobile.wa, p.pesan)} target="_blank" rel="noopener noreferrer">
                        {p.cta} →
                      </a>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ alur pesanan */}
        <section className="kb-cerita" id="alur" aria-labelledby="h-alur">
          <div className="kb-wrap">
            <Head
              label="Alur pesanan"
              title="Satu pesanan, dari Senin sampai Kamis"
              lead="Seorang kontraktor, satu pengecoran pondasi, dan tim di balik layar. Pesanan ini rekaan untuk menggambarkan alur kerja kami, dan setiap bab menunjukkan apa yang dicatat di tiap tahap."
              id="h-alur"
            />
          </div>
          <div className="kb-chapters">
            {CHAPTERS.map((c) => (
              <article key={c.id} className={`kb-ch ${c.aside ? "is-aside" : ""}`} aria-labelledby={c.id}>
                <div className="kb-wrap kb-ch-grid">
                  <div className="kb-when">
                    <span className="kb-day">{c.day}</span>
                    <time>{c.time}</time>
                    <span className="kb-who">{c.place}</span>
                    {c.aside && <span className="kb-aside-tag">Di balik layar</span>}
                  </div>
                  <Reveal className="kb-ch-body">
                    <h3 id={c.id}>{c.title}</h3>
                    {c.body.map((t) => (
                      <p key={t.slice(0, 28)}>{t}</p>
                    ))}
                    <ol className="kb-log" aria-label="Yang dicatat pada tahap ini">
                      {c.log.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ol>
                    {c.photo && <Fig p={c.photo.p} tab={c.photo.tab} sizes="(min-width: 900px) 600px, 100vw" />}
                  </Reveal>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ bukti */}
        <section className="kb-bab" id="bukti" aria-labelledby="h-bukti">
          <div className="kb-wrap">
            <Head label="Bukti" title="Yang bisa Anda periksa" lead="Kami tidak memajang angka yang belum bisa dibuktikan. Yang kami janjikan adalah proses yang Anda bisa lihat sendiri." id="h-bukti" />
            <div className="kb-grid3">
              {BUKTI.map((b, i) => (
                <Reveal key={b.judul} delay={i * 100} className="kb-cell">
                  <article className="kb-pain is-bukti">
                    <h3>{b.judul}</h3>
                    <p>{b.isi}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ sukses */}
        <section className="kb-bab is-krem" id="sukses" aria-labelledby="h-sukses">
          <div className="kb-wrap">
            <Head label="Sukses" title="Seperti apa saat semuanya berjalan" id="h-sukses" />
            <Reveal>
              <table className="kb-compare">
                <caption className="kb-sr">Perbandingan tanpa catatan yang rapi dan bersama KBL</caption>
                <thead>
                  <tr>
                    <th scope="col">Tanpa catatan yang rapi</th>
                    <th scope="col">Bersama KBL</th>
                  </tr>
                </thead>
                <tbody>
                  {SUKSES.map(([a, b]) => (
                    <tr key={a}>
                      <td>{a}</td>
                      <td>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
            <Reveal>
              <p className="kb-pull">Pengecoran yang tenang bukan keberuntungan. Itu hasil dari proses yang dicatat dan armada yang disiapkan sebelumnya.</p>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------------ cta penutup */}
        <section className="kb-kontak" id="kontak" aria-labelledby="h-kontak">
          <div className="kb-wrap kb-kontak-grid">
            <Reveal>
              <p className="kb-bab-label is-gelap">Giliran Anda</p>
              <h2 id="h-kontak">Ceritakan kebutuhan pengecoran Anda. Kami bantu hitung dan jadwalkan.</h2>
              <p className="kb-serif">Sampaikan lokasi, volume, mutu, dan jadwal cor. Tim sales kami akan membuat quotation tertulis dan menghubungi Anda.</p>
              <div className="kb-actions">
                <a className="kb-btn kb-btn-navy" href={waUtama} target="_blank" rel="noopener noreferrer">
                  Konsultasi Kebutuhan Beton
                </a>
                <a className="kb-btn kb-btn-wa" href={waLink(company.mobile.wa)} target="_blank" rel="noopener noreferrer">
                  Chat WhatsApp
                </a>
              </div>
            </Reveal>
            <Reveal delay={100}>
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
            </Reveal>
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
            <p className="kb-footer-line">Dari batu sampai beton siap cor, tercatat di setiap tahap.</p>
          </div>
          <nav aria-label="Tautan footer">
            <a href="#tentang">Tentang</a>
            <a href="#produk">Produk</a>
            <a href="#alur">Alur pesanan</a>
            <a href="#armada">Armada</a>
            <a href="#kontak">Hubungi</a>
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
