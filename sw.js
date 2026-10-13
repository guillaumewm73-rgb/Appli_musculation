/* Service worker : garde l'appli en cache pour qu'elle s'ouvre sans réseau.
   Stratégie : réponse immédiate depuis le cache, puis mise à jour du cache
   en arrière-plan (la nouvelle version s'affiche à l'ouverture suivante).
   Changer VERSION quand la liste FICHIERS change. */
'use strict';

const VERSION = 'v1';
const CACHE = `suivi-${VERSION}`;

// './' et non './index.html' : certains serveurs redirigent index.html vers '/',
// et Safari refuse une page servie depuis une réponse redirigée.
const FICHIERS = [
  './',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' évite de remplir le cache avec une vieille copie HTTP
  const requetes = FICHIERS.map((f) => new Request(f, { cache: 'reload' }));
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(requetes))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Supprime les caches des versions précédentes
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(
        cles
          .filter((cle) => cle.startsWith('suivi-') && cle !== CACHE)
          .map((cle) => caches.delete(cle))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  const memeOrigine = new URL(requete.url).origin === self.location.origin;
  if (requete.method !== 'GET' || !memeOrigine) return;

  const reseau = telechargerEtCacher(requete);
  event.waitUntil(reseau.catch(() => {})); // hors ligne : on garde la copie en cache
  event.respondWith(lireCache(requete).then((reponse) => reponse || reseau));
});

/** Cherche la requête dans le cache ; pour une page, retombe sur l'accueil. */
async function lireCache(requete) {
  const cache = await caches.open(CACHE);
  const reponse = await cache.match(requete, { ignoreSearch: true });
  if (reponse || requete.mode !== 'navigate') return reponse;
  return cache.match('./');
}

/** Télécharge la dernière version et la range dans le cache. */
async function telechargerEtCacher(requete) {
  const reponse = await fetch(requete);
  if (reponse.ok && !reponse.redirected) {
    try {
      const cache = await caches.open(CACHE);
      await cache.put(requete, reponse.clone());
    } catch (erreur) {
      // Stockage plein : on sert quand même la réponse réseau
      console.warn('Mise en cache impossible :', erreur);
    }
  }
  return reponse;
}
