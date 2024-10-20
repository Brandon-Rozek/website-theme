let version = 'v1::';
let cacheName = 'website';
let offlinePage = '/offline';
let offlineFundamentals = [offlinePage, '/'];
let maxItems = 100;

self.addEventListener('install', function (event) {
	// Cache offline fundamentals
	event.waitUntil(
    caches.open(version + cacheName).then(function (cache) {
        return cache.addAll(offlineFundamentals);
	}));
});

function trimCache(name, maxItems) {
  caches.open(name).then(function(cache) {
    cache.keys().then(function(keys) {
      // Make sure offlineFundamentals don't get deleted
      possibleDelete = keys.filter(function(key) {
        !offlineFundamentals.includes(key)
      });

      // Keep track of each delete
      deleteInProgress = []
      for (let i = 0; i < keys.length - maxItems; i++) {
        deleteInProgress.push(cache.delete(possibleDelete[i]));
      }

      // Return when everything is resolved
      return Promise.all(deleteInProgress);
    })
  })
}

// Listens for trimCache command which occurs on page load
self.addEventListener('message', event => {
  if (event.data.command == 'trimCache') {
    trimCache(version + cacheName, maxItems);
  }
});

// If the version changes, invalidate the cache
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          // Find all caches that aren't the current version
          .filter(function (key) {
            return !key.includes(version)
          })
          // Delete the cache
          .map(function (key) {
            return caches.delete(key);
          })
        );
      })
  );
});

// Listen for request events
self.addEventListener('fetch', function (event) {
	let request = event.request;

  // Always fetch non-GET requests from the network
  if (request.method !== 'GET') {
    event.respondWith(fetch(request)
      .catch(function () {
        return caches.match(offlinePage);
      })
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
		fetch(request).then(function (response) {
			// If successful, create a copy of the response
      // and save it to the cache
      // Note: Ignore badges
      if (!request.url.includes("/badges")) {
        let cacheCopy = response.clone();
        event.waitUntil(caches.open(version + cacheName).then(function (cache) {
          return cache.put(request, cacheCopy);
        }));
      }
			return response;
		}).catch(function (error) {
      // Otherwise, check the cache.
      return caches.match(request).then(function (response) {
        // Show offline page if cache misses for HTML pages.
        if (isRequestType('text/html')) {
          return response || caches.match(offlinePage);
        }
        return response;
      });
		})
	);
});