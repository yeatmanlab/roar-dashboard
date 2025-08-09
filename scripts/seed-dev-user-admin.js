import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function getEnv(name, fallback) {
  return process.env[name] ?? fallback
}

function getCredentials() {
  const inline = process.env.FIREBASE_ADMIN_CREDENTIALS
  if (inline) {
    try {
      return cert(JSON.parse(inline))
    } catch (e) {
      throw new Error('FIREBASE_ADMIN_CREDENTIALS is not valid JSON')
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault()
  }
  return null
}

async function initAdmin(projectId) {
  const creds = getCredentials()
  if (!creds) {
    console.warn('No admin credentials found. Set FIREBASE_ADMIN_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS.')
    return false
  }
  if (!getApps().length) {
    initializeApp({ credential: creds, projectId })
  }
  return true
}

async function upsertUserDoc({ email, displayName, role, adminOrgIds, projectId }) {
  const authed = await initAdmin(projectId)
  if (!authed) return false
  const auth = getAuth()
  const db = getFirestore()

  const user = await auth.getUserByEmail(email)
  const uid = user.uid
  const ref = db.doc(`users/${uid}`)
  await ref.set({ email, displayName, role, adminOrgIds: adminOrgIds ?? [], createdAt: new Date() }, { merge: true })
  return uid
}

async function main() {
  const email = getEnv('E2E_TEST_EMAIL', 'quqa2y1jss@levante.com')
  const projectId = getEnv('E2E_FIREBASE_PROJECT_ID', 'hs-levante-admin-dev')
  try {
    console.log(`(admin) Seeding user in ${projectId}...`)
    const uid = await upsertUserDoc({ email, displayName: 'Cypress Tester', role: 'admin', adminOrgIds: [], projectId })
    if (!uid) {
      console.warn('Admin credentials not provided. Skipping admin seed.')
      process.exit(2)
      return
    }
    console.log(`✅ (admin) Seeded users/${uid}`)
  } catch (err) {
    console.error('(admin) Failed to seed user:', err.message)
    process.exit(1)
  }
}

main()
