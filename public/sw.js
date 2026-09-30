// Service Worker para o PWA do Cenáculo de Crisma
const CACHE_NAME = 'cenaculo-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/santos_padroeiros.jpg',
  '/icon-192.png',
  '/icon-512.png'
];

// Instalação do Service Worker e pré-cache inicial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Alguns assets falharam no pré-cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Estratégia de busca de rede primeiro com fallback para cache
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignora requisições que não sejam GET ou que sejam para o Supabase / Cloudinary (dados sempre vivos)
  if (
    request.method !== 'GET' ||
    request.url.includes('supabase.co') ||
    request.url.includes('cloudinary.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Se a resposta for válida e for do mesmo domínio, atualiza o cache
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Em caso de falha de conexão (offline), busca no cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se for navegação de página HTML e offline, retorna a raiz em cache
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Sem conexão com a internet', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
          });
        });
      })
  );
});
