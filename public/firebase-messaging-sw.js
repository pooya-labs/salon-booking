// Handle clicks for foreground notifications before importing the Firebase SDK.
self.addEventListener('notificationclick', function (event) {
  const destination = event.notification && event.notification.data && event.notification.data.url;
  if (!destination) return;
  event.notification.close();
  event.waitUntil(clients.openWindow(destination));
});

// FCM automatically displays notification payloads while the page is in the
// background. No custom onBackgroundMessage handler is needed (avoids duplicates).
const firebaseConfig = __FIREBASE_CONFIG__;

if (firebaseConfig && firebaseConfig.apiKey) {
  importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');
  firebase.initializeApp(firebaseConfig);
  firebase.messaging();
}
