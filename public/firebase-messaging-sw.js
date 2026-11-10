// Replace stale push workers immediately so old clients use the latest handlers.
self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

// Open the authenticated manager workspace when a notification is tapped.
self.addEventListener('notificationclick', function (event) {
  const destination = event.notification && event.notification.data && event.notification.data.url;
  if (!destination) return;
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      var destinationUrl = new URL(destination);
      for (var index = 0; index < clientList.length; index += 1) {
        var client = clientList[index];
        var clientUrl = new URL(client.url);
        if (clientUrl.origin !== destinationUrl.origin ||
            !clientUrl.pathname.startsWith('/salon-booking/')) continue;
        if ('focus' in client && 'navigate' in client) {
          return client.navigate(destinationUrl.href).then(function () { return client.focus(); });
        }
      }
      return clients.openWindow(destination);
    })
  );
});

const firebaseConfig = __FIREBASE_CONFIG__;

if (firebaseConfig && firebaseConfig.apiKey) {
  importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function (payload) {
    const data = payload && payload.data ? payload.data : {};
    const title = data.title || (payload.notification && payload.notification.title) || 'نوبت جدید سالن';
    const body = data.body || (payload.notification && payload.notification.body) || 'یک نوبت جدید ثبت شد.';
    const destination = data.url || 'https://pooya-labs.github.io/salon-booking/?admin=1';
    const tag = data.tag || 'salon-booking-background-' + Date.now();

    return self.registration.showNotification(title, {
      body: body,
      icon: 'https://pooya-labs.github.io/salon-booking/icons/salon-icon.svg',
      badge: 'https://pooya-labs.github.io/salon-booking/icons/salon-icon.svg',
      tag: tag,
      renotify: true,
      requireInteraction: true,
      // Leave silent unset so Android uses the browser's configured notification sound.
      vibrate: [0, 450, 180, 450, 180, 750],
      timestamp: Date.now(),
      data: { url: destination }
    });
  });
}
