import { ImageResponse } from "next/og";

export const alt = "PT Karunia Beton Lestari — Quality Stone and Readymix Concrete";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0f172a", color: "#fff", padding: 72 }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, borderBottom: "8px solid #34d399", paddingBottom: 12, alignSelf: "flex-start" }}>PT Karunia Beton Lestari</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1.02, maxWidth: 980 }}>Dari batu sampai beton siap cor.</div>
          <div style={{ display: "flex", fontSize: 30, color: "#34d399", letterSpacing: 4, textTransform: "uppercase" }}>Quality Stone and Readymix Concrete</div>
        </div>
      </div>
    ),
    size,
  );
}
