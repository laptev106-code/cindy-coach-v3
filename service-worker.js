const CACHE_NAME = 'cindy-coach-v3-a057dc9ab4a1-shell';
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./coach_core_v3/coach_core_v3.js", "./coach_core_v3/coach_integration_v3.js", "./coach_core_v3/program_pack_v3.js", "./src/application/coach/coach_application_service_v3.js", "./src/application/program/program_service_v3.js", "./src/application/variety/variety_rotation_engine.js", "./src/application/workout/workout_history_service_v3.js", "./src/composition/bootstrap_v3.js", "./src/domain/exercises/exercise_catalog_v3.js", "./src/domain/history/history_provenance_v3.js", "./src/domain/workout/session_contract_v3.js", "./src/infrastructure/browser/feedback_v3.js", "./src/infrastructure/storage/coach_state_migration_v3.js", "./src/infrastructure/storage/coach_state_repository_v3.js", "./src/infrastructure/storage/local_storage_v3.js", "./src/infrastructure/storage/program_meta_repository_v3.js", "./src/infrastructure/storage/repositories_v3.js", "./src/presentation/components/leaf_components_v3.js", "./src/presentation/navigation/screen_presenter_v3.js", "./src/presentation/navigation/screen_router_v3.js", "./src/presentation/screens/screen_hosts_v3.js"];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (asset) => {
      const req = new Request(asset, { cache: 'reload' });
      const res = await fetch(req);
      if (!res || !res.ok) {
        throw new Error(`Precache failed for ${asset}: ${res ? res.status : 'no response'}`);
      }
      await cache.put(req, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

async function networkFirstWithTimeout(request, timeoutMs, isNavigate) {
  const cache = await caches.open(CACHE_NAME);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  try {
    const fetchPromise = isNavigate
      ? fetch(request.url, controller ? { signal: controller.signal, credentials: 'same-origin' } : { credentials: 'same-origin' })
      : (controller ? fetch(request, { signal: controller.signal }) : fetch(request));
    fetchPromise.catch(() => {});
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        if (controller) controller.abort();
        reject(new Error('network_timeout'));
      }, timeoutMs);
    });
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
      return response;
    }
    if (response && response.status >= 500) {
      const cachedOnError = await cache.match(request, { ignoreSearch: true });
      if (cachedOnError) return cachedOnError;
    }
    return response;
  } catch (_) {
    if (timer) clearTimeout(timer);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (isNavigate) {
      return (
        (await cache.match('./index.html', { ignoreSearch: true })) ||
        (await cache.match('./', { ignoreSearch: true })) ||
        Response.error()
      );
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isNavigate = event.request.mode === 'navigate';
  const timeoutMs = isNavigate ? 2500 : 1800;
  event.respondWith(networkFirstWithTimeout(event.request, timeoutMs, isNavigate));
});
