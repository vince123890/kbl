import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_AT_COOKIE, sessionExpired } from "@/lib/lockout";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth", "/offline", "/api/jobs"];

function isPublic(pathname: string) {
  if (pathname === "/" || pathname.startsWith("/opengraph-image")) return true; // landing page + gambar OG
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Menyegarkan sesi Supabase, memaksa login, dan menegakkan batas sesi 8 jam. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const { pathname } = request.nextUrl;

  const redirectToLogin = (reason?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = reason ? `?reason=${reason}` : "";
    const res = NextResponse.redirect(url);
    // bawa cookie terbaru (mis. hasil signOut) ke respon redirect
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    return res;
  };

  if (user) {
    const loginAt = Number(request.cookies.get(LOGIN_AT_COOKIE)?.value);
    if (Number.isFinite(loginAt) && loginAt > 0 && sessionExpired(loginAt, Date.now())) {
      await supabase.auth.signOut();
      const res = redirectToLogin("expired");
      res.cookies.delete(LOGIN_AT_COOKIE);
      return res;
    }
    if (!loginAt) {
      response.cookies.set(LOGIN_AT_COOKIE, String(Date.now()), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    }
    if (pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (!isPublic(pathname) && pathname !== "/reset-password") return redirectToLogin();
  if (pathname === "/reset-password") return redirectToLogin("invalid-link");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|js)$).*)"],
};
