/* Service worker KBL.
 * - Aset statis (_next/static, ikon): cache-first.
 * - Navigasi: network-first; bila offline tampilkan /offline.
 * - Halaman terautentikasi dan API TIDAK disimpan di cache (data pengguna tidak boleh bocor antar sesi).
 */
const VERSION = "kbl-v2";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

// Menyimpan halaman offline beserta berkas JS/CSS statisnya agar layar darurat dapat tampil tanpa sinyal.
async function precacheOffline() {
  const cache = await caches.open(STATIC_CACHE);
  const res = await fetch(new Request(OFFLINE_URL, { cache: "reload" }));
  const html = await res.clone().text();
  await cache.put(OFFLINE_URL, res);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) || [])];
  await Promise.all(assets.map((a) => cache.add(a).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOffline().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase dan domain lain tidak disentuh

  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  if (isStatic) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }),
    );
  }
});

// Notifikasi push (Web Push). Muatan JSON: {title, body, url}.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Karunia Beton Lestari", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Karunia Beton Lestari", {
      body: data.body || "",
      icon: "/icons/192",
      badge: "/icons/192",
      data: { url: data.url || "/dashboard" },
      tag: data.url || undefined,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
