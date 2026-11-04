import { readFile, writeFile } from 'node:fs/promises'

const outputPath = new URL('../dist/firebase-messaging-sw.js', import.meta.url)
const fields = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || '',
}
const complete = Object.values(fields).every(Boolean)
const template = await readFile(outputPath, 'utf8')
await writeFile(outputPath, template.replace('__FIREBASE_CONFIG__', complete ? JSON.stringify(fields) : 'null'))
