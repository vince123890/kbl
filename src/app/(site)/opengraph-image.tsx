import { ImageResponse } from "next/og";

export const alt = "PT Karunia Beton Lestari (KBL) — Quality Stone and Readymix Concrete";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#12263a", color: "#fff", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", width: 84, height: 84, alignItems: "center", justifyContent: "center", background: "#fff", color: "#12263a", fontSize: 40, fontWeight: 800, borderBottom: "9px solid #f26a21" }}>KBL</div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700 }}>PT Karunia Beton Lestari</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1.02, maxWidth: 980 }}>Dari batu sampai beton siap cor.</div>
          <div style={{ display: "flex", fontSize: 30, color: "#f26a21", letterSpacing: 4, textTransform: "uppercase" }}>Quality Stone and Readymix Concrete</div>
        </div>
      </div>
    ),
    size,
  );
}
