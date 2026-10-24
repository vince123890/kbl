import type { Metadata } from "next";
import Link from "next/link";
import { InstallButton } from "@/components/install-button";
import { hasContact, siteConfig } from "@/lib/site-config";
import {
  ApprovalArtifact,
  EmergencyArtifact,
  OpnameArtifact,
  RescheduleArtifact,
  ScheduleArtifact,
  StockCardArtifact,
} from "./artifacts";
import { HeroSlider } from "./hero-slider";
import { IllApproval, IllEmergency, IllOpname, IllReschedule, IllSchedule, IllStock } from "./illustrations";
import { SiteHeader } from "./site-header";

export const metadata: Metadata = {
  title: { absolute: "KBL — Armada terawat, perjalanan terjaga" },
  description:
    "Sparepart tercatat, perawatan terjadwal, perubahan punya alasan, keputusan dikontrol pusat, dan bantuan cepat saat darurat di jalan. Sistem manajemen perawatan dan sparepart armada.",
  openGraph: {
    title: "KBL — Armada terawat, perjalanan terjaga",
    description: "Sistem manajemen perawatan dan sparepart armada, dari gudang sampai tepi jalan tol.",
    locale: "id_ID",
    type: "website",
  },
};

const ODOMETER = "084250".split("");

const MODULES = [
  {
    id: "modul-stok",
    tag: "Gudang",
    title: "Mutasi sparepart & kartu stok",
    text: "Masuk, keluar, retur, dan pindah gudang tercatat dalam dokumen digital lengkap dengan kartu stok per sparepart.",
    chapter: "#bab-1",
    status: "Berikutnya",
    Art: IllStock,
  },
  {
    id: "modul-opname",
    tag: "Gudang",
    title: "Stock opname",
    text: "Hitung fisik lewat ponsel, bandingkan dengan sistem, dan beri alasan pada setiap selisih sebelum stok disesuaikan.",
    chapter: "#bab-5",
    status: "Berikutnya",
    Art: IllOpname,
  },
  {
    id: "modul-jadwal",
    tag: "Perawatan",
    title: "Jadwal perawatan & perbaikan",
    text: "Servis berkala muncul menurut waktu atau kilometer. Perbaikan darurat boleh menyela antrean.",
    chapter: "#bab-2",
    status: "Menyusul",
    Art: IllSchedule,
  },
  {
    id: "modul-anomali",
    tag: "Perawatan",
    title: "Perubahan jadwal & alasannya",
    text: "Percepatan dan penundaan wajib beralasan, lalu menjadi laporan pola keterlambatan per kendaraan dan cabang.",
    chapter: "#bab-3",
    status: "Menyusul",
    Art: IllReschedule,
  },
  {
    id: "modul-approval",
    tag: "Kontrol pusat",
    title: "Approval berjenjang",
    text: "Dokumen penting disetujui atasan dan departemen terkait. Pembuat tidak menyetujui dokumennya sendiri.",
    chapter: "#bab-4",
    status: "Berikutnya",
    Art: IllApproval,
  },
  {
    id: "modul-darurat",
    tag: "Keselamatan",
    title: "Darurat di jalan",
    text: "Lapor dengan satu ketukan, lihat langkah cepat dan kontak pusat, sementara pusat menindaklanjuti.",
    chapter: "#bab-6",
    status: "Menyusul",
    Art: IllEmergency,
  },
];

