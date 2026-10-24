// Data publik PT Karunia Beton Lestari. Sumber: situs resmi karuniabeton.co.id dan survei di docs/.
// SEMUA nilai di sini harus diverifikasi Karunia Beton Lestari sebelum rilis; dapat ditimpa lewat env.

const env = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const company = {
  brand: "Karunia Beton Lestari",
  legal: "PT Karunia Beton Lestari",
  tagline: "Quality Stone and Readymix Concrete",
  siteUrl: env(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000",
  phone: { label: "(061) 80044515", tel: "+626180044515" },
  mobile: {
    label: env(process.env.NEXT_PUBLIC_CONTACT_PHONE) ?? "+62 822 7692 4600",
    tel: "+6282276924600",
    wa: env(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP)?.replace(/\D/g, "") ?? "6282276924600",
  },
  email: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL) ?? "info@karuniabeton.co.id",
  instagram: { handle: "@karuniabetonlestari", url: "https://www.instagram.com/karuniabetonlestari/" },
  address: {
    street: "Jl. Megawati No. 88",
    area: "Kel. Serbajadi, Kec. Sunggal",
    city: "Kab. Deli Serdang, Sumatera Utara 20351",
  },
};

export const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("PT Karunia Beton Lestari Jl. Megawati 88 Sunggal Deli Serdang");

export function waLink(number: string, text = "Halo Karunia Beton Lestari, saya ingin bertanya tentang batu pecah dan readymix untuk proyek kami.") {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
