import { ImageResponse } from "next/og";

const SIZES: Record<string, { size: number; maskable: boolean }> = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
};

export async function GET(_req: Request, ctx: RouteContext<"/icons/[name]">) {
  const { name } = await ctx.params;
  const cfg = SIZES[name];
  if (!cfg) return new Response("Not found", { status: 404 });

  // area aman maskable: konten di dalam 80% tengah
  const font = Math.round(cfg.size * (cfg.maskable ? 0.34 : 0.42));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f766e",
          color: "white",
          fontSize: font,
          fontWeight: 800,
          letterSpacing: -2,
          borderRadius: cfg.maskable ? 0 : Math.round(cfg.size * 0.22),
        }}
      >
        KBL
      </div>
    ),
    { width: cfg.size, height: cfg.size },
  );
}