const NEEDS: { quote: string; answer: string; where: string }[] = [
  {
    quote: "Form digital atau kartu keluar-masuk sparepart kendaraan",
    answer: "Setiap sparepart yang masuk, keluar, diretur, atau dipindah punya dokumen digital dan kartu stok. Siapa, kapan, untuk kendaraan mana, dan sisa berapa, tertulis dan tidak bisa diubah diam-diam.",
    where: "Mutasi sparepart · Kartu stok",
  },
  {
    quote: "Form digital atau kartu stock opname",
    answer: "Hitung fisik di rak lewat ponsel, bandingkan dengan angka sistem, isi alasan untuk setiap selisih. Stok baru disesuaikan setelah disetujui.",
    where: "Stock opname",
  },
  {
    quote: "Jadwal perawatan dan perbaikan, bahkan saat emergensi",
    answer: "Servis berkala muncul sendiri menurut waktu atau kilometer. Perbaikan darurat boleh menyela antrean, dan pusat langsung tahu.",
    where: "Rencana perawatan · Work order · Kalender",
  },
  {
    quote: "Anomali jadwal saat dipercepat atau ditunda, beserta alasannya",
    answer: "Setiap jadwal yang maju atau mundur wajib punya alasan. Hasilnya menjadi laporan: kendaraan mana yang sering tertunda, dan karena apa.",
    where: "Perubahan jadwal · Laporan anomali",
  },
  {
    quote: "Validasi dan approval dari departemen lain atau atasan, supaya kontrol tetap di pusat",
    answer: "Dokumen penting melewati persetujuan berjenjang. Pembuat tidak menyetujui dokumennya sendiri, dan pusat melihat seluruh antrean lintas cabang.",
    where: "Approval berjenjang",
  },
  {
    quote: "Saat emergensi di jalan, ada kontak dan langkah cepat dari pusat",
    answer: "Satu ketukan melapor. Pengemudi langsung melihat langkah keselamatan dan tombol telepon, sementara pusat menerima peringatan dan menindaklanjuti.",
    where: "Lapor darurat · Insiden · Kontak",
  },
];

const ROLES: { name: string; text: string }[] = [
  { name: "Pengemudi", text: "Melapor darurat dalam sekali ketuk dan langsung tahu apa yang harus dilakukan." },
  { name: "Mekanik", text: "Menjalankan work order dan mencatat sparepart yang dipakai langsung dari bengkel." },
  { name: "Staf gudang", text: "Mencatat barang masuk dan keluar, menghitung stok di rak." },
  { name: "Supervisor", text: "Menyusun jadwal, menyetujui di level pertama, menangani insiden cabang." },
  { name: "Kepala departemen", text: "Menyetujui perubahan yang butuh keputusan lebih tinggi." },
  { name: "Admin pusat", text: "Melihat semua cabang, menyetujui akhir, memegang kendali saat darurat." },
  { name: "Admin sistem", text: "Mengatur pengguna, hak akses, data master, dan aturan." },
];

const CONTROLS: { title: string; text: string; live: boolean }[] = [
  { title: "Akses per peran dan cabang", text: "Setiap orang hanya melihat dan mengubah bagiannya. Data cabang lain tidak terlihat, kecuali oleh pusat. Ditegakkan di database, bukan sekadar menyembunyikan tombol.", live: true },
  { title: "Jejak audit permanen", text: "Perubahan data penting tercatat: siapa, kapan, nilai sebelum dan sesudah. Catatannya tidak bisa diubah atau dihapus.", live: true },
  { title: "Akun dan sesi terjaga", text: "Akun dikunci 15 menit setelah 5 kali salah password. Sesi berakhir otomatis setelah 8 jam. Akun dibuat admin, tanpa pendaftaran terbuka.", live: true },
  { title: "Persetujuan berjenjang", text: "Dokumen penting melewati atasan dan departemen terkait. Pembuat tidak dapat menyetujui dokumennya sendiri.", live: false },
];

