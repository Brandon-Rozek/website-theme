if (navigator && navigator.serviceWorker) {
    navigator.serviceWorker.register('/serviceworker.js', {
        scope: '/'
    });

    window.addEventListener("load", function() {
        if (navigator.serviceWorker.controller != null) {
            navigator.serviceWorker.controller.postMessage({"command":"trimCache"});
        }
    });
}

