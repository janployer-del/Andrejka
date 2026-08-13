/* Andrejka - service worker
   Stranka se bere prednostne ze site, takze nova verze naskoci hned.
   Ostatni soubory jdou hned z cache a na pozadi se obnovi.
   Bez site funguje vsechno z cache. */

var CACHE = "andrejka-v2";
var FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function keepAlive(e, p) {
  try { e.waitUntil(p); } catch (err) { /* event uz je vyrizeny - nevadi */ }
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") { return; }
  if (new URL(req.url).origin !== self.location.origin) { return; }

  var isPage = req.mode === "navigate" || /\.html(\?|$)/.test(req.url);

  if (isPage) {
    /* stranka: nejdriv sit, pri vypadku cache */
    e.respondWith(
      caches.open(CACHE).then(function (c) {
        return fetch(req).then(function (res) {
          if (res && res.ok) { c.put(req, res.clone()); }
          return res;
        }).catch(function () {
          return c.match(req).then(function (hit) {
            return hit || c.match("./index.html") || c.match("./");
          });
        });
      })
    );
    return;
  }

  /* ostatni soubory: hned z cache, novou verzi stahnout na pozadi */
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) { c.put(req, res.clone()); }
          return res;
        }).catch(function () { return hit; });
        if (hit) { keepAlive(e, net); return hit; }
        return net;
      });
    })
  );
});