const STATS = [
  { n: "6", label: "Modul inti dari kebutuhan awal" },
  { n: "7", label: "Peran pengguna dengan layar sendiri" },
  { n: "13", label: "Laporan standar dirancang" },
  { n: "4", label: "Titik persetujuan berjenjang" },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Apakah harus memasang aplikasi dari toko aplikasi?",
    a: "Tidak. KBL berjalan di browser dan dapat dipasang ke layar utama ponsel. Di Chrome atau Edge pilih Pasang Aplikasi; di iPhone buka lewat Safari, ketuk Bagikan, lalu Tambah ke Layar Utama.",
  },
  {
    q: "Siapa yang membuat akun pengguna?",
    a: "Admin sistem di perusahaan Anda. Tidak ada pendaftaran terbuka, jadi hanya orang yang memang berhak yang bisa masuk. Lupa password? Pakai tautan reset yang dikirim ke email.",
  },
  {
    q: "Apakah data tiap cabang terpisah?",
    a: "Ya. Pengguna cabang hanya melihat data cabangnya. Admin pusat dan admin sistem dapat melihat lintas cabang.",
  },
  {
    q: "Bagaimana kalau sinyal hilang di jalan?",
    a: "Layar langkah cepat dan kontak dirancang tetap tampil, dan laporan darurat menunggu di ponsel sampai tersambung. Bagian ini masuk tahap penanganan darurat dan belum tersedia.",
  },
  {
    q: "Apa saja yang sudah bisa dipakai hari ini?",
    a: "Fondasinya: login, pengguna dan hak akses, data master (cabang, kendaraan, sparepart, gudang, vendor, kategori alasan), parameter, dan audit log. Modul stok, jadwal, approval, dan darurat menyusul sesuai peta jalan.",
  },
  {
    q: "Bisa untuk beberapa cabang dengan kontrol dari pusat?",
    a: "Itu inti rancangannya. Setiap cabang bekerja di datanya sendiri, sementara pusat melihat antrean persetujuan dan insiden dari semua cabang.",
  },
];

