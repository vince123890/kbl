import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Klien Supabase atas nama pengguna login (RLS berlaku, auth.uid() terisi). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // dipanggil dari Server Component: penyegaran sesi ditangani proxy
        }
      },
    },
  });
}
