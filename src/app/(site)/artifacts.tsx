// Contoh tampilan untuk tiap bab cerita. Ini ilustrasi kebutuhan, bukan data nyata.
import type { ReactNode } from "react";

function Card({ title, label = "Contoh tampilan", children }: { title: string; label?: string; children: ReactNode }) {
  return (
    <figure className="kb-card" aria-label={`${title}. ${label}.`} style={{ marginInline: 0 }}>
      <div className="kb-card-head">
        <span>{title}</span>
        <span>{label}</span>
      </div>
      <div className="kb-card-body">{children}</div>
    </figure>
  );
}

export function StockCardArtifact() {
  return (
    <Card title="Kartu stok · Filter Oli Hino 500">
      <table className="kb-table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Dokumen</th>
            <th className="num">Masuk</th>
            <th className="num">Keluar</th>
            <th className="num">Saldo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>22 Okt</td>
            <td>Penerimaan dari supplier</td>
            <td className="num">20</td>
            <td className="num">–</td>
            <td className="num">14</td>
          </tr>
          <tr>
            <td>24 Okt</td>
            <td>
              Dipakai untuk B 9001 KBL
              <br />
              <span className="kb-meta">oleh Wawan · untuk WO servis 85.000 km</span>
            </td>
            <td className="num">–</td>
            <td className="num">2</td>
            <td className="num">12</td>
          </tr>
        </tbody>
      </table>
      <p style={{ margin: "12px 0 0" }}>
        <span className="kb-chip">Disetujui · stok terpotong</span>
      </p>
    </Card>
  );
}

export function ScheduleArtifact() {
  return (
    <Card title="Jadwal perawatan · B 9001 KBL">
      <h3>Servis 85.000 km</h3>
      <p style={{ margin: 0 }}>
        Odometer 84.250 km · jatuh tempo <b>750 km lagi</b> (± 6 hari)
      </p>
      <div className="kb-bars" aria-hidden="true">
        <div className="kb-bar">
          <span>B 9001 KBL</span>
          <div className="kb-bar-track">
            <div className="kb-bar-fill" style={{ left: "28%", width: "28%" }} />
          </div>
        </div>
        <div className="kb-bar">
          <span>B 9002 KBL</span>
          <div className="kb-bar-track">
            <div className="kb-bar-fill" style={{ left: "57%", width: "28%", background: "#f5b800" }} />
          </div>
        </div>
        <div className="kb-bar">
          <span style={{ color: "#d64532", fontWeight: 600 }}>Darurat</span>
          <div className="kb-bar-track">
            <div className="kb-bar-fill" style={{ left: "0", width: "14%", background: "#d64532" }} />
          </div>
        </div>
      </div>
      <p className="kb-meta" style={{ marginTop: 10 }}>
        Perbaikan darurat menyela antrean dan memberi tahu pusat.
      </p>
    </Card>
  );
}

export function RescheduleArtifact() {
  return (
    <Card title="Perubahan jadwal">
      <div className="kb-bars" aria-hidden="true" style={{ marginTop: 0 }}>
        <div className="kb-bar">
          <span>Semula</span>
          <div className="kb-bar-track">
            <div className="kb-bar-fill is-ghost" style={{ left: "14%", width: "28%" }} />
          </div>
        </div>
        <div className="kb-bar">
          <span>Jadi</span>
          <div className="kb-bar-track">
            <div className="kb-bar-fill is-moved" style={{ left: "57%", width: "28%" }} />
          </div>
        </div>
      </div>
      <p style={{ margin: "14px 0 6px" }}>
        <span className="kb-chip is-warn">Penundaan · +3 hari</span>
      </p>
      <table className="kb-table">
        <tbody>
          <tr>
            <td style={{ width: 90 }} className="kb-meta">
              Alasan
            </td>
            <td>Sparepart belum tersedia</td>
          </tr>
          <tr>
            <td className="kb-meta">Keterangan</td>
            <td>Kampas rem dari pemasok baru sampai Selasa.</td>
          </tr>
          <tr>
            <td className="kb-meta">Status</td>
            <td>Menunggu Kepala Departemen</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

export function ApprovalArtifact() {
  return (
    <Card title="Jejak persetujuan · perubahan jadwal">
      <ol className="kb-steps">
        <li>
          <span className="kb-dot" />
          <span>
            <b>Supervisor Jakarta</b> menyetujui
            <br />
            <span className="kb-meta">“Part memang belum datang.”</span>
          </span>
          <span className="kb-meta">13:12</span>
        </li>
        <li>
          <span className="kb-dot" />
          <span>
            <b>Kepala Departemen</b> menyetujui
          </span>
          <span className="kb-meta">13:41</span>
        </li>
        <li>
          <span className="kb-dot is-wait" />
          <span>
            <b>Pusat</b> memantau
            <br />
            <span className="kb-meta">Ikut menyetujui bila tertunda lebih dari 7 hari.</span>
          </span>
          <span className="kb-chip is-quiet">Opsional</span>
        </li>
      </ol>
      <p className="kb-meta" style={{ margin: "12px 0 0" }}>
        Pembuat dokumen tidak bisa menyetujui dokumennya sendiri.
      </p>
    </Card>
  );
}

export function OpnameArtifact() {
  return (
    <Card title="Stock opname · Gudang Utama Jakarta">
      <table className="kb-table">
        <thead>
          <tr>
            <th>Sparepart</th>
            <th className="num">Sistem</th>
            <th className="num">Fisik</th>
            <th className="num">Selisih</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Filter Oli Hino 500</td>
            <td className="num">12</td>
            <td className="num">12</td>
            <td className="num">0</td>
          </tr>
          <tr>
            <td>
              Kampas Rem Depan
              <br />
              <span className="kb-meta">Alasan: rusak saat dipasang</span>
            </td>
            <td className="num">10</td>
            <td className="num">8</td>
            <td className="num" style={{ color: "#8f2314", fontWeight: 600 }}>
              −2
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ margin: "12px 0 0" }}>
        <span className="kb-chip is-warn">Selisih menunggu persetujuan sebelum stok disesuaikan</span>
      </p>
    </Card>
  );
}

export function EmergencyArtifact() {
  return (
    <Card title="Lapor darurat · layar pengemudi">
      <div className="kb-sos-top">
        <svg className="kb-hazard" viewBox="0 0 48 48" role="img" aria-label="Lampu hazard">
          <path d="M24 4 L46 42 H2 Z" />
          <path d="M24 16 L36 37 H12 Z" fill="#14202b" />
        </svg>
        <span>
          <b>Laporan terkirim · INC-JKT-0007</b>
          <span className="kb-meta">Pusat sedang diberi tahu · 22:47</span>
        </span>
      </div>
      <div className="kb-sos" aria-hidden="true">
        <span className="is-on">Mogok</span>
        <span>Kecelakaan</span>
        <span>Ban</span>
        <span>Medis</span>
      </div>
      <h3 style={{ marginTop: 18 }}>Langkah cepat</h3>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        <li>Nyalakan lampu hazard</li>
        <li>Pasang segitiga pengaman</li>
        <li>Keluar ke area aman, jauh dari jalur</li>
        <li>Tunggu arahan pusat</li>
      </ol>
      <div className="kb-call">
        <b>Control Tower Pusat</b>
        <span className="kb-pill">Telepon</span>
      </div>
      <div className="kb-call">
        <b>Derek terdekat</b>
        <span className="kb-pill">Telepon</span>
      </div>
    </Card>
  );
}
