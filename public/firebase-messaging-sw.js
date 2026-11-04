// The build injects the public Firebase Web configuration into this file.
// FCM notification payloads are displayed automatically while the app is in the
// background. The server supplies webpush.fcmOptions.link for click navigation.

const firebaseConfig = __FIREBASE_CONFIG__;

if (firebaseConfig && firebaseConfig.apiKey) {
  importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');
  firebase.initializeApp(firebaseConfig);
  firebase.messaging();
}
