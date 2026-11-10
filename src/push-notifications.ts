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
type FcmPayload = {
  notification?: { title?: string; body?: string }
  data?: Record<string, string>
}
type FirebaseMessagingApi = {
  isSupported(): Promise<boolean>
  getMessaging(app: unknown): unknown
  getToken(messaging: unknown, options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }): Promise<string>
  onMessage(messaging: unknown, callback: (payload: FcmPayload) => void): () => void
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

async function saveCurrentDevice(requestPermission: boolean): Promise<void> {
  if (!firebaseReady) throw new Error('تنظیمات Firebase Web Push هنوز در GitHub Actions وارد نشده است.')
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('این مرورگر قابلیت اعلان وب را ندارد.')
  }

  let permission = Notification.permission
  if (permission === 'default' && requestPermission) {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    if (requestPermission) throw new Error('اجازه نمایش اعلان برای این سایت داده نشد.')
    return
  }

  const serviceWorkerUrl = `${import.meta.env.BASE_URL}firebase-messaging-sw.js`
  const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
    scope: import.meta.env.BASE_URL,
  })
  await registration.update().catch(() => undefined)
  const readyRegistration = await navigator.serviceWorker.ready
  const activeRegistration = registration.active ? registration : readyRegistration
  const { messaging, instance } = await getFirebaseMessaging()
  const token = await messaging.getToken(instance, {
    vapidKey,
    serviceWorkerRegistration: activeRegistration,
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

/** Called only from the manager's explicit button click when permission is needed. */
export async function registerOwnerPushDevice(): Promise<void> {
  await saveCurrentDevice(true)
}

/** Re-registers an already-approved device after login, without showing a permission prompt. */
export async function refreshOwnerPushDeviceRegistration(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  await saveCurrentDevice(false)
}

type EnhancedNotificationOptions = NotificationOptions & {
  vibrate: number[]
  renotify: boolean
  timestamp: number
}

async function showOwnerNotification(title: string, body: string, data: Record<string, string> = {}): Promise<void> {
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
  const defaultDestination = new URL('?admin=1', baseUrl).toString()
  const destination = data.url || defaultDestination
  const options = {
    body,
    icon: `${import.meta.env.BASE_URL}icons/salon-icon.svg`,
    badge: `${import.meta.env.BASE_URL}icons/salon-icon.svg`,
    tag: data.tag || `salon-booking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [0, 450, 180, 450, 180, 750],
    timestamp: Date.now(),
    data: { url: destination },
  } as EnhancedNotificationOptions

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, options)
  } catch {
    try { new Notification(title, options) } catch { /* Browser blocked page notifications. */ }
  }
}

export async function listenForOwnerPushMessages(): Promise<() => void> {
  if (!firebaseReady || !('Notification' in window) || !('serviceWorker' in navigator) || Notification.permission !== 'granted') {
    return () => undefined
  }
  try {
    const { messaging, instance } = await getFirebaseMessaging()
    return messaging.onMessage(instance, (payload) => {
      const title = payload.data?.title || payload.notification?.title || 'اعلان جدید شایان'
      const body = payload.data?.body || payload.notification?.body || 'یک رویداد جدید در سامانه ثبت شد.'
      void showOwnerNotification(title, body, payload.data || {})
    })
  } catch {
    return () => undefined
  }
}
