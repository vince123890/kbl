// Ilustrasi vektor buatan sendiri (tanpa foto stok). Palet: aspal, marka kuning, toska, lampu rem.
const A = "#14202b";
const A2 = "#1d2e3c";
const Y = "#f5b800";
const T = "#0f766e";
const R = "#d64532";
const W = "#f7f8f5";
const F = "#aebac3";

type P = { className?: string };
const svgProps = { viewBox: "0 0 360 280", fill: "none", role: "img" as const, xmlns: "http://www.w3.org/2000/svg" };

export function IllStock({ className }: P) {
  return (
    <svg {...svgProps} className={className} aria-label="Rak gudang dengan kotak sparepart dan label kartu stok">
      <rect x="30" y="40" width="300" height="200" rx="10" fill={A2} />
      {[100, 170].map((y) => (
        <rect key={y} x="30" y={y} width="300" height="8" fill={F} opacity="0.5" />
      ))}
      <rect x="50" y="62" width="70" height="38" rx="4" fill={Y} />
      <rect x="130" y="72" width="54" height="28" rx="4" fill={W} />
      <rect x="194" y="56" width="62" height="44" rx="4" fill={T} />
      <rect x="266" y="76" width="44" height="24" rx="4" fill={F} />
      <rect x="50" y="132" width="44" height="38" rx="4" fill={W} />
      <rect x="104" y="122" width="80" height="48" rx="4" fill={Y} />
      <rect x="194" y="140" width="60" height="30" rx="4" fill={T} />
      <rect x="62" y="196" width="76" height="14" rx="3" fill={F} opacity="0.35" />
      <rect x="205" y="168" width="110" height="82" rx="8" fill={W} transform="rotate(-6 205 168)" />
      <rect x="219" y="184" width="64" height="7" rx="3" fill={A} transform="rotate(-6 219 184)" />
      <rect x="219" y="202" width="82" height="6" rx="3" fill={F} transform="rotate(-6 219 202)" />
      <rect x="219" y="218" width="50" height="6" rx="3" fill={F} transform="rotate(-6 219 218)" />
      <circle cx="294" cy="196" r="12" fill={T} />
      <path d="M288 196l4 4 8-9" stroke={W} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IllOpname({ className }: P) {
  return (
    <svg {...svgProps} className={className} aria-label="Papan catatan membandingkan angka sistem dan hitung fisik">
      <rect x="70" y="26" width="220" height="236" rx="14" fill={W} />
      <rect x="140" y="14" width="80" height="28" rx="8" fill={A} />
      <rect x="92" y="62" width="176" height="8" rx="4" fill={F} />
      <g fontFamily="monospace" fontSize="15" fill={A}>
        <text x="92" y="106">Sistem</text>
        <text x="190" y="106">Fisik</text>
        <text x="130" y="106" opacity="0" />
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(0 ${i * 44})`}>
          <rect x="92" y="118" width="78" height="32" rx="6" fill={A} />
          <rect x="182" y="118" width="86" height="32" rx="6" fill={i === 1 ? R : T} />
          <text x="110" y="141" fontFamily="monospace" fontSize="18" fill={W}>
            {[12, 10, 6][i]}
          </text>
          <text x="200" y="141" fontFamily="monospace" fontSize="18" fill={W}>
            {[12, 8, 6][i]}
          </text>
        </g>
      ))}
      <rect x="92" y="252" width="0" height="0" />
      <circle cx="268" cy="244" r="20" fill={Y} />
      <path d="M259 244l7 7 12-14" stroke={A} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IllSchedule({ className }: P) {
  return (
    <svg {...svgProps} className={className} aria-label="Kalender perawatan dengan kunci inggris">
      <rect x="40" y="40" width="250" height="210" rx="14" fill={W} />
      <rect x="40" y="40" width="250" height="44" rx="14" fill={T} />
      <rect x="40" y="70" width="250" height="14" fill={T} />
      <rect x="82" y="26" width="10" height="28" rx="5" fill={A} />
      <rect x="238" y="26" width="10" height="28" rx="5" fill={A} />
      {Array.from({ length: 20 }).map((_, i) => {
        const x = 58 + (i % 5) * 44;
        const y = 104 + Math.floor(i / 5) * 34;
        const hot = i === 7 || i === 8;
        const red = i === 2;
        return <rect key={i} x={x} y={y} width="34" height="24" rx="5" fill={hot ? Y : red ? R : "#e4eaec"} />;
      })}
      <g transform="translate(236 168) rotate(35)">
        <rect x="0" y="0" width="22" height="120" rx="11" fill={A2} />
        <circle cx="11" cy="8" r="26" fill={A2} />
        <rect x="-3" y="-34" width="28" height="30" fill={W} />
        <circle cx="11" cy="104" r="14" fill={F} />
      </g>
    </svg>
  );
}

export function IllReschedule({ className }: P) {
  return (
    <svg {...svgProps} className={className} aria-label="Jadwal bergeser tiga hari dengan alasan tercatat">
      <rect x="24" y="36" width="312" height="208" rx="14" fill={A2} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={46 + i * 41} y="56" width="1" height="168" fill={F} opacity="0.35" />
      ))}
      <rect x="62" y="80" width="118" height="34" rx="7" stroke={F} strokeWidth="3" strokeDasharray="7 6" />
      <path d="M186 97 C 215 97 215 150 240 150" stroke={Y} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M232 140l12 10-12 10" stroke={Y} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="170" y="134" width="132" height="34" rx="7" fill={Y} />
      <rect x="46" y="188" width="170" height="34" rx="17" fill={W} />
      <circle cx="66" cy="205" r="9" fill={R} />
      <rect x="84" y="198" width="110" height="7" rx="3.5" fill={A} />
      <rect x="84" y="210" width="70" height="6" rx="3" fill={F} />
    </svg>
  );
}

export function IllApproval({ className }: P) {
  return (
    <svg {...svgProps} className={className} aria-label="Dokumen dengan tiga tahap persetujuan berjenjang">
      <rect x="40" y="26" width="170" height="228" rx="12" fill={W} />
      <rect x="60" y="52" width="100" height="8" rx="4" fill={A} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="60" y={78 + i * 20} width={i === 3 ? 70 : 130} height="6" rx="3" fill={F} />
      ))}
      <circle cx="270" cy="70" r="26" fill={T} />
      <path d="M258 70l9 9 16-18" stroke={W} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="270" cy="140" r="26" fill={T} />
      <path d="M258 140l9 9 16-18" stroke={W} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="270" cy="210" r="26" stroke={Y} strokeWidth="6" />
      <path d="M270 98v14M270 168v14" stroke={F} strokeWidth="4" strokeDasharray="4 5" />
      <rect x="86" y="190" width="104" height="44" rx="8" fill={Y} transform="rotate(-8 86 190)" />
      <text x="100" y="222" fontFamily="monospace" fontSize="18" fontWeight="700" fill={A} transform="rotate(-8 100 222)">
        DISETUJUI
      </text>
    </svg>
  );
}

export function IllEmergency({ className }: P) {
  return (
    <svg {...svgProps} className={className} aria-label="Segitiga pengaman dan truk di tepi jalan pada malam hari">
      <rect x="0" y="196" width="360" height="84" fill={A2} />
      <rect x="0" y="236" width="360" height="5" fill={Y} opacity="0.9" />
      <g opacity="0.9">
        <path d="M60 40 L116 168 H4 Z" fill={R} />
        <path d="M60 70 L98 156 H22 Z" fill={A} />
        <path d="M60 94 L84 148 H36 Z" fill={R} />
      </g>
      <g transform="translate(120 112)">
        <rect x="0" y="22" width="150" height="62" rx="6" fill={W} />
        <rect x="150" y="40" width="58" height="44" rx="8" fill={Y} />
        <rect x="160" y="48" width="30" height="16" rx="3" fill={A} />
        <circle cx="34" cy="88" r="14" fill={A} />
        <circle cx="112" cy="88" r="14" fill={A} />
        <circle cx="180" cy="88" r="14" fill={A} />
        <circle cx="34" cy="88" r="6" fill={F} />
        <circle cx="112" cy="88" r="6" fill={F} />
        <circle cx="180" cy="88" r="6" fill={F} />
        <circle cx="210" cy="62" r="9" fill={Y} />
      </g>
      <circle cx="318" cy="40" r="20" fill={Y} opacity="0.9" />
      <circle cx="318" cy="40" r="34" fill={Y} opacity="0.14" />
      <path d="M298 214 q22 -26 44 0" stroke={F} strokeWidth="3" fill="none" opacity="0" />
    </svg>
  );
}
