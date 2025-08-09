import axios from 'axios'

function getEnv(name, fallback) {
  return process.env[name] ?? fallback
}

async function signInWithPassword({ apiKey, email, password }) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`
  const res = await axios.post(url, {
    email,
    password,
    returnSecureToken: true,
  })
  return { idToken: res.data.idToken, uid: res.data.localId }
}

function buildUserDocFields({ email, displayName, role, adminOrgIds = [] }) {
  return {
    fields: {
      email: { stringValue: email },
      displayName: { stringValue: displayName },
      role: { stringValue: role },
      adminOrgIds: { arrayValue: { values: adminOrgIds.map((id) => ({ stringValue: id })) } },
      createdAt: { timestampValue: new Date().toISOString() },
    },
  }
}

async function createUserDoc({ projectId, idToken, uid, docBody }) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users?documentId=${uid}`
  await axios.post(url, docBody, { headers: { Authorization: `Bearer ${idToken}` } })
}

async function patchUserDoc({ projectId, idToken, uid, docBody }) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`
  await axios.patch(url, docBody, { headers: { Authorization: `Bearer ${idToken}` } })
}

async function upsertUserDoc({ projectId, idToken, uid, docBody }) {
  try {
    await createUserDoc({ projectId, idToken, uid, docBody })
  } catch (err) {
    if (err.response && err.response.status === 409) {
      // Already exists; fall back to patch
      await patchUserDoc({ projectId, idToken, uid, docBody })
    } else {
      throw err
    }
  }
}

async function main() {
  const email = getEnv('E2E_TEST_EMAIL', 'quqa2y1jss@levante.com')
  const password = getEnv('E2E_TEST_PASSWORD', 'xbqamkqc7z')
  const projectId = getEnv('E2E_FIREBASE_PROJECT_ID', 'hs-levante-admin-dev')
  const apiKey = getEnv('E2E_FIREBASE_API_KEY', 'AIzaSyCOzRA9a2sDHtVlX7qnszxrgsRCBLyf5p0')

  try {
    console.log(`Seeding user in ${projectId}...`)
    const { idToken, uid } = await signInWithPassword({ apiKey, email, password })
    const docBody = buildUserDocFields({ email, displayName: 'Cypress Tester', role: 'admin', adminOrgIds: [] })
    await upsertUserDoc({ projectId, idToken, uid, docBody })
    console.log(`✅ Seeded users/${uid}`)
  } catch (err) {
    console.error('Failed to seed user:', err.response?.data || err.message)
    process.exit(1)
  }
}

main()
