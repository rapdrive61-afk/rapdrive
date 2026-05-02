/* Rap Drive - Firebase Cloud Messaging Service Worker */
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC17KefrJEms-Be8rmMvnscgDSStxmLYjU",
  authDomain: "rapdrive.firebaseapp.com",
  databaseURL: "https://rapdrive-default-rtdb.firebaseio.com",
  projectId: "rapdrive",
  storageBucket: "rapdrive.firebasestorage.app",
  messagingSenderId: "101750387556",
  appId: "1:101750387556:web:2e3b672142ad4235958071",
  measurementId: "G-SPVVM3NS6X",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || 'Rap Drive';
  const options = {
    body: payload?.notification?.body || payload?.data?.body || '',
    icon: payload?.notification?.icon || payload?.data?.icon || '/rapdrive-icon-192.png',
    badge: payload?.data?.badge || '/rapdrive-badge-72.png',
    tag: payload?.data?.tag || payload?.fcmOptions?.analyticsLabel || 'rapdrive-push',
    renotify: true,
    vibrate: [180, 80, 180],
    data: payload?.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const targetUrl = data.url || '/';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const origin = self.location.origin;
    const finalUrl = new URL(targetUrl, origin).href;
    for (const client of allClients) {
      if (client.url.startsWith(origin) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) return client.navigate(finalUrl);
        return;
      }
    }
    return clients.openWindow(finalUrl);
  })());
});
