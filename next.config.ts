import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Kunjungan ulang ke halaman yang sama dalam 30 detik memakai salinan di peramban (kembali ke daftar terasa instan).
    // Setelah ada perubahan lewat server action, cache otomatis dibuang; LiveRefresh selalu mengambil data baru.
    staleTimes: { dynamic: 30 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // service worker harus selalu diambil ulang agar pembaruan sampai ke pengguna
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
