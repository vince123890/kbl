// Kontak ditampilkan di landing page HANYA bila diisi lewat variabel lingkungan (tidak ada data karangan).
// Semua bernilai publik, jadi memakai awalan NEXT_PUBLIC_.

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const siteConfig = {
  name: "KBL",
  tagline: "Armada terawat, perjalanan terjaga",
  /** Nomor WhatsApp format internasional tanpa +, mis. 6281234567890 */
  whatsapp: clean(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP)?.replace(/\D/g, ""),
  email: clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  phone: clean(process.env.NEXT_PUBLIC_CONTACT_PHONE),
  address: clean(process.env.NEXT_PUBLIC_CONTACT_ADDRESS),
};

export const hasContact = Boolean(siteConfig.whatsapp || siteConfig.email || siteConfig.phone || siteConfig.address);
