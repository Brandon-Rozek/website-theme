let version = 'v1::';
let cacheName = 'website';
let offlinePage = '/offline';
let offlineFundamentals = [offlinePage, '/'];
let maxItems = 100;


function addFundamentals() {
  return caches.open(version + cacheName)
  .then(cache => cache.addAll(offlineFundamentals))
}

// Cache the page(s) that initiate the service worker
function cacheClients() {
  return clients.matchAll({
      includeUncontrolled: true
  })
  .then(allClients => allClients.map(client => client.url))
  .then(pages => Promise.all([pages, caches.open(cacheName)]))
  .then(([pages, cache]) => cache.addAll(pages))
}

// Remove caches whose name is no longer valid
function clearInvalidatedCaches() {
  return caches.keys()
  .then( keys => {
      return Promise.all(keys
        .filter(key => !key.includes(version))
        .map(key => caches.delete(key))
      );
  });
}

function trimCache(name, maxItems) {
  return caches.open(name)
  .then(cache => Promise.all([cache, cache.keys()]))
  // Make sure offlineFundamentals don't get deleted
  .then(([cache, keys]) => [cache, keys.filter(key => !offlineFundamentals.includes(key))])
  .then(([cache, possibleDelete]) => {
    // Trim cache until we are of the right size
    deleteInProgress = []
    for (let i = 0; i < keys.length - maxItems; i++) {
      // Keep track of each delete
      deleteInProgress.push(cache.delete(possibleDelete[i]));
    }

    // Return when everything is resolved
    return Promise.all(deleteInProgress);
  })
}

self.addEventListener('install', function (event) {
	// Cache offline fundamentals
	event.waitUntil(
    addFundamentals()
    .then(() => cacheClients())
    .then(() => skipWaiting())
  )
});

// Listens for trimCache command which occurs on page load
self.addEventListener('message', event => {
  if (event.data.command == 'trimCache') {
    trimCache(version + cacheName, maxItems);
  }
});

// If the version changes, invalidate the cache
self.addEventListener('activate', function (event) {
  event.waitUntil(
    clearInvalidatedCaches()
    .then(() => clients.claim())
  );
});

if (registration.navigationPreload) {
  addEventListener('activate', event => {
      event.waitUntil(
          registration.navigationPreload.enable()
      );
  });
}

// Listen for request events
self.addEventListener('fetch', function (event) {
	const request = event.request;

  // Always fetch non-GET requests from the network
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request)
      .catch(() => caches.match(offlinePage))
    );
    return;
  }

  let isRequestType = function(name) {
    return request.headers
      .get('Accept')
      .includes(name);
  }

	// Network-first Approach
	event.respondWith(
    // Attepmt to grab the latest copy from the network
    Promise.resolve(event.preloadResponse)
    .then(preloadResponse => preloadResponse || fetch(request))
    .then(response => {
			// If successful, create a copy of the response
      // and save it to the cache
      // Note: Ignore badges
      if (!request.url.includes("/badges")) {
        let cacheCopy = response.clone();
        event.waitUntil(
          caches.open(version + cacheName)
          .then(cache => cache.put(request, cacheCopy))
        );
      }
			return response;
		})
    // Check the cache
    .catch(error =>
      caches.match(request)
      // Show offline page for HTML pages if cache miss
      .then(response => isRequestType('text/html')? response || caches.match(offlinePage) : response)
		)
	);
});