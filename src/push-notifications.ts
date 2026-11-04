type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

type FirebaseAppApi = {
  getApps(): unknown[]
  getApp(): unknown
  initializeApp(config: FirebaseConfig): unknown
}
type FirebaseMessagingApi = {
  isSupported(): Promise<boolean>
  getMessaging(app: unknown): unknown
  getToken(messaging: unknown, options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }): Promise<string>
  onMessage(messaging: unknown, callback: (payload: { notification?: { title?: string; body?: string } }) => void): () => void
}

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
const firebaseReady = Object.values(firebaseConfig).every(Boolean) && Boolean(vapidKey)
const loadExternalModule = (url: string) =>
  import(/* @vite-ignore */ url) as Promise<Record<string, unknown>>

async function getFirebaseMessaging() {
  if (!firebaseReady) {
    throw new Error('تنظیمات Firebase Web Push هنوز در GitHub Actions وارد نشده است.')
  }
  const appModule = await loadExternalModule('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js') as unknown as FirebaseAppApi
  const messagingModule = await loadExternalModule('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging.js') as unknown as FirebaseMessagingApi
  if (!await messagingModule.isSupported()) {
    throw new Error('این مرورگر از اعلان وب Firebase پشتیبانی نمی‌کند.')
  }
  const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig)
  return { messaging: messagingModule, instance: messagingModule.getMessaging(app) }
}

/** Called only from the manager's explicit button click after login. */
export async function registerOwnerPushDevice(): Promise<void> {
  if (!firebaseReady) throw new Error('تنظیمات Firebase Web Push هنوز در GitHub Actions وارد نشده است.')
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('این مرورگر قابلیت اعلان وب را ندارد.')
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('اجازه نمایش اعلان برای این سایت داده نشد.')
  }

  const { messaging, instance } = await getFirebaseMessaging()
  const registration = await navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}firebase-messaging-sw.js`,
    { scope: import.meta.env.BASE_URL },
  )
  const token = await messaging.getToken(instance, {
    vapidKey,
    serviceWorkerRegistration: registration,
  })
  if (!token) throw new Error('شناسه دستگاه برای اعلان دریافت نشد.')

  const response = await fetch('/api/admin/push-subscriptions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ token, device: navigator.userAgent.slice(0, 80) }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(payload.message || 'ثبت دستگاه برای اعلان انجام نشد.')
  }
}

export async function listenForOwnerPushMessages(): Promise<() => void> {
  if (!firebaseReady || !('Notification' in window) || !('serviceWorker' in navigator) || Notification.permission !== 'granted') return () => undefined
  try {
    const { messaging, instance } = await getFirebaseMessaging()
    return messaging.onMessage(instance, (payload) => {
      const title = payload.notification?.title || 'اعلان جدید شایان'
      const body = payload.notification?.body || 'یک رویداد جدید در سامانه ثبت شد.'
      const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
      const destination = new URL('?admin=1', baseUrl).toString()
      void navigator.serviceWorker.ready.then((registration) => registration.showNotification(title, {
        body,
        icon: `${import.meta.env.BASE_URL}icons/salon-icon.svg`,
        tag: 'salon-booking-foreground',
        data: { url: destination },
      })).catch(() => {
        try { new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icons/salon-icon.svg` }) } catch {}
      })
    })
  } catch {
    return () => undefined
  }
}
