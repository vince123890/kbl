import { ImageResponse } from "next/og";

export const alt = "KBL — Armada terawat, perjalanan terjaga";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#14202b",
          color: "#f7f8f5",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, letterSpacing: 2 }}>KBL</div>
          <div style={{ display: "flex", height: 8, width: 120, background: "#f5b800" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.02, maxWidth: 980 }}>
            Truk itu berangkat 05.45. Pulangnya ditentukan jauh sebelumnya.
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#aebac3" }}>Sparepart, perawatan, approval, dan bantuan darurat untuk armada.</div>
        </div>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            background: "#f5b800",
            color: "#111",
            border: "5px solid #111",
            borderRadius: 14,
            padding: "8px 28px",
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: 4,
          }}
        >
          B 9001 KBL
        </div>
      </div>
    ),
    size,
  );
}
