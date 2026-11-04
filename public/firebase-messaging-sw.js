// The build injects the public Firebase Web configuration into this file.
const firebaseConfig = __FIREBASE_CONFIG__;

if (firebaseConfig && firebaseConfig.apiKey) {
  importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function (payload) {
    const notification = payload.notification || {};
    const title = notification.title || 'نوبت جدید فُرم';
    const options = {
      body: notification.body || 'یک نوبت جدید در سامانه ثبت شد.',
      icon: new URL('icons/salon-icon.svg', self.registration.scope).toString(),
      data: { url: new URL('admin', self.registration.scope).toString() }
    };
    self.registration.showNotification(title, options);
  });
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const destination = event.notification.data && event.notification.data.url;
  if (!destination) return;
  event.waitUntil(clients.openWindow(destination));
});
