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

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#141010",
          borderRadius: cfg.maskable ? 0 : Math.round(cfg.size * 0.22),
        }}
      >
        <div style={{ display: "flex", width: "44%", height: "9%", background: "#ffb400" }} />
      </div>
    ),
    { width: cfg.size, height: cfg.size },
  );
}