const CHAPTERS = [
  {
    id: "bab-1",
    tone: "is-dawn",
    time: "05:45",
    place: "Gudang Jakarta",
    title: "Satu filter oli, satu catatan",
    body: [
      "Wawan sudah di gudang sebelum matahari naik. Mekanik meminta dua filter oli untuk B 9001 KBL. Dulu, permintaan seperti ini berakhir sebagai coretan di kartu kertas yang entah kapan dipindahkan ke buku besar.",
      "Pagi ini Wawan mengisi satu form. Sistem menolak kalau stok tak cukup, mencatat kendaraan yang memakainya, lalu meminta persetujuan supervisor. Begitu disetujui, kartu stok filter oli berkurang dua, dengan nama dan jamnya.",
    ],
    need: "form digital dan kartu keluar-masuk sparepart kendaraan.",
    Art: StockCardArtifact,
  },
  {
    id: "bab-2",
    tone: "is-morning",
    time: "08:20",
    place: "Workshop",
    title: "Servis yang datang sebelum diminta",
    body: [
      "Odometer B 9001 KBL menunjuk 84.250. Servis besar jatuh di 85.000. Supervisor tidak perlu mengingat-ingat: jadwalnya sudah muncul, lengkap dengan sparepart yang akan dibutuhkan, sehingga gudang bisa menyisihkannya lebih dulu.",
      "Bengkel pun tak lagi bergantung pada ingatan siapa pun. Dan kalau ada kerusakan mendadak, perbaikan darurat tetap punya tempat di jadwal: ia menyela antrean, dan pusat langsung diberi tahu.",
    ],
    need: "jadwal perawatan dan perbaikan, termasuk saat emergensi.",
    Art: ScheduleArtifact,
  },
  {
    id: "bab-3",
    tone: "is-noon",
    time: "11:00",
    place: "Kantor cabang",
    title: "Jadwal boleh bergeser. Alasannya tidak boleh hilang.",
    body: [
      "Kampas rem untuk B 9002 KBL belum datang. Sinta, supervisor, menunda servisnya tiga hari. Di kertas, perubahan seperti ini sering lenyap tanpa penjelasan, lalu setahun kemudian tak ada yang tahu kenapa kendaraan itu terlambat servis terus.",
      "Kini sistem tidak mau menyimpan perubahan sebelum alasannya dipilih. Percepatan dan penundaan sama-sama tercatat: berapa lama, karena apa, siapa yang meminta. Dari situ pusat bisa melihat pola, bukan sekadar kejadian.",
    ],
    need: "jadwal dan anomali saat dipercepat atau ditunda, beserta alasannya.",
    Art: RescheduleArtifact,
  },
  {
    id: "bab-4",
    tone: "is-morning",
    time: "13:30",
    place: "Kantor pusat",
    title: "Pusat tak perlu berdiri di bengkel untuk tahu",
    body: [
      "Hendra di pusat memegang lima cabang. Ia tidak menelepon satu per satu untuk bertanya, “Jadi ini sudah disetujui siapa?” Antreannya ada di satu layar: apa yang menunggu, di level mana, sudah berapa lama.",
      "Setiap keputusan meninggalkan jejak: siapa, kapan, dengan catatan apa. Yang membuat dokumen tak bisa menyetujuinya sendiri. Kalau ada yang macet, pusat bisa mengingatkan, atau mengambil alih dengan alasan yang tercatat.",
    ],
    need: "validasi dan approval dari departemen lain atau atasan, supaya kontrol tetap di pusat.",
    Art: ApprovalArtifact,
  },
  {
    id: "bab-5",
    tone: "is-afternoon",
    time: "16:00",
    place: "Gudang Jakarta",
    title: "Angka di rak dan angka di layar harus bertemu",
    body: [
      "Sore hari Wawan menghitung. Ia berjalan di antara rak dengan ponsel di tangan, mengisi jumlah yang benar-benar ada. Hampir semua cocok. Kampas rem depan kurang dua, dan ia menuliskan sebabnya: rusak saat dipasang.",
      "Selisih itu tidak langsung mengubah stok. Ia menunggu persetujuan, supaya angka yang dipakai semua orang besok pagi adalah angka yang sudah disepakati.",
    ],
    need: "form digital dan kartu stock opname.",
    Art: OpnameArtifact,
  },
  {
    id: "bab-6",
    tone: "is-night",
    time: "22:47",
    place: "Jalan tol, km 58",
    title: "Dua menit pertama menentukan segalanya",
    body: [
      "Mesin B 9001 KBL mati di jalur lambat. Gelap, truk penuh muatan, dan Dedi sendirian. Ia tidak mencari-cari nomor di ponsel, tidak mengetik laporan panjang. Ia menekan satu tombol: Mogok.",
      "Layarnya langsung berisi apa yang perlu dilakukan: nyalakan hazard, pasang segitiga pengaman, menjauh dari jalur. Di bawahnya ada nomor pusat dan derek terdekat, cukup satu ketukan. Di meja pusat, peringatan sudah menyala. Kalau sinyal putus, laporan menunggu di ponsel dan terkirim begitu tersambung.",
      "Tengah malam nanti truk itu akan ditarik ke bengkel. Besok pagi, perbaikan daruratnya sudah punya tempat di jadwal.",
    ],
    need: "saat emergensi di jalan, ada kontak dan langkah cepat dari pusat.",
    Art: EmergencyArtifact,
  },
];

function SectionHead({ label, title, lead, light }: { label: string; title: string; lead?: string; light?: boolean }) {
  return (
    <div className={`kb-head ${light ? "is-light" : ""}`}>
      <p className="kb-label">{label}</p>
      <h2 className="kb-h2">{title}</h2>
      {lead && <p className="kb-lead">{lead}</p>}
    </div>
  );
}

