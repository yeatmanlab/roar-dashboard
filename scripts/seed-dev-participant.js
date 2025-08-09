import axios from 'axios'

function getEnv(name, fallback) {
  return process.env[name] ?? fallback
}

async function signUpOrSignIn({ apiKey, email, password }) {
  const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`
  try {
    const res = await axios.post(signUpUrl, { email, password, returnSecureToken: true })
    return { idToken: res.data.idToken, uid: res.data.localId }
  } catch (err) {
    if (err.response && err.response.data && String(err.response.data.error?.message).includes('EMAIL_EXISTS')) {
      const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`
      const res = await axios.post(signInUrl, { email, password, returnSecureToken: true })
      return { idToken: res.data.idToken, uid: res.data.localId }
    }
    throw err
  }
}

function buildUserDocFields({ email, displayName, role }) {
  return {
    fields: {
      email: { stringValue: email },
      displayName: { stringValue: displayName },
      role: { stringValue: role },
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
      await patchUserDoc({ projectId, idToken, uid, docBody })
    } else {
      throw err
    }
  }
}

async function main() {
  const email = getEnv('E2E_TEST_EMAIL', 'participant.cypress@levante.com')
  const password = getEnv('E2E_TEST_PASSWORD', 'cypress123!')
  const projectId = getEnv('E2E_FIREBASE_PROJECT_ID', 'hs-levante-admin-dev')
  const apiKey = getEnv('E2E_FIREBASE_API_KEY', 'AIzaSyCOzRA9a2sDHtVlX7qnszxrgsRCBLyf5p0')

  try {
    console.log(`(participant) Seeding auth user and Firestore doc in ${projectId}...`)
    const { idToken, uid } = await signUpOrSignIn({ apiKey, email, password })
    const displayName = email.split('@')[0]
    const docBody = buildUserDocFields({ email, displayName, role: 'participant' })
    await upsertUserDoc({ projectId, idToken, uid, docBody })
    console.log(`✅ (participant) Seeded users/${uid}`)
  } catch (err) {
    console.error('(participant) Failed to seed:', err.response?.data || err.message)
    process.exit(1)
  }
}

main()