export default function LandingPage() {
  const waHref = siteConfig.whatsapp ? `https://wa.me/${siteConfig.whatsapp}` : undefined;

  return (
    <>
      <a className="kb-skip" href="#modul">
        Lompat ke konten
      </a>

      <SiteHeader contact={{ whatsapp: siteConfig.whatsapp, email: siteConfig.email, phone: siteConfig.phone }} />
      <HeroSlider />

      <main>
        {/* ------------------------------------------------------------ pengantar */}
        <section className="kb-section is-white kb-intro" aria-labelledby="h-intro">
          <div className="kb-wrap kb-intro-grid">
            <div>
              <p className="kb-label">Sistem manajemen armada</p>
              <h2 className="kb-h2" id="h-intro">
                KBL
              </h2>
            </div>
            <div>
              <p className="kb-lead" style={{ marginTop: 0 }}>
                Satu tempat untuk mencatat sparepart, menjadwalkan perawatan, menyetujui keputusan, dan menolong pengemudi yang berhenti di jalan. Dirancang untuk perusahaan
                dengan banyak kendaraan dan banyak cabang, dengan kontrol tetap di pusat.
              </p>
              <a className="kb-btn kb-btn-solid" href="#cerita">
                Baca selengkapnya
              </a>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ tiga kartu */}
        <section className="kb-section is-fog kb-tight" aria-label="Tentang KBL">
          <div className="kb-wrap kb-cards3">
            <article className="kb-info">
              <span className="kb-info-ico" aria-hidden="true">
                01
              </span>
              <h3>Tentang KBL</h3>
              <p>KBL lahir dari enam kebutuhan sederhana tentang sparepart, jadwal, persetujuan, dan keselamatan. Semuanya dirangkai menjadi satu aplikasi.</p>
              <a href="#kebutuhan">Lihat kebutuhannya →</a>
            </article>
            <article className="kb-info">
              <span className="kb-info-ico" aria-hidden="true">
                02
              </span>
              <h3>Siapa yang memakai</h3>
              <p>Dari pengemudi di jalan sampai admin di pusat. Tujuh peran, masing-masing dengan layar dan wewenangnya sendiri.</p>
              <a href="#peran">Kenali perannya →</a>
            </article>
            <article className="kb-info">
              <span className="kb-info-ico" aria-hidden="true">
                03
              </span>
              <h3>Prinsip kami</h3>
              <p>Tercatat, terkontrol, tanggap. Tidak ada perubahan tanpa jejak, tidak ada keputusan tanpa penanggung jawab.</p>
              <a href="#keamanan">Lihat kontrolnya →</a>
            </article>
          </div>
        </section>

        {/* ------------------------------------------------------------ fokus kami */}
        <section className="kb-section is-asphalt kb-focus" aria-labelledby="h-fokus">
          <div className="kb-wrap kb-focus-grid">
            <div>
              <p className="kb-label is-light">Fokus kami</p>
              <h2 className="kb-focus-h" id="h-fokus">
                Keputusan kecil di gudang menentukan keselamatan di jalan.
              </h2>
            </div>
            <div>
              <p className="kb-lead is-light" style={{ marginTop: 0 }}>
                Sebuah kampas rem yang tak tercatat, servis yang tertunda tanpa alasan, atau laporan darurat yang tidak sampai ke pusat. Biasanya bukan satu hal besar yang
                membuat armada bermasalah, melainkan banyak hal kecil yang lolos dari catatan. KBL ada untuk menutup celah itu.
              </p>
              <a className="kb-btn kb-btn-marka" href="#modul">
                Kenali modulnya
              </a>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ tantangan & jawaban */}
        <section className="kb-section is-white" aria-labelledby="h-tantangan">
          <div className="kb-wrap">
            <SectionHead label="Yang kami jawab" title="Dari catatan tercecer menjadi satu sumber kebenaran" />
            <div className="kb-twocol">
              <div className="kb-panel">
                <h3>Masalah yang lazim di armada</h3>
                <ul className="kb-checks is-bad">
                  <li>Sparepart keluar dicatat di kartu kertas atau ingatan.</li>
                  <li>Angka di rak berbeda dengan angka di buku, dan tak ada yang tahu sebabnya.</li>
                  <li>Jadwal servis bergeser tanpa penjelasan.</li>
                  <li>Pusat baru tahu setelah masalah membesar.</li>
                  <li>Saat darurat, pengemudi mencari nomor telepon sendiri.</li>
                </ul>
              </div>
              <div className="kb-panel is-dark">
                <h3>Yang dilakukan KBL</h3>
                <ul className="kb-checks is-good">
                  <li>Setiap mutasi punya dokumen, pelaku, dan jam.</li>
                  <li>Selisih opname wajib beralasan dan disetujui.</li>
                  <li>Percepatan dan penundaan wajib beralasan.</li>
                  <li>Antrean persetujuan dan insiden terlihat dari pusat.</li>
                  <li>Langkah cepat dan kontak muncul otomatis di layar pengemudi.</li>
                </ul>
                <Link className="kb-btn kb-btn-marka" href="/login" style={{ marginTop: 20 }}>
                  Masuk ke aplikasi
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ keamanan & kontrol */}
        <section className="kb-section is-fog" id="keamanan" aria-labelledby="h-keamanan">
          <div className="kb-wrap">
            <SectionHead label="Keamanan & kontrol" title="Dapat dipercaya sejak fondasi" lead="Empat jaminan yang menjadi dasar semua modul. Tiga di antaranya sudah berjalan." />
            <div className="kb-cards4">
              {CONTROLS.map((c) => (
                <article key={c.title} className="kb-cred">
                  <span className={`kb-chip ${c.live ? "" : "is-quiet"}`}>{c.live ? "Tersedia" : "Berikutnya"}</span>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ modul */}
        <section className="kb-section is-white" id="modul" aria-labelledby="h-modul">
          <div className="kb-wrap">
            <SectionHead label="Modul" title="Enam kebutuhan, enam modul" lead="Setiap modul menjawab satu kebutuhan awal. Status menunjukkan posisinya di peta jalan." />
            <div className="kb-tiles">
              {MODULES.map((m) => (
                <article key={m.id} id={m.id} className="kb-tile">
                  <div className="kb-tile-art" aria-hidden="true">
                    <m.Art />
                  </div>
                  <div className="kb-tile-body">
                    <div className="kb-tile-meta">
                      <span className="kb-tag">{m.tag}</span>
                      <span className="kb-chip is-quiet">{m.status}</span>
                    </div>
                    <h3>{m.title}</h3>
                    <p>{m.text}</p>
                    <a href={m.chapter}>Lihat ceritanya →</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ angka */}
        <section className="kb-stats" aria-label="Cakupan rancangan">
          <div className="kb-wrap">
            <ul className="kb-stats-row">
              {STATS.map((s) => (
                <li key={s.label}>
                  <b>{s.n}</b>
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
            <p className="kb-stats-note">Angka menggambarkan cakupan rancangan KBL, bukan jumlah pelanggan atau proyek.</p>
          </div>
        </section>

        {/* ------------------------------------------------------------ cerita */}
        <section id="cerita" aria-labelledby="h-cerita">
          <div className="kb-section is-white kb-story-intro">
            <div className="kb-wrap kb-story-head">
              <div className="kb-head">
                <p className="kb-label">Cerita</p>
                <h2 className="kb-h2" id="h-cerita">
                  Sehari bersama B 9001 KBL
                </h2>
                <p className="kb-lead">Satu truk, satu hari, enam kebutuhan. Ceritanya fiktif, kebutuhan di baliknya nyata.</p>
              </div>
              <aside className="kb-dash" aria-label="Contoh data kendaraan dalam cerita">
                <div className="kb-plate" role="img" aria-label="Pelat nomor B 9001 KBL">
                  <b>B 9001 KBL</b>
                  <small>08 · 27</small>
                </div>
                <div className="kb-odo" aria-label="Odometer 84.250 kilometer">
                  {ODOMETER.map((d, i) => (
                    <span key={i}>{d}</span>
                  ))}
                </div>
                <span className="kb-dash-label">kilometer, pagi ini</span>
              </aside>
            </div>
          </div>

          <div className="kb-story-wrap">
            <div className="kb-rail" aria-hidden="true">
              <svg className="kb-rail-truck" viewBox="0 0 26 64" fill="none">
                <rect x="3" y="1" width="20" height="40" rx="3" fill="#f7f8f5" />
                <rect x="3" y="1" width="20" height="6" rx="2" fill="#dfe6e9" />
                <rect x="4" y="43" width="18" height="19" rx="4" fill="#f5b800" />
                <rect x="7" y="46" width="12" height="6" rx="1.5" fill="#14202b" opacity="0.75" />
                <rect x="0" y="8" width="3" height="9" rx="1" fill="#0b141b" />
                <rect x="23" y="8" width="3" height="9" rx="1" fill="#0b141b" />
                <rect x="0" y="22" width="3" height="9" rx="1" fill="#0b141b" />
                <rect x="23" y="22" width="3" height="9" rx="1" fill="#0b141b" />
                <rect x="0" y="48" width="3" height="9" rx="1" fill="#0b141b" />
                <rect x="23" y="48" width="3" height="9" rx="1" fill="#0b141b" />
              </svg>
            </div>
            <div className="kb-story-chapters">
              {CHAPTERS.map((c) => (
                <section key={c.id} className={`kb-chapter ${c.tone}`} aria-labelledby={c.id}>
                  <div className="kb-wrap kb-chapter-grid">
                    <div className="kb-clock">
                      <time dateTime={c.time}>{c.time}</time>
                      <span className="kb-place">{c.place}</span>
                    </div>
                    <div className="kb-story">
                      <h3 id={c.id}>{c.title}</h3>
                      {c.body.map((p) => (
                        <p key={p.slice(0, 24)}>{p}</p>
                      ))}
                      <p className="kb-need">
                        <strong>Kebutuhan:</strong> {c.need}
                      </p>
                      <c.Art />
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ kebutuhan */}
        <section className="kb-section is-white" id="kebutuhan" aria-labelledby="h-kebutuhan">
          <div className="kb-wrap">
            <SectionHead label="Di luar cerita" title="Enam kebutuhan, apa adanya" lead="Di kiri, bunyinya seperti disampaikan sejak awal. Di kanan, jawaban KBL." />
            <ul className="kb-needs">
              {NEEDS.map((n) => (
                <li key={n.quote}>
                  <q>{n.quote}</q>
                  <div>
                    <p>{n.answer}</p>
                    <span className="kb-meta">{n.where}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ peran */}
        <section className="kb-section is-fog" id="peran" aria-labelledby="h-peran">
          <div className="kb-wrap">
            <SectionHead label="Tim pengguna" title="Tujuh peran, satu cerita yang sama" lead="Semua orang dalam cerita tadi punya layar sendiri. Mereka hanya melihat dan melakukan apa yang menjadi bagiannya, dan hanya untuk cabangnya, kecuali pusat." />
            <ul className="kb-roles">
              {ROLES.map((r) => (
                <li key={r.name}>
                  <h3>{r.name}</h3>
                  <p>{r.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ peta jalan */}
        <section className="kb-section is-asphalt" id="peta-jalan" aria-labelledby="h-peta">
          <div className="kb-wrap">
            <SectionHead light label="Peta jalan" title="Baru sampai di km pertama" lead="Cerita di atas adalah tujuan, bukan status hari ini. Urutannya bisa berubah; bila keselamatan jadi prioritas, penanganan darurat dapat dimajukan." />
            <ol className="kb-route">
              <li className="is-done">
                <span className="kb-pin" aria-hidden="true" />
                <div>
                  <h3>
                    Fondasi <span className="kb-chip">Tersedia</span>
                  </h3>
                  <p>
                    Login dengan penguncian akun, pengguna dan hak akses per peran dan cabang, data master (cabang, kendaraan, sparepart, gudang, vendor, kategori alasan),
                    parameter sistem, audit log yang tak bisa diubah. Dapat dipasang di ponsel seperti aplikasi biasa.
                  </p>
                </div>
              </li>
              <li>
                <span className="kb-pin" aria-hidden="true" />
                <div>
                  <h3>
                    Stok dan persetujuan <span className="kb-chip is-quiet">Berikutnya</span>
                  </h3>
                  <p>Mutasi sparepart, kartu stok, stock opname, dan mesin approval berjenjang. Inilah bab 05:45, 13:30, dan 16:00.</p>
                </div>
              </li>
              <li>
                <span className="kb-pin" aria-hidden="true" />
                <div>
                  <h3>
                    Jadwal dan anomali <span className="kb-chip is-quiet">Menyusul</span>
                  </h3>
                  <p>Rencana perawatan, work order, kalender, perubahan jadwal beserta alasannya, dan dashboard pusat. Bab 08:20 dan 11:00.</p>
                </div>
              </li>
              <li>
                <span className="kb-pin" aria-hidden="true" />
                <div>
                  <h3>
                    Darurat di jalan <span className="kb-chip is-quiet">Menyusul</span>
                  </h3>
                  <p>Lapor satu ketukan, langkah cepat, kontak darurat, penanganan insiden oleh pusat, dan antrean offline. Bab 22:47.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ ajakan */}
        <section className="kb-cta" aria-labelledby="h-cta">
          <div className="kb-wrap kb-cta-grid">
            <div>
              <p className="kb-label">Komitmen, ketelitian & ketanggapan</p>
              <h2 className="kb-h2" id="h-cta">
                Percayakan catatan armada Anda pada sistem yang tidak lupa
              </h2>
              <div className="kb-slide-actions">
                <Link className="kb-btn kb-btn-solid" href="/login">
                  Masuk ke KBL
                </Link>
                <InstallButton />
                {waHref && (
                  <a className="kb-btn kb-btn-ghost" href={waHref} target="_blank" rel="noopener noreferrer">
                    Hubungi lewat WhatsApp
                  </a>
                )}
              </div>
            </div>
            <div className="kb-cta-art" aria-hidden="true">
              <IllEmergency />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ FAQ */}
        <section className="kb-section is-white" id="faq" aria-labelledby="h-faq">
          <div className="kb-wrap kb-faq-grid">
            <div className="kb-head">
              <p className="kb-label">Pertanyaan umum</p>
              <h2 className="kb-h2" id="h-faq">
                Yang sering ditanyakan
              </h2>
            </div>
            <div className="kb-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="kb-footer" id="kontak">
        <div className="kb-wrap kb-footer-grid">
          <div>
            <p className="kb-brand is-footer">
              <span className="kb-brand-mark">
                <span>KBL</span>
                <i />
              </span>
            </p>
            <p>Sistem manajemen perawatan dan sparepart armada. {siteConfig.tagline}.</p>
          </div>
          <div>
            <h3>Tautan</h3>
            <ul>
              <li>
                <a href="#modul">Modul</a>
              </li>
              <li>
                <a href="#cerita">Cerita</a>
              </li>
              <li>
                <a href="#peran">Peran</a>
              </li>
              <li>
                <a href="#peta-jalan">Peta jalan</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
            </ul>
          </div>
          <div>
            <h3>Aplikasi</h3>
            <ul>
              <li>
                <Link href="/login">Masuk</Link>
              </li>
              <li>
                <Link href="/forgot-password">Lupa password</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Kontak</h3>
            {hasContact ? (
              <ul>
                {siteConfig.address && <li>{siteConfig.address}</li>}
                {siteConfig.phone && (
                  <li>
                    <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`}>{siteConfig.phone}</a>
                  </li>
                )}
                {siteConfig.email && (
                  <li>
                    <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
                  </li>
                )}
                {waHref && (
                  <li>
                    <a href={waHref} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <p>Akun pengguna dibuat oleh admin sistem di perusahaan Anda. Hubungi admin untuk akses.</p>
            )}
          </div>
        </div>
        <div className="kb-wrap kb-footer-bottom">
          <span>© 2026 KBL. Tokoh dan kejadian dalam cerita adalah fiksi untuk menggambarkan kebutuhan.</span>
          <a href="#beranda">Kembali ke atas ↑</a>
        </div>
      </footer>
    </>
  );
}
